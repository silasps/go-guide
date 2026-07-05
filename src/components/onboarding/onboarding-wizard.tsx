'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Profile } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { toast } from 'sonner'
import { Loader2, Check, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'

const CURRENCIES = ['BRL', 'USD', 'EUR', 'GBP', 'CHF', 'CAD', 'AUD']
const STEP_LABELS = ['Perfil', 'Recebimento', 'Primeiro projeto', 'Concluído']

interface Props {
  profile: Profile
}

export function OnboardingWizard({ profile }: Props) {
  const router = useRouter()
  const [step, setStep] = useState(1)

  // Passo 1 — perfil
  const [displayName, setDisplayName] = useState(profile.display_name)
  const [username, setUsername] = useState(profile.username)
  const [bio, setBio] = useState(profile.bio ?? '')
  const [location, setLocation] = useState(profile.location ?? '')
  const [missionStartDate, setMissionStartDate] = useState(profile.mission_start_date ?? '')
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle')
  const [usernameTimer, setUsernameTimer] = useState<ReturnType<typeof setTimeout> | null>(null)

  // Passo 2 — recebimento
  const [pixKey, setPixKey] = useState(profile.pix_key ?? '')
  const [paypalUrl, setPaypalUrl] = useState(profile.paypal_url ?? '')
  const [wiseUrl, setWiseUrl] = useState(profile.wise_url ?? '')
  const [donationUrl, setDonationUrl] = useState(profile.external_donation_url ?? '')
  const [paymentConfigured, setPaymentConfigured] = useState(
    Boolean(profile.pix_key || profile.paypal_url || profile.wise_url || profile.external_donation_url)
  )

  // Passo 3 — primeiro projeto
  const [projectTitle, setProjectTitle] = useState('')
  const [projectDescription, setProjectDescription] = useState('')
  const [projectGoal, setProjectGoal] = useState('')
  const [projectCurrency, setProjectCurrency] = useState('BRL')
  const [projectCreated, setProjectCreated] = useState(false)

  const [saving, setSaving] = useState(false)

  function handleUsernameChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '')
    setUsername(value)
    setUsernameStatus('idle')

    if (usernameTimer) clearTimeout(usernameTimer)
    if (value === profile.username || value.length < 3) return

    if (!/^[a-z][a-z0-9_]{2,29}$/.test(value)) {
      setUsernameStatus('invalid')
      return
    }

    setUsernameStatus('checking')
    setUsernameTimer(setTimeout(async () => {
      const supabase = createClient()
      const { data } = await supabase.from('profiles').select('id').eq('username', value).neq('id', profile.id).maybeSingle()
      setUsernameStatus(data ? 'taken' : 'available')
    }, 500))
  }

  const usernameIcon = useCallback(() => {
    if (usernameStatus === 'checking') return <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
    if (usernameStatus === 'available') return <Check className="h-3.5 w-3.5 text-green-500" />
    if (usernameStatus === 'taken' || usernameStatus === 'invalid') return <span className="text-xs text-destructive">✕</span>
    return null
  }, [usernameStatus])

  async function handleProfileContinue() {
    if (usernameStatus === 'taken' || usernameStatus === 'invalid') return
    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase.from('profiles').update({
      display_name: displayName.trim() || profile.display_name,
      username: username.trim() || profile.username,
      bio: bio.trim() || null,
      location: location.trim() || null,
      mission_start_date: missionStartDate || null,
    }).eq('id', profile.id)
    setSaving(false)
    if (error) { toast.error('Erro ao salvar perfil.'); return }
    setStep(2)
  }

  async function handlePaymentContinue() {
    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase.from('profiles').update({
      pix_key: pixKey.trim() || null,
      paypal_url: paypalUrl.trim() || null,
      wise_url: wiseUrl.trim() || null,
      external_donation_url: donationUrl.trim() || null,
    }).eq('id', profile.id)
    setSaving(false)
    if (error) { toast.error('Erro ao salvar dados de recebimento.'); return }
    setPaymentConfigured(Boolean(pixKey || paypalUrl || wiseUrl || donationUrl))
    setStep(3)
  }

  async function handleProjectContinue() {
    if (!projectTitle.trim()) { setStep(4); return }
    setSaving(true)
    const res = await fetch('/api/highlights', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        profileId: profile.id,
        title: projectTitle.trim(),
        description: projectDescription.trim(),
        goalTypes: ['financial'],
        goalAmount: projectGoal ? parseFloat(projectGoal) : null,
        currentAmount: 0,
        currency: projectCurrency,
        coverUrl: null,
        coverPosition: '50% 50%',
        tripStartDate: null,
        fundingDeadline: null,
        scripture: '',
        letter: '',
        status: 'active',
        milestones: [],
        budgetCategories: [],
      }),
    })
    setSaving(false)
    if (!res.ok) { toast.error('Erro ao criar projeto.'); return }
    setProjectCreated(true)
    setStep(4)
  }

  function finish() {
    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="w-full max-w-lg">
      {/* Progresso */}
      <div className="flex items-center gap-2 mb-6">
        {STEP_LABELS.map((label, i) => (
          <div key={label} className="flex-1">
            <div className={cn('h-1.5 rounded-full transition-colors', i + 1 <= step ? 'bg-primary' : 'bg-muted')} />
            <p className={cn('text-[11px] mt-1.5 hidden sm:block', i + 1 === step ? 'text-foreground font-medium' : 'text-muted-foreground')}>{label}</p>
          </div>
        ))}
      </div>

      <Card>
        {step === 1 && (
          <>
            <CardHeader>
              <CardTitle>Seu perfil missionário</CardTitle>
              <CardDescription>Essas informações aparecem no seu perfil público — pode ser sobre você ou sua família em campo.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Nome *</Label>
                <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="João e Maria Silva" />
              </div>
              <div className="space-y-2">
                <Label>Usuário *</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">@</span>
                  <Input className="pl-7 pr-7" value={username} onChange={handleUsernameChange} placeholder="joaoemaria" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2">{usernameIcon()}</span>
                </div>
                {usernameStatus === 'taken' && <p className="text-xs text-destructive">Username indisponível.</p>}
                {usernameStatus === 'invalid' && <p className="text-xs text-destructive">Apenas letras minúsculas, números e _. Mínimo 3 chars.</p>}
              </div>
              <div className="space-y-2">
                <Label>Bio</Label>
                <Textarea value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Missionários na África desde 2020..." rows={2} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Localização</Label>
                  <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Nairóbi, Quênia" />
                </div>
                <div className="space-y-2">
                  <Label>Em campo desde</Label>
                  <Input type="date" value={missionStartDate} onChange={(e) => setMissionStartDate(e.target.value)} />
                </div>
              </div>
              <Button
                className="w-full"
                disabled={saving || !displayName.trim() || !username.trim() || usernameStatus === 'taken' || usernameStatus === 'invalid'}
                onClick={handleProfileContinue}
              >
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Continuar
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardContent>
          </>
        )}

        {step === 2 && (
          <>
            <CardHeader>
              <CardTitle>Configure o recebimento</CardTitle>
              <CardDescription>
                Como seus parceiros vão te apoiar financeiramente? O dinheiro vai direto a você — a plataforma não intermedia.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { id: 'pix', label: 'Chave Pix', value: pixKey, set: setPixKey, placeholder: 'CPF, e-mail, telefone ou aleatória' },
                { id: 'paypal', label: 'PayPal', value: paypalUrl, set: setPaypalUrl, placeholder: 'https://paypal.me/seunome' },
                { id: 'wise', label: 'Wise', value: wiseUrl, set: setWiseUrl, placeholder: 'https://wise.com/pay/...' },
                { id: 'donation', label: 'Link de doação externo', value: donationUrl, set: setDonationUrl, placeholder: 'https://...' },
              ].map(({ id, label, value, set, placeholder }) => (
                <div key={id} className="space-y-2">
                  <Label htmlFor={id}>{label}</Label>
                  <Input id={id} value={value} onChange={(e: React.ChangeEvent<HTMLInputElement>) => set(e.target.value)} placeholder={placeholder} />
                </div>
              ))}
              <div className="flex gap-2">
                <Button variant="ghost" className="flex-1" disabled={saving} onClick={() => setStep(3)}>
                  Pular por agora
                </Button>
                <Button className="flex-1" disabled={saving} onClick={handlePaymentContinue}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Continuar
                </Button>
              </div>
            </CardContent>
          </>
        )}

        {step === 3 && (
          <>
            <CardHeader>
              <CardTitle>Crie seu primeiro projeto</CardTitle>
              <CardDescription>Uma campanha simples para compartilhar com seus parceiros. Você pode detalhar depois.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Título</Label>
                <Input value={projectTitle} onChange={(e) => setProjectTitle(e.target.value)} placeholder="Viagem ao campo missionário 2026" />
              </div>
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Textarea value={projectDescription} onChange={(e) => setProjectDescription(e.target.value)} rows={2} placeholder="Conte brevemente sobre este projeto..." />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label>Moeda</Label>
                  <select
                    value={projectCurrency}
                    onChange={(e) => setProjectCurrency(e.target.value)}
                    className="h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="space-y-2 col-span-2">
                  <Label>Meta financeira</Label>
                  <Input type="number" value={projectGoal} onChange={(e) => setProjectGoal(e.target.value)} placeholder="10000" />
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" className="flex-1" disabled={saving} onClick={() => setStep(4)}>
                  Pular por agora
                </Button>
                <Button className="flex-1" disabled={saving} onClick={handleProjectContinue}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {projectTitle.trim() ? 'Criar projeto e continuar' : 'Continuar'}
                </Button>
              </div>
            </CardContent>
          </>
        )}

        {step === 4 && (
          <>
            <CardHeader>
              <CardTitle>Tudo pronto!</CardTitle>
              <CardDescription>Você pode revisar ou completar qualquer item depois, no seu painel.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-2.5">
                <li className="flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 text-green-500 shrink-0" />
                  Perfil configurado
                </li>
                <li className="flex items-center gap-2 text-sm">
                  {paymentConfigured
                    ? <Check className="h-4 w-4 text-green-500 shrink-0" />
                    : <span className="h-4 w-4 rounded-full border border-amber-400 shrink-0" />}
                  Recebimento de contribuições {paymentConfigured ? 'configurado' : '— pendente'}
                </li>
                <li className="flex items-center gap-2 text-sm">
                  {projectCreated
                    ? <Check className="h-4 w-4 text-green-500 shrink-0" />
                    : <span className="h-4 w-4 rounded-full border border-amber-400 shrink-0" />}
                  Primeiro projeto {projectCreated ? 'criado' : '— pendente'}
                </li>
              </ul>
              {(!paymentConfigured || !projectCreated) && (
                <p className="text-xs text-muted-foreground bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-lg px-3 py-2">
                  Vamos te lembrar dos itens pendentes no seu painel até você completá-los.
                </p>
              )}
              <Button className="w-full" onClick={finish}>
                Ir para o dashboard
              </Button>
            </CardContent>
          </>
        )}
      </Card>
    </div>
  )
}
