'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { planLimits } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { PhoneInput } from '@/components/ui/phone-input'
import { toast } from 'sonner'
import { Plus, Loader2 } from 'lucide-react'

interface Props {
  profileId: string
  plan: string
  partnerCount: number
}

export function AddPartnerButton({ profileId, plan, partnerCount }: Props) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [phoneAlt, setPhoneAlt] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [type, setType] = useState<'financial' | 'prayer' | 'both'>('both')

  const limit = planLimits(plan).partners
  const atLimit = partnerCount >= limit

  async function handleAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase.from('partners').insert({
      profile_id: profileId,
      name: name.trim(),
      email: email.trim() || null,
      phone: phone.trim() || null,
      phone_alt: phoneAlt.trim() || null,
      birth_date: birthDate || null,
      type,
    })
    setSaving(false)
    if (error) { toast.error('Erro ao adicionar parceiro.'); return }
    toast.success('Parceiro adicionado!')
    setOpen(false)
    setName(''); setEmail(''); setPhone(''); setPhoneAlt(''); setBirthDate('')
    window.location.reload()
  }

  return (
    <>
      <Button
        onClick={() => {
          if (atLimit) { toast.error(`Plano ${plan} permite até ${limit} parceiros. Faça upgrade.`); return }
          setOpen(true)
        }}
        className="gap-2"
      >
        <Plus className="h-4 w-4" />
        Adicionar parceiro
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Novo parceiro</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAdd} className="space-y-4">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input value={name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)} placeholder="Nome completo" required />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={email} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)} placeholder="email@exemplo.com" />
            </div>
            <div className="space-y-2">
              <Label>WhatsApp</Label>
              <PhoneInput onChange={setPhone} />
            </div>
            <div className="space-y-2">
              <Label>Telefone (opcional)</Label>
              <PhoneInput onChange={setPhoneAlt} />
            </div>
            <div className="space-y-2">
              <Label>Data de nascimento</Label>
              <Input type="date" value={birthDate} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBirthDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as typeof type)}
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring"
              >
                <option value="both">Financeiro + Oração</option>
                <option value="financial">Financeiro</option>
                <option value="prayer">Oração</option>
              </select>
            </div>
            <div className="flex gap-2 pt-1">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button type="submit" className="flex-1" disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Adicionar
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
