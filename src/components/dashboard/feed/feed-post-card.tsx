import Image from 'next/image'
import Link from 'next/link'
import { PostWithProfile } from '@/types/database'
import type { Locale } from '@/i18n/config'
import { resolveLocalizedText } from '@/lib/i18n/resolve-content-locale'
import { formatRelativeTime, getInitials } from '@/lib/utils'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { PostProjectLink } from '@/components/shared/post-project-link'

interface Props {
  post: PostWithProfile
  visitorLocale: Locale
}

export function FeedPostCard({ post, visitorLocale }: Props) {
  const { text } = resolveLocalizedText(post.content, post.original_locale, post.translations, visitorLocale)

  return (
    <div className={`p-4 rounded-2xl border bg-card space-y-2.5 ${post.highlight ? 'border-l-[3px] border-l-support' : ''}`}>
      <Link href={`/${post.profile.username}`} className="flex items-center gap-2.5 min-w-0">
        <Avatar className="h-8 w-8 shrink-0">
          <AvatarImage src={post.profile.avatar_url ?? ''} alt={post.profile.display_name} />
          <AvatarFallback className="text-xs">{getInitials(post.profile.display_name)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{post.profile.display_name}</p>
          <p className="text-xs text-muted-foreground truncate">@{post.profile.username}</p>
        </div>
      </Link>

      {post.highlight && (
        <PostProjectLink username={post.profile.username} highlight={post.highlight} />
      )}

      <PostMedia post={post} />

      {text && <p className="text-sm whitespace-pre-wrap">{text}</p>}

      {post.published_at && (
        <p className="text-xs text-muted-foreground">{formatRelativeTime(post.published_at)}</p>
      )}
    </div>
  )
}

function PostMedia({ post }: { post: PostWithProfile }) {
  if (!post.media_urls?.length) return null

  if (post.type === 'video') {
    return (
      <div className="relative aspect-video rounded-xl overflow-hidden bg-muted">
        <video src={post.media_urls[0]} controls className="w-full h-full object-cover" />
      </div>
    )
  }

  if (post.type === 'carousel') {
    return (
      <div className="flex gap-2 overflow-x-auto snap-x snap-mandatory scrollbar-hide -mx-1 px-1">
        {post.media_urls.map((url, i) => (
          <div key={url + i} className="relative aspect-video w-[85%] shrink-0 snap-start rounded-xl overflow-hidden bg-muted">
            <Image src={url} alt="" fill className="object-cover" sizes="85vw" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="relative aspect-video rounded-xl overflow-hidden bg-muted">
      <Image src={post.media_urls[0]} alt="" fill className="object-cover" />
    </div>
  )
}
