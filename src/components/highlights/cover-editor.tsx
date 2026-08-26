'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import Image from 'next/image'
import { compressImage, getMediaType } from '@/lib/media/compress'
import { ImagePlus, Move } from 'lucide-react'

export function parsePosition(pos: string): { x: number; y: number } {
  const [x, y] = pos.replace(/%/g, '').split(' ').map(Number)
  return { x: isNaN(x) ? 50 : x, y: isNaN(y) ? 50 : y }
}

export function uniqueFileName(ext: string) {
  return `${crypto.randomUUID()}.${ext}`
}

interface Props {
  initialUrl: string
  initialPosition: { x: number; y: number }
  initialMediaType?: 'image' | 'video'
  onChange: (file: File | null, previewUrl: string, position: { x: number; y: number }, mediaType: 'image' | 'video') => void
}

/** Upload + drag-to-reposition da capa (só pra imagem — vídeo é sempre
 *  object-cover, sem reposicionamento). Não faz upload sozinho — só
 *  notifica o pai via onChange, que faz o upload no momento de salvar
 *  (imagem vai pro Supabase Storage, vídeo vai pra Bunny Stream). */
export function CoverEditor({ initialUrl, initialPosition, initialMediaType = 'image', onChange }: Props) {
  const [preview, setPreview] = useState(initialUrl)
  const [position, setPosition] = useState(initialPosition)
  const [mediaType, setMediaType] = useState<'image' | 'video'>(initialMediaType)

  const dragging = useRef(false)
  const dragStart = useRef({ mouseX: 0, mouseY: 0, posX: 50, posY: 50 })
  const previewRef = useRef<HTMLDivElement>(null)

  const onDragMove = useCallback((clientX: number, clientY: number) => {
    if (!dragging.current || !previewRef.current) return
    const rect = previewRef.current.getBoundingClientRect()
    const dx = ((clientX - dragStart.current.mouseX) / rect.width) * 100
    const dy = ((clientY - dragStart.current.mouseY) / rect.height) * 100
    const x = Math.min(100, Math.max(0, dragStart.current.posX - dx))
    const y = Math.min(100, Math.max(0, dragStart.current.posY - dy))
    setPosition({ x, y })
    onChange(null, preview, { x, y }, 'image')
  }, [onChange, preview])

  const onDragEnd = useCallback(() => { dragging.current = false }, [])

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => onDragMove(e.clientX, e.clientY)
    const onTouchMove = (e: TouchEvent) => { e.preventDefault(); onDragMove(e.touches[0].clientX, e.touches[0].clientY) }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onDragEnd)
    window.addEventListener('touchmove', onTouchMove, { passive: false })
    window.addEventListener('touchend', onDragEnd)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onDragEnd)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('touchend', onDragEnd)
    }
  }, [onDragMove, onDragEnd])

  function startDrag(clientX: number, clientY: number) {
    dragging.current = true
    dragStart.current = { mouseX: clientX, mouseY: clientY, posX: position.x, posY: position.y }
  }

  async function handleCoverSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const type = getMediaType(file)
    if (type === 'unknown') return
    const processed = type === 'image' ? await compressImage(file) : file
    const url = URL.createObjectURL(processed)
    setPreview(url)
    setMediaType(type)
    setPosition({ x: 50, y: 50 })
    onChange(processed, url, { x: 50, y: 50 }, type)
  }

  return (
    <div className="space-y-2">
      <div
        ref={previewRef}
        className="relative h-48 rounded-xl bg-muted overflow-hidden border border-dashed select-none"
        style={{ cursor: preview && mediaType === 'image' ? 'grab' : 'default' }}
        onMouseDown={preview && mediaType === 'image' ? (e) => { e.preventDefault(); startDrag(e.clientX, e.clientY) } : undefined}
        onTouchStart={preview && mediaType === 'image' ? (e) => startDrag(e.touches[0].clientX, e.touches[0].clientY) : undefined}
      >
        {preview ? (
          <>
            {mediaType === 'video' ? (
              <video src={preview} muted loop autoPlay playsInline className="absolute inset-0 w-full h-full object-cover pointer-events-none" />
            ) : (
              <>
                <Image
                  src={preview}
                  alt="capa"
                  fill
                  draggable={false}
                  className="object-cover pointer-events-none"
                  style={{ objectPosition: `${position.x}% ${position.y}%` }}
                />
                <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                  <div className="bg-black/50 text-white text-xs px-2.5 py-1.5 rounded-full flex items-center gap-1.5 backdrop-blur-sm">
                    <Move className="h-3.5 w-3.5" />
                    Arraste para reposicionar
                  </div>
                </div>
              </>
            )}
            <label className="absolute bottom-2 right-2 cursor-pointer">
              <div className="bg-black/60 text-white text-xs px-2 py-1 rounded-lg hover:bg-black/80 transition-colors">
                Trocar
              </div>
              <input type="file" accept="image/*,video/*" className="hidden" onChange={handleCoverSelect} />
            </label>
          </>
        ) : (
          <label className="absolute inset-0 flex flex-col items-center justify-center gap-2 cursor-pointer text-muted-foreground hover:text-foreground transition-colors">
            <ImagePlus className="h-7 w-7" />
            <span className="text-sm">Clique para adicionar capa (foto ou vídeo)</span>
            <input type="file" accept="image/*,video/*" className="hidden" onChange={handleCoverSelect} />
          </label>
        )}
      </div>
    </div>
  )
}
