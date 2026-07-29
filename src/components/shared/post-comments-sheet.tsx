'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Heart, Loader2, Send, X } from 'lucide-react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { getComments, addComment, toggleCommentLike } from '@/app/dashboard/publicacoes/social-actions'
import { getInitials, formatRelativeTime, cn } from '@/lib/utils'

interface CommentProfile {
  id: string
  username: string
  display_name: string
  avatar_url: string | null
}

interface CommentRow {
  id: string
  content: string
  created_at: string
  parent_comment_id: string | null
  like_count: number
  viewer_has_liked: boolean
  profile: CommentProfile | CommentProfile[]
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  postId: string
  onCommentAdded: () => void
}

export function PostCommentsSheet({ open, onOpenChange, postId, onCommentAdded }: Props) {
  const t = useTranslations('Feed')
  const [comments, setComments] = useState<CommentRow[] | null>(null)
  const [value, setValue] = useState('')
  const [sending, setSending] = useState(false)
  const [replyTo, setReplyTo] = useState<{ id: string; name: string } | null>(null)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    const id = setTimeout(() => {
      setComments(null)
      setReplyTo(null)
      getComments(postId).then((data) => { if (!cancelled) setComments(data as unknown as CommentRow[]) })
    }, 0)
    return () => { cancelled = true; clearTimeout(id) }
  }, [open, postId])

  async function handleSend() {
    const trimmed = value.trim()
    if (!trimmed) return
    setSending(true)
    try {
      const comment = await addComment(postId, trimmed, replyTo?.id ?? null)
      setComments((prev) => [...(prev ?? []), comment as unknown as CommentRow])
      setValue('')
      setReplyTo(null)
      onCommentAdded()
    } catch {
      toast.error(t('commentError'))
    } finally {
      setSending(false)
    }
  }

  async function handleLikeComment(commentId: string) {
    setComments((prev) => prev?.map((c) => (
      c.id === commentId ? { ...c, viewer_has_liked: !c.viewer_has_liked, like_count: c.like_count + (c.viewer_has_liked ? -1 : 1) } : c
    )) ?? null)
    try {
      await toggleCommentLike(commentId)
    } catch {
      setComments((prev) => prev?.map((c) => (
        c.id === commentId ? { ...c, viewer_has_liked: !c.viewer_has_liked, like_count: c.like_count + (c.viewer_has_liked ? -1 : 1) } : c
      )) ?? null)
      toast.error(t('commentError'))
    }
  }

  const topLevel = comments?.filter((c) => !c.parent_comment_id) ?? []
  const repliesByParent = new Map<string, CommentRow[]>()
  for (const c of comments ?? []) {
    if (!c.parent_comment_id) continue
    const list = repliesByParent.get(c.parent_comment_id) ?? []
    list.push(c)
    repliesByParent.set(c.parent_comment_id, list)
  }

  function CommentItem({ comment, isReply = false }: { comment: CommentRow; isReply?: boolean }) {
    const profile = Array.isArray(comment.profile) ? comment.profile[0] : comment.profile
    return (
      <div className={cn('flex items-start gap-2.5', isReply && 'ml-8 mt-2.5')}>
        <Avatar className="h-7 w-7 shrink-0">
          <AvatarImage src={profile?.avatar_url ?? ''} alt={profile?.display_name ?? ''} />
          <AvatarFallback className="text-[10px]">{getInitials(profile?.display_name ?? '')}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="text-sm"><span className="font-medium">{profile?.display_name}</span> {comment.content}</p>
          <div className="flex items-center gap-3 mt-0.5">
            <p className="text-xs text-muted-foreground">{formatRelativeTime(comment.created_at)}</p>
            <button
              type="button"
              onClick={() => setReplyTo({ id: comment.id, name: profile?.display_name ?? '' })}
              className="text-xs text-muted-foreground font-medium hover:text-foreground"
            >
              {t('reply')}
            </button>
            {comment.like_count > 0 && <span className="text-xs text-muted-foreground">{comment.like_count}</span>}
          </div>
        </div>
        <button type="button" onClick={() => handleLikeComment(comment.id)} className="shrink-0 mt-0.5" aria-label={t('like')}>
          <Heart className={cn('h-3.5 w-3.5', comment.viewer_has_liked ? 'fill-destructive text-destructive' : 'text-muted-foreground')} />
        </button>
      </div>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md flex flex-col max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>{t('comments')}</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto space-y-3 -mx-1 px-1">
          {comments === null ? (
            <div className="flex justify-center py-6"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
          ) : comments.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">{t('noComments')}</p>
          ) : (
            topLevel.map((comment) => (
              <div key={comment.id}>
                <CommentItem comment={comment} />
                {(repliesByParent.get(comment.id) ?? []).map((reply) => (
                  <CommentItem key={reply.id} comment={reply} isReply />
                ))}
              </div>
            ))
          )}
        </div>
        <div className="pt-2 border-t space-y-1.5">
          {replyTo && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              {t('replyingTo', { name: replyTo.name })}
              <button type="button" onClick={() => setReplyTo(null)} aria-label={t('cancelReply')}>
                <X className="h-3 w-3" />
              </button>
            </div>
          )}
          <div className="flex items-center gap-2">
            <Input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={t('commentPlaceholder')}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSend() }}
            />
            <Button type="button" size="icon" onClick={handleSend} disabled={sending || !value.trim()}>
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
