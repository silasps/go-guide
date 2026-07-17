import { NextRequest, NextResponse } from 'next/server'
import { getTranslations } from 'next-intl/server'
import { createServiceClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email/brevo'

function addOneMonth(date: string) {
  const d = new Date(date)
  d.setMonth(d.getMonth() + 1)
  return d.toISOString().slice(0, 10)
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const supabase = await createServiceClient()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin
  const today = new Date().toISOString().slice(0, 10)
  // Lembrete é enviado em PT — não temos como saber o idioma preferido de quem apoia
  // (não é um usuário com `profiles.locale`, é um parceiro/apoiador externo).
  const t = await getTranslations({ locale: 'pt', namespace: 'PaymentMethods' })

  const { data: due } = await supabase
    .from('recurring_pledges')
    .select('*, partners(name, email), profiles(display_name, username)')
    .eq('status', 'active')
    .is('stripe_subscription_id', null)
    .eq('reminder_opt_in', true)
    .lte('next_reminder_at', today)

  let sent = 0
  for (const rp of due ?? []) {
    const partner = Array.isArray(rp.partners) ? rp.partners[0] : rp.partners
    const missionaryProfile = Array.isArray(rp.profiles) ? rp.profiles[0] : rp.profiles
    if (!partner?.email || !missionaryProfile) continue

    const methodLabel = t(`type_${rp.payment_method}`)
    const unsubscribeUrl = `${appUrl}/api/recurring-pledges/${rp.id}/unsubscribe`

    const ok = await sendEmail({
      to: partner.email,
      toName: partner.name,
      subject: `Lembrete: apoio mensal a ${missionaryProfile.display_name}`,
      html: `
        <p>Olá, ${partner.name}!</p>
        <p>Este é um lembrete de que você combinou apoiar <strong>${missionaryProfile.display_name}</strong> mensalmente,
        no valor de ${rp.amount} ${rp.currency}, via <strong>${methodLabel}</strong>.</p>
        <p>Acesse <a href="${appUrl}/${missionaryProfile.username}/parceria">a página de parceria</a> para ver os dados de recebimento.</p>
        <p style="color:#888;font-size:12px;margin-top:24px;">
          Não quer mais receber este lembrete? <a href="${unsubscribeUrl}">Cancelar lembrete mensal</a>.
        </p>
      `,
    })

    if (ok) {
      sent += 1
      await supabase.from('recurring_pledges').update({ next_reminder_at: addOneMonth(rp.next_reminder_at) }).eq('id', rp.id)
    }
  }

  return NextResponse.json({ checked: due?.length ?? 0, sent })
}
