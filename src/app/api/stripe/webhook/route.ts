import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createServiceClient } from '@/lib/supabase/server'
import { getStripeClient } from '@/lib/stripe/client'

// Webhook de Stripe Connect — recebe eventos de TODAS as contas conectadas
// (endpoint configurado nas configurações de Connect do Stripe Dashboard,
// secret separado do webhook de billing da plataforma).
export async function POST(req: NextRequest) {
  const stripe = getStripeClient()
  const webhookSecret = process.env.STRIPE_CONNECT_WEBHOOK_SECRET
  if (!stripe || !webhookSecret) return NextResponse.json({ error: 'not_configured' }, { status: 501 })

  const signature = req.headers.get('stripe-signature')
  if (!signature) return NextResponse.json({ error: 'missing_signature' }, { status: 400 })

  const body = await req.text()
  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
  } catch {
    return NextResponse.json({ error: 'invalid_signature' }, { status: 400 })
  }

  const supabase = await createServiceClient()

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    const recurringPledgeId = session.metadata?.recurring_pledge_id
    if (session.mode === 'subscription' && recurringPledgeId && session.subscription) {
      await supabase.from('recurring_pledges').update({
        status: 'active',
        stripe_subscription_id: String(session.subscription),
      }).eq('id', recurringPledgeId)
    }
  }

  if (event.type === 'invoice.payment_succeeded') {
    const invoice = event.data.object as Stripe.Invoice
    const subscriptionId = typeof invoice.parent?.subscription_details?.subscription === 'string'
      ? invoice.parent.subscription_details.subscription
      : invoice.parent?.subscription_details?.subscription?.id
    if (subscriptionId) {
      const { data: rp } = await supabase
        .from('recurring_pledges')
        .select('*, partners(name, email)')
        .eq('stripe_subscription_id', subscriptionId)
        .maybeSingle()

      if (rp) {
        const amount = invoice.amount_paid / 100
        const partner = Array.isArray(rp.partners) ? rp.partners[0] : rp.partners

        const { data: newPledge } = await supabase.from('pledges').insert({
          profile_id: rp.profile_id,
          highlight_id: rp.highlight_id,
          partner_id: rp.partner_id,
          reporter_user_id: rp.reporter_user_id,
          reporter_name: partner?.name ?? 'Parceiro',
          reporter_email: partner?.email ?? null,
          reported_amount: amount,
          currency: rp.currency,
          payment_method: 'stripe',
          reported_at: new Date().toISOString(),
          is_recurring_pledge: true,
          recurring_pledge_id: rp.id,
          status: 'confirmed',
          reviewed_at: new Date().toISOString(),
        }).select('id').single()

        const { data: stripeMethod } = await supabase
          .from('payment_methods')
          .select('linked_account_id')
          .eq('profile_id', rp.profile_id)
          .eq('type', 'stripe')
          .maybeSingle()

        if (newPledge && stripeMethod?.linked_account_id) {
          const { data: transaction } = await supabase.from('transactions').insert({
            account_id: stripeMethod.linked_account_id,
            profile_id: rp.profile_id,
            created_by_user_id: null,
            type: 'income',
            amount,
            currency: rp.currency,
            description: `Assinatura Stripe — ${partner?.name ?? 'Parceiro'}`,
            partner_id: rp.partner_id,
            highlight_id: rp.highlight_id,
            source: 'api',
            date: new Date().toISOString().slice(0, 10),
          }).select('id').single()

          if (transaction) {
            await supabase.from('pledges').update({ confirmed_transaction_id: transaction.id }).eq('id', newPledge.id)
          }
        }
      }
    }
  }

  if (event.type === 'customer.subscription.deleted') {
    const subscription = event.data.object as Stripe.Subscription
    await supabase.from('recurring_pledges').update({ status: 'cancelled' }).eq('stripe_subscription_id', subscription.id)
  }

  return NextResponse.json({ received: true })
}
