import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getActiveProfile } from '@/lib/profile/active-profile'
import { getStripeClient } from '@/lib/stripe/client'
import { STRIPE_CONNECT_COUNTRIES } from '@/lib/stripe/connect-countries'

// Fluxo Express + Account Link: a plataforma cria a conta conectada e a
// Stripe hospeda o formulário de onboarding (dados bancários, identidade)
// direto no domínio stripe.com — o app nunca vê nem guarda essas
// informações, só recebe de volta o ID da conta. Diferente do Connect
// Standard (OAuth), não exige nenhum client_id configurado na plataforma.
export async function GET(req: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin
  const settingsUrl = new URL('/dashboard/configuracoes', appUrl)
  settingsUrl.searchParams.set('tab', 'pagamentos')

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/login?redirect=/dashboard/configuracoes', req.url))

  const stripe = getStripeClient()
  if (!stripe) {
    settingsUrl.searchParams.set('stripe', 'not_configured')
    return NextResponse.redirect(settingsUrl)
  }

  const profile = await getActiveProfile()
  if (!profile) return NextResponse.redirect(new URL('/login', appUrl))

  const { data: existing } = await supabase
    .from('payment_methods')
    .select('id, value')
    .eq('profile_id', profile.id)
    .eq('type', 'stripe')
    .maybeSingle()

  let accountId = existing?.value ?? null

  if (!accountId) {
    const country = req.nextUrl.searchParams.get('country')?.toUpperCase()
    if (!country || !STRIPE_CONNECT_COUNTRIES.includes(country as typeof STRIPE_CONNECT_COUNTRIES[number])) {
      settingsUrl.searchParams.set('stripe', 'country_required')
      return NextResponse.redirect(settingsUrl)
    }

    try {
      const account = await stripe.accounts.create({
        type: 'express',
        country,
        email: user.email,
        capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
      })
      accountId = account.id

      await supabase.from('payment_methods').insert({
        profile_id: profile.id,
        type: 'stripe',
        label: 'Stripe',
        value: accountId,
        is_active: false,
        sort_order: 0,
      })
    } catch {
      settingsUrl.searchParams.set('stripe', 'error')
      return NextResponse.redirect(settingsUrl)
    }
  }

  try {
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      type: 'account_onboarding',
      refresh_url: `${appUrl}/api/stripe/connect/start`,
      return_url: `${appUrl}/api/stripe/connect/callback`,
    })
    return NextResponse.redirect(accountLink.url)
  } catch {
    settingsUrl.searchParams.set('stripe', 'error')
    return NextResponse.redirect(settingsUrl)
  }
}
