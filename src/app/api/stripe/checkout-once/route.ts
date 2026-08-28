import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getStripeClient } from '@/lib/stripe/client'

// Doação avulsa com cartão, sem exigir login (diferente da recorrente em
// checkout-recurring/route.ts) — o pledge só é criado depois, pelo webhook,
// quando o pagamento é confirmado (ver metadata pledge_*).
export async function POST(req: NextRequest) {
  const stripe = getStripeClient()
  if (!stripe) return NextResponse.json({ error: 'not_configured' }, { status: 501 })

  const body = await req.json()
  const { profileId, amount, currency, highlightId, budgetCategoryId, isAnonymous, name, email, message } = body as {
    profileId: string; amount: number; currency: string; highlightId?: string; budgetCategoryId?: string
    isAnonymous: boolean; name?: string; email?: string; message?: string
  }
  if (!profileId || !amount || amount <= 0 || !currency) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }
  if (!isAnonymous && !name?.trim()) {
    return NextResponse.json({ error: 'name_required' }, { status: 400 })
  }

  const supabase = await createClient()
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

  const { data: { user } } = await supabase.auth.getUser()

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin
  // Mesma regra do PartnershipWizard pra decidir o passo (partnership-wizard.tsx):
  // highlightId só existe quando o passo é financial_once (doação vinculada a
  // um projeto) — sem isso, `choice` nunca vai no success/cancel_url e voltar
  // do Stripe cai na lista inicial em vez da tela de doação de onde saiu.
  const choice = highlightId ? 'financial_once' : 'financial_once_general'
  const returnUrl = `${appUrl}/${profile.username}/parceria${highlightId ? `?highlight_id=${highlightId}` : ''}`

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    customer_email: !isAnonymous ? (email?.trim() || user?.email || undefined) : undefined,
    line_items: [{
      price_data: {
        currency: currency.toLowerCase(),
        unit_amount: Math.round(amount * 100),
        product_data: { name: `Oferta — ${profile.display_name}` },
      },
      quantity: 1,
    }],
    metadata: {
      pledge_profile_id: profileId,
      pledge_highlight_id: highlightId || '',
      pledge_budget_category_id: budgetCategoryId || '',
      pledge_reporter_user_id: user?.id || '',
      pledge_is_anonymous: isAnonymous ? '1' : '0',
      pledge_name: isAnonymous ? '' : (name || '').slice(0, 480),
      pledge_email: isAnonymous ? '' : (email || '').slice(0, 480),
      pledge_message: (message || '').slice(0, 480),
    },
    success_url: `${returnUrl}${highlightId ? '&' : '?'}choice=${choice}&stripe=success`,
    cancel_url: `${returnUrl}${highlightId ? '&' : '?'}choice=${choice}&stripe=cancelled`,
  }, { stripeAccount: stripeMethod.value })

  return NextResponse.json({ url: session.url })
}
