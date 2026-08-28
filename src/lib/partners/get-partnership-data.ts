import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { getProfile } from '@/lib/profile/get-profile'
import { PledgePaymentMethod } from '@/types/database'
import { resolveBudgetCategoryLabel } from '@/lib/highlights/budget-category-labels'
import type { PartnershipWizardProps } from '@/components/partners/partnership-wizard'

const VALID_CHOICES = ['financial_once', 'financial_once_general', 'financial_ongoing', 'prayer', 'ambassador', 'volunteer'] as const

interface PartnershipSearchParams {
  highlight_id?: string
  choice?: string
  category?: string
}

/** Busca dos dados de `/[username]/parceria`, compartilhada entre a página
 *  cheia e a rota interceptada (modal) — as duas renderizam o mesmo
 *  PartnershipWizard, só muda o container em volta. */
export async function getPartnershipData(username: string, { highlight_id, choice, category }: PartnershipSearchParams): Promise<PartnershipWizardProps | null> {
  const initialChoice = VALID_CHOICES.find(c => c === choice)

  const profile = await getProfile(username)
  if (!profile || profile.privacy_mode === 'stealth') return null

  const supabase = await createClient()
  const [t, { data: methods }, { data: { user } }, { data: highlight }, { data: budgetProgress }] = await Promise.all([
    getTranslations('PaymentMethods'),
    supabase.from('payment_methods').select('*').eq('profile_id', profile.id).eq('is_active', true).order('sort_order'),
    supabase.auth.getUser(),
    highlight_id
      ? supabase.from('highlights').select('id, title, currency, cover_url, cover_position').eq('id', highlight_id).eq('profile_id', profile.id).single()
      : Promise.resolve({ data: null as { id: string; title: string; currency: string; cover_url: string | null; cover_position: string | null } | null }),
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

  return {
    profileId: profile.id,
    username,
    initialChoice,
    missionaryName: profile.display_name,
    missionStartYear,
    highlightId: highlight?.id,
    highlightTitle: highlight?.title,
    defaultCurrency,
    paymentOptions,
    budgetCategories,
    initialCategoryId,
    hasFinancialOptions: true,
    stripeAvailable,
    profileAvatarUrl: profile.avatar_url,
    highlightCoverUrl: highlight?.cover_url ?? null,
    highlightCoverPosition: highlight?.cover_position ?? null,
    user: user ? { id: user.id, email: user.email ?? null, user_metadata: { full_name: user.user_metadata?.full_name } } : null,
  }
}
