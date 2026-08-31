import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email/brevo'

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
    .select('id, name, email, profile_id, joined_at, last_update_email_sent_at, profiles(display_name, username)')
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

    const updates: string[] = []
    if (newPosts) updates.push(newPosts === 1 ? 'publicou 1 atualização nova' : `publicou ${newPosts} atualizações novas`)
    if (newProjects) updates.push(newProjects === 1 ? 'iniciou 1 projeto novo' : `iniciou ${newProjects} projetos novos`)
    const unsubscribeUrl = `${appUrl}/api/partners/${partner.id}/unsubscribe-updates`

    const ok = await sendEmail({
      to: partner.email,
      toName: partner.name,
      subject: `Novidades de ${missionary.display_name} pra você orar 🙏`,
      html: `
        <p>Olá, ${partner.name}!</p>
        <p>Obrigado por estar orando por <strong>${missionary.display_name}</strong> — sua parceria faz muita diferença.</p>
        <p>Desde a última vez, ${missionary.display_name} ${updates.join(' e ')}.</p>
        <p><a href="${appUrl}/${missionary.username}">Acompanhe os desenvolvimentos de ${missionary.display_name}</a> e continue levantando essa missão em oração.</p>
        <p>Obrigado pela sua parceria em oração! 🙏</p>
        <p style="color:#888;font-size:12px;margin-top:24px;">
          Não quer mais receber esses e-mails? <a href="${unsubscribeUrl}">Cancelar e-mails de atualização</a>.
        </p>
      `,
    })

    if (ok) {
      sent += 1
      await supabase.from('partners').update({ last_update_email_sent_at: new Date().toISOString() }).eq('id', partner.id)
    }
  }

  return NextResponse.json({ checked: partners?.length ?? 0, sent })
}
