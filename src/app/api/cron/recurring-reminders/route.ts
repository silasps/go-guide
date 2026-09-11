import { NextRequest, NextResponse } from 'next/server'
import { getTranslations } from 'next-intl/server'
import { createServiceClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email/brevo'
import { sendMissionaryNudgeEmail } from '@/lib/email/missionary-nudge-email'
import type { Locale } from '@/i18n/config'

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
    .select('*, partners(name, email, phone), profiles(user_id, display_name, username, locale), highlights(slug, title, cover_url, current_amount, goal_amount)')
    .eq('status', 'active')
    .is('stripe_subscription_id', null)
    .eq('reminder_opt_in', true)
    .lte('next_reminder_at', today)

  let sent = 0
  for (const rp of due ?? []) {
    const partner = Array.isArray(rp.partners) ? rp.partners[0] : rp.partners
    const missionaryProfile = Array.isArray(rp.profiles) ? rp.profiles[0] : rp.profiles
    const highlight = Array.isArray(rp.highlights) ? rp.highlights[0] : rp.highlights
    // Convidado sem conta não tem linha em `partners` — cai pros campos
    // gravados direto na própria linha (ver migration 093).
    const recipientEmail = partner?.email ?? rp.reporter_email
    const recipientName = partner?.name ?? rp.reporter_name
    const recipientPhone = partner?.phone ?? rp.reporter_phone
    if (!recipientEmail || !missionaryProfile) continue

    const methodLabel = t(`type_${rp.payment_method}`)
    const unsubscribeUrl = `${appUrl}/api/recurring-pledges/${rp.id}/unsubscribe`

    const ok = await sendEmail({
      to: recipientEmail,
      toName: recipientName,
      subject: `Lembrete: apoio mensal a ${missionaryProfile.display_name}`,
      html: `
        <p>Olá, ${recipientName}!</p>
        <p>Este é um lembrete de que você combinou apoiar <strong>${missionaryProfile.display_name}</strong> mensalmente,
        no valor de ${rp.amount} ${rp.currency}, via <strong>${methodLabel}</strong>.</p>
        <p>Acesse <a href="${appUrl}/${missionaryProfile.username}/parceria">a página de parceria</a> para ver os dados de recebimento.</p>
        <p style="color:#888;font-size:12px;margin-top:24px;">
          Não quer mais receber este lembrete? <a href="${unsubscribeUrl}">Cancelar lembrete mensal</a>.
        </p>
      `,
    })

    if (!ok) continue
    sent += 1

    // Prazo combinado ("parceiro por N meses") — aqui um ciclo = um
    // lembrete enviado, não uma confirmação de pagamento (não há como
    // confirmar um Pix automaticamente). Ver migration 101.
    const previousReminderDate = rp.next_reminder_at as string
    const newCyclesCompleted = rp.cycles_completed + 1
    const isFinalCycle = rp.duration_months != null && newCyclesCompleted >= rp.duration_months

    await supabase.from('recurring_pledges').update({
      cycles_completed: newCyclesCompleted,
      next_reminder_at: isFinalCycle ? null : addOneMonth(previousReminderDate),
      status: isFinalCycle ? 'completed' : rp.status,
      completed_at: isFinalCycle ? new Date().toISOString() : null,
    }).eq('id', rp.id)

    // Sugestão de "oi" no WhatsApp pro missionário — todo ciclo, sem
    // telefone não tem o que sugerir (sem fallback, pula silenciosamente).
    // `missionary_nudge_sent_for_date` (comparado ao valor ANTERIOR ao
    // avanço) evita duplicar se o cron reprocessar a mesma linha no
    // mesmo dia.
    if (recipientPhone && rp.missionary_nudge_sent_for_date !== previousReminderDate) {
      const { data: userRes } = await supabase.auth.admin.getUserById(missionaryProfile.user_id)
      const missionaryEmail = userRes?.user?.email
      if (missionaryEmail) {
        const nudgeOk = await sendMissionaryNudgeEmail({
          appUrl,
          missionaryEmail,
          missionaryName: missionaryProfile.display_name,
          missionaryUsername: missionaryProfile.username,
          missionaryLocale: (missionaryProfile.locale as Locale) ?? 'en',
          partnerName: recipientName,
          partnerPhone: recipientPhone,
          amount: rp.amount,
          currency: rp.currency,
          isFinalCycle,
          project: highlight
            ? { slug: highlight.slug, title: highlight.title, coverUrl: highlight.cover_url, goalAmount: highlight.goal_amount, currentAmount: highlight.current_amount }
            : null,
        })
        if (nudgeOk) {
          await supabase.from('recurring_pledges').update({ missionary_nudge_sent_for_date: previousReminderDate }).eq('id', rp.id)
        }
      }
    }
  }

  return NextResponse.json({ checked: due?.length ?? 0, sent })
}
