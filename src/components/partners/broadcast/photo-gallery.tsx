'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { PhotoLightbox } from './photo-lightbox'

export interface PeriodPhoto {
  url: string
  caption: string | null
}

interface Props {
  photos: PeriodPhoto[]
  heading: string
}

// Mesmo espírito quadrado do grid de posts do perfil público
// (`ProfilePostsGrid`, `aspect-square`), num tamanho um pouco maior (pedido
// do usuário depois de ver ao vivo) — 104px ainda cabe 3 lado a lado sem
// cortar/rolar nem no menor celular comum (iPhone SE, ~343px de área útil
// dentro do card: 3×104 + 2×8 = 328px).
const THUMB_SIZE = 104
const GAP = 8
const MAX_VISIBLE = 3

// Galeria "Fotos do período" — puxada automaticamente dos posts que o
// próprio missionário já publicou (nunca upload manual pra este relatório).
// Miniaturas pequenas e quadradas, igual ao grid do perfil — nunca uma foto
// grande de destaque (uma versão anterior fazia isso só com 1 foto, mas o
// usuário achou melhor manter o mesmo tamanho sempre, centralizado). Até 3
// fotos cabem centralizadas sem precisar rolar; com mais de 3, vira slider
// com setas (mesmo padrão de scroll+affordance de `FinanceSubNav`) — a
// "janela" mostra 3 por vez, as setas andam de 3 em 3.
export function BroadcastPhotoGallery({ photos, heading }: Props) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)
  const hasOverflow = photos.length > MAX_VISIBLE

  useEffect(() => {
    const el = scrollRef.current
    if (!el || !hasOverflow) return

    function updateScrollState() {
      if (!el) return
      setCanScrollLeft(el.scrollLeft > 4)
      setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4)
    }

    updateScrollState()
    el.addEventListener('scroll', updateScrollState, { passive: true })
    const observer = new ResizeObserver(updateScrollState)
    observer.observe(el)
    return () => {
      el.removeEventListener('scroll', updateScrollState)
      observer.disconnect()
    }
  }, [hasOverflow])

  function scrollByPage(direction: 1 | -1) {
    scrollRef.current?.scrollBy({ left: direction * (THUMB_SIZE + GAP) * MAX_VISIBLE, behavior: 'smooth' })
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1">{heading}</p>

      <div className="relative">
        {canScrollLeft && (
          <button
            type="button"
            aria-label="Fotos anteriores"
            onClick={() => scrollByPage(-1)}
            className="absolute -left-3 top-1/2 -translate-y-1/2 z-10 h-7 w-7 flex items-center justify-center rounded-full bg-background border shadow-sm hover:bg-muted"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        )}

        <div
          ref={scrollRef}
          className={`flex gap-2 overflow-x-auto scrollbar-hide snap-x snap-mandatory pb-1 ${hasOverflow ? '' : 'justify-center'}`}
        >
          {photos.map((photo, i) => (
            <motion.button
              key={`${photo.url}-${i}`}
              type="button"
              onClick={() => setLightboxIndex(i)}
              whileTap={{ scale: 0.96 }}
              className="relative shrink-0 h-[104px] w-[104px] rounded-xl overflow-hidden snap-start"
            >
              <Image src={photo.url} alt={photo.caption ?? ''} fill className="object-cover" sizes="104px" />
            </motion.button>
          ))}
        </div>

        {canScrollRight && (
          <button
            type="button"
            aria-label="Mais fotos"
            onClick={() => scrollByPage(1)}
            className="absolute -right-3 top-1/2 -translate-y-1/2 z-10 h-7 w-7 flex items-center justify-center rounded-full bg-background border shadow-sm hover:bg-muted"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        )}
      </div>

      {lightboxIndex !== null && (
        <PhotoLightbox
          photos={photos}
          index={lightboxIndex}
          onIndexChange={setLightboxIndex}
          open={lightboxIndex !== null}
          onOpenChange={(open) => !open && setLightboxIndex(null)}
        />
      )}
    </div>
  )
}
