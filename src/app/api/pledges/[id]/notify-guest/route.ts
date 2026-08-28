import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email/brevo'
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
    .select('reporter_email, reporter_name, reported_amount, currency, is_anonymous, reporter_user_id, profile:profiles(display_name, username), highlight:highlights(title)')
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
  const projectLine = highlight?.title ? ` para o projeto <strong>${highlight.title}</strong>` : ''

  const ok = await sendEmail({
    to: pledge.reporter_email,
    toName: pledge.reporter_name ?? '',
    subject: `Recebemos sua contribuição para ${missionary.display_name}`,
    html: `
      <p>Olá, ${pledge.reporter_name}!</p>
      <p>Recebemos o registro da sua contribuição de <strong>${amountFormatted}</strong>${projectLine},
      para <strong>${missionary.display_name}</strong>. Assim que for confirmada, você vai poder acompanhar por aqui.</p>
      <p><a href="${appUrl}/${missionary.username}">Ver o perfil de ${missionary.display_name}</a></p>
      <p style="color:#888;font-size:12px;margin-top:24px;">Obrigado por fazer parte dessa caminhada!</p>
    `,
  })

  return NextResponse.json({ ok })
}
