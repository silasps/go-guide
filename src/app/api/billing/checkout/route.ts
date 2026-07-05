import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getActiveProfile } from '@/lib/profile/active-profile'
import { getStripeClient } from '@/lib/stripe/client'
import { MANAGER_ADDONS } from '@/lib/pricing'

const PRICE_ENV_VARS = {
  pro: { monthly: 'STRIPE_PRICE_PRO_MONTHLY', yearly: 'STRIPE_PRICE_PRO_YEARLY' },
  mission: { monthly: 'STRIPE_PRICE_MISSION_MONTHLY', yearly: 'STRIPE_PRICE_MISSION_YEARLY' },
} as const

export async function POST(req: NextRequest) {
  const stripe = getStripeClient()
  if (!stripe) {
    return NextResponse.json({ error: 'not_configured' }, { status: 501 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const profile = await getActiveProfile()
  if (!profile) return NextResponse.json({ error: 'Perfil não encontrado' }, { status: 404 })

  const body = await req.json()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin

  // Pacote de gestores extras (além do incluído no plano — ver planLimits().managersIncluded).
  // Igual ao upgrade de plano abaixo, a sessão é criada mas o incremento de
  // profiles.extra_manager_seats depende do webhook Stripe → profiles, ainda não implementado.
  if (body.type === 'manager_addon') {
    const addon = MANAGER_ADDONS.find((a) => a.seats === body.seats)
    if (!addon) return NextResponse.json({ error: 'invalid_addon' }, { status: 400 })
    const priceId = process.env[addon.stripePriceEnvVar]
    if (!priceId) return NextResponse.json({ error: 'not_configured' }, { status: 501 })

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: profile.stripe_customer_id ?? undefined,
      customer_email: profile.stripe_customer_id ? undefined : user.email,
      line_items: [{ price: priceId, quantity: 1 }],
      metadata: { profile_id: profile.id, type: 'manager_addon', seats: String(addon.seats) },
      success_url: `${appUrl}/dashboard/configuracoes?checkout=success`,
      cancel_url: `${appUrl}/dashboard/configuracoes?checkout=cancelled`,
    })
    return NextResponse.json({ url: session.url })
  }

  const { plan, interval } = body as { plan: 'pro' | 'mission'; interval: 'monthly' | 'yearly' }
  const envVar = PRICE_ENV_VARS[plan]?.[interval]
  const priceId = envVar ? process.env[envVar] : undefined
  if (!priceId) return NextResponse.json({ error: 'not_configured' }, { status: 501 })

  // Cobrança global: Stripe Checkout + Adaptive Pricing (ativado no dashboard da Stripe)
  // converte automaticamente o preço em USD/BRL para a moeda local do cartão do parceiro.
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: profile.stripe_customer_id ?? undefined,
    customer_email: profile.stripe_customer_id ? undefined : user.email,
    line_items: [{ price: priceId, quantity: 1 }],
    metadata: { profile_id: profile.id, plan },
    success_url: `${appUrl}/dashboard?checkout=success`,
    cancel_url: `${appUrl}/planos?checkout=cancelled`,
  })

  return NextResponse.json({ url: session.url })
}
