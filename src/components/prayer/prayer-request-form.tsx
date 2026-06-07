'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { toast } from 'sonner'
import { Loader2, CheckCircle } from 'lucide-react'

interface Props { profileId: string; missionaryName: string }

export function PrayerRequestForm({ profileId, missionaryName }: Props) {
  const [done, setDone] = useState(false)
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState('')
  const [content, setContent] = useState('')

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

    const { error } = await supabase.from('prayer_requests').insert({
      profile_id: profileId,
      requester_id: user.id,
      requester_type: 'partner',
      content: content.trim(),
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
          <Button type="submit" className="w-full" disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Enviar pedido
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
