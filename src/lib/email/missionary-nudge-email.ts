import { getTranslations } from 'next-intl/server'
import { sendEmail } from '@/lib/email/brevo'
import { renderEmailTemplate } from '@/lib/email/template'
import { projectCardHtml } from '@/lib/email/partner-update-template'
import { buildWhatsAppLink } from '@/lib/whatsapp'
import { formatCurrency } from '@/lib/utils'
import type { Locale } from '@/i18n/config'

interface MissionaryNudgeParams {
  appUrl: string
  missionaryEmail: string
  missionaryName: string
  missionaryUsername: string
  missionaryLocale: Locale
  partnerName: string
  partnerPhone: string
  amount: number
  currency: string
  isFinalCycle: boolean
  project: { slug: string | null; title: string; coverUrl: string | null; goalAmount: number | null; currentAmount: number } | null
}

// Sugestão pro missionário mandar um "oi" pro parceiro no WhatsApp — nunca
// no idioma do parceiro (não temos essa coluna, ver recurring-reminders
// cron), mas sempre no do missionário (mesmo padrão de birthday-reminders,
// que já renderiza a mensagem pré-preenchida no locale de quem vai enviar,
// não de quem recebe).
export async function sendMissionaryNudgeEmail(params: MissionaryNudgeParams): Promise<boolean> {
  const { appUrl, missionaryEmail, missionaryName, missionaryUsername, missionaryLocale, partnerName, partnerPhone, amount, currency, isFinalCycle, project } = params
  const t = await getTranslations({ locale: missionaryLocale, namespace: 'MissionaryNudge' })
  const firstName = partnerName.split(' ')[0]

  const waMessage = t(isFinalCycle ? 'waMessageFinal' : 'waMessage', { name: firstName })
  const waLink = buildWhatsAppLink(partnerPhone, waMessage)

  const updatesHtml = project
    ? projectCardHtml(
        { title: project.title, slug: project.slug, coverUrl: project.coverUrl, goalAmount: project.goalAmount, currentAmount: project.currentAmount, currency },
        appUrl,
        missionaryUsername
      )
    : `<p style="margin:16px 0 0;"><a href="${appUrl}/${missionaryUsername}" style="color:#34390c;font-weight:600;">${t('emailUpdatesLinkLabel', { partnerName: firstName })}</a></p>`

  const bodyHtml = `
    <p style="margin:0 0 12px;">${t('emailIntro', { partnerName: firstName, amount: formatCurrency(amount, currency) })}</p>
    <p style="margin:0;">${t(isFinalCycle ? 'emailBodyFinal' : 'emailBody', { partnerName: firstName })}</p>
    ${updatesHtml}
  `

  return sendEmail({
    to: missionaryEmail,
    toName: missionaryName,
    subject: t('emailSubject', { partnerName: firstName }),
    html: renderEmailTemplate({
      appUrl,
      title: t('emailTitle', { partnerName: firstName }),
      accent: 'primary',
      preheader: t('emailPreheader', { partnerName: firstName }),
      bodyHtml,
      cta: { url: waLink, label: t('emailCtaWhatsapp') },
    }),
  })
}
