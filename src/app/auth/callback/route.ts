import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// Data de nascimento vinda do Google só existe quando o escopo
// user.birthday.read foi concedido no consentimento (ver signInWithOAuth em
// /cadastro e /login) — a pessoa pode negar, então isso é best-effort e não
// bloqueia o login se falhar.
async function syncGoogleBirthday(providerToken: string, userId: string, supabase: Awaited<ReturnType<typeof createClient>>) {
  try {
    const res = await fetch('https://people.googleapis.com/v1/people/me?personFields=birthdays', {
      headers: { Authorization: `Bearer ${providerToken}` },
    })
    if (!res.ok) return
    const people: { birthdays?: { date?: { year?: number; month?: number; day?: number } }[] } = await res.json()
    const date = people.birthdays?.find((b) => b.date?.year && b.date?.month && b.date?.day)?.date
    if (!date) return
    const birthDate = `${date.year}-${String(date.month).padStart(2, '0')}-${String(date.day).padStart(2, '0')}`
    // Só preenche se ainda estiver vazio — não sobrescreve o que a pessoa já
    // informou manualmente numa conta existente.
    await supabase.from('profiles').update({ birth_date: birthDate }).eq('user_id', userId).is('birth_date', null)
  } catch {
    // best-effort — sem escopo concedido, sem people API, etc.
  }
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const redirect = searchParams.get('redirect') ?? '/dashboard'

  if (code) {
    const supabase = await createClient()
    const { data } = await supabase.auth.exchangeCodeForSession(code)
    if (data.session?.provider_token && data.user) {
      await syncGoogleBirthday(data.session.provider_token, data.user.id, supabase)
    }
  }

  return NextResponse.redirect(`${origin}${redirect}`)
}
