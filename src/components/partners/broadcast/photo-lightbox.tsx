'use client'

import { useEffect } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import type { PeriodPhoto } from './photo-gallery'

interface Props {
  photos: PeriodPhoto[]
  index: number
  onIndexChange: (index: number) => void
  open: boolean
  onOpenChange: (open: boolean) => void
}

// Visualizador de imagem em modal — v1 era um Dialog fullscreen com fundo
// preto cobrindo a tela (usuário: "sensação de estar saindo do sistema").
// v2 trocou pro card de modal padrão do design system, mas prendia a foto
// numa moldura preta de altura fixa (`h-[60vh]`) com `object-contain` — pra
// fotos em formato retrato/story, isso sobrava como faixas pretas enormes
// nas laterais dentro do próprio card claro, que o usuário viu como "bugado"
// (a moldura fixa também empurrava o botão de fechar padrão pra uma posição
// estranha por causa do padding extra). v3: sem moldura nem altura fixa — a
// imagem usa `<img>` puro (não `next/image`, que exige width/height
// conhecidos de antemão; aqui o post não guarda dimensão, então deixar o
// próprio navegador dimensionar pelo tamanho real do arquivo, só limitado
// por `max-h`/`max-w`, é o jeito certo de não adivinhar aspect ratio) —
// o card cresce/encolhe junto com a foto, sem barra preta nenhuma. Botão de
// fechar volta a ser o padrão do `DialogContent` (ghost, ícone escuro) —
// visível de novo porque o fundo agora é claro (`bg-popover`), não preto.
export function PhotoLightbox({ photos, index, onIndexChange, open, onOpenChange }: Props) {
  const t = useTranslations('PartnerUpdate')
  const photo = photos[index]

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowRight') onIndexChange((index + 1) % photos.length)
      if (e.key === 'ArrowLeft') onIndexChange((index - 1 + photos.length) % photos.length)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, index, photos.length, onIndexChange])

  if (!photo) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton className="max-w-xl w-[calc(100%-2rem)] p-4 gap-3 sm:max-w-xl">
        <DialogTitle className="sr-only">{t('photosHeading')}</DialogTitle>

        <div className="relative flex items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element -- dimensão real da foto não é conhecida de antemão (posts não guardam width/height), então deixar o navegador dimensionar naturalmente (limitado por max-h/max-w) evita tanto esticar quanto barras de letterbox dentro de uma caixa de altura fixa adivinhada. */}
          <img
            src={photo.url}
            alt={photo.caption ?? ''}
            className="max-w-full max-h-[70vh] w-auto h-auto object-contain rounded-lg mx-auto block"
          />

          {photos.length > 1 && (
            <>
              <button
                type="button"
                aria-label={t('lightboxPrev')}
                onClick={() => onIndexChange((index - 1 + photos.length) % photos.length)}
                className="absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8 flex items-center justify-center rounded-full bg-background/90 text-foreground ring-1 ring-border hover:bg-muted"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                aria-label={t('lightboxNext')}
                onClick={() => onIndexChange((index + 1) % photos.length)}
                className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 flex items-center justify-center rounded-full bg-background/90 text-foreground ring-1 ring-border hover:bg-muted"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </>
          )}
        </div>

        {photo.caption && <p className="text-sm text-muted-foreground text-center">{photo.caption}</p>}
      </DialogContent>
    </Dialog>
  )
}
