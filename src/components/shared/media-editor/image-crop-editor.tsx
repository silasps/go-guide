'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import Image from 'next/image'
import { Plus, Minus, Crop } from 'lucide-react'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import type { MediaAspectRatio } from '@/types/database'
import { ASPECT_RATIOS, averageColor } from '@/lib/media/bake-image'
import { ASPECT_RATIO_CLASS, resolveCssFilter, type MediaDraft } from './types'

const ASPECT_OPTIONS: MediaAspectRatio[] = ['original', '1:1', '4:5', '16:9']

interface Props {
  media: MediaDraft
  aspect: MediaAspectRatio
  onAspectChange: (aspect: MediaAspectRatio) => void
  onPositionChange: (position: { x: number; y: number }) => void
  onZoomChange: (zoom: number) => void
  /** Esconde o seletor de proporção — usado quando o formato é fixo pelo
   *  layout (ex: capa de perfil, sempre 21:9), sem escolha do usuário. */
  showAspectPicker?: boolean
  /** Quadro circular (avatar) em vez de cantos arredondados — os botões de
   *  zoom saem de dentro do quadro (ficariam cortados nos cantos do círculo
   *  inscrito) e viram uma fileira centralizada logo abaixo. */
  round?: boolean
}

function touchDistance(touches: { clientX: number; clientY: number }[] | { [i: number]: { clientX: number; clientY: number } }) {
  const dx = touches[0].clientX - touches[1].clientX
  const dy = touches[0].clientY - touches[1].clientY
  return Math.hypot(dx, dy)
}

const ZOOM_STEP = 0.1
const WHEEL_STEP = 0.08

export function ImageCropEditor({ media, aspect, onAspectChange, onPositionChange, onZoomChange, showAspectPicker = true, round = false }: Props) {
  const t = useTranslations('MediaEditor')
  const [isDragging, setIsDragging] = useState(false)
  // Proporção natural da imagem + cor média — carregadas uma vez, usadas pro
  // teto de zoom (scaleRatio abaixo) e pra cor de fundo da sobra, igual ao
  // que bakeImage vai gerar de fato ao salvar.
  const [imgInfo, setImgInfo] = useState<{ ratio: number; bgColor: string } | null>(null)

  const dragging = useRef(false)
  const dragStart = useRef({ mouseX: 0, mouseY: 0, posX: 50, posY: 50 })
  const pinch = useRef<{ startDist: number; startZoom: number } | null>(null)
  const frameRef = useRef<HTMLDivElement>(null)

  const targetRatio = ASPECT_RATIOS[aspect] ?? imgInfo?.ratio
  // Zoom em que a sobra (letterbox do object-fit:contain) acaba de
  // desaparecer e a imagem passa a cobrir o quadro inteiro — a partir daí
  // o zoom começa a recortar a própria foto. Ver bake-image.ts (mesma
  // fórmula, pra o resultado salvo bater com o preview em qualquer zoom).
  const scaleRatio = imgInfo && targetRatio ? Math.max(imgInfo.ratio / targetRatio, targetRatio / imgInfo.ratio) : 1
  const maxZoom = scaleRatio * 3

  function handleImageLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    const img = e.currentTarget
    setImgInfo({ ratio: img.naturalWidth / img.naturalHeight, bgColor: averageColor(img) })
  }

  const onDragMove = useCallback((clientX: number, clientY: number) => {
    if (!dragging.current || !frameRef.current) return
    const rect = frameRef.current.getBoundingClientRect()
    const dx = ((clientX - dragStart.current.mouseX) / rect.width) * 100
    const dy = ((clientY - dragStart.current.mouseY) / rect.height) * 100
    // position é um deslocamento livre nos dois eixos (não mais limitado à
    // "sobra" do object-fit:contain) — a imagem segue o cursor 1:1, em
    // qualquer direção, em qualquer zoom.
    const x = Math.min(100, Math.max(0, dragStart.current.posX + dx))
    const y = Math.min(100, Math.max(0, dragStart.current.posY + dy))
    onPositionChange({ x, y })
  }, [onPositionChange])

  const onDragEnd = useCallback(() => {
    dragging.current = false
    pinch.current = null
    setIsDragging(false)
  }, [])

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => onDragMove(e.clientX, e.clientY)
    const onTouchMove = (e: TouchEvent) => {
      // Só intercepta o toque quando o usuário está de fato arrastando/dando
      // pinça dentro do editor — fora disso, deixa o gesto passar pra rolagem
      // normal da página (senão a tela trava e não dá pra chegar no botão
      // de salvar mais abaixo).
      if (e.touches.length === 2 && pinch.current) {
        e.preventDefault()
        const ratio = touchDistance(e.touches) / pinch.current.startDist
        onZoomChange(Math.min(maxZoom, Math.max(1, pinch.current.startZoom * ratio)))
        return
      }
      if (dragging.current && e.touches.length === 1) {
        e.preventDefault()
        onDragMove(e.touches[0].clientX, e.touches[0].clientY)
      }
    }
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
  }, [onDragMove, onDragEnd, onZoomChange, maxZoom])

  // Zoom por scroll do mouse (desktop) — listener nativo em vez de onWheel
  // no JSX pra poder chamar preventDefault() sem o aviso de passive listener.
  useEffect(() => {
    const el = frameRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const delta = e.deltaY > 0 ? -WHEEL_STEP : WHEEL_STEP
      onZoomChange(Math.min(maxZoom, Math.max(1, media.zoom + delta)))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [maxZoom, media.zoom, onZoomChange])

  function startDrag(clientX: number, clientY: number) {
    dragging.current = true
    setIsDragging(true)
    dragStart.current = { mouseX: clientX, mouseY: clientY, posX: media.position.x, posY: media.position.y }
  }

  const zoomButtons = (
    <>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onZoomChange(Math.min(maxZoom, media.zoom + ZOOM_STEP)) }}
        disabled={media.zoom >= maxZoom}
        className="h-8 w-8 rounded-full bg-black/60 text-white flex items-center justify-center backdrop-blur-sm disabled:opacity-40"
        aria-label={t('zoomIn')}
      >
        <Plus className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onZoomChange(Math.max(1, media.zoom - ZOOM_STEP)) }}
        disabled={media.zoom <= 1}
        className="h-8 w-8 rounded-full bg-black/60 text-white flex items-center justify-center backdrop-blur-sm disabled:opacity-40"
        aria-label={t('zoomOut')}
      >
        <Minus className="h-4 w-4" />
      </button>
    </>
  )

  return (
    <div className="space-y-3">
      <div
        ref={frameRef}
        className={cn(
          'relative w-full overflow-hidden select-none',
          round ? 'rounded-full' : 'rounded-lg',
          ASPECT_RATIO_CLASS[aspect] || 'aspect-[4/5]'
        )}
        style={{ cursor: isDragging ? 'grabbing' : 'grab', touchAction: 'none', backgroundColor: imgInfo?.bgColor ?? '#000' }}
        onMouseDown={(e) => {
          if ((e.target as HTMLElement).closest('button, input')) return
          e.preventDefault()
          startDrag(e.clientX, e.clientY)
        }}
        onTouchStart={(e) => {
          if ((e.target as HTMLElement).closest('button, input')) return
          if (e.touches.length === 2) {
            pinch.current = { startDist: touchDistance(e.touches), startZoom: media.zoom }
            return
          }
          startDrag(e.touches[0].clientX, e.touches[0].clientY)
        }}
      >
        <Image
          src={media.previewUrl}
          alt=""
          fill
          draggable={false}
          onLoad={handleImageLoad}
          className="pointer-events-none object-contain"
          style={{
            // object-position fixo (o pan é feito via translate abaixo, livre
            // nos dois eixos) + transform:scale a partir do centro do quadro
            // — mesma matemática de bakeImage.ts (translate depois de scale,
            // deslocamento em pixels fixos do quadro, não afetado pela
            // escala), então o zoom cresce contínuo e o arrastar funciona em
            // qualquer direção, em qualquer zoom, batendo com o resultado
            // salvo.
            objectPosition: '50% 50%',
            transform: `translate(${media.position.x - 50}%, ${media.position.y - 50}%) scale(${media.zoom})`,
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

        {/* Botões de zoom — mouse/desktop. No touch o zoom principal é por
            pinça (2 dedos) direto na imagem; os botões continuam disponíveis
            como alternativa, sem precisar de um slider fino pra arrastar.
            Num quadro circular os cantos ficam fora do círculo visível, por
            isso essa versão overlay só é usada no quadro retangular. */}
        {!round && (
          <div
            className="absolute bottom-3 left-3 flex flex-col gap-1.5"
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
          >
            {zoomButtons}
          </div>
        )}
      </div>

      {round && (
        <div className="flex items-center justify-center gap-3">
          {zoomButtons}
        </div>
      )}

      {showAspectPicker && (
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
      )}
    </div>
  )
}
