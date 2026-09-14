'use client'

import { useState } from 'react'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { PhotoLightbox } from './photo-lightbox'

export interface PeriodPhoto {
  url: string
  caption: string | null
}

interface Props {
  photos: PeriodPhoto[]
  heading: string
}

// Galeria "Fotos do período" — puxada automaticamente dos posts que o
// próprio missionário já publicou (nunca upload manual pra este relatório):
// tira horizontal com scroll-snap, toca pra abrir em tela cheia. Sempre
// renderizada só quando há pelo menos 1 foto real (guard fica no caller,
// page.tsx, mesmo padrão de `categoryItems.length > 0 &&`).
//
// Com só 1 foto, a tira de miniaturas de 112px parecia incompleta — uma
// label "Fotos do período" grande em cima de uma única miniatura pequena
// (crítica do usuário revendo a página como visitante). Com 1 foto só, vira
// destaque grande (like uma capa), sem a tira horizontal.
export function BroadcastPhotoGallery({ photos, heading }: Props) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1">{heading}</p>
      {photos.length === 1 ? (
        <motion.button
          type="button"
          onClick={() => setLightboxIndex(0)}
          whileTap={{ scale: 0.98 }}
          className="relative block w-full h-64 rounded-2xl overflow-hidden"
        >
          <Image src={photos[0].url} alt={photos[0].caption ?? ''} fill className="object-cover" sizes="(max-width: 640px) 100vw, 32rem" />
        </motion.button>
      ) : (
        <div className="flex gap-2 overflow-x-auto snap-x snap-mandatory scrollbar-hide pb-1 -mx-4 px-4">
          {photos.map((photo, i) => (
            <motion.button
              key={`${photo.url}-${i}`}
              type="button"
              onClick={() => setLightboxIndex(i)}
              whileTap={{ scale: 0.96 }}
              className="relative shrink-0 h-28 w-28 rounded-xl overflow-hidden snap-start"
            >
              <Image src={photo.url} alt={photo.caption ?? ''} fill className="object-cover" sizes="112px" />
            </motion.button>
          ))}
        </div>
      )}

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
