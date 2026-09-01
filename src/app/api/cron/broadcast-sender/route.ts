import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email/brevo'
import { buildBroadcastHtml, BroadcastProjectCard } from '@/lib/email/partner-update-template'

type ServiceClient = Awaited<ReturnType<typeof createServiceClient>>

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
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin

  const { data: pending } = await supabase
    .from('partner_broadcast_recipients')
    .select('id, email, partner_id, broadcast_id, partner_broadcasts(subject, body, profile_id, highlight_ids)')
    .is('sent_at', null)
    .order('created_at', { ascending: true })
    .limit(BATCH_SIZE)

  // Broadcasts costumam ter dezenas de destinatários — cacheia o HTML já
  // montado (busca de projetos/username inclusas) por broadcast_id, em vez
  // de refazer a mesma query pra cada linha do lote.
  const htmlCache = new Map<string, { subject: string; html: string } | null>()

  let sent = 0
  for (const row of pending ?? []) {
    const broadcast = Array.isArray(row.partner_broadcasts) ? row.partner_broadcasts[0] : row.partner_broadcasts
    if (!broadcast) {
      await supabase.from('partner_broadcast_recipients').update({ sent_at: new Date().toISOString(), error: 'broadcast não encontrado' }).eq('id', row.id)
      continue
    }

    const unsubscribeUrl = `${appUrl}/api/partners/${row.partner_id}/unsubscribe-updates`

    let built = htmlCache.get(row.broadcast_id)
    if (built === undefined) {
      built = await buildEmailForBroadcast(supabase, broadcast, appUrl, unsubscribeUrl)
      htmlCache.set(row.broadcast_id, built)
    }

    if (!built) {
      await supabase.from('partner_broadcast_recipients').update({ sent_at: new Date().toISOString(), error: 'perfil do broadcast não encontrado' }).eq('id', row.id)
      continue
    }

    const { data: partner } = await supabase.from('partners').select('name').eq('id', row.partner_id).maybeSingle()

    const ok = await sendEmail({ to: row.email, toName: partner?.name ?? '', subject: built.subject, html: built.html })

    await supabase
      .from('partner_broadcast_recipients')
      .update({ sent_at: new Date().toISOString(), error: ok ? null : 'falha no envio (ver logs do sendEmail)' })
      .eq('id', row.id)

    if (ok) sent += 1
  }

  return NextResponse.json({ checked: pending?.length ?? 0, sent })
}

async function buildEmailForBroadcast(
  supabase: ServiceClient,
  broadcast: { subject: string; body: string; profile_id: string; highlight_ids: string[] },
  appUrl: string,
  unsubscribeUrl: string
): Promise<{ subject: string; html: string } | null> {
  const { data: profile } = await supabase.from('profiles').select('username').eq('id', broadcast.profile_id).maybeSingle()
  if (!profile) return null

  let projects: BroadcastProjectCard[] = []
  if (broadcast.highlight_ids?.length) {
    const { data: highlights } = await supabase
      .from('highlights')
      .select('title, slug, cover_url, goal_amount, current_amount, currency')
      .in('id', broadcast.highlight_ids)
    projects = (highlights ?? []).map((h) => ({
      title: h.title,
      slug: h.slug,
      coverUrl: h.cover_url,
      goalAmount: h.goal_amount,
      currentAmount: h.current_amount,
      currency: h.currency ?? 'BRL',
    }))
  }

  const html = buildBroadcastHtml({ narrativeBody: broadcast.body, projects, appUrl, username: profile.username, unsubscribeUrl })
  return { subject: broadcast.subject, html }
}
