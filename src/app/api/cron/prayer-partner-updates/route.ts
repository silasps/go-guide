import { NextRequest, NextResponse } from 'next/server'
import { getTranslations } from 'next-intl/server'
import { createServiceClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email/brevo'
import { wrapPersonalEmail } from '@/lib/email/personal-email-template'
import { resolveRecipientLocale } from '@/lib/email/resolve-recipient-locale'

// Roda 1x/dia (ver vercel.json): pra cada parceiro de oração (type
// 'prayer'/'both', com e-mail e não descadastrado), confere se o
// missionário publicou algo novo (post ou projeto) desde o último e-mail
// (ou desde que o parceiro entrou, se nunca recebeu nenhum) e manda um
// "obrigado por orar" com o que mudou — pedido do usuário, mesmo padrão do
// cron de lembrete de assinatura recorrente (recurring-reminders).
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const supabase = await createServiceClient()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin

  const { data: partners } = await supabase
    .from('partners')
    .select('id, name, email, profile_id, user_id, locale, joined_at, last_update_email_sent_at, profiles(display_name, username, avatar_url)')
    .in('type', ['prayer', 'both'])
    .eq('update_emails_opt_in', true)
    .not('email', 'is', null)

  let sent = 0
  for (const partner of partners ?? []) {
    const missionary = Array.isArray(partner.profiles) ? partner.profiles[0] : partner.profiles
    if (!partner.email || !missionary) continue

    const since = partner.last_update_email_sent_at ?? partner.joined_at

    const [{ count: newPosts }, { count: newProjects }] = await Promise.all([
      supabase.from('posts').select('id', { count: 'exact', head: true })
        .eq('profile_id', partner.profile_id).eq('is_draft', false).gt('published_at', since),
      supabase.from('highlights').select('id', { count: 'exact', head: true })
        .eq('profile_id', partner.profile_id).neq('status', 'hidden').gt('created_at', since),
    ])

    if (!newPosts && !newProjects) continue

    const locale = await resolveRecipientLocale(supabase, partner.user_id, partner.locale)
    const t = await getTranslations({ locale, namespace: 'PrayerPartnerUpdateEmail' })

    const updates: string[] = []
    if (newPosts) updates.push(t('updatePosts', { count: newPosts }))
    if (newProjects) updates.push(t('updateProjects', { count: newProjects }))
    const unsubscribeUrl = `${appUrl}/api/partners/${partner.id}/unsubscribe-updates`
    const firstName = partner.name.split(' ')[0] || partner.name
    const missionaryName = missionary.display_name

    const bodyHtml = `
      <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.6;">${t('emailGreeting', { partnerName: firstName, name: missionaryName })}</p>
      <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.6;">${t('emailThanks')}</p>
      <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.6;">${t('emailUpdatesIntro', { updates: updates.join(t('updatesJoiner')) })}
        <a href="${appUrl}/${missionary.username}" style="color:#34390c;">${t('emailLinkLabel')}</a>${t('emailLinkSuffix')}</p>
      <p style="margin:0;font-size:15px;color:#374151;line-height:1.5;">${t('emailSignOff')}<br>${missionaryName}</p>
    `
    const footNoteHtml = `
      <p style="margin:0 0 8px;font-size:12px;color:#9ca3af;line-height:1.5;">
        ${t('emailUnsubscribePrefix')}<a href="${unsubscribeUrl}" style="color:#9ca3af;">${t('emailUnsubscribeLinkLabel')}</a>.
      </p>
      <p style="margin:0;font-size:11px;color:#c1c5cb;">${t('emailAutomatedNote', { name: missionaryName })}</p>
    `

    const ok = await sendEmail({
      to: partner.email,
      toName: partner.name,
      subject: t('emailSubject', { partnerName: firstName }),
      fromName: `${missionaryName} via go→guide`,
      html: wrapPersonalEmail({ missionaryName, avatarUrl: missionary.avatar_url, bodyHtml, footNoteHtml, locale }),
    })

    if (ok) {
      sent += 1
      await supabase.from('partners').update({ last_update_email_sent_at: new Date().toISOString() }).eq('id', partner.id)
    }
  }

  return NextResponse.json({ checked: partners?.length ?? 0, sent })
}
