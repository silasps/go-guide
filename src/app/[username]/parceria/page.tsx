import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { PartnershipWizard } from '@/components/partners/partnership-wizard'
import { getProfile } from '@/lib/profile/get-profile'
import { PledgePaymentMethod } from '@/types/database'
import { resolveBudgetCategoryLabel } from '@/lib/highlights/budget-category-labels'

const VALID_CHOICES = ['financial_once', 'financial_once_general', 'financial_ongoing', 'prayer', 'ambassador', 'volunteer'] as const

interface Props {
  params: Promise<{ username: string }>
  searchParams: Promise<{ highlight_id?: string; choice?: string; category?: string }>
}

export default async function ParceriaPage({ params, searchParams }: Props) {
  const { username } = await params
  const { highlight_id, choice, category } = await searchParams
  const initialChoice = VALID_CHOICES.find(c => c === choice)

  const profile = await getProfile(username)
  if (!profile || profile.privacy_mode === 'stealth') notFound()

  const supabase = await createClient()
  const [t, { data: methods }, { data: { user } }, { data: highlight }, { data: budgetProgress }] = await Promise.all([
    getTranslations('PaymentMethods'),
    supabase.from('payment_methods').select('*').eq('profile_id', profile.id).eq('is_active', true).order('sort_order'),
    supabase.auth.getUser(),
    highlight_id
      ? supabase.from('highlights').select('id, title, currency').eq('id', highlight_id).eq('profile_id', profile.id).single()
      : Promise.resolve({ data: null as { id: string; title: string; currency: string } | null }),
    highlight_id
      ? supabase.from('project_budget_progress').select('*').eq('highlight_id', highlight_id).order('order_index')
      : Promise.resolve({ data: null }),
  ])

  const budgetCategories = (budgetProgress ?? []).map(c => ({
    id: c.id,
    label: resolveBudgetCategoryLabel(c),
    raised_amount: c.raised_amount,
    target_amount: c.target_amount,
  }))
  const initialCategoryId = category && budgetCategories.some(c => c.id === category) ? category : null

  const stripeAvailable = (methods ?? []).some(m => m.type === 'stripe')
  const manualMethods = (methods ?? []).filter(m => m.type !== 'stripe')

  const defaultCurrency = highlight?.currency ?? 'BRL'

  const paymentOptions: { id: string; method: PledgePaymentMethod; label: string; value: string; details: string | null; currency: string }[] =
    manualMethods.map(m => ({ id: m.id, method: m.type, label: m.label || t(`type_${m.type}`), value: m.value, details: m.details, currency: m.currency }))
  if (!paymentOptions.some(o => o.method === 'bank_transfer')) {
    paymentOptions.push({ id: 'bank_transfer', method: 'bank_transfer', label: t('type_bank_transfer'), value: '', details: null, currency: defaultCurrency })
  }
  if (!paymentOptions.some(o => o.method === 'other')) {
    paymentOptions.push({ id: 'other', method: 'other', label: t('type_other'), value: '', details: null, currency: defaultCurrency })
  }

  const missionStartYear = profile.mission_start_date ? new Date(profile.mission_start_date).getFullYear() : null

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <PartnershipWizard
          profileId={profile.id}
          username={username}
          initialChoice={initialChoice}
          missionaryName={profile.display_name}
          missionStartYear={missionStartYear}
          highlightId={highlight?.id}
          highlightTitle={highlight?.title}
          defaultCurrency={defaultCurrency}
          paymentOptions={paymentOptions}
          budgetCategories={budgetCategories}
          initialCategoryId={initialCategoryId}
          hasFinancialOptions={true}
          stripeAvailable={stripeAvailable}
          user={user ? { id: user.id, email: user.email ?? null, user_metadata: { full_name: user.user_metadata?.full_name } } : null}
        />
      </div>
    </div>
  )
}
