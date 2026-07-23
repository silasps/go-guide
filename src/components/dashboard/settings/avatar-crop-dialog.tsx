'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface Props {
  file: File | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onApply: (file: File) => void
}

const VIEWPORT = 280
const OUTPUT = 512
const MAX_ZOOM = 3

// Editor de posicionamento estilo Instagram: arrasta pra reposicionar e
// usa o slider pra dar zoom. O corte final só é gerado (canvas -> File)
// quando o usuário confirma em "Usar foto" — nada é enviado ao Storage
// aqui, isso continua acontecendo só no botão Salvar do ProfileForm.
export function AvatarCropDialog({ file, open, onOpenChange, onApply }: Props) {
  const t = useTranslations('ProfileForm')
  const [naturalSize, setNaturalSize] = useState({ w: 0, h: 0 })
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const dragRef = useRef<{ startX: number; startY: number; origin: { x: number; y: number } } | null>(null)

  const imgUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file])

  useEffect(() => {
    return () => {
      if (imgUrl) URL.revokeObjectURL(imgUrl)
    }
  }, [imgUrl])

  useEffect(() => {
    if (!imgUrl) return
    const img = new Image()
    img.onload = () => {
      setNaturalSize({ w: img.naturalWidth, h: img.naturalHeight })
      setZoom(1)
      setOffset({ x: 0, y: 0 })
    }
    img.src = imgUrl
  }, [imgUrl])

  if (!naturalSize.w || !naturalSize.h) {
    return null
  }

  const baseScale = Math.max(VIEWPORT / naturalSize.w, VIEWPORT / naturalSize.h)
  const scale = baseScale * zoom
  const dispW = naturalSize.w * scale
  const dispH = naturalSize.h * scale
  const centeredLeft = (VIEWPORT - dispW) / 2
  const centeredTop = (VIEWPORT - dispH) / 2

  function clamp(offsetValue: { x: number; y: number }, dispWValue: number, dispHValue: number) {
    const left = (VIEWPORT - dispWValue) / 2
    const top = (VIEWPORT - dispHValue) / 2
    const minX = VIEWPORT - dispWValue - left
    const maxX = -left
    const minY = VIEWPORT - dispHValue - top
    const maxY = -top
    return {
      x: Math.min(maxX, Math.max(minX, offsetValue.x)),
      y: Math.min(maxY, Math.max(minY, offsetValue.y)),
    }
  }

  const clampedOffset = clamp(offset, dispW, dispH)
  const left = centeredLeft + clampedOffset.x
  const top = centeredTop + clampedOffset.y

  function handlePointerDown(e: React.PointerEvent) {
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = { startX: e.clientX, startY: e.clientY, origin: clampedOffset }
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!dragRef.current) return
    const dx = e.clientX - dragRef.current.startX
    const dy = e.clientY - dragRef.current.startY
    setOffset(clamp({ x: dragRef.current.origin.x + dx, y: dragRef.current.origin.y + dy }, dispW, dispH))
  }

  function handlePointerUp() {
    dragRef.current = null
  }

  function handleZoomChange(value: number) {
    const newDispW = naturalSize.w * baseScale * value
    const newDispH = naturalSize.h * baseScale * value
    setZoom(value)
    setOffset(clamp(clampedOffset, newDispW, newDispH))
  }

  function handleApply() {
    if (!imgUrl) return
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = OUTPUT
      canvas.height = OUTPUT
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      const sourceSize = VIEWPORT / scale
      const sourceX = -left / scale
      const sourceY = -top / scale
      ctx.drawImage(img, sourceX, sourceY, sourceSize, sourceSize, 0, 0, OUTPUT, OUTPUT)
      canvas.toBlob((blob) => {
        if (!blob) return
        onApply(new File([blob], 'avatar.webp', { type: 'image/webp' }))
      }, 'image/webp', 0.9)
    }
    img.src = imgUrl
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="w-auto max-w-none sm:max-w-none p-4 gap-4">
        <DialogTitle className="text-center">{t('adjustPhoto')}</DialogTitle>

        <div
          className="relative mx-auto overflow-hidden rounded-full bg-muted touch-none select-none cursor-move ring-1 ring-foreground/10"
          style={{ width: VIEWPORT, height: VIEWPORT }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          {imgUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imgUrl}
              alt=""
              draggable={false}
              className="absolute max-w-none pointer-events-none"
              style={{ width: dispW, height: dispH, left, top }}
            />
          )}
        </div>

        <div className="flex items-center gap-3 px-2">
          <span className="text-xs text-muted-foreground shrink-0">{t('zoom')}</span>
          <input
            type="range"
            min={1}
            max={MAX_ZOOM}
            step={0.01}
            value={zoom}
            onChange={(e) => handleZoomChange(Number(e.target.value))}
            className="w-full accent-primary"
          />
        </div>

        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
            {t('cancel')}
          </Button>
          <Button className="flex-1" onClick={handleApply}>
            {t('usePhoto')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
