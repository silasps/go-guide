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
  open: boolean
  onOpenChange: (open: boolean) => void
}

const SWIPE_THRESHOLD = 50

/** Visualizador de post em tela cheia, estilo Instagram: abre no post
 *  clicado e arrasta (touch) ou usa as setas (desktop) pra ver o anterior
 *  /próximo da mesma lista, sem precisar de uma rota de permalink. */
export function PostDetailViewer({ posts, initialIndex, visitorLocale, open, onOpenChange }: Props) {
  const [index, setIndex] = useState(initialIndex)
  const touchStartX = useRef<number | null>(null)

  useEffect(() => {
    if (open) setIndex(initialIndex)
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
        className="fixed inset-0 translate-x-0 translate-y-0 z-50 flex flex-col w-full h-full max-h-full max-w-none rounded-none p-0 gap-0 overflow-y-hidden bg-black/95"
      >
        <DialogTitle className="sr-only">Post</DialogTitle>

        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="absolute top-3 right-3 z-10 text-white p-1.5 bg-black/50 rounded-full"
        >
          <X className="h-5 w-5" />
        </button>

        <div
          className="flex-1 min-h-0 overflow-y-auto flex items-center justify-center py-8 sm:py-12 px-0 sm:px-4"
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          <div key={post.id} className="w-full sm:max-w-md">
            <PostCard post={post} visitorLocale={visitorLocale} />
          </div>
        </div>

        {index > 0 && (
          <button
            type="button"
            onClick={goPrev}
            aria-label="Previous"
            className="hidden sm:flex absolute left-4 top-1/2 -translate-y-1/2 h-9 w-9 items-center justify-center rounded-full bg-white/90 text-black hover:bg-white"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        )}
        {index < posts.length - 1 && (
          <button
            type="button"
            onClick={goNext}
            aria-label="Next"
            className="hidden sm:flex absolute right-4 top-1/2 -translate-y-1/2 h-9 w-9 items-center justify-center rounded-full bg-white/90 text-black hover:bg-white"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        )}
      </DialogContent>
    </Dialog>
  )
}
