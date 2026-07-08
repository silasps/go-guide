'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { conversationId } from '@/lib/crypto/conversation'
import * as keyManager from '@/lib/crypto/key-manager'
import { Message } from '@/types/database'
import { formatRelativeTime, cn } from '@/lib/utils'
import { MessageComposer } from './message-composer'
import { Loader2 } from 'lucide-react'

interface Props {
  profileId: string
  myUserId: string
  otherUserId: string
  otherName: string
}

interface DecryptedMessage extends Message {
  plaintext: string
}

export function MessageThread({ profileId, myUserId, otherUserId, otherName }: Props) {
  const [messages, setMessages] = useState<DecryptedMessage[]>([])
  const [loading, setLoading] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)

  async function loadMessages() {
    const supabase = createClient()
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('profile_id', profileId)
      .or(`and(sender_id.eq.${myUserId},recipient_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},recipient_id.eq.${myUserId})`)
      .order('created_at', { ascending: true })

    const convId = await conversationId(profileId, myUserId, otherUserId)
    const decrypted: DecryptedMessage[] = []
    for (const m of data ?? []) {
      if (m.is_encrypted && m.nonce) {
        try {
          const plaintext = await keyManager.decryptResource('conversation', convId, m.content, m.nonce)
          decrypted.push({ ...m, plaintext })
        } catch {
          decrypted.push({ ...m, plaintext: '🔒 Não foi possível decifrar esta mensagem.' })
        }
      } else {
        decrypted.push({ ...m, plaintext: m.content })
      }
    }
    setMessages(decrypted)
    setLoading(false)
  }

  useEffect(() => {
    void Promise.resolve().then(loadMessages)
    const supabase = createClient()
    const channel = supabase
      .channel(`messages-${profileId}-${otherUserId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `profile_id=eq.${profileId}` }, () => {
        loadMessages()
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId, myUserId, otherUserId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  return (
    <div className="flex flex-col h-[calc(100vh-14rem)] md:h-[600px] rounded-xl border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b">
        <p className="font-medium text-sm">{otherName}</p>
        <p className="text-xs text-muted-foreground flex items-center gap-1">🔒 Conversa cifrada ponta-a-ponta</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-0.5">
        {loading && <div className="flex justify-center py-8"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>}
        {!loading && messages.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">Nenhuma mensagem ainda. Diga olá!</p>
        )}
        {messages.map((m, i) => {
          const isMine = m.sender_id === myUserId
          const groupedWithPrev = i > 0 && messages[i - 1].sender_id === m.sender_id
          const groupedWithNext = i < messages.length - 1 && messages[i + 1].sender_id === m.sender_id
          return (
            <div key={m.id} className={cn('flex', groupedWithPrev ? 'mt-0.5' : 'mt-2.5', isMine ? 'justify-end' : 'justify-start')}>
              <div className={cn(
                'max-w-[75%] rounded-2xl px-3.5 py-2 text-sm',
                isMine ? 'bg-primary text-primary-foreground' : 'bg-muted',
                isMine && groupedWithNext && 'rounded-br-md',
                isMine && groupedWithPrev && 'rounded-tr-md',
                !isMine && groupedWithNext && 'rounded-bl-md',
                !isMine && groupedWithPrev && 'rounded-tl-md'
              )}>
                <p className="whitespace-pre-wrap break-words">{m.plaintext}</p>
                {!groupedWithNext && (
                  <p className={cn('text-[10px] mt-1', isMine ? 'text-primary-foreground/70' : 'text-muted-foreground')}>
                    {formatRelativeTime(m.created_at)}
                  </p>
                )}
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      <MessageComposer
        profileId={profileId}
        myUserId={myUserId}
        otherUserId={otherUserId}
        onSent={loadMessages}
      />
    </div>
  )
}
