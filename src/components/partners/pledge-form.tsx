'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { compressImage } from '@/lib/media/compress'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { Loader2, CheckCircle, Upload } from 'lucide-react'
import { PledgePaymentMethod } from '@/types/database'
import Image from 'next/image'

interface Props {
  profileId: string
  missionaryName: string
  highlightId?: string
  highlightTitle?: string
  isRecurring: boolean
  currency: string
  paymentOptions: { method: PledgePaymentMethod; label: string; value: string }[]
  onBecomePartner?: () => void
}

function toMasked(raw: string) {
  const digits = raw.replace(/\D/g, '')
  if (!digits) return ''
  return (Number(digits) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })
}
function fromMasked(masked: string) {
  return masked.replace(/\./g, '').replace(',', '.')
}

export function PledgeForm({ profileId, missionaryName, highlightId, highlightTitle, isRecurring, currency, paymentOptions, onBecomePartner }: Props) {
  const [done, setDone] = useState(false)
  const [saving, setSaving] = useState(false)
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState<PledgePaymentMethod>(paymentOptions[0]?.method ?? 'other')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [proofFile, setProofFile] = useState<File | null>(null)
  const [proofPreview, setProofPreview] = useState('')

  async function handleProofSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const compressed = await compressImage(file)
    setProofFile(compressed)
    setProofPreview(URL.createObjectURL(compressed))
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const parsedAmount = parseFloat(fromMasked(amount))
    if (!parsedAmount || parsedAmount <= 0) { toast.error('Informe um valor válido.'); return }
    if (!name.trim()) { toast.error('Informe seu nome.'); return }
    setSaving(true)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    let proof_url: string | null = null
    if (proofFile && user) {
      const path = `${user.id}/pledges/${crypto.randomUUID()}.webp`
      const { error: uploadError } = await supabase.storage.from('media').upload(path, proofFile)
      if (!uploadError) proof_url = supabase.storage.from('media').getPublicUrl(path).data.publicUrl
    }

    const { error } = await supabase.from('pledges').insert({
      highlight_id: isRecurring ? null : (highlightId ?? null),
      profile_id: profileId,
      reporter_user_id: user?.id ?? null,
      reporter_name: name.trim(),
      reporter_email: email.trim() || user?.email || null,
      reported_amount: parsedAmount,
      currency,
      payment_method: method,
      reported_at: new Date(date).toISOString(),
      proof_url,
      is_recurring_pledge: isRecurring,
    })

    setSaving(false)
    if (error) { toast.error('Erro ao registrar oferta. Tente novamente.'); return }
    setDone(true)
  }

  if (done) {
    return (
      <div className="space-y-3">
        <Card>
          <CardContent className="py-12 text-center space-y-3">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto" />
            <h2 className="text-xl font-semibold">Recebemos seu registro!</h2>
            <p className="text-muted-foreground text-sm">
              {missionaryName} vai confirmar o recebimento em breve. Assim que confirmado, você será notificado(a).
            </p>
          </CardContent>
        </Card>
        {!isRecurring && onBecomePartner && (
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="py-6 text-center space-y-3">
              <p className="text-sm">
                Gostaria de saber mais e participar ainda mais da caminhada de {missionaryName}?
              </p>
              <Button type="button" variant="outline" className="w-full" onClick={onBecomePartner}>
                Quero ser parceiro fixo
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {isRecurring ? 'Registrar contribuição contínua' : `Registrar oferta${highlightTitle ? ` — ${highlightTitle}` : ''}`}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-xs text-muted-foreground -mt-2">
            Como não há cobrança automática, registre aqui o valor que você já enviou por Pix/transferência. {missionaryName} vai confirmar o recebimento.
          </p>

          <div className="space-y-2">
            <Label>Forma de envio</Label>
            <div className="grid grid-cols-2 gap-2">
              {paymentOptions.map(opt => (
                <button
                  key={opt.method}
                  type="button"
                  onClick={() => setMethod(opt.method)}
                  className={`py-2 px-3 rounded-lg border text-sm text-left transition-colors ${method === opt.method ? 'border-primary bg-primary/10 text-primary font-medium' : 'border-border text-muted-foreground hover:border-foreground'}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {paymentOptions.find(o => o.method === method)?.value && (
              <p className="text-xs font-mono bg-muted rounded-lg px-3 py-2 select-all">{paymentOptions.find(o => o.method === method)?.value}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Valor enviado ({currency}) *</Label>
              <Input inputMode="numeric" value={amount} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAmount(toMasked(e.target.value))} placeholder="0,00" required />
            </div>
            <div className="space-y-2">
              <Label>Data do envio</Label>
              <Input type="date" value={date} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDate(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Seu nome *</Label>
            <Input value={name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)} placeholder="Nome completo" required />
          </div>
          <div className="space-y-2">
            <Label>E-mail</Label>
            <Input type="email" value={email} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)} placeholder="seu@email.com" />
          </div>

          <div className="space-y-2">
            <Label>Comprovante (opcional, acelera a confirmação)</Label>
            {proofPreview ? (
              <div className="relative h-32 w-full">
                <Image src={proofPreview} alt="comprovante" fill className="object-cover rounded-lg" />
                <label className="absolute bottom-2 right-2 cursor-pointer">
                  <div className="bg-black/60 text-white text-xs px-2 py-1 rounded-lg hover:bg-black/80 transition-colors">Trocar</div>
                  <input type="file" accept="image/*" className="hidden" onChange={handleProofSelect} />
                </label>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center gap-1.5 h-20 rounded-lg border border-dashed cursor-pointer text-muted-foreground hover:text-foreground transition-colors">
                <Upload className="h-4 w-4" />
                <span className="text-xs">Anexar print/comprovante</span>
                <input type="file" accept="image/*" className="hidden" onChange={handleProofSelect} />
              </label>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Registrar oferta
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
