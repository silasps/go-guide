import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendVerificationEmail } from '@/lib/email/send-verification-email'

// Dispara (ou reenvia) o e-mail de verificação pra conta logada — chamada logo
// após o cadastro por e-mail/senha e também pelo botão "reenviar" do
// EmailVerificationBanner, exibido no dashboard enquanto não confirmar.
// Sempre gera um token novo, invalidando qualquer link anterior.
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !user.email) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, email_verified')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!profile || profile.email_verified) {
    return NextResponse.json({ ok: true })
  }

  const token = crypto.randomUUID()
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

  await supabase
    .from('profiles')
    .update({ email_verification_token: token, email_verification_token_expires_at: expiresAt })
    .eq('user_id', user.id)

  const verifyUrl = `${req.nextUrl.origin}/verificar-email/${token}`
  const sent = await sendVerificationEmail(user.email, profile.display_name, verifyUrl)

  return NextResponse.json({ ok: sent })
}
