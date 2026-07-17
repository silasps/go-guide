import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getStripeClient } from '@/lib/stripe/client'

export async function POST(req: NextRequest) {
  const stripe = getStripeClient()
  if (!stripe) return NextResponse.json({ error: 'not_configured' }, { status: 501 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 })

  const body = await req.json()
  const { profileId, amount, currency, highlightId } = body as {
    profileId: string; amount: number; currency: string; highlightId?: string
  }
  if (!profileId || !amount || amount <= 0 || !currency) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }

  const { data: profile } = await supabase.from('profiles').select('display_name, username').eq('id', profileId).maybeSingle()
  if (!profile) return NextResponse.json({ error: 'profile_not_found' }, { status: 404 })

  const { data: stripeMethod } = await supabase
    .from('payment_methods')
    .select('value')
    .eq('profile_id', profileId)
    .eq('type', 'stripe')
    .eq('is_active', true)
    .maybeSingle()
  if (!stripeMethod) return NextResponse.json({ error: 'stripe_not_connected' }, { status: 400 })

  // Encontra ou cria o parceiro — mesma lógica de src/components/financial/pledge-review-card.tsx,
  // só que já roda aqui porque o apoiador está autenticado (recorrência exige conta).
  let partnerId: string
  const { data: existingPartner } = await supabase.from('partners').select('id').eq('profile_id', profileId).eq('user_id', user.id).maybeSingle()
  if (existingPartner) {
    partnerId = existingPartner.id
  } else {
    const { data: createdPartner, error: partnerError } = await supabase.from('partners').insert({
      profile_id: profileId,
      user_id: user.id,
      name: user.user_metadata?.full_name || user.email!.split('@')[0],
      email: user.email,
      type: 'financial',
    }).select('id').single()
    if (partnerError || !createdPartner) return NextResponse.json({ error: 'partner_failed' }, { status: 500 })
    partnerId = createdPartner.id
  }

  const { data: recurringPledge, error: rpError } = await supabase.from('recurring_pledges').insert({
    profile_id: profileId,
    partner_id: partnerId,
    reporter_user_id: user.id,
    amount,
    currency,
    payment_method: 'stripe',
    highlight_id: highlightId || null,
    reminder_opt_in: false,
    next_reminder_at: null,
    status: 'pending',
  }).select('id').single()
  if (rpError || !recurringPledge) return NextResponse.json({ error: 'recurring_pledge_failed' }, { status: 500 })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin
  const returnUrl = `${appUrl}/${profile.username}/parceria${highlightId ? `?highlight_id=${highlightId}` : ''}`

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer_email: user.email ?? undefined,
    line_items: [{
      price_data: {
        currency: currency.toLowerCase(),
        unit_amount: Math.round(amount * 100),
        recurring: { interval: 'month' },
        product_data: { name: `Apoio mensal — ${profile.display_name}` },
      },
      quantity: 1,
    }],
    metadata: { recurring_pledge_id: recurringPledge.id },
    success_url: `${returnUrl}${highlightId ? '&' : '?'}stripe=success`,
    cancel_url: `${returnUrl}${highlightId ? '&' : '?'}stripe=cancelled`,
  }, { stripeAccount: stripeMethod.value })

  return NextResponse.json({ url: session.url })
}
