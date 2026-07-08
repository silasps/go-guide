import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { OnboardingWizard } from '@/components/onboarding/onboarding-wizard'

export default async function OnboardingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (!profile) redirect('/login')

  const { count: paymentMethodsCount } = await supabase
    .from('payment_methods')
    .select('*', { count: 'exact', head: true })
    .eq('profile_id', profile.id)

  const t = await getTranslations('Onboarding')

  return (
    <div className="min-h-screen bg-muted/30 flex flex-col items-center justify-center px-4 py-10">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold">{t('welcomeTitle')}</h1>
        <p className="text-muted-foreground mt-2">{t('welcomeSubtitle')}</p>
      </div>
      <OnboardingWizard profile={profile} hasPaymentMethod={(paymentMethodsCount ?? 0) > 0} />
    </div>
  )
}
