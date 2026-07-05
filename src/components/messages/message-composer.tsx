'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { conversationId } from '@/lib/crypto/conversation'
import * as keyManager from '@/lib/crypto/key-manager'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { Loader2, Send } from 'lucide-react'

interface Props {
  profileId: string
  myUserId: string
  otherUserId: string
  onSent: () => void
}

export function MessageComposer({ profileId, myUserId, otherUserId, onSent }: Props) {
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)

  async function handleSend(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const trimmed = text.trim()
    if (!trimmed) return
    setSending(true)

    try {
      const supabase = createClient()
      const convId = await conversationId(profileId, myUserId, otherUserId)
      const { ciphertext, nonce } = await keyManager.encryptForResource('conversation', convId, [myUserId, otherUserId], trimmed)

      const { error } = await supabase.from('messages').insert({
        sender_id: myUserId,
        recipient_id: otherUserId,
        profile_id: profileId,
        content: ciphertext,
        nonce,
        is_encrypted: true,
      })
      if (error) throw error
      setText('')
      onSent()
    } catch {
      toast.error('Erro ao enviar mensagem.')
    }
    setSending(false)
  }

  return (
    <form onSubmit={handleSend} className="flex gap-2 p-3 border-t">
      <Input
        value={text}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setText(e.target.value)}
        placeholder="Escreva uma mensagem..."
        className="flex-1"
      />
      <Button type="submit" size="icon" disabled={sending || !text.trim()}>
        {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
      </Button>
    </form>
  )
}
