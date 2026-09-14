import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { getTranslations } from 'next-intl/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getStripeClient } from '@/lib/stripe/client'
import { sendEmail } from '@/lib/email/brevo'
import { renderEmailTemplate } from '@/lib/email/template'
import { isLocale } from '@/i18n/config'
import { formatCurrency } from '@/lib/utils'

type ServiceClient = Awaited<ReturnType<typeof createServiceClient>>

// Busca a taxa real que a Stripe descontou de uma cobrança, direto da
// `balance_transaction` da conta conectada — sem isso não dava pra saber
// quanto de fato cai na conta do missionário (pedido do usuário, 2026-09-12).
// Primeira versão fazia `transactions.amount` já nascer líquido (bruto menos
// taxa) numa linha só; o usuário preferiu manter a oferta pelo valor cheio
// e lançar a taxa como uma segunda transação de despesa à parte, pra ficar
// rastreável (2026-09-13) — esta função virou só um lookup da taxa, quem soma
// os dois lançamentos é o saldo da conta, não um cálculo aqui. Melhor
// esforço: se a `balance_transaction` ainda não estiver disponível (raro, mas
// pode acontecer com métodos de liquidação mais lenta), devolve 0 e a oferta
// é lançada normalmente, sem o lançamento de taxa — nunca bloqueia o registro
// da oferta por isso.
async function getStripeFeeAmount(
  stripe: Stripe,
  paymentIntentId: string,
  stripeAccount: string,
): Promise<number> {
  try {
    const pi = await stripe.paymentIntents.retrieve(
      paymentIntentId,
      { expand: ['latest_charge.balance_transaction'] },
      { stripeAccount },
    )
    const charge = pi.latest_charge as Stripe.Charge | null
    const balanceTransaction = charge?.balance_transaction as Stripe.BalanceTransaction | null | undefined
    return balanceTransaction ? balanceTransaction.fee / 100 : 0
  } catch {
    return 0
  }
}

// Cumpre a responsabilidade de "notificar vendedores quando afetados por
// risco/prevenção de fraude" que a Stripe exige reconhecer no perfil da
// plataforma (Managed risk, ver system.architecture.md 7.11) — sem isso o
// missionário só saberia que a conta dele foi restringida se checasse o
// próprio Dashboard da Stripe por conta própria. Dono de conta conectada é
// sempre um usuário de verdade — `profiles.locale` resolve o idioma sem
// precisar de fallback pra convidado.
async function connectedAccountRecipient(supabase: ServiceClient, stripeAccountId: string) {
  const { data: method } = await supabase
    .from('payment_methods')
    .select('profile_id')
    .eq('type', 'stripe')
    .eq('value', stripeAccountId)
    .maybeSingle()
  if (!method) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('user_id, display_name, locale')
    .eq('id', method.profile_id)
    .maybeSingle()
  if (!profile) return null

  const { data: userRes } = await supabase.auth.admin.getUserById(profile.user_id)
  const email = userRes?.user?.email
  if (!email) return null

  return { email, displayName: profile.display_name, locale: isLocale(profile.locale) ? profile.locale : 'pt' } as const
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
        const donorLabel = isAnonymous ? 'Apoiador anônimo' : (m.pledge_name || 'Doador')
        const txDate = new Date().toISOString().slice(0, 10)

        const { data: transaction } = await supabase.from('transactions').insert({
          account_id: stripeMethod.linked_account_id,
          profile_id: profileId,
          created_by_user_id: null,
          type: 'income',
          amount,
          currency,
          description: `Oferta via Stripe — ${donorLabel}`,
          partner_id: partnerId,
          highlight_id: m.pledge_highlight_id || null,
          budget_category_id: m.pledge_budget_category_id || null,
          source: 'api',
          date: txDate,
        }).select('id').single()

        if (transaction) {
          await supabase.from('pledges').update({ confirmed_transaction_id: transaction.id }).eq('id', newPledge.id)

          const paymentIntentId = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id
          const feeAmount = paymentIntentId && event.account ? await getStripeFeeAmount(stripe, paymentIntentId, event.account) : 0
          if (feeAmount > 0) {
            await supabase.from('transactions').insert({
              account_id: stripeMethod.linked_account_id,
              profile_id: profileId,
              created_by_user_id: null,
              type: 'expense',
              amount: feeAmount,
              currency,
              description: `Taxa Stripe — ${donorLabel}`,
              partner_id: partnerId,
              source: 'api',
              date: txDate,
            })
          }
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
          const partnerLabel = partner?.name ?? 'Parceiro'
          const txDate = new Date().toISOString().slice(0, 10)

          const { data: transaction } = await supabase.from('transactions').insert({
            account_id: stripeMethod.linked_account_id,
            profile_id: rp.profile_id,
            created_by_user_id: null,
            type: 'income',
            amount,
            currency: rp.currency,
            description: `Assinatura Stripe — ${partnerLabel}`,
            partner_id: rp.partner_id,
            highlight_id: rp.highlight_id,
            source: 'api',
            date: txDate,
          }).select('id').single()

          if (transaction) {
            await supabase.from('pledges').update({ confirmed_transaction_id: transaction.id }).eq('id', newPledge.id)

            let paymentIntentId: string | undefined
            if (event.account) {
              try {
                const fullInvoice = await stripe.invoices.retrieve(
                  invoice.id!,
                  { expand: ['payments.data.payment.payment_intent'] },
                  { stripeAccount: event.account },
                )
                const paymentRef = fullInvoice.payments?.data?.[0]?.payment?.payment_intent
                paymentIntentId = typeof paymentRef === 'string' ? paymentRef : paymentRef?.id
              } catch {
                paymentIntentId = undefined
              }
            }
            const feeAmount = paymentIntentId && event.account ? await getStripeFeeAmount(stripe, paymentIntentId, event.account) : 0
            if (feeAmount > 0) {
              await supabase.from('transactions').insert({
                account_id: stripeMethod.linked_account_id,
                profile_id: rp.profile_id,
                created_by_user_id: null,
                type: 'expense',
                amount: feeAmount,
                currency: rp.currency,
                description: `Taxa Stripe — ${partnerLabel}`,
                partner_id: rp.partner_id,
                source: 'api',
                date: txDate,
              })
            }
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
  // só mexe no estado quando `requirements` mudou NESTE evento
  // (previous_attributes), não em toda atualização irrelevante da conta
  // enquanto ela seguir restrita. `stripe_disabled_reason` é persistido em
  // `payment_methods` (não só disparado por e-mail e esquecido) pra
  // `StripeConnectCard` conseguir refletir o estado atual — e é limpo
  // automaticamente aqui quando a Stripe libera a conta de novo.
  if (event.type === 'account.updated' && event.account) {
    const account = event.data.object as Stripe.Account
    const changedRequirements = (event.data.previous_attributes as Partial<Stripe.Account> | undefined)?.requirements
    if (changedRequirements) {
      const disabledReason = account.requirements?.disabled_reason ?? null
      await supabase
        .from('payment_methods')
        .update({ stripe_disabled_reason: disabledReason })
        .eq('type', 'stripe')
        .eq('value', event.account)

      if (disabledReason) {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin
        const recipient = await connectedAccountRecipient(supabase, event.account)
        if (recipient) {
          const t = await getTranslations({ locale: recipient.locale, namespace: 'StripeAlertsEmail' })
          await sendEmail({
            to: recipient.email,
            toName: recipient.displayName,
            subject: t('restrictedSubject'),
            html: renderEmailTemplate({
              appUrl,
              title: t('restrictedSubject'),
              accent: 'warning',
              preheader: t('restrictedPreheader'),
              bodyHtml: `<p style="margin:0 0 12px;">${t('restrictedBody')}</p>
               <p style="margin:0 0 12px;padding:12px 14px;background:#faf5eb;border-radius:10px;color:#0a0a0a;"><strong>${t('restrictedReasonLabel')}</strong> ${disabledReason}</p>
               <p style="margin:0;">${t('restrictedInstructions')}</p>`,
              cta: { url: `${appUrl}/api/stripe/connect/start`, label: t('restrictedCta') },
            }),
          })
        }
      }
    }
  }

  // Contestação (chargeback) numa cobrança da conta conectada.
  if (event.type === 'charge.dispute.created' && event.account) {
    const dispute = event.data.object as Stripe.Dispute
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin
    const recipient = await connectedAccountRecipient(supabase, event.account)
    if (recipient) {
      const t = await getTranslations({ locale: recipient.locale, namespace: 'StripeAlertsEmail' })
      await sendEmail({
        to: recipient.email,
        toName: recipient.displayName,
        subject: t('disputeSubject'),
        html: renderEmailTemplate({
          appUrl,
          title: t('disputeSubject'),
          accent: 'warning',
          preheader: t('disputePreheader'),
          bodyHtml: `<p style="margin:0 0 12px;">${t('disputeBody', { amount: formatCurrency(dispute.amount / 100, dispute.currency.toUpperCase()), reason: dispute.reason.replace(/_/g, ' ') })}</p>
           <p style="margin:0;">${t('disputeInstructions')}</p>`,
          cta: { url: `${appUrl}/dashboard/configuracoes?tab=pagamentos`, label: t('defaultCta') },
        }),
      })
    }
  }

  return NextResponse.json({ received: true })
}
