import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createServiceClient } from '@/lib/supabase/server'
import { getStripeClient } from '@/lib/stripe/client'
import type { PlanId } from '@/lib/pricing'

// Webhook de cobrança da PLATAFORMA (upgrade de plano + assentos extras de
// gestor) — separado do webhook de Stripe Connect (src/app/api/stripe/webhook,
// secret próprio) que trata cobrança recebida PELOS missionários. Sincroniza
// profiles.plan/extra_manager_seats/stripe_customer_id e a tabela
// `subscriptions`, fechando a lacuna documentada em system.architecture.md
// (checkout já existia, só faltava este lado).
export async function POST(req: NextRequest) {
  const stripe = getStripeClient()
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
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
    const m = session.metadata
    if (session.mode === 'subscription' && m?.profile_id && session.customer) {
      await supabase.from('profiles').update({ stripe_customer_id: String(session.customer) }).eq('id', m.profile_id)
    }

    if (session.mode === 'subscription' && m?.type === 'plan' && m.profile_id && m.plan && session.subscription) {
      const subscription = await stripe.subscriptions.retrieve(String(session.subscription))
      const periodEnd = new Date(subscription.items.data[0].current_period_end * 1000).toISOString()

      await supabase.from('profiles').update({ plan: m.plan as PlanId }).eq('id', m.profile_id)
      await supabase.from('subscriptions').upsert({
        profile_id: m.profile_id,
        stripe_subscription_id: subscription.id,
        plan: m.plan,
        status: subscription.status,
        current_period_end: periodEnd,
      }, { onConflict: 'profile_id' })
    }

    if (session.mode === 'subscription' && m?.type === 'manager_addon' && m.profile_id && m.seats) {
      const { data: profileRow } = await supabase.from('profiles').select('extra_manager_seats').eq('id', m.profile_id).single()
      const current = profileRow?.extra_manager_seats ?? 0
      await supabase.from('profiles').update({ extra_manager_seats: current + Number(m.seats) }).eq('id', m.profile_id)
    }
  }

  if (event.type === 'customer.subscription.updated') {
    const subscription = event.data.object as Stripe.Subscription
    const m = subscription.metadata
    if (m?.type === 'plan' && m.profile_id) {
      const periodEnd = new Date(subscription.items.data[0].current_period_end * 1000).toISOString()
      await supabase.from('subscriptions').update({
        status: subscription.status,
        current_period_end: periodEnd,
      }).eq('stripe_subscription_id', subscription.id)
    }
  }

  if (event.type === 'customer.subscription.deleted') {
    const subscription = event.data.object as Stripe.Subscription
    const m = subscription.metadata

    if (m?.type === 'plan' && m.profile_id) {
      await supabase.from('profiles').update({ plan: 'free' }).eq('id', m.profile_id)
      await supabase.from('subscriptions').update({ status: 'cancelled' }).eq('stripe_subscription_id', subscription.id)
    }

    if (m?.type === 'manager_addon' && m.profile_id && m.seats) {
      const { data: profileRow } = await supabase.from('profiles').select('extra_manager_seats').eq('id', m.profile_id).single()
      const current = profileRow?.extra_manager_seats ?? 0
      const next = Math.max(0, current - Number(m.seats))
      await supabase.from('profiles').update({ extra_manager_seats: next }).eq('id', m.profile_id)
    }
  }

  return NextResponse.json({ received: true })
}
