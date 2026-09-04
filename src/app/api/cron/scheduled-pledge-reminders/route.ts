import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email/brevo'
import { wrapEmail } from '@/lib/email/email-header'

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const supabase = await createServiceClient()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin
  const today = new Date().toISOString().slice(0, 10)

  const { data: due } = await supabase
    .from('scheduled_pledges')
    .select('*, partners(name, email), profiles(display_name, username)')
    .eq('status', 'pending')
    .lte('scheduled_date', today)

  let sent = 0
  for (const sp of due ?? []) {
    const partner = Array.isArray(sp.partners) ? sp.partners[0] : sp.partners
    const missionaryProfile = Array.isArray(sp.profiles) ? sp.profiles[0] : sp.profiles
    if (!missionaryProfile) continue

    const choice = sp.highlight_id ? 'financial_once' : 'financial_once_general'
    const params = new URLSearchParams()
    if (sp.highlight_id) params.set('highlight_id', sp.highlight_id)
    params.set('choice', choice)
    params.set('scheduled', sp.id)
    if (sp.amount) { params.set('amount', String(sp.amount)); params.set('currency', sp.currency) }
    const continueUrl = `${appUrl}/${missionaryProfile.username}/parceria?${params.toString()}`
    const cancelUrl = `${appUrl}/api/scheduled-pledges/${sp.id}/cancel`

    await supabase.rpc('notify', {
      p_recipient_user_id: sp.reporter_user_id,
      p_type: 'scheduled_pledge_reminder',
      p_payload: {
        username: missionaryProfile.username,
        choice,
        scheduled_pledge_id: sp.id,
        highlight_id: sp.highlight_id,
        amount: sp.amount,
        currency: sp.currency,
      },
    })

    let ok = true
    if (partner?.email) {
      ok = await sendEmail({
        to: partner.email,
        toName: partner.name ?? '',
        subject: 'Hoje é o dia combinado — sem cobrança',
        html: wrapEmail(`
          <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.6;">
            Olá, ${partner.name}! Você combinou pensar em ajudar <strong>${missionaryProfile.display_name}</strong>
            por volta de hoje${sp.amount ? `, com algo perto de ${sp.amount} ${sp.currency}` : ''}.
          </p>
          <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.6;">
            Não é uma cobrança — é só o lembrete que você mesmo pediu. Se ainda fizer sentido, é só continuar por aqui:
          </p>
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td align="center" style="padding:0 0 28px;">
                <a href="${continueUrl}"
                  style="display:inline-block;background:#34390c;color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;padding:14px 36px;border-radius:10px;">
                  Continuar →
                </a>
              </td>
            </tr>
          </table>
          <p style="margin:0;font-size:12px;color:#9ca3af;">
            Se não for mais o momento, sem problema — <a href="${cancelUrl}">cancelar este lembrete</a>.
          </p>
        `, 'Hoje é o dia combinado'),
      })
    }

    if (ok) {
      sent += 1
      await supabase.from('scheduled_pledges').update({ status: 'sent', reminded_at: new Date().toISOString() }).eq('id', sp.id)
    }
  }

  return NextResponse.json({ checked: due?.length ?? 0, sent })
}
