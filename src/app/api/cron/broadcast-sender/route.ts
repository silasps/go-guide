import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email/brevo'

// Drena partner_broadcast_recipients em lotes (mesmo padrão do
// notification-emails, 068): roda a cada 5min (vercel.json), marca
// sent_at mesmo em falha (sem retry infinito — o erro real fica salvo na
// linha, não só no log). Fase 1 de "campanhas pra parceiros"
// (system.architecture.md 7.10-bis).
const BATCH_SIZE = 100

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const supabase = await createServiceClient()

  const { data: pending } = await supabase
    .from('partner_broadcast_recipients')
    .select('id, email, partner_id, broadcast_id, partner_broadcasts(subject, body)')
    .is('sent_at', null)
    .order('created_at', { ascending: true })
    .limit(BATCH_SIZE)

  let sent = 0
  for (const row of pending ?? []) {
    const broadcast = Array.isArray(row.partner_broadcasts) ? row.partner_broadcasts[0] : row.partner_broadcasts
    if (!broadcast) {
      await supabase.from('partner_broadcast_recipients').update({ sent_at: new Date().toISOString(), error: 'broadcast não encontrado' }).eq('id', row.id)
      continue
    }

    const { data: partner } = await supabase.from('partners').select('name, id').eq('id', row.partner_id).maybeSingle()

    const unsubscribeUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin}/api/partners/${row.partner_id}/unsubscribe-updates`
    const ok = await sendEmail({
      to: row.email,
      toName: partner?.name ?? '',
      subject: broadcast.subject,
      html: `
        <p>${(broadcast.body as string).replace(/\n/g, '<br/>')}</p>
        <p style="color:#888;font-size:12px;margin-top:24px;">
          Não quer mais receber esses e-mails? <a href="${unsubscribeUrl}">Cancelar e-mails de atualização</a>.
        </p>
      `,
    })

    await supabase
      .from('partner_broadcast_recipients')
      .update({ sent_at: new Date().toISOString(), error: ok ? null : 'falha no envio (ver logs do sendEmail)' })
      .eq('id', row.id)

    if (ok) sent += 1
  }

  return NextResponse.json({ checked: pending?.length ?? 0, sent })
}
