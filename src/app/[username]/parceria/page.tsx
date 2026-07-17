import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { PartnershipWizard } from '@/components/partners/partnership-wizard'
import { PledgePaymentMethod } from '@/types/database'

const VALID_CHOICES = ['financial_once', 'financial_once_general', 'financial_ongoing', 'prayer', 'ambassador', 'volunteer'] as const

interface Props {
  params: Promise<{ username: string }>
  searchParams: Promise<{ highlight_id?: string; choice?: string }>
}

export default async function ParceriaPage({ params, searchParams }: Props) {
  const { username } = await params
  const { highlight_id, choice } = await searchParams
  const initialChoice = VALID_CHOICES.find(c => c === choice)
  const supabase = await createClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, display_name, privacy_mode, mission_start_date')
    .eq('username', username)
    .single()

  if (!profile || profile.privacy_mode === 'stealth') notFound()

  const t = await getTranslations('PaymentMethods')
  const [{ data: methods }, { data: { user } }] = await Promise.all([
    supabase.from('payment_methods').select('*').eq('profile_id', profile.id).eq('is_active', true).order('sort_order'),
    supabase.auth.getUser(),
  ])

  let highlight: { id: string; title: string; currency: string } | null = null
  if (highlight_id) {
    const { data } = await supabase
      .from('highlights')
      .select('id, title, currency')
      .eq('id', highlight_id)
      .eq('profile_id', profile.id)
      .single()
    highlight = data
  }

  const stripeAvailable = (methods ?? []).some(m => m.type === 'stripe')
  const manualMethods = (methods ?? []).filter(m => m.type !== 'stripe')

  const paymentOptions: { method: PledgePaymentMethod; label: string; value: string }[] =
    manualMethods.map(m => ({ method: m.type, label: m.label || t(`type_${m.type}`), value: m.value }))
  if (!paymentOptions.some(o => o.method === 'bank_transfer')) {
    paymentOptions.push({ method: 'bank_transfer', label: t('type_bank_transfer'), value: '' })
  }
  if (!paymentOptions.some(o => o.method === 'other')) {
    paymentOptions.push({ method: 'other', label: t('type_other'), value: '' })
  }

  const missionStartYear = profile.mission_start_date ? new Date(profile.mission_start_date).getFullYear() : null

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Faça parte com {profile.display_name}</h1>
          <p className="text-muted-foreground mt-2">Escolha como você quer se envolver com esta missão.</p>
        </div>
        <PartnershipWizard
          profileId={profile.id}
          username={username}
          initialChoice={initialChoice}
          missionaryName={profile.display_name}
          missionStartYear={missionStartYear}
          highlightId={highlight?.id}
          highlightTitle={highlight?.title}
          currency={highlight?.currency ?? 'BRL'}
          paymentOptions={paymentOptions}
          hasFinancialOptions={true}
          stripeAvailable={stripeAvailable}
          user={user ? { id: user.id, email: user.email ?? null, user_metadata: { full_name: user.user_metadata?.full_name } } : null}
        />
      </div>
    </div>
  )
}
