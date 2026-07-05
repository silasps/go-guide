'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { toast } from 'sonner'
import { Loader2, CheckCircle, Lock } from 'lucide-react'
import * as keyManager from '@/lib/crypto/key-manager'
import { E2EEGate } from '@/components/messages/e2ee-gate'

interface Props { profileId: string; missionaryName: string; missionaryUserId: string }

export function PrayerRequestForm({ profileId, missionaryName, missionaryUserId }: Props) {
  const [done, setDone] = useState(false)
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState('')
  const [content, setContent] = useState('')
  const [isPrivate, setIsPrivate] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [unlocked, setUnlocked] = useState(false)

  useEffect(() => {
    void Promise.resolve().then(async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      setUserId(user?.id ?? null)
    })
  }, [])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!content.trim()) return
    setSaving(true)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      // Anônimo: criar conta temporária seria complexo — pede login simples
      toast.error('Faça login para enviar um pedido de oração.')
      setSaving(false)
      return
    }

    if (isPrivate && !keyManager.isUnlocked()) {
      toast.error('Configure sua criptografia antes de enviar um pedido privado. Tente enviar sem marcar como privado, ou acesse Mensagens primeiro.')
      setSaving(false)
      return
    }

    const prayerRequestId = crypto.randomUUID()
    let contentToStore = content.trim()
    let nonce: string | null = null

    if (isPrivate) {
      const encrypted = await keyManager.encryptForResource('prayer_request', prayerRequestId, [user.id, missionaryUserId], content.trim())
      contentToStore = encrypted.ciphertext
      nonce = encrypted.nonce
    }

    const { error } = await supabase.from('prayer_requests').insert({
      id: prayerRequestId,
      profile_id: profileId,
      requester_id: user.id,
      requester_type: 'partner',
      content: contentToStore,
      is_private: isPrivate,
      nonce,
    })

    setSaving(false)
    if (error) { toast.error('Erro ao enviar. Tente novamente.'); return }
    setDone(true)
  }

  if (done) {
    return (
      <Card>
        <CardContent className="py-12 text-center space-y-3">
          <CheckCircle className="h-12 w-12 text-green-500 mx-auto" />
          <h2 className="text-xl font-semibold">Pedido enviado!</h2>
          <p className="text-muted-foreground text-sm">{missionaryName} receberá seu pedido.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Seu nome</Label>
            <Input value={name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)} placeholder="Seu nome (opcional)" />
          </div>
          <div className="space-y-2">
            <Label>Pedido de oração *</Label>
            <Textarea
              value={content}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setContent(e.target.value)}
              placeholder="Compartilhe seu pedido..."
              rows={4}
              required
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={isPrivate}
              onChange={(e) => { setIsPrivate(e.target.checked); if (!e.target.checked) setUnlocked(keyManager.isUnlocked()) }}
              className="rounded border-input"
            />
            <Lock className="h-3.5 w-3.5" />
            Pedido privado (cifrado — só {missionaryName} consegue ler)
          </label>

          {isPrivate && !userId && (
            <p className="text-xs text-destructive">Faça login para enviar um pedido privado.</p>
          )}
          {isPrivate && userId && !unlocked && (
            <E2EEGate userId={userId}>
              <UnlockedMarker onReady={() => setUnlocked(true)} />
            </E2EEGate>
          )}

          <Button type="submit" className="w-full" disabled={saving || (isPrivate && !unlocked)}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Enviar pedido
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

/** Renderizado apenas quando o E2EEGate resolve para "desbloqueado" — avisa o formulário pai. */
function UnlockedMarker({ onReady }: { onReady: () => void }) {
  useEffect(() => { onReady() }, [onReady])
  return null
}
