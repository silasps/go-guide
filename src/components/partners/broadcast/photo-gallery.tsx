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
export function BroadcastPhotoGallery({ photos, heading }: Props) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1">{heading}</p>
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
