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
// (`ProfilePostsGrid`, `aspect-square`, `sizes="33vw"`) — mas lá o grid é
// edge-to-edge (`-mx-4`, ocupa a tela inteira), então `vw` faz sentido; aqui
// a galeria vive dentro de um card com respiro (`max-w-lg`), então usar
// `vw` faria a miniatura estourar em telas largas (ex.: 30vw numa tela de
// 1920px = 576px, muito maior que o próprio card de 512px). Em vez disso,
// usa *container query* (`cqw`, Tailwind v4 nativo, ver `@container` no
// wrapper abaixo): a miniatura escala com a largura do CARD, não da tela,
// então cresce em telas grandes sem nunca estourar o card, e encolhe em
// telas pequenas sem nunca ficar ilegível — `clamp(mín, ideal, máx)` trava
// as duas pontas. Não trava mais num número fixo de "quantas cabem" — o
// componente mede de verdade (`canScrollLeft`/`canScrollRight`, mesma
// técnica de `FinanceSubNav`) se as miniaturas cabem inteiras na largura
// disponível: cabendo, centraliza sem rolar; não cabendo (poucas fotos
// grandes numa tela estreita, ou muitas fotos), vira slider com setas.
const THUMB_SIZE_CLASS = 'w-[clamp(104px,30cqw,170px)] h-[clamp(104px,30cqw,170px)]'

export function BroadcastPhotoGallery({ photos, heading }: Props) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)
  const fitsWithoutScroll = !canScrollLeft && !canScrollRight

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return

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
  }, [photos.length])

  function scrollByPage(direction: 1 | -1) {
    const el = scrollRef.current
    if (!el) return
    // Anda pela largura de verdade do que está visível (quantas miniaturas
    // cabem ali), não por um número fixo — se a tela mudar de tamanho, o
    // "salto" do slider continua fazendo sentido.
    el.scrollBy({ left: direction * el.clientWidth, behavior: 'smooth' })
  }

  return (
    <div className="space-y-2 @container">
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
          className={`flex gap-2 overflow-x-auto scrollbar-hide snap-x snap-mandatory pb-1 ${fitsWithoutScroll ? 'justify-center' : ''}`}
        >
          {photos.map((photo, i) => (
            <motion.button
              key={`${photo.url}-${i}`}
              type="button"
              onClick={() => setLightboxIndex(i)}
              whileTap={{ scale: 0.96 }}
              className={`relative shrink-0 rounded-xl overflow-hidden snap-start ${THUMB_SIZE_CLASS}`}
            >
              <Image src={photo.url} alt={photo.caption ?? ''} fill className="object-cover" sizes="170px" />
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
