import { notFound } from 'next/navigation'
import Link from 'next/link'
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
    .select('id, display_name, privacy_mode, pix_key, paypal_url, wise_url, mission_start_date')
    .eq('username', username)
    .single()

  if (!profile || profile.privacy_mode === 'stealth') notFound()

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

  const paymentOptions: { method: PledgePaymentMethod; label: string; value: string }[] = []
  if (profile.pix_key) paymentOptions.push({ method: 'pix', label: '🔑 Pix', value: profile.pix_key })
  if (profile.paypal_url) paymentOptions.push({ method: 'paypal', label: '💳 PayPal', value: profile.paypal_url })
  if (profile.wise_url) paymentOptions.push({ method: 'wise', label: '🌍 Wise', value: profile.wise_url })
  paymentOptions.push({ method: 'bank_transfer', label: '🏦 Transferência bancária', value: '' })
  paymentOptions.push({ method: 'other', label: 'Outro', value: '' })

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
