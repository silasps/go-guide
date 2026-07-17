import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getActiveProfile } from '@/lib/profile/active-profile'
import { getStripeClient } from '@/lib/stripe/client'

// return_url do Account Link (não é OAuth — não vem `code`/`state` aqui).
// A Stripe manda de volta assim que o missionário sai do onboarding
// hospedado, mesmo que ele tenha fechado antes de terminar — por isso
// sempre conferimos o status real da conta antes de marcar como ativa.
export async function GET(req: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin
  const settingsUrl = new URL('/dashboard/configuracoes', appUrl)
  settingsUrl.searchParams.set('tab', 'pagamentos')

  const stripe = getStripeClient()
  if (!stripe) {
    settingsUrl.searchParams.set('stripe', 'not_configured')
    return NextResponse.redirect(settingsUrl)
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const profile = await getActiveProfile()
  if (!user || !profile) return NextResponse.redirect(new URL('/login', appUrl))

  const { data: method } = await supabase
    .from('payment_methods')
    .select('id, value')
    .eq('profile_id', profile.id)
    .eq('type', 'stripe')
    .maybeSingle()

  if (!method) {
    settingsUrl.searchParams.set('stripe', 'error')
    return NextResponse.redirect(settingsUrl)
  }

  try {
    const account = await stripe.accounts.retrieve(method.value)
    if (account.details_submitted && account.charges_enabled) {
      await supabase.from('payment_methods').update({ is_active: true }).eq('id', method.id)
      settingsUrl.searchParams.set('stripe', 'connected')
    } else {
      settingsUrl.searchParams.set('stripe', 'incomplete')
    }
  } catch {
    settingsUrl.searchParams.set('stripe', 'error')
  }

  return NextResponse.redirect(settingsUrl)
}
