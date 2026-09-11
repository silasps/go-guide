import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createServiceClient } from '@/lib/supabase/server'
import { getStripeClient } from '@/lib/stripe/client'
import { sendEmail } from '@/lib/email/brevo'
import { renderEmailTemplate } from '@/lib/email/template'
import { formatCurrency } from '@/lib/utils'

type ServiceClient = Awaited<ReturnType<typeof createServiceClient>>

// Cumpre a responsabilidade de "notificar vendedores quando afetados por
// risco/prevenção de fraude" que a Stripe exige reconhecer no perfil da
// plataforma (Managed risk, ver system.architecture.md 7.11) — sem isso o
// missionário só saberia que a conta dele foi restringida se checasse o
// próprio Dashboard da Stripe por conta própria.
async function notifyConnectedAccountOwner(
  supabase: ServiceClient,
  appUrl: string,
  stripeAccountId: string,
  subject: string,
  bodyHtml: string,
  preheader: string
) {
  const { data: method } = await supabase
    .from('payment_methods')
    .select('profile_id')
    .eq('type', 'stripe')
    .eq('value', stripeAccountId)
    .maybeSingle()
  if (!method) return

  const { data: profile } = await supabase
    .from('profiles')
    .select('user_id, display_name')
    .eq('id', method.profile_id)
    .maybeSingle()
  if (!profile) return

  const { data: userRes } = await supabase.auth.admin.getUserById(profile.user_id)
  const email = userRes?.user?.email
  if (!email) return

  await sendEmail({
    to: email,
    toName: profile.display_name,
    subject,
    html: renderEmailTemplate({
      appUrl,
      title: subject,
      accent: 'warning',
      preheader,
      bodyHtml,
      cta: { url: `${appUrl}/dashboard/configuracoes?tab=pagamentos`, label: 'Ver configurações de pagamento' },
    }),
  })
}

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
      const subscriptionId = String(session.subscription)
      await supabase.from('recurring_pledges').update({
        status: 'active',
        stripe_subscription_id: subscriptionId,
      }).eq('id', recurringPledgeId)

      // Checkout Session não aceita `cancel_at` na criação (ver
      // checkout-recurring/route.ts) — agenda o encerramento automático
      // agora que a assinatura de fato existe, usando o mesmo timestamp já
      // gravado em `stripe_cancel_at` na hora do pedido.
      const { data: rp } = await supabase.from('recurring_pledges').select('stripe_cancel_at').eq('id', recurringPledgeId).maybeSingle()
      if (rp?.stripe_cancel_at) {
        await stripe.subscriptions.update(subscriptionId, {
          cancel_at: Math.floor(new Date(rp.stripe_cancel_at).getTime() / 1000),
        }, { stripeAccount: event.account })
      }
    }

    const profileId = session.metadata?.pledge_profile_id
    if (session.mode === 'payment' && profileId) {
      const m = session.metadata!
      const isAnonymous = m.pledge_is_anonymous === '1'
      const reporterUserId = m.pledge_reporter_user_id || null
      const amount = (session.amount_total ?? 0) / 100
      const currency = (session.currency ?? 'brl').toUpperCase()

      let partnerId: string | null = null
      if (!isAnonymous && reporterUserId) {
        const { data: existing } = await supabase.from('partners').select('id').eq('profile_id', profileId).eq('user_id', reporterUserId).maybeSingle()
        if (existing) {
          partnerId = existing.id
        } else {
          const { data: created } = await supabase.from('partners').insert({
            profile_id: profileId,
            user_id: reporterUserId,
            name: m.pledge_name || 'Parceiro',
            email: m.pledge_email || session.customer_details?.email || null,
            type: 'financial',
          }).select('id').single()
          partnerId = created?.id ?? null
        }
      }

      const { data: newPledge } = await supabase.from('pledges').insert({
        highlight_id: m.pledge_highlight_id || null,
        budget_category_id: m.pledge_budget_category_id || null,
        profile_id: profileId,
        partner_id: partnerId,
        reporter_user_id: reporterUserId,
        reporter_name: isAnonymous ? null : (m.pledge_name || null),
        reporter_email: isAnonymous ? null : (m.pledge_email || session.customer_details?.email || null),
        is_anonymous: isAnonymous,
        message: m.pledge_message || null,
        reported_amount: amount,
        currency,
        payment_method: 'stripe',
        reported_at: new Date().toISOString(),
        is_recurring_pledge: false,
        status: 'confirmed',
        reviewed_at: new Date().toISOString(),
      }).select('id').single()

      const { data: stripeMethod } = await supabase
        .from('payment_methods')
        .select('linked_account_id')
        .eq('profile_id', profileId)
        .eq('type', 'stripe')
        .maybeSingle()

      if (newPledge && stripeMethod?.linked_account_id) {
        const { data: transaction } = await supabase.from('transactions').insert({
          account_id: stripeMethod.linked_account_id,
          profile_id: profileId,
          created_by_user_id: null,
          type: 'income',
          amount,
          currency,
          description: `Oferta via Stripe — ${isAnonymous ? 'Apoiador anônimo' : (m.pledge_name || 'Doador')}`,
          partner_id: partnerId,
          highlight_id: m.pledge_highlight_id || null,
          budget_category_id: m.pledge_budget_category_id || null,
          source: 'api',
          date: new Date().toISOString().slice(0, 10),
        }).select('id').single()

        if (transaction) {
          await supabase.from('pledges').update({ confirmed_transaction_id: transaction.id }).eq('id', newPledge.id)
        }
      }
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

        // Progresso do prazo combinado (duration_months) — só pra exibição,
        // quem de fato encerra a assinatura é o `cancel_at` já configurado
        // na criação (checkout-recurring/route.ts), não uma contagem aqui.
        await supabase.from('recurring_pledges').update({ cycles_completed: rp.cycles_completed + 1 }).eq('id', rp.id)

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
    // Distingue "terminou o prazo combinado sozinho" (completed) de
    // "cancelado antes da hora" (cancelled): compara o instante real do
    // cancelamento com o `stripe_cancel_at` que a gente mesmo mandou pro
    // Stripe na criação (checkout-recurring/route.ts) — tolerância de 2
    // dias cobre fuso/retry sem abrir margem pra confundir com um
    // cancelamento manual muito antecipado.
    const { data: rp } = await supabase
      .from('recurring_pledges')
      .select('id, stripe_cancel_at')
      .eq('stripe_subscription_id', subscription.id)
      .maybeSingle()

    let status: 'cancelled' | 'completed' = 'cancelled'
    if (rp?.stripe_cancel_at && subscription.canceled_at) {
      const diffDays = Math.abs(subscription.canceled_at * 1000 - new Date(rp.stripe_cancel_at).getTime()) / 86_400_000
      if (diffDays <= 2) status = 'completed'
    }

    await supabase.from('recurring_pledges').update({
      status,
      completed_at: status === 'completed' ? new Date().toISOString() : null,
    }).eq('stripe_subscription_id', subscription.id)
  }

  // Conta conectada restringida (risco/conformidade/documentação pendente) —
  // só alerta quando `requirements` mudou NESTE evento (previous_attributes),
  // não em toda atualização irrelevante da conta enquanto ela seguir restrita.
  if (event.type === 'account.updated' && event.account) {
    const account = event.data.object as Stripe.Account
    const changedRequirements = (event.data.previous_attributes as Partial<Stripe.Account> | undefined)?.requirements
    if (changedRequirements && account.requirements?.disabled_reason) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin
      await notifyConnectedAccountOwner(
        supabase,
        appUrl,
        event.account,
        'Sua conta Stripe precisa de atenção',
        `<p style="margin:0 0 12px;">A Stripe restringiu temporariamente o recebimento de pagamentos na sua conta conectada, por questões de risco ou conformidade.</p>
         <p style="margin:0 0 12px;padding:12px 14px;background:#faf5eb;border-radius:10px;color:#0a0a0a;"><strong>Motivo informado pela Stripe:</strong> ${account.requirements.disabled_reason}</p>
         <p style="margin:0;">Acesse suas configurações de pagamento pra ver o que precisa ser resolvido — geralmente é só confirmar algum documento ou dado adicional.</p>`,
        'Sua conta Stripe foi restringida — veja o que fazer.'
      )
    }
  }

  // Contestação (chargeback) numa cobrança da conta conectada.
  if (event.type === 'charge.dispute.created' && event.account) {
    const dispute = event.data.object as Stripe.Dispute
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin
    await notifyConnectedAccountOwner(
      supabase,
      appUrl,
      event.account,
      'Uma contestação foi aberta na sua conta Stripe',
      `<p style="margin:0 0 12px;">Um pagamento de <strong>${formatCurrency(dispute.amount / 100, dispute.currency.toUpperCase())}</strong> recebido na sua conta foi contestado pelo titular do cartão (motivo: ${dispute.reason.replace(/_/g, ' ')}).</p>
       <p style="margin:0;">Responda essa contestação direto no seu Dashboard da Stripe o quanto antes — contestações não respondidas dentro do prazo costumam ser perdidas automaticamente.</p>`,
      'Uma contestação foi aberta — responda no prazo.'
    )
  }

  return NextResponse.json({ received: true })
}
