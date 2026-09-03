'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { Play, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

export interface PickablePost { id: string; media_urls: string[]; type: string }

interface Props {
  profileId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (post: PickablePost) => void
  title: string
  emptyLabel: string
}

// Grade 3 colunas igual à do próprio perfil (ProfilePostsGrid) — escolher
// um post pra vincular na linha do tempo deveria parecer navegar no feed,
// não um formulário à parte.
export function TimelinePostPicker({ profileId, open, onOpenChange, onSelect, title, emptyLabel }: Props) {
  const [loading, setLoading] = useState(true)
  const [posts, setPosts] = useState<PickablePost[]>([])

  useEffect(() => {
    if (!open) return
    let active = true
    async function loadPosts() {
      setLoading(true)
      const supabase = createClient()
      const { data } = await supabase
        .from('posts')
        .select('id, media_urls, type')
        .eq('profile_id', profileId)
        .eq('is_draft', false)
        .neq('moderation_status', 'removed')
        .not('media_urls', 'eq', '{}')
        .order('published_at', { ascending: false })
        .limit(60)
      if (!active) return
      setPosts((data as PickablePost[]) ?? [])
      setLoading(false)
    }
    loadPosts()
    return () => { active = false }
  }, [open, profileId])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : posts.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">{emptyLabel}</p>
        ) : (
          <div className="grid grid-cols-3 gap-0.5 max-h-[60vh] overflow-y-auto">
            {posts.map((post) => (
              <button
                key={post.id}
                type="button"
                onClick={() => onSelect(post)}
                className="relative aspect-square bg-muted overflow-hidden"
              >
                {post.type === 'video' ? (
                  <>
                    <video src={post.media_urls[0]} className="h-full w-full object-cover" muted />
                    <Play className="absolute inset-0 m-auto h-4 w-4 text-white drop-shadow fill-white" />
                  </>
                ) : (
                  <Image src={post.media_urls[0]} alt="" fill sizes="33vw" className="object-cover" />
                )}
              </button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
