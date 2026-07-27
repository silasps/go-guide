'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Copy, Play } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { PostWithProfile } from '@/types/database'
import type { Locale } from '@/i18n/config'
import { resolveLocalizedText } from '@/lib/i18n/resolve-content-locale'
import { PostCard } from '@/components/shared/post-card'

interface Props {
  posts: PostWithProfile[]
  visitorLocale: Locale
}

/** Grade 3 colunas estilo Instagram — prioriza a imagem, sem legenda/ações
 *  visíveis aqui. Clicar abre o post completo (PostCard) num lightbox, sem
 *  precisar de uma rota de permalink dedicada. */
export function ProfilePostsGrid({ posts, visitorLocale }: Props) {
  const [openPost, setOpenPost] = useState<PostWithProfile | null>(null)

  return (
    <>
      <div className="grid grid-cols-3 gap-0.5">
        {posts.map((post) => (
          <button
            key={post.id}
            type="button"
            onClick={() => setOpenPost(post)}
            className="relative aspect-square bg-muted overflow-hidden"
          >
            <GridThumbnail post={post} visitorLocale={visitorLocale} />
            {post.type === 'carousel' && <Copy className="absolute top-1.5 right-1.5 h-4 w-4 text-white drop-shadow" />}
            {post.type === 'video' && <Play className="absolute top-1.5 right-1.5 h-4 w-4 text-white drop-shadow fill-white" />}
          </button>
        ))}
      </div>

      <Dialog open={!!openPost} onOpenChange={(next) => !next && setOpenPost(null)}>
        <DialogContent className="sm:max-w-md p-0 gap-0 overflow-y-auto max-h-[85vh]">
          <DialogTitle className="sr-only">{openPost ? resolveLocalizedText(openPost.content, openPost.original_locale, openPost.translations, visitorLocale).text ?? '' : ''}</DialogTitle>
          {openPost && <PostCard post={openPost} visitorLocale={visitorLocale} />}
        </DialogContent>
      </Dialog>
    </>
  )
}

function GridThumbnail({ post, visitorLocale }: { post: PostWithProfile; visitorLocale: Locale }) {
  if (post.media_urls?.length) {
    return post.type === 'video' ? (
      <video src={post.media_urls[0]} className="h-full w-full object-cover" muted />
    ) : (
      <Image src={post.media_urls[0]} alt="" fill sizes="33vw" className="object-cover" />
    )
  }

  const { text } = resolveLocalizedText(post.content, post.original_locale, post.translations, visitorLocale)
  return (
    <div className="h-full w-full flex items-center justify-center p-2 bg-muted">
      <p className="text-[11px] leading-snug text-center line-clamp-6 text-muted-foreground">{text}</p>
    </div>
  )
}
