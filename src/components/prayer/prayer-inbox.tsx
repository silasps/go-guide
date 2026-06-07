'use client'

import { useState } from 'react'
import { PrayerRequest } from '@/types/database'
import { formatRelativeTime } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { CheckCircle, Circle, User, Heart } from 'lucide-react'

const TABS = ['Todos', 'Meus pedidos', 'De parceiros', 'Respondidos'] as const
type Tab = (typeof TABS)[number]

export function PrayerInbox({ requests: initial, profileId }: { requests: PrayerRequest[]; profileId: string }) {
  const [requests, setRequests] = useState(initial)
  const [tab, setTab] = useState<Tab>('Todos')

  const filtered = requests.filter(r => {
    if (tab === 'Todos') return !r.is_answered
    if (tab === 'Meus pedidos') return r.requester_type === 'missionary' && !r.is_answered
    if (tab === 'De parceiros') return r.requester_type === 'partner' && !r.is_answered
    return r.is_answered
  })

  async function markAnswered(id: string, current: boolean) {
    const supabase = createClient()
    const update = { is_answered: !current, answered_at: !current ? new Date().toISOString() : null }
    await supabase.from('prayer_requests').update(update).eq('id', id)
    setRequests(prev => prev.map(r => r.id === id ? { ...r, ...update } : r))
    toast.success(!current ? 'Marcado como respondido!' : 'Reaberto.')
  }

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex gap-1 border rounded-lg p-1 bg-muted w-fit">
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1 rounded text-sm transition-colors ${
              tab === t ? 'bg-background shadow-sm font-medium' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {!filtered.length && (
        <p className="text-sm text-muted-foreground py-8 text-center">Nenhum pedido aqui.</p>
      )}

      <div className="space-y-3">
        {filtered.map(r => (
          <div key={r.id} className={`p-4 border rounded-xl bg-card ${r.is_answered ? 'opacity-60' : ''}`}>
            <div className="flex items-start gap-3">
              <div className="mt-0.5 shrink-0">
                {r.requester_type === 'missionary'
                  ? <Heart className="h-4 w-4 text-primary" />
                  : <User className="h-4 w-4 text-muted-foreground" />
                }
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant={r.requester_type === 'missionary' ? 'default' : 'secondary'} className="text-xs">
                    {r.requester_type === 'missionary' ? 'Meu pedido' : 'Parceiro'}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{formatRelativeTime(r.created_at)}</span>
                </div>
                <p className="text-sm leading-relaxed">{r.content}</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                onClick={() => markAnswered(r.id, r.is_answered)}
                title={r.is_answered ? 'Reabrir' : 'Marcar como respondido'}
              >
                {r.is_answered
                  ? <CheckCircle className="h-4 w-4 text-green-500" />
                  : <Circle className="h-4 w-4 text-muted-foreground" />
                }
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
