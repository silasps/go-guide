'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
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
   *  notificação) — só no post inicial, não persiste ao arrastar pros outros. */
  initialCommentsOpen?: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
}

const SWIPE_THRESHOLD = 50

/** Visualizador de post em tela cheia, estilo Instagram: abre no post
 *  clicado e arrasta (touch) ou usa as setas (desktop) pra ver o anterior
 *  /próximo da mesma lista, sem precisar de uma rota de permalink. */
export function PostDetailViewer({ posts, initialIndex, visitorLocale, canEdit = false, initialCommentsOpen = false, open, onOpenChange }: Props) {
  const [index, setIndex] = useState(initialIndex)
  const touchStartX = useRef<number | null>(null)

  useEffect(() => {
    if (!open) return
    const id = setTimeout(() => setIndex(initialIndex), 0)
    return () => clearTimeout(id)
  }, [open, initialIndex])

  function goNext() { setIndex((i) => Math.min(posts.length - 1, i + 1)) }
  function goPrev() { setIndex((i) => Math.max(0, i - 1)) }

  function onTouchStart(e: React.TouchEvent) { touchStartX.current = e.touches[0].clientX }
  function onTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null) return
    const delta = e.changedTouches[0].clientX - touchStartX.current
    if (delta < -SWIPE_THRESHOLD) goNext()
    else if (delta > SWIPE_THRESHOLD) goPrev()
    touchStartX.current = null
  }

  const post = posts[index]
  if (!post) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="w-full max-w-md sm:max-w-lg max-h-[85vh] p-0 gap-0 overflow-y-auto overflow-x-hidden rounded-2xl bg-transparent ring-0"
      >
        <DialogTitle className="sr-only">Post</DialogTitle>

        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="absolute top-2 right-2 z-10 h-7 w-7 flex items-center justify-center rounded-full bg-background/90 text-foreground ring-1 ring-border hover:bg-muted"
        >
          <X className="h-4 w-4" />
        </button>

        <div key={post.id} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
          <PostCard
            post={post}
            visitorLocale={visitorLocale}
            canEdit={canEdit}
            autoOpenComments={initialCommentsOpen && index === initialIndex}
          />
        </div>

        {index > 0 && (
          <button
            type="button"
            onClick={goPrev}
            aria-label="Previous"
            className="hidden sm:flex absolute left-2 top-1/2 -translate-y-1/2 z-10 h-8 w-8 items-center justify-center rounded-full bg-background/90 ring-1 ring-border text-foreground hover:bg-muted"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        )}
        {index < posts.length - 1 && (
          <button
            type="button"
            onClick={goNext}
            aria-label="Next"
            className="hidden sm:flex absolute right-2 top-1/2 -translate-y-1/2 z-10 h-8 w-8 items-center justify-center rounded-full bg-background/90 ring-1 ring-border text-foreground hover:bg-muted"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        )}
      </DialogContent>
    </Dialog>
  )
}
