'use client'

import { useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Heart, Globe, MessageCircle, Share2, Tag as TagIcon, MoreHorizontal, Pencil, Archive, Trash2 } from 'lucide-react'
import { PostTagWithProfile, PostWithProfile } from '@/types/database'
import type { Locale } from '@/i18n/config'
import { resolveLocalizedText } from '@/lib/i18n/resolve-content-locale'
import { formatRelativeTime, getInitials, cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { PostProjectLink } from '@/components/shared/post-project-link'
import { PostCommentsSheet } from '@/components/shared/post-comments-sheet'
import { InstagramVideoPlayer } from '@/components/shared/instagram-video-player'
import { toggleLike, recordShare } from '@/app/dashboard/publicacoes/social-actions'
import { useOptionalComposer } from '@/components/dashboard/post-composer-provider'

// Comprimento de legenda a partir do qual mostramos "...mais" — mesmo
// limiar usado pra decidir SE trunca e pra onde cortar o texto truncado
// (ver `truncateCaption`).
const CAPTION_CLAMP_LENGTH = 140

/** Corta o texto no limite, recuando até o último espaço — evita partir
 *  uma palavra no meio bem em cima do "...mais". */
function truncateCaption(text: string, max: number): string {
  if (text.length <= max) return text
  const sliced = text.slice(0, max)
  const lastSpace = sliced.lastIndexOf(' ')
  return (lastSpace > 0 ? sliced.slice(0, lastSpace) : sliced).trimEnd()
}

const ASPECT_CLASS: Record<string, string> = {
  original: '',
  '1:1': 'aspect-square',
  '4:5': 'aspect-[4/5]',
  '1.91:1': 'aspect-[1.91/1]',
}

interface Props {
  post: PostWithProfile
  visitorLocale: Locale
  canEdit?: boolean
  /** Abre a folha de comentários já expandida ao montar — usado pelo link
   *  do sino de notificação de comentário. */
  autoOpenComments?: boolean
  /** `true` numa lista vertical contínua (PostDetailViewer, feed do
   *  dashboard) — tira canto arredondado/borda do card pra virar uma faixa
   *  única, sem caixinha separada por post. `false` (padrão) é o cartão
   *  isolado, com borda e cantos arredondados. */
  edgeToEdge?: boolean
}

export function PostCard({ post, visitorLocale, canEdit = false, autoOpenComments = false, edgeToEdge = false }: Props) {
  const t = useTranslations('Feed')
  const composer = useOptionalComposer()
  const { text } = resolveLocalizedText(post.content, post.original_locale, post.translations, visitorLocale)

  const [liked, setLiked] = useState(post.viewer_has_liked)
  const [likeCount, setLikeCount] = useState(post.like_count)
  const [expanded, setExpanded] = useState(false)
  const [showTags, setShowTags] = useState(false)
  const [commentsOpen, setCommentsOpen] = useState(autoOpenComments)
  const [commentCount, setCommentCount] = useState(post.comment_count)
  const [shareCount, setShareCount] = useState(post.share_count)
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

  function trackShare() {
    setShareCount((c) => c + 1)
    recordShare(post.id).catch(() => {})
  }

  async function handleShare() {
    const url = `${window.location.origin}/${post.profile.username}`
    if (navigator.share) {
      try {
        await navigator.share({ title: post.profile.display_name, url })
        trackShare()
      } catch { /* usuário cancelou */ }
      return
    }
    await navigator.clipboard.writeText(url)
    trackShare()
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

  const needsClamp = (text?.length ?? 0) > CAPTION_CLAMP_LENGTH

  return (
    <div
      className={cn(
        'bg-card overflow-hidden',
        edgeToEdge ? 'rounded-none border-0' : 'rounded-2xl border',
      )}
    >
      <div className="p-4 pb-2 flex items-start gap-2.5">
        <Link href={`/${post.profile.username}`} className="shrink-0">
          <Avatar className="h-8 w-8">
            <AvatarImage src={post.profile.avatar_url ?? ''} alt={post.profile.display_name} />
            <AvatarFallback className="text-xs">{getInitials(post.profile.display_name)}</AvatarFallback>
          </Avatar>
        </Link>
        <div className="flex items-start gap-2.5 min-w-0 flex-1">
          <div className="min-w-0 flex-1">
            <Link href={`/${post.profile.username}`} className="block text-sm font-medium truncate hover:underline">
              {post.profile.display_name}
            </Link>
            <p className="text-xs text-muted-foreground truncate">
              <Link href={`/${post.profile.username}`} className="hover:underline">
                @{post.profile.username}
              </Link>
              {post.location && (
                <>
                  {' · '}
                  {/* Abre o mapa igual o Instagram — só temos o endereço em texto livre (sem lat/lng salvo), então buscamos no Google Maps pelo texto. */}
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(post.location)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:underline hover:text-foreground"
                  >
                    {post.location}
                  </a>
                </>
              )}
            </p>
          </div>
          {post.published_at && <p className="text-xs text-muted-foreground shrink-0">{formatRelativeTime(post.published_at)}</p>}
        </div>

        {canEdit && (
          <DropdownMenu>
            <DropdownMenuTrigger aria-label={t('postActions')} className="text-muted-foreground hover:text-foreground p-1 -mr-1 -mt-1">
              <MoreHorizontal className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => composer?.openComposer(post)} className="gap-2">
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
            {shareCount > 0 && <span>{shareCount}</span>}
          </button>
        </div>

        {text && (
          <p className="text-sm whitespace-pre-wrap">
            {!expanded && needsClamp ? truncateCaption(text, CAPTION_CLAMP_LENGTH) : text}
            {needsClamp && (
              <button type="button" onClick={() => setExpanded((v) => !v)} className="text-muted-foreground font-medium">
                {expanded ? ` ${t('seeLess')}` : t('seeMore')}
              </button>
            )}
          </p>
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
  const t = useTranslations('Feed')
  const aspectClass = ASPECT_CLASS[post.media_aspect_ratio] || 'aspect-[4/5]'

  // Vídeo processando na Bunny ainda não tem media_urls — mas o post
  // precisa renderizar o placeholder de "processando" mesmo assim.
  if (post.type === 'video') {
    return (
      <MediaFrame aspectClass={aspectClass}>
        <InstagramVideoPlayer
          src={post.media_urls[0] ?? ''}
          status={post.media_status}
          className="absolute inset-0"
          processingLabel={t('videoProcessing')}
          muteLabel={t('mute')}
          unmuteLabel={t('unmute')}
        />
        <RoleBadge role={post.profile.user_role} />
      </MediaFrame>
    )
  }

  if (!post.media_urls?.length) return null

  if (post.type === 'carousel') {
    return (
      <div className="relative">
        <div ref={scrollRef} onScroll={onScroll} className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide">
          {post.media_urls.map((url, i) => (
            <div key={url + i} className="shrink-0 snap-start w-full">
              <MediaFrame aspectClass={aspectClass}>
                <Image src={url} alt="" fill className="object-cover" sizes="100vw" />
                {showTags && <TagPins tags={post.tags.filter((tag) => tag.media_index === i)} />}
              </MediaFrame>
            </div>
          ))}
        </div>
        <div className="absolute top-2 left-1/2 -translate-x-1/2 flex gap-1">
          {post.media_urls.map((_, i) => (
            <span key={i} className={cn('h-1.5 w-1.5 rounded-full', i === activeSlide ? 'bg-white' : 'bg-white/40')} />
          ))}
        </div>
        <RoleBadge role={post.profile.user_role} />
        {post.tags.length > 0 && <TagToggleButton onClick={onToggleTags} />}
      </div>
    )
  }

  return (
    <MediaFrame aspectClass={aspectClass}>
      <Image src={post.media_urls[0]} alt="" fill className="object-cover" />
      {showTags && <TagPins tags={post.tags.filter((tag) => tag.media_index === 0)} />}
      <RoleBadge role={post.profile.user_role} />
      {post.tags.length > 0 && <TagToggleButton onClick={onToggleTags} />}
    </MediaFrame>
  )
}

/** Caixa que envolve a mídia (imagem/vídeo/slide) na proporção escolhida no
 *  upload — bloco full-bleed de largura 100%, altura vem só da proporção
 *  (`aspect-*`). */
function MediaFrame({ aspectClass, children }: { aspectClass: string; children: React.ReactNode }) {
  return <div className={cn('relative bg-muted', aspectClass)}>{children}</div>
}

function RoleBadge({ role }: { role: 'missionary' | 'partner' }) {
  const t = useTranslations('Feed')
  const Icon = role === 'missionary' ? Heart : Globe
  return (
    <div className="absolute top-2 right-2 bg-card/95 text-foreground rounded-full px-2.5 py-1 shadow-sm flex items-center gap-1 text-xs font-medium">
      <Icon className="h-3.5 w-3.5 text-primary" />
      {t(role === 'missionary' ? 'roleMissionary' : 'rolePartner')}
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
