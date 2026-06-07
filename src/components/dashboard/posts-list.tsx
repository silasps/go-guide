'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Post } from '@/types/database'
import { formatDate } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Pencil, Trash2, Eye, EyeOff } from 'lucide-react'

interface Props {
  posts: Post[]
}

export function PostsList({ posts: initialPosts }: Props) {
  const [posts, setPosts] = useState(initialPosts)

  async function handleDelete(id: string) {
    if (!confirm('Excluir esta publicação?')) return
    const supabase = createClient()
    const { error } = await supabase.from('posts').delete().eq('id', id)
    if (error) { toast.error('Erro ao excluir.'); return }
    setPosts(posts.filter(p => p.id !== id))
    toast.success('Publicação excluída.')
  }

  async function toggleDraft(post: Post) {
    const supabase = createClient()
    const update = post.is_draft
      ? { is_draft: false, published_at: new Date().toISOString() }
      : { is_draft: true, published_at: null }
    const { error } = await supabase.from('posts').update(update).eq('id', post.id)
    if (error) { toast.error('Erro ao atualizar.'); return }
    setPosts(posts.map(p => p.id === post.id ? { ...p, ...update } : p))
    toast.success(post.is_draft ? 'Publicado!' : 'Movido para rascunho.')
  }

  if (!posts.length) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <p>Nenhuma publicação ainda.</p>
        <Link href="/dashboard/publicacoes/nova" className={cn(buttonVariants(), 'mt-4')}>
          Criar primeira publicação
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {posts.map((post) => (
        <div key={post.id} className="flex items-center gap-4 p-4 border rounded-xl bg-card">
          {/* Thumbnail */}
          <div className="h-12 w-12 rounded-lg bg-muted overflow-hidden shrink-0">
            {post.media_urls[0] ? (
              <Image src={post.media_urls[0]} alt="" width={48} height={48} className="object-cover h-full w-full" />
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground text-xs uppercase font-medium">
                {post.type[0]}
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">
              {post.content?.slice(0, 60) ?? `(${post.type})`}
            </p>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant={post.is_draft ? 'secondary' : 'default'} className="text-xs">
                {post.is_draft ? 'Rascunho' : 'Publicado'}
              </Badge>
              {post.published_at && (
                <span className="text-xs text-muted-foreground">{formatDate(post.published_at)}</span>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 shrink-0">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => toggleDraft(post)}>
              {post.is_draft ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            </Button>
            <Link href={`/dashboard/publicacoes/${post.id}`} className={cn(buttonVariants({ variant: 'ghost', size: 'icon' }), 'h-8 w-8')}>
              <Pencil className="h-4 w-4" />
            </Link>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDelete(post.id)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  )
}
