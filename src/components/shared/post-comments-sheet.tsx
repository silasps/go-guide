'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Loader2, Send } from 'lucide-react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { getComments, addComment } from '@/app/dashboard/publicacoes/social-actions'
import { getInitials, formatRelativeTime } from '@/lib/utils'

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

  useEffect(() => {
    if (!open) return
    let cancelled = false
    const id = setTimeout(() => {
      setComments(null)
      getComments(postId).then((data) => { if (!cancelled) setComments(data as unknown as CommentRow[]) })
    }, 0)
    return () => { cancelled = true; clearTimeout(id) }
  }, [open, postId])

  async function handleSend() {
    const trimmed = value.trim()
    if (!trimmed) return
    setSending(true)
    try {
      const comment = await addComment(postId, trimmed)
      setComments((prev) => [...(prev ?? []), comment as unknown as CommentRow])
      setValue('')
      onCommentAdded()
    } catch {
      toast.error(t('commentError'))
    } finally {
      setSending(false)
    }
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
            comments.map((comment) => {
              const profile = Array.isArray(comment.profile) ? comment.profile[0] : comment.profile
              return (
                <div key={comment.id} className="flex items-start gap-2.5">
                  <Avatar className="h-7 w-7 shrink-0">
                    <AvatarImage src={profile?.avatar_url ?? ''} alt={profile?.display_name ?? ''} />
                    <AvatarFallback className="text-[10px]">{getInitials(profile?.display_name ?? '')}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="text-sm"><span className="font-medium">{profile?.display_name}</span> {comment.content}</p>
                    <p className="text-xs text-muted-foreground">{formatRelativeTime(comment.created_at)}</p>
                  </div>
                </div>
              )
            })
          )}
        </div>
        <div className="flex items-center gap-2 pt-2 border-t">
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
      </DialogContent>
    </Dialog>
  )
}
