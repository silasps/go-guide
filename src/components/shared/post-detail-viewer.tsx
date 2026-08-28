'use client'

import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { PostWithProfile } from '@/types/database'
import type { Locale } from '@/i18n/config'
import { PostCard } from './post-card'

interface Props {
  posts: PostWithProfile[]
  initialIndex: number
  visitorLocale: Locale
  canEdit?: boolean
  /** Abre com os comentários já expandidos (link vindo do sino de
   *  notificação) — só no post inicial, não persiste ao rolar pros outros. */
  initialCommentsOpen?: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** Visualizador de post em tela cheia, estilo Instagram: abre no post
 *  clicado dentro de uma lista vertical com scroll-snap — rolar pra baixo
 *  mostra o próximo post da mesma lista, rolar pra cima mostra o anterior,
 *  sem precisar de uma rota de permalink por post (pedido do usuário,
 *  substituindo a navegação anterior por seta/arrastar horizontal — ver
 *  Changelog). Cada post ocupa a altura inteira do modal (`snap-start`); se
 *  o conteúdo for mais alto que cabe, rola só dentro daquele post
 *  (encadeamento de scroll nativo do navegador: ao chegar no fim do post
 *  atual, o mesmo gesto passa a mover a lista externa pro próximo — não
 *  precisa de nenhum JS extra pra isso). */
export function PostDetailViewer({ posts, initialIndex, visitorLocale, canEdit = false, initialCommentsOpen = false, open, onOpenChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const slotRefs = useRef<(HTMLDivElement | null)[]>([])
  const [activeIndex, setActiveIndex] = useState(initialIndex)

  // Ao abrir (ou trocar de post inicial, ex.: link direto de outro post),
  // pula direto pro slot certo sem rolar visivelmente por cima dos outros.
  useEffect(() => {
    if (!open) return
    const id = setTimeout(() => {
      setActiveIndex(initialIndex)
      slotRefs.current[initialIndex]?.scrollIntoView({ block: 'start' })
    }, 0)
    return () => clearTimeout(id)
  }, [open, initialIndex])

  // Rastreia qual post está visível durante a rolagem — só pra saber qual é
  // "o atual" (autoOpenComments não deve reaparecer nos vizinhos); a
  // navegação em si já é rolagem nativa do navegador, não depende disso.
  useEffect(() => {
    const container = containerRef.current
    if (!open || !container) return
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.find((e) => e.isIntersecting)
        if (!visible) return
        const idx = slotRefs.current.indexOf(visible.target as HTMLDivElement)
        if (idx !== -1) setActiveIndex(idx)
      },
      { root: container, threshold: 0.5 },
    )
    slotRefs.current.forEach((el) => el && observer.observe(el))
    return () => observer.disconnect()
  }, [open, posts])

  if (posts.length === 0) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="inset-0 sm:inset-auto sm:top-1/2 sm:left-1/2 translate-x-0 translate-y-0 sm:-translate-x-1/2 sm:-translate-y-1/2 w-full h-full sm:h-auto max-w-none sm:max-w-lg max-h-full sm:max-h-[85vh] p-0 gap-0 overflow-hidden rounded-none sm:rounded-2xl bg-card sm:bg-transparent ring-0"
      >
        <DialogTitle className="sr-only">Post</DialogTitle>

        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="absolute top-2 right-2 z-10 h-7 w-7 flex items-center justify-center rounded-full bg-background/90 text-foreground ring-1 ring-border hover:bg-muted"
        >
          <X className="h-4 w-4" />
        </button>

        <div ref={containerRef} className="h-full overflow-y-auto snap-y snap-proximity scrollbar-hide">
          {posts.map((post, i) => (
            <div
              key={post.id}
              ref={(el) => { slotRefs.current[i] = el }}
              className="snap-start"
            >
              <PostCard
                post={post}
                visitorLocale={visitorLocale}
                canEdit={canEdit}
                autoOpenComments={initialCommentsOpen && i === initialIndex && activeIndex === i}
                inDetailModal
              />
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
