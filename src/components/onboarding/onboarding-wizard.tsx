'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase/client'
import { Profile, UserRole } from '@/types/database'
import { AccountTypeSelector, useAccountTypeCopy } from '@/components/profile/account-type-selector'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { toast } from 'sonner'
import { Loader2, Check, ArrowRight, HandHeart, Compass } from 'lucide-react'
import { cn } from '@/lib/utils'

const CURRENCIES = ['BRL', 'USD', 'EUR', 'GBP', 'CHF', 'CAD', 'AUD']

type Step = 'role' | 'profile' | 'payment' | 'project' | 'summary' | 'partnerDone'
const MISSIONARY_STEPS: Step[] = ['profile', 'payment', 'project', 'summary']

interface Props {
  profile: Profile
  hasPaymentMethod: boolean
}

export function OnboardingWizard({ profile, hasPaymentMethod }: Props) {
  const t = useTranslations('Onboarding')
  const router = useRouter()
  // Quem chega aqui já como 'missionary' veio do fluxo "virar missionário"
  // (becomeMissionary() já fez o flip antes de redirecionar) — pula a
  // pergunta de papel e cai direto na configuração de perfil.
  const [step, setStep] = useState<Step>(profile.user_role === 'missionary' ? 'profile' : 'role')
  const [roleSaving, setRoleSaving] = useState(false)

  // Passo 1 — perfil
  const [displayName, setDisplayName] = useState(profile.display_name)
  const [accountType, setAccountType] = useState(profile.account_type)
  const { bioPlaceholder, bioHint, displayNamePlaceholder } = useAccountTypeCopy(accountType)
  const [username, setUsername] = useState(profile.username)
  const [bio, setBio] = useState(profile.bio ?? '')
  const [location, setLocation] = useState(profile.location ?? '')
  const [showLocation, setShowLocation] = useState(profile.show_location ?? true)
  const [missionStartDate, setMissionStartDate] = useState(profile.mission_start_date ?? '')
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle')
  const [usernameTimer, setUsernameTimer] = useState<ReturnType<typeof setTimeout> | null>(null)

  // Passo 2 — recebimento
  const [pixKey, setPixKey] = useState('')
  const [paypalUrl, setPaypalUrl] = useState('')
  const [wiseUrl, setWiseUrl] = useState('')
  const [paymentConfigured, setPaymentConfigured] = useState(hasPaymentMethod)

  // Passo 3 — primeiro projeto
  const [projectTitle, setProjectTitle] = useState('')
  const [projectDescription, setProjectDescription] = useState('')
  const [projectGoal, setProjectGoal] = useState('')
  const [projectCurrency, setProjectCurrency] = useState('BRL')
  const [projectCreated, setProjectCreated] = useState(false)

  const [saving, setSaving] = useState(false)

  const STEP_LABELS = [t('stepLabel1'), t('stepLabel2'), t('stepLabel3'), t('stepLabel4')]
  const missionaryStepIndex = MISSIONARY_STEPS.indexOf(step)

  async function chooseRole(role: UserRole) {
    setRoleSaving(true)
    const supabase = createClient()
    const { error } = await supabase.from('profiles').update({ user_role: role }).eq('id', profile.id)
    setRoleSaving(false)
    if (error) { toast.error(t('errorSavingProfile')); return }
    setStep(role === 'partner' ? 'partnerDone' : 'profile')
  }

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
      account_type: accountType,
      username: username.trim() || profile.username,
      bio: bio.trim() || null,
      location: location.trim() || null,
      show_location: showLocation,
      mission_start_date: missionStartDate || null,
    }).eq('id', profile.id)
    setSaving(false)
    if (error) { toast.error(t('errorSavingProfile')); return }
    setStep('payment')
  }

  async function handlePaymentContinue() {
    const rows = [
      pixKey.trim() && { profile_id: profile.id, type: 'pix' as const, value: pixKey.trim(), sort_order: 0 },
      paypalUrl.trim() && { profile_id: profile.id, type: 'paypal' as const, value: paypalUrl.trim(), sort_order: 1 },
      wiseUrl.trim() && { profile_id: profile.id, type: 'wise' as const, value: wiseUrl.trim(), sort_order: 2 },
    ].filter(Boolean)

    if (rows.length > 0) {
      setSaving(true)
      const supabase = createClient()
      const { error } = await supabase.from('payment_methods').insert(rows)
      setSaving(false)
      if (error) { toast.error(t('errorSavingPayment')); return }
      setPaymentConfigured(true)
    }
    setStep('project')
  }

  async function handleProjectContinue() {
    if (!projectTitle.trim()) { setStep('summary'); return }
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
    if (!res.ok) { toast.error(t('errorCreatingProject')); return }
    setProjectCreated(true)
    setStep('summary')
  }

  function finish() {
    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="w-full max-w-lg">
      {/* Progresso — só aparece na trilha de missionário (perfil/recebimento/projeto/concluído);
          a escolha de papel e o fim de parceiro são telas fora dessa trilha. */}
      {missionaryStepIndex >= 0 && (
        <div className="flex items-center gap-2 mb-6">
          {STEP_LABELS.map((label, i) => (
            <div key={label} className="flex-1">
              <div className={cn('h-1.5 rounded-full transition-colors', i <= missionaryStepIndex ? 'bg-primary' : 'bg-muted')} />
              <p className={cn('text-[11px] mt-1.5 hidden sm:block', i === missionaryStepIndex ? 'text-foreground font-medium' : 'text-muted-foreground')}>{label}</p>
            </div>
          ))}
        </div>
      )}

      <Card>
        {step === 'role' && (
          <>
            <CardHeader>
              <CardTitle>{t('roleStepTitle')}</CardTitle>
              <CardDescription>{t('roleStepDescription')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <button
                type="button"
                disabled={roleSaving}
                onClick={() => chooseRole('partner')}
                className="w-full flex items-start gap-3 p-4 rounded-xl border text-left transition-colors border-border hover:border-primary hover:bg-primary/5 disabled:opacity-60"
              >
                <HandHeart className="h-5 w-5 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium">{t('rolePartnerLabel')}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{t('rolePartnerDescription')}</p>
                </div>
              </button>
              <button
                type="button"
                disabled={roleSaving}
                onClick={() => chooseRole('missionary')}
                className="w-full flex items-start gap-3 p-4 rounded-xl border text-left transition-colors border-border hover:border-primary hover:bg-primary/5 disabled:opacity-60"
              >
                <Compass className="h-5 w-5 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium">{t('roleMissionaryLabel')}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{t('roleMissionaryDescription')}</p>
                </div>
              </button>
              {roleSaving && <Loader2 className="h-4 w-4 animate-spin mx-auto" />}
            </CardContent>
          </>
        )}

        {step === 'partnerDone' && (
          <>
            <CardHeader>
              <CardTitle>{t('partnerDoneTitle')}</CardTitle>
              <CardDescription>{t('partnerDoneDescription')}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" onClick={finish}>
                {t('goToDashboard')}
              </Button>
            </CardContent>
          </>
        )}

        {step === 'profile' && (
          <>
            <CardHeader>
              <CardTitle>{t('step1Title')}</CardTitle>
              <CardDescription>{t('step1Description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>{t('accountTypeLabel')}</Label>
                <AccountTypeSelector value={accountType} onChange={setAccountType} />
              </div>
              <div className="space-y-2">
                <Label>{t('nameLabel')}</Label>
                <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder={displayNamePlaceholder} />
              </div>
              <div className="space-y-2">
                <Label>{t('usernameLabel')}</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">@</span>
                  <Input className="pl-7 pr-7" value={username} onChange={handleUsernameChange} placeholder={t('usernamePlaceholder')} />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2">{usernameIcon()}</span>
                </div>
                {usernameStatus === 'taken' && <p className="text-xs text-destructive">{t('usernameTaken')}</p>}
                {usernameStatus === 'invalid' && <p className="text-xs text-destructive">{t('usernameInvalid')}</p>}
              </div>
              <div className="space-y-2">
                <Label>{t('bioLabel')}</Label>
                <p className="text-xs text-muted-foreground">{bioHint}</p>
                <Textarea value={bio} onChange={(e) => setBio(e.target.value)} placeholder={bioPlaceholder} rows={2} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('locationLabel')}</Label>
                  <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder={t('locationPlaceholder')} />
                </div>
                <div className="space-y-2">
                  <Label>{t('missionStartLabel')}</Label>
                  <Input type="date" value={missionStartDate} onChange={(e) => setMissionStartDate(e.target.value)} />
                </div>
              </div>
              <label className="flex items-start gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={showLocation}
                  onChange={(e) => setShowLocation(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-input"
                />
                <span>
                  {t('showLocationLabel')}
                  <span className="block text-xs text-muted-foreground">{t('showLocationHint')}</span>
                </span>
              </label>
              <Button
                className="w-full"
                disabled={saving || !displayName.trim() || !username.trim() || usernameStatus === 'taken' || usernameStatus === 'invalid'}
                onClick={handleProfileContinue}
              >
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t('continueButton')}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardContent>
          </>
        )}

        {step === 'payment' && (
          <>
            <CardHeader>
              <CardTitle>{t('step2Title')}</CardTitle>
              <CardDescription>{t('step2Description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { id: 'pix', label: t('pixLabel'), value: pixKey, set: setPixKey, placeholder: t('pixPlaceholder') },
                { id: 'paypal', label: 'PayPal', value: paypalUrl, set: setPaypalUrl, placeholder: t('paypalPlaceholder') },
                { id: 'wise', label: 'Wise', value: wiseUrl, set: setWiseUrl, placeholder: t('wisePlaceholder') },
              ].map(({ id, label, value, set, placeholder }) => (
                <div key={id} className="space-y-2">
                  <Label htmlFor={id}>{label}</Label>
                  <Input id={id} value={value} onChange={(e: React.ChangeEvent<HTMLInputElement>) => set(e.target.value)} placeholder={placeholder} />
                </div>
              ))}
              <p className="text-xs text-muted-foreground">{t('step2MoreOptionsHint')}</p>
              <div className="flex gap-2">
                <Button variant="ghost" className="flex-1" disabled={saving} onClick={() => setStep('project')}>
                  {t('skipForNow')}
                </Button>
                <Button className="flex-1" disabled={saving} onClick={handlePaymentContinue}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {t('continueButton')}
                </Button>
              </div>
            </CardContent>
          </>
        )}

        {step === 'project' && (
          <>
            <CardHeader>
              <CardTitle>{t('step3Title')}</CardTitle>
              <CardDescription>{t('step3Description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>{t('titleLabel')}</Label>
                <Input value={projectTitle} onChange={(e) => setProjectTitle(e.target.value)} placeholder={t('titlePlaceholder')} />
              </div>
              <div className="space-y-2">
                <Label>{t('descriptionLabel')}</Label>
                <Textarea value={projectDescription} onChange={(e) => setProjectDescription(e.target.value)} rows={2} placeholder={t('descriptionPlaceholder')} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label>{t('currencyLabel')}</Label>
                  <select
                    value={projectCurrency}
                    onChange={(e) => setProjectCurrency(e.target.value)}
                    className="h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="space-y-2 col-span-2">
                  <Label>{t('goalLabel')}</Label>
                  <Input type="number" value={projectGoal} onChange={(e) => setProjectGoal(e.target.value)} placeholder="10000" />
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" className="flex-1" disabled={saving} onClick={() => setStep('summary')}>
                  {t('skipForNow')}
                </Button>
                <Button className="flex-1" disabled={saving} onClick={handleProjectContinue}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {projectTitle.trim() ? t('createProjectButton') : t('continueButton')}
                </Button>
              </div>
            </CardContent>
          </>
        )}

        {step === 'summary' && (
          <>
            <CardHeader>
              <CardTitle>{t('step4Title')}</CardTitle>
              <CardDescription>{t('step4Description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-2.5">
                <li className="flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 text-green-500 shrink-0" />
                  {t('profileConfigured')}
                </li>
                <li className="flex items-center gap-2 text-sm">
                  {paymentConfigured
                    ? <Check className="h-4 w-4 text-green-500 shrink-0" />
                    : <span className="h-4 w-4 rounded-full border border-amber-400 shrink-0" />}
                  {paymentConfigured ? t('paymentConfiguredDone') : t('paymentConfiguredPending')}
                </li>
                <li className="flex items-center gap-2 text-sm">
                  {projectCreated
                    ? <Check className="h-4 w-4 text-green-500 shrink-0" />
                    : <span className="h-4 w-4 rounded-full border border-amber-400 shrink-0" />}
                  {projectCreated ? t('projectConfiguredDone') : t('projectConfiguredPending')}
                </li>
              </ul>
              {(!paymentConfigured || !projectCreated) && (
                <p className="text-xs text-muted-foreground bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-lg px-3 py-2">
                  {t('reminderNote')}
                </p>
              )}
              <Button className="w-full" onClick={finish}>
                {t('goToDashboard')}
              </Button>
            </CardContent>
          </>
        )}
      </Card>
    </div>
  )
}
