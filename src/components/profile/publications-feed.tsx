import Image from 'next/image'
import { Post } from '@/types/database'
import type { Locale } from '@/i18n/config'
import { resolveLocalizedText } from '@/lib/i18n/resolve-content-locale'
import { formatRelativeTime } from '@/lib/utils'
import { PostProjectLink } from '@/components/shared/post-project-link'

interface Props {
  posts: (Post & { highlight?: { title: string; slug: string | null; cover_url: string | null } | null })[]
  username: string
  visitorLocale: Locale
}

export function PublicationsFeed({ posts, username, visitorLocale }: Props) {
  return (
    <div className="space-y-3">
      <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Publicações</h2>
      <div className="space-y-4">
        {posts.map((post) => {
          const { text } = resolveLocalizedText(post.content, post.original_locale, post.translations, visitorLocale)
          return (
            <div key={post.id} className="p-4 rounded-2xl border bg-card space-y-2.5">
              {post.highlight && (
                <PostProjectLink username={username} highlight={post.highlight} />
              )}

              {post.media_urls?.[0] && (
                <div className="relative aspect-video rounded-xl overflow-hidden bg-muted">
                  <Image src={post.media_urls[0]} alt="" fill className="object-cover" />
                </div>
              )}

              {text && <p className="text-sm whitespace-pre-wrap">{text}</p>}

              {post.published_at && (
                <p className="text-xs text-muted-foreground">{formatRelativeTime(post.published_at)}</p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
