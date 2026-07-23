'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Highlight } from '@/types/database'
import { formatCurrency } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Pencil, Trash2, Eye, EyeOff, ChevronUp, ChevronDown, ExternalLink } from 'lucide-react'

export function HighlightsList({ highlights: initial, basePath = '/dashboard/destaques', username }: { highlights: Highlight[], basePath?: string, username?: string }) {
  const [highlights, setHighlights] = useState(initial)

  async function handleDelete(id: string) {
    if (!confirm('Excluir este destaque?')) return
    const supabase = createClient()
    const { error } = await supabase.from('highlights').delete().eq('id', id)
    if (error) { toast.error('Erro ao excluir.'); return }
    setHighlights(prev => prev.filter(h => h.id !== id))
    toast.success('Destaque excluído.')
  }

  async function toggleStatus(h: Highlight) {
    const status = h.status === 'active' ? 'hidden' : 'active'
    const supabase = createClient()
    await supabase.from('highlights').update({ status }).eq('id', h.id)
    setHighlights(prev => prev.map(x => x.id === h.id ? { ...x, status } : x))
  }

  async function move(idx: number, dir: -1 | 1) {
    const next = [...highlights]
    const target = idx + dir
    if (target < 0 || target >= next.length) return
    ;[next[idx], next[target]] = [next[target], next[idx]]

    const supabase = createClient()
    await Promise.all([
      supabase.from('highlights').update({ order_index: idx }).eq('id', next[idx].id),
      supabase.from('highlights').update({ order_index: target }).eq('id', next[target].id),
    ])
    setHighlights(next)
  }

  if (!highlights.length) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <p>Nenhum destaque ainda.</p>
        <Link href={`${basePath}/novo`} className={cn(buttonVariants(), 'mt-4')}>
          Criar primeiro destaque
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {highlights.map((h, idx) => {
        const pct = h.goal_amount ? Math.min(100, (h.current_amount / h.goal_amount) * 100) : null
        return (
          <div key={h.id} className="flex gap-4 p-4 border rounded-xl bg-card items-center">
            {/* Cover */}
            <div className="h-14 w-14 rounded-lg bg-muted overflow-hidden shrink-0">
              {h.cover_url
                ? <Image src={h.cover_url} alt={h.title} width={112} height={112} className="object-cover h-full w-full" style={{ objectPosition: h.cover_position ?? '50% 50%' }} />
                : <div className="h-full flex items-center justify-center text-xl">✨</div>
              }
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center gap-2">
                <p className="font-medium text-sm truncate">{h.title}</p>
                <Badge variant={h.status === 'active' ? 'default' : 'secondary'} className="text-xs shrink-0">
                  {h.status === 'active' ? 'Ativo' : 'Oculto'}
                </Badge>
                {pct === 100 && (
                  <Badge variant="success" className="text-xs shrink-0">
                    Meta atingida 🎉
                  </Badge>
                )}
              </div>
              {pct !== null && (
                <div className="space-y-0.5">
                  <Progress value={pct} className="h-1.5" />
                  <p className="text-xs text-muted-foreground">
                    {formatCurrency(h.current_amount, h.currency)} / {formatCurrency(h.goal_amount!, h.currency)} ({pct.toFixed(0)}%)
                  </p>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-0.5 shrink-0">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => move(idx, -1)} disabled={idx === 0}>
                <ChevronUp className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => move(idx, 1)} disabled={idx === highlights.length - 1}>
                <ChevronDown className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => toggleStatus(h)}>
                {h.status === 'active' ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </Button>
              {username && (
                <Link href={`/${username}/projetos/${h.slug ?? h.id}`} target="_blank" className={cn(buttonVariants({ variant: 'ghost', size: 'icon' }), 'h-7 w-7')}>
                  <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              )}
              <Link href={`${basePath}/${h.id}`} className={cn(buttonVariants({ variant: 'ghost', size: 'icon' }), 'h-7 w-7')}>
                <Pencil className="h-3.5 w-3.5" />
              </Link>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDelete(h.id)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
