import { NextRequest, NextResponse } from 'next/server'
import { getTranslations } from 'next-intl/server'
import { createServiceClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email/brevo'
import { wrapPersonalEmail } from '@/lib/email/personal-email-template'
import { resolveRecipientLocale } from '@/lib/email/resolve-recipient-locale'
import { formatCurrency } from '@/lib/utils'

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
    .select('*, partners(name, email), profiles(display_name, username, avatar_url)')
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

    // Convidado sem conta (reporter_user_id nulo) não tem pra quem
    // notificar in-app — notify() já no-opa com NULL, mas evita a chamada
    // à toa.
    if (sp.reporter_user_id) {
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
    }

    // Convidado não tem linha em `partners` — cai pros campos gravados
    // direto na própria linha (ver migration 093).
    const recipientEmail = partner?.email ?? sp.reporter_email
    const recipientName = partner?.name ?? sp.reporter_name ?? ''

    if (recipientEmail) {
      const firstName = recipientName.split(' ')[0] || recipientName
      const missionaryName = missionaryProfile.display_name
      // Com conta, `profiles.locale` (o que a pessoa escolheu em
      // Configurações) manda; sem conta, cai pro idioma capturado no
      // formulário (migration 103), com PT como último fallback.
      const locale = await resolveRecipientLocale(supabase, sp.reporter_user_id, sp.reporter_locale)
      const t = await getTranslations({ locale, namespace: 'ScheduledPledgeReminder' })

      // Voz do missionário, não do sistema — a pedido do usuário: o parceiro
      // deveria sentir que é o próprio missionário lembrando, não uma
      // notificação institucional ("chegou a hora de pagar o que você
      // prometeu"). `wrapPersonalEmail` (sem faixa de marca) + `fromName`
      // no remetente reforçam isso; a menção à plataforma vira só uma linha
      // pequena no rodapé, honesta sobre ser automático sem competir com a
      // mensagem.
      const bodyHtml = `
        <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.6;">
          ${t('emailGreeting', { firstName, missionaryName })}
        </p>
        <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.6;">
          ${sp.amount
            ? t('emailIntroWithAmount', { amount: formatCurrency(sp.amount, sp.currency) })
            : t('emailIntro')}
        </p>
        <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.6;">
          ${t('emailBody')}
        </p>
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td align="center" style="padding:0 0 28px;">
              <a href="${continueUrl}"
                style="display:inline-block;background:#34390c;color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;padding:14px 36px;border-radius:10px;">
                ${t('emailCta')} →
              </a>
            </td>
          </tr>
        </table>
        <p style="margin:0;font-size:15px;color:#374151;line-height:1.5;">
          ${t('emailSignOff')}<br>${missionaryName}
        </p>
      `
      const footNoteHtml = `
        <p style="margin:0 0 8px;font-size:12px;color:#9ca3af;line-height:1.5;">
          ${t('emailFooterNote')} ${t('emailCancelPrefix')} <a href="${cancelUrl}" style="color:#9ca3af;">${t('emailCancelLinkLabel')}</a>.
        </p>
        <p style="margin:0;font-size:11px;color:#c1c5cb;">${t('emailAutomatedNote', { missionaryName })}</p>
      `

      const ok = await sendEmail({
        to: recipientEmail,
        toName: recipientName,
        subject: t('emailSubject', { firstName }),
        fromName: `${missionaryName} via go→guide`,
        html: wrapPersonalEmail({ missionaryName, avatarUrl: missionaryProfile.avatar_url, bodyHtml, footNoteHtml, locale }),
      })

      // Só marca como enviado quando de fato tentou (e conseguiu) mandar
      // e-mail — sem isso, uma linha sem e-mail nenhum (parceiro sem
      // e-mail cadastrado, ou convidado que só deixou WhatsApp) virava
      // "sent" sem nunca ter avisado ninguém.
      if (ok) {
        sent += 1
        await supabase.from('scheduled_pledges').update({ status: 'sent', reminded_at: new Date().toISOString() }).eq('id', sp.id)
      }
    }
  }

  return NextResponse.json({ checked: due?.length ?? 0, sent })
}
