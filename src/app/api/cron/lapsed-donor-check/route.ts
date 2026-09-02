import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

// Compromisso é sempre mensal — 45 dias dá ~15 dias de folga antes de
// considerar "parou".
const LAPSE_THRESHOLD_DAYS = 45

// Detecta recurring_pledges (system.architecture.md, seção sobre
// parceiros) que ficaram quietos: diferente de recurring-reminders/
// route.ts (que só lembra o PARCEIRO de pagar por fora), este cron avisa
// o MISSIONÁRIO quando nenhuma `pledges` confirmada chega há tempo
// demais — sinal agnóstico a método de pagamento (Pix manual ou Stripe).
// Recalcula tudo do zero a cada execução: auto-corretivo, sem precisar de
// código em nenhum outro lugar pra "resetar" `lapsed_notified_at` quando
// uma nova oferta volta a ser confirmada.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const supabase = await createServiceClient()

  const { data: active } = await supabase
    .from('recurring_pledges')
    .select('id, partner_id, created_at, lapsed_notified_at, partners(name), profiles(user_id)')
    .eq('status', 'active')

  const ids = (active ?? []).map((rp) => rp.id)
  const { data: lastPledges } = ids.length > 0
    ? await supabase
        .from('pledges')
        .select('recurring_pledge_id, reported_at')
        .eq('status', 'confirmed')
        .in('recurring_pledge_id', ids)
        .order('reported_at', { ascending: false })
    : { data: [] }

  const lastPledgeAt = new Map<string, string>()
  for (const p of lastPledges ?? []) {
    if (p.recurring_pledge_id && !lastPledgeAt.has(p.recurring_pledge_id)) {
      lastPledgeAt.set(p.recurring_pledge_id, p.reported_at)
    }
  }

  const now = Date.now()
  let notified = 0
  let cleared = 0

  for (const rp of active ?? []) {
    const partner = Array.isArray(rp.partners) ? rp.partners[0] : rp.partners
    const missionaryProfile = Array.isArray(rp.profiles) ? rp.profiles[0] : rp.profiles
    const lastAt = lastPledgeAt.get(rp.id) ?? rp.created_at
    const daysSince = Math.floor((now - new Date(lastAt).getTime()) / 86_400_000)
    const isLapsed = daysSince > LAPSE_THRESHOLD_DAYS

    if (isLapsed && !rp.lapsed_notified_at) {
      if (missionaryProfile?.user_id && partner?.name) {
        await supabase.rpc('notify', {
          p_recipient_user_id: missionaryProfile.user_id,
          p_type: 'partner_lapsed',
          p_payload: { partner_id: rp.partner_id, partner_name: partner.name, days_since_last_pledge: daysSince },
        })
        notified += 1
      }
      await supabase.from('recurring_pledges').update({ lapsed_notified_at: new Date().toISOString() }).eq('id', rp.id)
    } else if (!isLapsed && rp.lapsed_notified_at) {
      await supabase.from('recurring_pledges').update({ lapsed_notified_at: null }).eq('id', rp.id)
      cleared += 1
    }
  }

  return NextResponse.json({ checked: active?.length ?? 0, notified, cleared })
}
