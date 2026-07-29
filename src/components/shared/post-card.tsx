'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Heart, MessageCircle, Share2, Tag as TagIcon, MoreHorizontal, Pencil, Archive, Trash2 } from 'lucide-react'
import { PostTagWithProfile, PostWithProfile } from '@/types/database'
import type { Locale } from '@/i18n/config'
import { resolveLocalizedText } from '@/lib/i18n/resolve-content-locale'
import { formatRelativeTime, getInitials, cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { PostProjectLink } from '@/components/shared/post-project-link'
import { PostCommentsSheet } from '@/components/shared/post-comments-sheet'
import { toggleLike } from '@/app/dashboard/publicacoes/social-actions'

const ASPECT_CLASS: Record<string, string> = {
  original: '',
  '1:1': 'aspect-square',
  '4:5': 'aspect-[4/5]',
  '16:9': 'aspect-video',
}

interface Props {
  post: PostWithProfile
  visitorLocale: Locale
  canEdit?: boolean
}

export function PostCard({ post, visitorLocale, canEdit = false }: Props) {
  const t = useTranslations('Feed')
  const router = useRouter()
  const { text } = resolveLocalizedText(post.content, post.original_locale, post.translations, visitorLocale)

  const [liked, setLiked] = useState(post.viewer_has_liked)
  const [likeCount, setLikeCount] = useState(post.like_count)
  const [expanded, setExpanded] = useState(false)
  const [showTags, setShowTags] = useState(false)
  const [commentsOpen, setCommentsOpen] = useState(false)
  const [commentCount, setCommentCount] = useState(post.comment_count)
  const [activeSlide, setActiveSlide] = useState(0)
  const [showLikeBurst, setShowLikeBurst] = useState(false)
  const [removed, setRemoved] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  async function like() {
    if (liked) return
    setLiked(true)
    setLikeCount((c) => c + 1)
    try {
      await toggleLike(post.id)
    } catch {
      setLiked(false)
      setLikeCount((c) => c - 1)
      toast.error(t('likeError'))
    }
  }

  async function handleLikeToggle() {
    const nextLiked = !liked
    setLiked(nextLiked)
    setLikeCount((c) => c + (nextLiked ? 1 : -1))
    try {
      await toggleLike(post.id)
    } catch {
      setLiked(!nextLiked)
      setLikeCount((c) => c + (nextLiked ? -1 : 1))
      toast.error(t('likeError'))
    }
  }

  function handleDoubleClick() {
    setShowLikeBurst(true)
    setTimeout(() => setShowLikeBurst(false), 700)
    like()
  }

  async function handleShare() {
    const url = `${window.location.origin}/${post.profile.username}`
    if (navigator.share) {
      try { await navigator.share({ title: post.profile.display_name, url }) } catch { /* usuário cancelou */ }
      return
    }
    await navigator.clipboard.writeText(url)
    toast.success(t('linkCopied'))
  }

  async function handleArchive() {
    const supabase = createClient()
    const { error } = await supabase.from('posts').update({ is_draft: true, published_at: null }).eq('id', post.id)
    if (error) { toast.error(t('postActionError')); return }
    toast.success(t('postArchived'))
    setRemoved(true)
  }

  async function handleDelete() {
    if (!confirm(t('deleteConfirm'))) return
    const supabase = createClient()
    const { error } = await supabase.from('posts').delete().eq('id', post.id)
    if (error) { toast.error(t('postActionError')); return }
    toast.success(t('postDeleted'))
    setRemoved(true)
  }

  function handleScroll() {
    const el = scrollRef.current
    if (!el || el.clientWidth === 0) return
    setActiveSlide(Math.round(el.scrollLeft / el.clientWidth))
  }

  if (removed) return null

  const needsClamp = (text?.length ?? 0) > 140

  return (
    <div className={cn('rounded-2xl border bg-card overflow-hidden', post.highlight && 'border-l-[3px] border-l-support')}>
      <div className="p-4 pb-2 flex items-start gap-2.5">
        <Link href={`/${post.profile.username}`} className="flex items-center gap-2.5 min-w-0 flex-1">
          <Avatar className="h-8 w-8 shrink-0">
            <AvatarImage src={post.profile.avatar_url ?? ''} alt={post.profile.display_name} />
            <AvatarFallback className="text-xs">{getInitials(post.profile.display_name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate">{post.profile.display_name}</p>
            <p className="text-xs text-muted-foreground truncate">
              @{post.profile.username}
              {post.location ? ` · ${post.location}` : ''}
            </p>
          </div>
          {post.published_at && <p className="text-xs text-muted-foreground shrink-0">{formatRelativeTime(post.published_at)}</p>}
        </Link>

        {canEdit && (
          <DropdownMenu>
            <DropdownMenuTrigger aria-label={t('postActions')} className="text-muted-foreground hover:text-foreground p-1 -mr-1 -mt-1">
              <MoreHorizontal className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => router.push('/dashboard/publicacoes')} className="gap-2">
                <Pencil className="h-3.5 w-3.5" />
                {t('editPost')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleArchive} className="gap-2">
                <Archive className="h-3.5 w-3.5" />
                {t('archivePost')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleDelete} className="gap-2 text-destructive">
                <Trash2 className="h-3.5 w-3.5" />
                {t('deletePost')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {post.highlight && (
        <div className="px-4 pb-2">
          <PostProjectLink username={post.profile.username} highlight={post.highlight} />
        </div>
      )}

      <div onDoubleClick={handleDoubleClick} className="relative">
        <PostMedia
          post={post}
          scrollRef={scrollRef}
          onScroll={handleScroll}
          activeSlide={activeSlide}
          showTags={showTags}
          onToggleTags={() => setShowTags((v) => !v)}
        />
        {showLikeBurst && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <Heart className="h-20 w-20 text-white fill-white drop-shadow-lg animate-in zoom-in-50 fade-in-0 duration-300" />
          </div>
        )}
      </div>

      <div className="p-4 pt-3 space-y-1.5">
        <div className="flex items-center gap-4">
          <button type="button" onClick={handleLikeToggle} className="flex items-center gap-1.5 text-sm" aria-label={t('like')}>
            <Heart className={cn('h-5 w-5', liked ? 'fill-destructive text-destructive' : 'text-foreground')} />
            {likeCount > 0 && <span>{likeCount}</span>}
          </button>
          <button type="button" onClick={() => setCommentsOpen(true)} className="flex items-center gap-1.5 text-sm" aria-label={t('comments')}>
            <MessageCircle className="h-5 w-5" />
            {commentCount > 0 && <span>{commentCount}</span>}
          </button>
          <button type="button" onClick={handleShare} className="flex items-center gap-1.5 text-sm" aria-label={t('share')}>
            <Share2 className="h-5 w-5" />
          </button>
        </div>

        {text && (
          <div>
            <p className={cn('text-sm whitespace-pre-wrap', !expanded && needsClamp && 'line-clamp-2')}>{text}</p>
            {needsClamp && (
              <button type="button" onClick={() => setExpanded((v) => !v)} className="text-xs text-muted-foreground font-medium mt-0.5">
                {expanded ? t('seeLess') : t('seeMore')}
              </button>
            )}
          </div>
        )}
      </div>

      <PostCommentsSheet
        open={commentsOpen}
        onOpenChange={setCommentsOpen}
        postId={post.id}
        onCommentAdded={() => setCommentCount((c) => c + 1)}
      />
    </div>
  )
}

function PostMedia({
  post, scrollRef, onScroll, activeSlide, showTags, onToggleTags,
}: {
  post: PostWithProfile
  scrollRef: React.RefObject<HTMLDivElement | null>
  onScroll: () => void
  activeSlide: number
  showTags: boolean
  onToggleTags: () => void
}) {
  if (!post.media_urls?.length) return null
  const aspectClass = ASPECT_CLASS[post.media_aspect_ratio] || 'aspect-[4/5]'

  if (post.type === 'video') {
    return (
      <div className={cn('relative bg-muted', aspectClass)}>
        <video src={post.media_urls[0]} controls className="w-full h-full object-cover" />
      </div>
    )
  }

  if (post.type === 'carousel') {
    return (
      <div className="relative">
        <div ref={scrollRef} onScroll={onScroll} className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide">
          {post.media_urls.map((url, i) => (
            <div key={url + i} className={cn('relative w-full shrink-0 snap-start bg-muted', aspectClass)}>
              <Image src={url} alt="" fill className="object-cover" sizes="100vw" />
              {showTags && <TagPins tags={post.tags.filter((tag) => tag.media_index === i)} />}
            </div>
          ))}
        </div>
        <div className="absolute top-2 left-1/2 -translate-x-1/2 flex gap-1">
          {post.media_urls.map((_, i) => (
            <span key={i} className={cn('h-1.5 w-1.5 rounded-full', i === activeSlide ? 'bg-white' : 'bg-white/40')} />
          ))}
        </div>
        {post.tags.length > 0 && <TagToggleButton onClick={onToggleTags} />}
      </div>
    )
  }

  return (
    <div className={cn('relative bg-muted', aspectClass)}>
      <Image src={post.media_urls[0]} alt="" fill className="object-cover" />
      {showTags && <TagPins tags={post.tags.filter((tag) => tag.media_index === 0)} />}
      {post.tags.length > 0 && <TagToggleButton onClick={onToggleTags} />}
    </div>
  )
}

function TagToggleButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="absolute bottom-2 left-2 bg-black/50 text-white rounded-full p-1.5">
      <TagIcon className="h-3.5 w-3.5" />
    </button>
  )
}

function TagPins({ tags }: { tags: PostTagWithProfile[] }) {
  return (
    <>
      {tags.map((tag) => (
        <Link
          key={tag.id}
          href={`/${tag.profile.username}`}
          style={{ left: `${tag.position_x}%`, top: `${tag.position_y}%` }}
          className="absolute -translate-x-1/2 -translate-y-1/2 bg-black/70 text-white text-xs rounded-full px-2 py-0.5 whitespace-nowrap"
        >
          {tag.profile.display_name}
        </Link>
      ))}
    </>
  )
}
