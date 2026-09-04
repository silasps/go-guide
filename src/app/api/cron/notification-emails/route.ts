import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email/brevo'
import { renderEmailTemplate, EmailAccent } from '@/lib/email/template'
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

    const ok = await sendEmail({ to: email, toName: content.toName, subject: content.subject, html: content.html })
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
    .select('id, profile_id, reporter_name, reporter_email, reported_amount, currency, rejection_reason, highlight_id')
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

    const ok = await sendEmail({
      to: p.reporter_email!,
      toName: p.reporter_name || 'Apoiador',
      subject: 'Sua oferta não pôde ser confirmada',
      html: renderEmailTemplate({
        appUrl,
        title: 'Oferta não confirmada',
        accent: 'warning',
        preheader: p.rejection_reason ?? 'Sua oferta ainda pode ser reanalisada.',
        bodyHtml: `<p style="margin:0 0 12px;">Sua oferta de <strong>${formatCurrency(p.reported_amount, p.currency)}</strong>${highlight?.title ? ` para <strong>${highlight.title}</strong>` : ''}${profile?.display_name ? ` a <strong>${profile.display_name}</strong>` : ''} não pôde ser confirmada.</p>
         ${p.rejection_reason ? `<p style="margin:0 0 12px;padding:12px 14px;background:#faf5eb;border-radius:10px;color:#0a0a0a;"><strong>Motivo:</strong> ${p.rejection_reason}</p>` : ''}
         <p style="margin:0;">Se você acredita que isso foi um engano — por exemplo, se tem o comprovante em mãos — entre em contato pra reanalisarmos.</p>`,
        cta: profile?.username ? { url: `${appUrl}/${profile.username}`, label: 'Ver perfil' } : undefined,
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

const TYPE_ACCENT: Record<(typeof EMAIL_TYPES)[number], EmailAccent> = {
  new_message: 'primary',
  pledge_confirmed: 'success',
  pledge_rejected: 'warning',
  new_pledge: 'primary',
  new_partner: 'primary',
}

async function buildEmailContent(supabase: ServiceClient, n: NotificationRow, appUrl: string): Promise<EmailContent | null> {
  const recipientName = await displayNameOf(supabase, n.recipient_user_id)
  const accent = TYPE_ACCENT[n.type]

  switch (n.type) {
    case 'new_message': {
      const senderId = n.payload.sender_id as string | undefined
      if (!senderId) return null
      const senderName = await displayNameOf(supabase, senderId)
      return {
        toName: recipientName,
        subject: `Nova mensagem de ${senderName}`,
        html: renderEmailTemplate({
          appUrl,
          accent,
          title: 'Você recebeu uma nova mensagem',
          bodyHtml: `<p style="margin:0;">${senderName} te mandou uma mensagem no go→guide.</p>`,
          cta: { url: `${appUrl}/dashboard/mensagens/${senderId}`, label: 'Ver mensagem' },
        }),
      }
    }

    case 'pledge_confirmed': {
      const pledgeId = n.payload.pledge_id as string | undefined
      if (!pledgeId) return null
      const { data: pledge } = await supabase.from('pledges').select('reported_amount, currency').eq('id', pledgeId).maybeSingle()
      if (!pledge) return null
      const highlightTitle = n.payload.highlight_title as string | undefined
      return {
        toName: recipientName,
        subject: 'Sua oferta foi confirmada',
        html: renderEmailTemplate({
          appUrl,
          accent,
          title: 'Oferta confirmada ✓',
          bodyHtml: `<p style="margin:0;">Sua oferta de <strong>${formatCurrency(pledge.reported_amount, pledge.currency)}</strong>${highlightTitle ? ` para <strong>${highlightTitle}</strong>` : ''} foi confirmada. Obrigado pela sua parceria!</p>`,
          cta: { url: `${appUrl}/dashboard/financeiro-parceiro`, label: 'Ver histórico de doações' },
        }),
      }
    }

    case 'pledge_rejected': {
      const pledgeId = n.payload.pledge_id as string | undefined
      if (!pledgeId) return null
      const { data: pledge } = await supabase.from('pledges').select('reported_amount, currency').eq('id', pledgeId).maybeSingle()
      if (!pledge) return null
      const highlightTitle = n.payload.highlight_title as string | undefined
      const reason = n.payload.rejection_reason as string | undefined
      return {
        toName: recipientName,
        subject: 'Sua oferta não pôde ser confirmada',
        html: renderEmailTemplate({
          appUrl,
          accent,
          title: 'Oferta não confirmada',
          preheader: reason ?? 'Sua oferta ainda pode ser reanalisada.',
          bodyHtml: `<p style="margin:0 0 12px;">Sua oferta de <strong>${formatCurrency(pledge.reported_amount, pledge.currency)}</strong>${highlightTitle ? ` para <strong>${highlightTitle}</strong>` : ''} não pôde ser confirmada.</p>
           ${reason ? `<p style="margin:0 0 12px;padding:12px 14px;background:#faf5eb;border-radius:10px;color:#0a0a0a;"><strong>Motivo:</strong> ${reason}</p>` : ''}
           <p style="margin:0;">Se você acredita que isso foi um engano — por exemplo, se tem o comprovante em mãos — entre em contato pra reanalisarmos.</p>`,
          cta: { url: `${appUrl}/dashboard/financeiro-parceiro`, label: 'Ver histórico de doações' },
        }),
      }
    }

    case 'new_pledge': {
      const pledgeId = n.payload.pledge_id as string | undefined
      const reporterName = (n.payload.reporter_name as string | undefined) ?? 'Alguém'
      if (!pledgeId) return null
      const { data: pledge } = await supabase.from('pledges').select('reported_amount, currency').eq('id', pledgeId).maybeSingle()
      if (!pledge) return null
      return {
        toName: recipientName,
        subject: `Nova oferta registrada por ${reporterName}`,
        html: renderEmailTemplate({
          appUrl,
          accent,
          title: 'Nova oferta pra revisar',
          bodyHtml: `<p style="margin:0;"><strong>${reporterName}</strong> registrou uma oferta de <strong>${formatCurrency(pledge.reported_amount, pledge.currency)}</strong>, aguardando sua confirmação.</p>`,
          cta: { url: `${appUrl}/dashboard/financeiro`, label: 'Revisar oferta' },
        }),
      }
    }

    case 'new_partner': {
      const name = (n.payload.name as string | undefined) ?? 'Alguém'
      return {
        toName: recipientName,
        subject: `${name} agora é seu parceiro`,
        html: renderEmailTemplate({
          appUrl,
          accent,
          title: 'Novo parceiro 🎉',
          bodyHtml: `<p style="margin:0;"><strong>${name}</strong> agora faz parte da sua rede de parceiros.</p>`,
          cta: { url: `${appUrl}/dashboard/parceiros`, label: 'Ver parceiros' },
        }),
      }
    }

    default:
      return null
  }
}
