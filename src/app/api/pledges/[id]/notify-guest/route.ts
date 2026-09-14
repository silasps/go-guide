import { NextRequest, NextResponse } from 'next/server'
import { getTranslations } from 'next-intl/server'
import { createServiceClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email/brevo'
import { wrapPersonalEmail } from '@/lib/email/personal-email-template'
import { isLocale } from '@/i18n/config'
import { formatCurrency } from '@/lib/utils'

// Confirmação por e-mail pra quem se identifica (nome/e-mail) mas contribui
// sem estar logado — essa pessoa não tem conta pra receber notificação
// in-app, então é o único jeito de avisar que o registro foi recebido.
// Todos os dados vêm do banco (não do corpo da requisição) pra não virar
// um relay de e-mail arbitrário: só envia se o id apontar pra uma pledge
// real, identificada, sem reporter_user_id, com e-mail já salvo nela.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createServiceClient()

  const { data: pledge } = await supabase
    .from('pledges')
    .select('reporter_email, reporter_name, reporter_locale, reported_amount, currency, is_anonymous, reporter_user_id, profile:profiles(display_name, username, avatar_url), highlight:highlights(title)')
    .eq('id', id)
    .maybeSingle()

  if (!pledge || pledge.is_anonymous || pledge.reporter_user_id || !pledge.reporter_email) {
    return NextResponse.json({ ok: false })
  }

  const missionary = Array.isArray(pledge.profile) ? pledge.profile[0] : pledge.profile
  const highlight = Array.isArray(pledge.highlight) ? pledge.highlight[0] : pledge.highlight
  if (!missionary) return NextResponse.json({ ok: false })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? _req.nextUrl.origin
  const amountFormatted = formatCurrency(pledge.reported_amount, pledge.currency)
  // Sempre convidado (guardas acima já excluem reporter_user_id) — idioma
  // vem só do que foi capturado no formulário (migration 103), PT de
  // último fallback.
  const locale = isLocale(pledge.reporter_locale) ? pledge.reporter_locale : 'pt'
  const t = await getTranslations({ locale, namespace: 'PledgeGuestConfirmationEmail' })
  const projectPhrase = highlight?.title ? t('emailProjectPhrase', { projectTitle: highlight.title }) : ''
  const recipientName = pledge.reporter_name ?? ''
  const firstName = recipientName.split(' ')[0] || recipientName
  const missionaryName = missionary.display_name

  const bodyHtml = `
    <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.6;">${t('emailGreeting', { firstName, missionaryName })}</p>
    <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.6;">${t('emailBody', { amount: amountFormatted, projectPhrase })}</p>
    <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.6;">${t('emailThanks')}
      <a href="${appUrl}/${missionary.username}" style="color:#34390c;">${t('emailProfileLinkLabel')}</a>.</p>
    <p style="margin:0;font-size:15px;color:#374151;line-height:1.5;">${t('emailSignOff')}<br>${missionaryName}</p>
  `
  const footNoteHtml = `<p style="margin:0;font-size:11px;color:#c1c5cb;">${t('emailAutomatedNote', { missionaryName })}</p>`

  const ok = await sendEmail({
    to: pledge.reporter_email,
    toName: recipientName,
    subject: t('emailSubject', { firstName }),
    fromName: `${missionaryName} via go→guide`,
    html: wrapPersonalEmail({ missionaryName, avatarUrl: missionary.avatar_url, bodyHtml, footNoteHtml, locale }),
  })

  return NextResponse.json({ ok })
}
