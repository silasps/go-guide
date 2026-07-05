'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { Loader2, CheckCircle } from 'lucide-react'

interface Props { profileId: string; missionaryName: string; defaultType?: 'financial' | 'prayer' | 'both' | 'ambassador' }

export function PartnershipForm({ profileId, missionaryName, defaultType }: Props) {
  const [done, setDone] = useState(false)
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [notes, setNotes] = useState('')
  const [type, setType] = useState<'financial' | 'prayer' | 'both' | 'ambassador'>(defaultType ?? 'both')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!name.trim() || !email.trim()) return
    setSaving(true)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const { error } = await supabase.from('partners').insert({
      profile_id: profileId,
      user_id: user?.id ?? null,
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim() || null,
      notes: notes.trim() || null,
      type,
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
          <h2 className="text-xl font-semibold">Obrigado, {name.split(' ')[0]}!</h2>
          <p className="text-muted-foreground text-sm">
            {missionaryName} será notificado(a). Você começará a receber atualizações em breve.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Como deseja se envolver?</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {!defaultType && (
            <div className="grid grid-cols-2 gap-2">
              {([
                { value: 'both',       label: '💰🙏 Financeiro + Oração' },
                { value: 'financial',  label: '💰 Apoio financeiro' },
                { value: 'prayer',     label: '🙏 Somente oração' },
                { value: 'ambassador', label: '📣 Embaixador' },
              ] as const).map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setType(value)}
                  className={`py-2 px-3 rounded-lg border text-sm text-left transition-colors ${
                    type === value ? 'border-primary bg-primary/10 text-primary font-medium' : 'border-border text-muted-foreground hover:border-foreground'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          <div className="space-y-2">
            <Label>Nome completo *</Label>
            <Input value={name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)} placeholder="Seu nome" required />
          </div>
          <div className="space-y-2">
            <Label>Email *</Label>
            <Input type="email" value={email} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)} placeholder="seu@email.com" required />
          </div>
          <div className="space-y-2">
            <Label>WhatsApp</Label>
            <Input value={phone} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPhone(e.target.value)} placeholder="+55 11 99999-9999" />
          </div>
          <div className="space-y-2">
            <Label>Mensagem (opcional)</Label>
            <Textarea value={notes} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNotes(e.target.value)} placeholder="Como posso orar por vocês?" rows={2} />
          </div>

          <Button type="submit" className="w-full" disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Quero ser parceiro
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
