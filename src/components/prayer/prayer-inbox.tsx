'use client'

import { useEffect, useState } from 'react'
import { PrayerRequest } from '@/types/database'
import { formatRelativeTime } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createClient } from '@/lib/supabase/client'
import * as keyManager from '@/lib/crypto/key-manager'
import { toast } from 'sonner'
import { CheckCircle, Circle, User, Heart, Lock, Loader2 } from 'lucide-react'

const TABS = ['Todos', 'Meus pedidos', 'De parceiros', 'Respondidos'] as const
type Tab = (typeof TABS)[number]

interface Reply { id: string; author_user_id: string; text: string; created_at: string }

function PrayerCard({ request, myUserId, onMarkAnswered }: { request: PrayerRequest; myUserId: string; onMarkAnswered: (id: string, current: boolean) => void }) {
  const [content, setContent] = useState(request.is_private ? '🔒 Decifrando...' : request.content)
  const [replies, setReplies] = useState<Reply[]>([])
  const [replyText, setReplyText] = useState('')
  const [sending, setSending] = useState(false)
  const [showReplies, setShowReplies] = useState(false)

  useEffect(() => {
    if (!request.is_private || !request.nonce) return
    keyManager.decryptResource('prayer_request', request.id, request.content, request.nonce)
      .then(setContent)
      .catch(() => setContent('🔒 Sem acesso a este conteúdo cifrado neste dispositivo.'))
  }, [request])

  async function loadReplies() {
    const supabase = createClient()
    const { data } = await supabase.from('prayer_request_replies').select('*').eq('prayer_request_id', request.id).order('created_at')
    const decrypted: Reply[] = []
    for (const r of data ?? []) {
      if (r.ciphertext && r.nonce) {
        try {
          const text = await keyManager.decryptResource('prayer_request', request.id, r.ciphertext, r.nonce)
          decrypted.push({ id: r.id, author_user_id: r.author_user_id, text, created_at: r.created_at })
        } catch {
          decrypted.push({ id: r.id, author_user_id: r.author_user_id, text: '🔒 Sem acesso.', created_at: r.created_at })
        }
      } else {
        decrypted.push({ id: r.id, author_user_id: r.author_user_id, text: r.content ?? '', created_at: r.created_at })
      }
    }
    setReplies(decrypted)
  }

  async function handleToggleReplies() {
    setShowReplies(v => !v)
    if (!showReplies) await loadReplies()
  }

  async function handleReply() {
    if (!replyText.trim()) return
    setSending(true)
    const supabase = createClient()
    const payload: Record<string, unknown> = { prayer_request_id: request.id, author_user_id: myUserId }
    if (request.is_private) {
      const grantees = [request.requester_id, myUserId].filter((id): id is string => !!id)
      const { ciphertext, nonce } = await keyManager.encryptForResource('prayer_request', request.id, grantees, replyText.trim())
      payload.ciphertext = ciphertext
      payload.nonce = nonce
    } else {
      payload.content = replyText.trim()
    }
    const { error } = await supabase.from('prayer_request_replies').insert(payload)
    setSending(false)
    if (error) { toast.error('Erro ao responder.'); return }
    setReplyText('')
    await loadReplies()
  }

  return (
    <div className={`p-4 border rounded-xl bg-card ${request.is_answered ? 'opacity-60' : ''}`}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5 shrink-0">
          {request.requester_type === 'missionary' ? <Heart className="h-4 w-4 text-primary" /> : <User className="h-4 w-4 text-muted-foreground" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Badge variant={request.requester_type === 'missionary' ? 'default' : 'secondary'} className="text-xs">
              {request.requester_type === 'missionary' ? 'Meu pedido' : 'Parceiro'}
            </Badge>
            {request.is_private && <Lock className="h-3 w-3 text-muted-foreground" />}
            <span className="text-xs text-muted-foreground">{formatRelativeTime(request.created_at)}</span>
          </div>
          <p className="text-sm leading-relaxed">{content}</p>
          <button onClick={handleToggleReplies} className="text-xs text-primary hover:underline mt-2">
            {showReplies ? 'Ocultar respostas' : 'Ver/responder'}
          </button>

          {showReplies && (
            <div className="mt-3 space-y-2 border-t pt-3">
              {replies.map(r => (
                <div key={r.id} className="text-sm bg-muted rounded-lg px-3 py-2">
                  <p>{r.text}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{formatRelativeTime(r.created_at)}</p>
                </div>
              ))}
              <div className="flex gap-2">
                <Input value={replyText} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setReplyText(e.target.value)} placeholder="Responder..." className="h-8 text-sm" />
                <Button size="sm" onClick={handleReply} disabled={sending || !replyText.trim()}>
                  {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Enviar'}
                </Button>
              </div>
            </div>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          onClick={() => onMarkAnswered(request.id, request.is_answered)}
          title={request.is_answered ? 'Reabrir' : 'Marcar como respondido'}
        >
          {request.is_answered ? <CheckCircle className="h-4 w-4 text-green-500" /> : <Circle className="h-4 w-4 text-muted-foreground" />}
        </Button>
      </div>
    </div>
  )
}

export function PrayerInbox({ requests: initial, myUserId }: { requests: PrayerRequest[]; myUserId: string }) {
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
      <div className="flex gap-1 border rounded-lg p-1 bg-muted w-fit">
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1 rounded text-sm transition-colors ${tab === t ? 'bg-background shadow-sm font-medium' : 'text-muted-foreground hover:text-foreground'}`}
          >
            {t}
          </button>
        ))}
      </div>

      {!filtered.length && <p className="text-sm text-muted-foreground py-8 text-center">Nenhum pedido aqui.</p>}

      <div className="space-y-3">
        {filtered.map(r => (
          <PrayerCard key={r.id} request={r} myUserId={myUserId} onMarkAnswered={markAnswered} />
        ))}
      </div>
    </div>
  )
}
