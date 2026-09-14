import { NextRequest, NextResponse } from 'next/server'
import { getTranslations } from 'next-intl/server'
import { createServiceClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email/brevo'
import { renderEmailTemplate, EmailAccent } from '@/lib/email/template'
import { wrapPersonalEmail } from '@/lib/email/personal-email-template'
import { isLocale, type Locale } from '@/i18n/config'
import { formatCurrency } from '@/lib/utils'

type ServiceClient = Awaited<ReturnType<typeof createServiceClient>>

const EMAIL_TYPES = ['new_message', 'pledge_confirmed', 'pledge_rejected', 'new_pledge', 'new_partner'] as const

interface NotificationRow {
  id: string
  recipient_user_id: string
  type: (typeof EMAIL_TYPES)[number]
  payload: Record<string, unknown>
  read_at: string | null
}

interface EmailContent {
  toName: string
  subject: string
  html: string
  /** Nome de exibição do remetente — só nos e-mails que soam como o
   *  missionário escrevendo (`pledge_confirmed`, ver wrapPersonalEmail).
   *  Omitido = remetente padrão da plataforma. */
  fromName?: string
}

// E-mail por notificação selecionada (new_message, pledge_confirmed, new_pledge,
// new_partner) — roda a cada 5min (vercel.json) varrendo `notifications` com
// email_sent_at IS NULL, mesmo padrão do cron prayer-partner-updates. Mensagens
// são E2EE (seção 6 do system.architecture.md) — o servidor nunca tem acesso ao
// texto claro, então o e-mail de new_message nunca inclui o conteúdo, só avisa
// que chegou algo novo.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const supabase = await createServiceClient()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin

  const { data: notifications } = await supabase
    .from('notifications')
    .select('id, recipient_user_id, type, payload, read_at')
    .in('type', EMAIL_TYPES)
    .is('email_sent_at', null)
    .order('created_at', { ascending: true })
    .limit(200)

  let sent = 0
  for (const n of (notifications ?? []) as NotificationRow[]) {
    // new_message só vale a pena por e-mail se ainda não foi lida no app —
    // se a pessoa já abriu a conversa, o e-mail chegaria depois e à toa.
    if (n.type === 'new_message' && n.read_at) {
      await markSent(supabase, n.id)
      continue
    }

    const { data: userRes } = await supabase.auth.admin.getUserById(n.recipient_user_id)
    const email = userRes?.user?.email
    if (!email) {
      await markSent(supabase, n.id)
      continue
    }

    const content = await buildEmailContent(supabase, n, appUrl)
    if (!content) {
      await markSent(supabase, n.id)
      continue
    }

    const ok = await sendEmail({ to: email, toName: content.toName, subject: content.subject, html: content.html, fromName: content.fromName })
    if (ok) sent += 1
    // Marca mesmo se falhar — evita retry indefinido a cada 5min pra um
    // endereço permanentemente inválido; falhas ficam nos logs do sendEmail.
    await markSent(supabase, n.id)
  }

  const anonSent = await sendAnonymousRejectionEmails(supabase, appUrl)

  return NextResponse.json({ checked: notifications?.length ?? 0, sent, anonRejectionsSent: anonSent })
}

// Fase 2: oferta recusada reportada por quem não tem conta (reporter_user_id
// NULL) — não passa pela tabela `notifications` (recipient_user_id exige um
// usuário real, ver notify() na migration 014), então varre `pledges` direto
// buscando por `reporter_email` (migration 087). Quem escolheu doação
// anônima já tem reporter_email NULL desde o insert (PledgeForm) — a query
// já respeita isso sem checagem extra.
async function sendAnonymousRejectionEmails(supabase: ServiceClient, appUrl: string): Promise<number> {
  const { data: pledges } = await supabase
    .from('pledges')
    .select('id, profile_id, reporter_name, reporter_email, reporter_locale, reported_amount, currency, rejection_reason, highlight_id')
    .eq('status', 'rejected')
    .is('reporter_user_id', null)
    .not('reporter_email', 'is', null)
    .is('rejection_email_sent_at', null)
    .order('reviewed_at', { ascending: true })
    .limit(200)

  let sent = 0
  for (const p of pledges ?? []) {
    const [{ data: highlight }, { data: profile }] = await Promise.all([
      p.highlight_id ? supabase.from('highlights').select('title').eq('id', p.highlight_id).maybeSingle() : Promise.resolve({ data: null }),
      supabase.from('profiles').select('username, display_name').eq('id', p.profile_id).maybeSingle(),
    ])

    // Sempre convidado (guarda `reporter_user_id IS NULL` na query acima)
    // — idioma vem só do que foi capturado no formulário (migration 103).
    const locale = isLocale(p.reporter_locale) ? p.reporter_locale : 'pt'
    const t = await getTranslations({ locale, namespace: 'PledgeRejectedEmail' })
    const highlightPhrase = highlight?.title ? t('emailHighlightPhrase', { highlightTitle: highlight.title }) : ''
    const profilePhrase = profile?.display_name ? t('emailProfilePhrase', { profileName: profile.display_name }) : ''

    const ok = await sendEmail({
      to: p.reporter_email!,
      toName: p.reporter_name || 'Apoiador',
      subject: t('emailSubject'),
      html: renderEmailTemplate({
        appUrl,
        title: t('emailTitle'),
        accent: 'warning',
        preheader: p.rejection_reason ?? t('emailPreheaderDefault'),
        bodyHtml: `<p style="margin:0 0 12px;">${t('emailBody', { amount: formatCurrency(p.reported_amount, p.currency), highlightPhrase, profilePhrase })}</p>
         ${p.rejection_reason ? `<p style="margin:0 0 12px;padding:12px 14px;background:#faf5eb;border-radius:10px;color:#0a0a0a;"><strong>${t('emailReasonLabel')}</strong> ${p.rejection_reason}</p>` : ''}
         <p style="margin:0;">${t('emailReasonBody')}</p>`,
        cta: profile?.username ? { url: `${appUrl}/${profile.username}`, label: t('emailCtaProfile') } : undefined,
      }),
    })
    if (ok) sent += 1
    // Marca mesmo se falhar — mesmo motivo do markSent() acima (evita
    // retry indefinido a cada 5min pra um endereço inválido).
    await supabase.from('pledges').update({ rejection_email_sent_at: new Date().toISOString() }).eq('id', p.id)
  }

  return sent
}

async function markSent(supabase: ServiceClient, id: string) {
  await supabase.from('notifications').update({ email_sent_at: new Date().toISOString() }).eq('id', id)
}

async function displayNameOf(supabase: ServiceClient, userId: string): Promise<string> {
  const { data } = await supabase.from('profiles').select('display_name').eq('user_id', userId).maybeSingle()
  return data?.display_name ?? 'Alguém'
}

// Todo destinatário de `notifications` é uma conta de verdade (a tabela
// exige `recipient_user_id NOT NULL`) — `profiles.locale` sempre resolve
// aqui, diferente dos e-mails pra convidado/parceiro sem conta que
// dependem do que foi capturado no formulário (migration 103).
async function localeOf(supabase: ServiceClient, userId: string): Promise<Locale> {
  const { data } = await supabase.from('profiles').select('locale').eq('user_id', userId).maybeSingle()
  return isLocale(data?.locale) ? data.locale : 'pt'
}

const TYPE_ACCENT: Record<(typeof EMAIL_TYPES)[number], EmailAccent> = {
  new_message: 'primary',
  pledge_confirmed: 'success',
  pledge_rejected: 'warning',
  new_pledge: 'primary',
  new_partner: 'primary',
}

async function buildEmailContent(supabase: ServiceClient, n: NotificationRow, appUrl: string): Promise<EmailContent | null> {
  const recipientName = await displayNameOf(supabase, n.recipient_user_id)
  const locale = await localeOf(supabase, n.recipient_user_id)
  const accent = TYPE_ACCENT[n.type]

  switch (n.type) {
    case 'new_message': {
      const senderId = n.payload.sender_id as string | undefined
      if (!senderId) return null
      const senderName = await displayNameOf(supabase, senderId)
      const t = await getTranslations({ locale, namespace: 'NewMessageEmail' })
      return {
        toName: recipientName,
        subject: t('emailSubject', { sender: senderName }),
        html: renderEmailTemplate({
          appUrl,
          accent,
          title: t('emailTitle'),
          bodyHtml: `<p style="margin:0;">${t('emailBody', { sender: senderName })}</p>`,
          cta: { url: `${appUrl}/dashboard/mensagens/${senderId}`, label: t('emailCta') },
        }),
      }
    }

    case 'pledge_confirmed': {
      const pledgeId = n.payload.pledge_id as string | undefined
      if (!pledgeId) return null
      const { data: pledge } = await supabase.from('pledges').select('reported_amount, currency, profile_id').eq('id', pledgeId).maybeSingle()
      if (!pledge) return null
      const { data: missionary } = await supabase.from('profiles').select('display_name, avatar_url').eq('id', pledge.profile_id).maybeSingle()
      if (!missionary) return null
      const highlightTitle = n.payload.highlight_title as string | undefined
      const t = await getTranslations({ locale, namespace: 'PledgeConfirmedEmail' })
      const highlightPhrase = highlightTitle ? t('emailHighlightPhrase', { highlightTitle }) : ''
      const firstName = recipientName.split(' ')[0] || recipientName
      const missionaryName = missionary.display_name

      // Voz do missionário, não do sistema — mesmo tratamento de
      // scheduled-pledge-reminders/recurring-reminders: quem confirmou a
      // oferta "de fato" foi o missionário revisando Conciliação, então o
      // e-mail soa como ele mesmo avisando, não uma notificação genérica.
      const bodyHtml = `
        <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.6;">${t('emailGreeting', { firstName, missionaryName })}</p>
        <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.6;">${t('emailBody', { amount: formatCurrency(pledge.reported_amount, pledge.currency), highlightPhrase })}</p>
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr><td align="center" style="padding:0 0 28px;">
            <a href="${appUrl}/dashboard/financeiro-parceiro" style="display:inline-block;background:#34390c;color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;padding:14px 36px;border-radius:10px;">${t('emailCta')} →</a>
          </td></tr>
        </table>
        <p style="margin:0;font-size:15px;color:#374151;line-height:1.5;">${t('emailSignOff')}<br>${missionaryName}</p>
      `
      const footNoteHtml = `<p style="margin:0;font-size:11px;color:#c1c5cb;">${t('emailAutomatedNote', { missionaryName })}</p>`

      return {
        toName: recipientName,
        subject: t('emailSubject', { firstName }),
        fromName: `${missionaryName} via go→guide`,
        html: wrapPersonalEmail({ missionaryName, avatarUrl: missionary.avatar_url, bodyHtml, footNoteHtml, locale }),
      }
    }

    case 'pledge_rejected': {
      const pledgeId = n.payload.pledge_id as string | undefined
      if (!pledgeId) return null
      const { data: pledge } = await supabase.from('pledges').select('reported_amount, currency').eq('id', pledgeId).maybeSingle()
      if (!pledge) return null
      const highlightTitle = n.payload.highlight_title as string | undefined
      const reason = n.payload.rejection_reason as string | undefined
      const t = await getTranslations({ locale, namespace: 'PledgeRejectedEmail' })
      const highlightPhrase = highlightTitle ? t('emailHighlightPhrase', { highlightTitle }) : ''
      return {
        toName: recipientName,
        subject: t('emailSubject'),
        html: renderEmailTemplate({
          appUrl,
          accent,
          title: t('emailTitle'),
          preheader: reason ?? t('emailPreheaderDefault'),
          bodyHtml: `<p style="margin:0 0 12px;">${t('emailBody', { amount: formatCurrency(pledge.reported_amount, pledge.currency), highlightPhrase, profilePhrase: '' })}</p>
           ${reason ? `<p style="margin:0 0 12px;padding:12px 14px;background:#faf5eb;border-radius:10px;color:#0a0a0a;"><strong>${t('emailReasonLabel')}</strong> ${reason}</p>` : ''}
           <p style="margin:0;">${t('emailReasonBody')}</p>`,
          cta: { url: `${appUrl}/dashboard/financeiro-parceiro`, label: t('emailCtaHistory') },
        }),
      }
    }

    case 'new_pledge': {
      const pledgeId = n.payload.pledge_id as string | undefined
      const reporterName = (n.payload.reporter_name as string | undefined) ?? 'Alguém'
      if (!pledgeId) return null
      const { data: pledge } = await supabase.from('pledges').select('reported_amount, currency').eq('id', pledgeId).maybeSingle()
      if (!pledge) return null
      const t = await getTranslations({ locale, namespace: 'NewPledgeEmail' })
      return {
        toName: recipientName,
        subject: t('emailSubject', { reporter: reporterName }),
        html: renderEmailTemplate({
          appUrl,
          accent,
          title: t('emailTitle'),
          bodyHtml: `<p style="margin:0;">${t('emailBody', { reporter: reporterName, amount: formatCurrency(pledge.reported_amount, pledge.currency) })}</p>`,
          cta: { url: `${appUrl}/dashboard/financeiro`, label: t('emailCta') },
        }),
      }
    }

    case 'new_partner': {
      const name = (n.payload.name as string | undefined) ?? 'Alguém'
      const t = await getTranslations({ locale, namespace: 'NewPartnerEmail' })
      return {
        toName: recipientName,
        subject: t('emailSubject', { name }),
        html: renderEmailTemplate({
          appUrl,
          accent,
          title: t('emailTitle'),
          bodyHtml: `<p style="margin:0;">${t('emailBody', { name })}</p>`,
          cta: { url: `${appUrl}/dashboard/parceiros`, label: t('emailCta') },
        }),
      }
    }

    default:
      return null
  }
}
