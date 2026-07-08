import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { PartnershipWizard } from '@/components/partners/partnership-wizard'
import { PledgePaymentMethod } from '@/types/database'

interface Props {
  params: Promise<{ username: string }>
  searchParams: Promise<{ highlight_id?: string }>
}

export default async function ParceriaPage({ params, searchParams }: Props) {
  const { username } = await params
  const { highlight_id } = await searchParams
  const supabase = await createClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, display_name, privacy_mode, mission_start_date')
    .eq('username', username)
    .single()

  if (!profile || profile.privacy_mode === 'stealth') notFound()

  const t = await getTranslations('PaymentMethods')
  const { data: methods } = await supabase
    .from('payment_methods')
    .select('*')
    .eq('profile_id', profile.id)
    .eq('is_active', true)
    .order('sort_order')

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

  const paymentOptions: { method: PledgePaymentMethod; label: string; value: string }[] =
    (methods ?? []).map(m => ({ method: m.type, label: m.label || t(`type_${m.type}`), value: m.value }))
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
        <Link href={`/${username}`} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
          ← Voltar ao perfil de {profile.display_name}
        </Link>
        <div className="text-center">
          <h1 className="text-2xl font-bold">Faça parte com {profile.display_name}</h1>
          <p className="text-muted-foreground mt-2">Escolha como você quer se envolver com esta missão.</p>
        </div>
        <PartnershipWizard
          profileId={profile.id}
          missionaryName={profile.display_name}
          missionStartYear={missionStartYear}
          highlightId={highlight?.id}
          highlightTitle={highlight?.title}
          currency={highlight?.currency ?? 'BRL'}
          paymentOptions={paymentOptions}
          hasFinancialOptions={true}
        />
      </div>
    </div>
  )
}
