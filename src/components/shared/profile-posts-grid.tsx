'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Copy, Play } from 'lucide-react'
import { PostWithProfile } from '@/types/database'
import type { Locale } from '@/i18n/config'
import { resolveLocalizedText } from '@/lib/i18n/resolve-content-locale'
import { PostDetailViewer } from '@/components/shared/post-detail-viewer'

interface Props {
  posts: PostWithProfile[]
  visitorLocale: Locale
  canEdit?: boolean
  /** Vem do link da notificação de comentário (?post=&comments=1) — abre
   *  esse post direto, com os comentários já abertos, sem precisar clicar. */
  deepLinkPostId?: string
  deepLinkComments?: boolean
}

/** Grade 3 colunas quadrada, de ponta a ponta (cancela o padding da página),
 *  igual ao grid do Instagram. Clicar abre o visualizador em tela cheia
 *  (PostDetailViewer), que deixa arrastar pro post anterior/próximo. */
export function ProfilePostsGrid({ posts, visitorLocale, canEdit = false, deepLinkPostId, deepLinkComments = false }: Props) {
  const [openIndex, setOpenIndex] = useState<number | null>(() => {
    if (!deepLinkPostId) return null
    const i = posts.findIndex((p) => p.id === deepLinkPostId)
    return i === -1 ? null : i
  })

  return (
    <>
      <div className="grid grid-cols-3 gap-0.5 -mx-4">
        {posts.map((post, i) => (
          <button
            key={post.id}
            type="button"
            onClick={() => setOpenIndex(i)}
            className="relative aspect-square bg-muted overflow-hidden"
          >
            <GridThumbnail post={post} visitorLocale={visitorLocale} />
            {post.type === 'carousel' && <Copy className="absolute top-1.5 right-1.5 h-4 w-4 text-white drop-shadow" />}
            {post.type === 'video' && <Play className="absolute top-1.5 right-1.5 h-4 w-4 text-white drop-shadow fill-white" />}
          </button>
        ))}
      </div>

      <PostDetailViewer
        posts={posts}
        initialIndex={openIndex ?? 0}
        visitorLocale={visitorLocale}
        canEdit={canEdit}
        initialCommentsOpen={deepLinkComments}
        open={openIndex !== null}
        onOpenChange={(next) => !next && setOpenIndex(null)}
      />
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
    // Sem foto, o post ainda precisa "ser uma imagem" na grade — igual ao
    // Instagram, onde todo item da grade tem uma miniatura de verdade,
    // nunca texto cru sobre cinza. Fundo na cor do perfil (accent_color) +
    // gradiente escuro sutil garante contraste do texto branco em cima,
    // independente do tom da cor escolhida.
    <div className="relative h-full w-full flex items-center justify-center p-4 text-center" style={{ backgroundColor: post.profile.accent_color || '#34390c' }}>
      <div className="absolute inset-0 bg-gradient-to-br from-black/10 via-transparent to-black/30" />
      <p className="relative text-[11px] leading-snug line-clamp-6 text-white font-medium">{text}</p>
    </div>
  )
}
