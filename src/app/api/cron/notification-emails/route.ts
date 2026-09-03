import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email/brevo'
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

  return NextResponse.json({ checked: notifications?.length ?? 0, sent })
}

async function markSent(supabase: ServiceClient, id: string) {
  await supabase.from('notifications').update({ email_sent_at: new Date().toISOString() }).eq('id', id)
}

async function displayNameOf(supabase: ServiceClient, userId: string): Promise<string> {
  const { data } = await supabase.from('profiles').select('display_name').eq('user_id', userId).maybeSingle()
  return data?.display_name ?? 'Alguém'
}

function wrap(title: string, bodyHtml: string, ctaUrl: string, ctaLabel: string): string {
  return `
    <p style="font-size:16px;font-weight:700;margin:0 0 12px;">${title}</p>
    ${bodyHtml}
    <p style="margin:20px 0 0;">
      <a href="${ctaUrl}" style="display:inline-block;background:#34390c;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;padding:12px 24px;border-radius:10px;">${ctaLabel}</a>
    </p>
  `
}

async function buildEmailContent(supabase: ServiceClient, n: NotificationRow, appUrl: string): Promise<EmailContent | null> {
  const recipientName = await displayNameOf(supabase, n.recipient_user_id)

  switch (n.type) {
    case 'new_message': {
      const senderId = n.payload.sender_id as string | undefined
      if (!senderId) return null
      const senderName = await displayNameOf(supabase, senderId)
      return {
        toName: recipientName,
        subject: `Nova mensagem de ${senderName}`,
        html: wrap(
          `Você recebeu uma nova mensagem`,
          `<p style="margin:0;color:#374151;">${senderName} te mandou uma mensagem no go→guide.</p>`,
          `${appUrl}/dashboard/mensagens/${senderId}`,
          'Ver mensagem'
        ),
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
        html: wrap(
          'Oferta confirmada ✓',
          `<p style="margin:0;color:#374151;">Sua oferta de <strong>${formatCurrency(pledge.reported_amount, pledge.currency)}</strong>${highlightTitle ? ` para <strong>${highlightTitle}</strong>` : ''} foi confirmada. Obrigado pela sua parceria!</p>`,
          `${appUrl}/dashboard/financeiro-parceiro`,
          'Ver histórico de doações'
        ),
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
        html: wrap(
          'Oferta não confirmada',
          `<p style="margin:0 0 8px;color:#374151;">Sua oferta de <strong>${formatCurrency(pledge.reported_amount, pledge.currency)}</strong>${highlightTitle ? ` para <strong>${highlightTitle}</strong>` : ''} não pôde ser confirmada.</p>
           ${reason ? `<p style="margin:0 0 8px;color:#374151;"><strong>Motivo:</strong> ${reason}</p>` : ''}
           <p style="margin:0;color:#374151;">Se você acredita que isso foi um engano — por exemplo, se tem o comprovante em mãos — entre em contato pra reanalisarmos.</p>`,
          `${appUrl}/dashboard/financeiro-parceiro`,
          'Ver histórico de doações'
        ),
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
        html: wrap(
          'Nova oferta pra revisar',
          `<p style="margin:0;color:#374151;"><strong>${reporterName}</strong> registrou uma oferta de <strong>${formatCurrency(pledge.reported_amount, pledge.currency)}</strong>, aguardando sua confirmação.</p>`,
          `${appUrl}/dashboard/financeiro`,
          'Revisar oferta'
        ),
      }
    }

    case 'new_partner': {
      const name = (n.payload.name as string | undefined) ?? 'Alguém'
      return {
        toName: recipientName,
        subject: `${name} agora é seu parceiro`,
        html: wrap(
          'Novo parceiro 🎉',
          `<p style="margin:0;color:#374151;"><strong>${name}</strong> agora faz parte da sua rede de parceiros.</p>`,
          `${appUrl}/dashboard/parceiros`,
          'Ver parceiros'
        ),
      }
    }

    default:
      return null
  }
}
