'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Profile } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface Props {
  profile: Profile
}

export function PaymentForm({ profile }: Props) {
  const router = useRouter()
  const [pixKey, setPixKey] = useState(profile.pix_key ?? '')
  const [paypalUrl, setPaypalUrl] = useState(profile.paypal_url ?? '')
  const [wiseUrl, setWiseUrl] = useState(profile.wise_url ?? '')
  const [donationUrl, setDonationUrl] = useState(profile.external_donation_url ?? '')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase
      .from('profiles')
      .update({
        pix_key: pixKey || null,
        paypal_url: paypalUrl || null,
        wise_url: wiseUrl || null,
        external_donation_url: donationUrl || null,
      })
      .eq('id', profile.id)

    if (error) toast.error('Erro ao salvar.')
    else { toast.success('Dados de pagamento atualizados!'); router.refresh() }
    setSaving(false)
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Essas informações são exibidas no seu perfil público para que parceiros possam apoiar sua missão.
        O dinheiro vai diretamente a você — a plataforma não intermedia.
      </p>

      <div className="space-y-4">
        {[
          { id: 'pix', label: 'Chave Pix', value: pixKey, set: setPixKey, placeholder: 'CPF, e-mail, telefone ou aleatória' },
          { id: 'paypal', label: 'PayPal', value: paypalUrl, set: setPaypalUrl, placeholder: 'https://paypal.me/seunome' },
          { id: 'wise', label: 'Wise', value: wiseUrl, set: setWiseUrl, placeholder: 'https://wise.com/pay/...' },
          { id: 'donation', label: 'Link de doação externo', value: donationUrl, set: setDonationUrl, placeholder: 'https://...' },
        ].map(({ id, label, value, set, placeholder }) => (
          <div key={id} className="space-y-2">
            <Label htmlFor={id}>{label}</Label>
            <Input
              id={id}
              value={value}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => set(e.target.value)}
              placeholder={placeholder}
            />
          </div>
        ))}
      </div>

      <Button onClick={handleSave} disabled={saving}>
        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Salvar
      </Button>
    </div>
  )
}
