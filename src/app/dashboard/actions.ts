'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ACTIVE_PROFILE_COOKIE } from '@/lib/profile/active-profile'
import { PREVIEW_ROLE_COOKIE } from '@/lib/profile/role-preview'
import { isSuperAdmin } from '@/lib/auth/superadmin'
import { UserRole } from '@/types/database'

export async function setActiveProfile(profileId: string) {
  const cookieStore = await cookies()
  cookieStore.set(ACTIVE_PROFILE_COOKIE, profileId, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  })
  redirect('/dashboard')
}

// Flip único, no próprio perfil de quem chama (nunca em nome de outra
// pessoa) — quem já tem conta como parceiro passa a ver e usar as
// ferramentas de missionário. /onboarding pula direto para o passo de
// perfil quando profile.user_role já é 'missionary'.
export async function becomeMissionary() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  await supabase.from('profiles').update({ user_role: 'missionary' satisfies UserRole }).eq('user_id', user.id)
  redirect('/onboarding')
}

// Só tem efeito para quem está na allowlist de SUPERADMIN_EMAILS — pra
// qualquer outra conta é um no-op silencioso (nunca troca o user_role real).
export async function setPreviewRole(role: UserRole | null) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !isSuperAdmin(user.email)) return

  const cookieStore = await cookies()
  if (role) {
    cookieStore.set(PREVIEW_ROLE_COOKIE, role, { path: '/', maxAge: 60 * 60 * 24, sameSite: 'lax' })
  } else {
    cookieStore.delete(PREVIEW_ROLE_COOKIE)
  }
  redirect('/dashboard')
}
