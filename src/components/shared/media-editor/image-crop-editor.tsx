'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import Image from 'next/image'
import { ZoomIn, Crop } from 'lucide-react'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import type { MediaAspectRatio } from '@/types/database'
import { ASPECT_RATIO_CLASS, resolveCssFilter, type MediaDraft } from './types'

const ASPECT_OPTIONS: MediaAspectRatio[] = ['original', '1:1', '4:5', '16:9']

interface Props {
  media: MediaDraft
  aspect: MediaAspectRatio
  onAspectChange: (aspect: MediaAspectRatio) => void
  onPositionChange: (position: { x: number; y: number }) => void
  onZoomChange: (zoom: number) => void
}

export function ImageCropEditor({ media, aspect, onAspectChange, onPositionChange, onZoomChange }: Props) {
  const t = useTranslations('MediaEditor')
  const [isDragging, setIsDragging] = useState(false)
  const [showZoom, setShowZoom] = useState(false)

  const dragging = useRef(false)
  const dragStart = useRef({ mouseX: 0, mouseY: 0, posX: 50, posY: 50 })
  const frameRef = useRef<HTMLDivElement>(null)

  const onDragMove = useCallback((clientX: number, clientY: number) => {
    if (!dragging.current || !frameRef.current) return
    const rect = frameRef.current.getBoundingClientRect()
    const dx = ((clientX - dragStart.current.mouseX) / rect.width) * 100
    const dy = ((clientY - dragStart.current.mouseY) / rect.height) * 100
    const x = Math.min(100, Math.max(0, dragStart.current.posX - dx))
    const y = Math.min(100, Math.max(0, dragStart.current.posY - dy))
    onPositionChange({ x, y })
  }, [onPositionChange])

  const onDragEnd = useCallback(() => {
    dragging.current = false
    setIsDragging(false)
  }, [])

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
    setIsDragging(true)
    dragStart.current = { mouseX: clientX, mouseY: clientY, posX: media.position.x, posY: media.position.y }
  }

  return (
    <div className="space-y-3">
      <div
        ref={frameRef}
        className={cn(
          'relative w-full overflow-hidden rounded-lg bg-black select-none',
          ASPECT_RATIO_CLASS[aspect] || 'aspect-[4/5]'
        )}
        style={{ cursor: 'grab', touchAction: 'none' }}
        onMouseDown={(e) => {
          if ((e.target as HTMLElement).closest('button, input')) return
          e.preventDefault()
          startDrag(e.clientX, e.clientY)
        }}
        onTouchStart={(e) => {
          if ((e.target as HTMLElement).closest('button, input')) return
          startDrag(e.touches[0].clientX, e.touches[0].clientY)
        }}
      >
        <Image
          src={media.previewUrl}
          alt=""
          fill
          draggable={false}
          className="object-cover pointer-events-none"
          style={{
            objectPosition: `${media.position.x}% ${media.position.y}%`,
            transform: `scale(${media.zoom})`,
            filter: resolveCssFilter(media) || undefined,
          }}
        />

        {isDragging && (
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute left-1/3 top-0 bottom-0 w-px bg-white/60" />
            <div className="absolute left-2/3 top-0 bottom-0 w-px bg-white/60" />
            <div className="absolute top-1/3 left-0 right-0 h-px bg-white/60" />
            <div className="absolute top-2/3 left-0 right-0 h-px bg-white/60" />
          </div>
        )}

        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setShowZoom((v) => !v) }}
          className="absolute bottom-3 left-3 bg-black/60 text-white rounded-full p-2 backdrop-blur-sm"
          aria-label={t('zoom')}
        >
          <ZoomIn className="h-4 w-4" />
        </button>

        {showZoom && (
          <div
            className="absolute bottom-3 left-14 right-3 bg-black/60 rounded-full px-3 py-2 backdrop-blur-sm"
            style={{ touchAction: 'manipulation' }}
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
          >
            <input
              type="range"
              min={1}
              max={3}
              step={0.01}
              value={media.zoom}
              onChange={(e) => onZoomChange(Number(e.target.value))}
              className="w-full accent-white"
            />
          </div>
        )}
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger className="mx-auto flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground">
          <Crop className="h-3.5 w-3.5" />
          {t(`aspect_${aspect.replace(':', '_')}` as 'aspect_original')}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center">
          {ASPECT_OPTIONS.map((option) => (
            <DropdownMenuItem key={option} onClick={() => onAspectChange(option)}>
              {t(`aspect_${option.replace(':', '_')}` as 'aspect_original')}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
