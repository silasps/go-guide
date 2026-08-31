'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { ACTIVE_PROFILE_COOKIE } from '@/lib/profile/active-profile'
import { PREVIEW_ROLE_COOKIE } from '@/lib/profile/role-preview'
import { isSuperAdmin } from '@/lib/auth/superadmin'
import { UserRole } from '@/types/database'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

function serviceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

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
// perfil quando profile.user_role já é 'missionary'. verification_status
// entra 'pending' junto — perfil some da descoberta pública (/explorar,
// busca) e a página pública fica bloqueada pra visitante até um
// superadmin aprovar em /superadmin/moderacao (ver migration 056).
export async function becomeMissionary() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  await supabase
    .from('profiles')
    .update({ user_role: 'missionary' satisfies UserRole, verification_status: 'pending', verification_requested_at: new Date().toISOString() })
    .eq('user_id', user.id)
  redirect('/onboarding')
}

async function requireSuperAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !isSuperAdmin(user.email)) throw new Error('Não autorizado')
  return user
}

export async function approveMissionary(profileId: string) {
  await requireSuperAdmin()
  const service = serviceClient()
  const { error } = await service.from('profiles').update({ verification_status: 'approved' }).eq('id', profileId)
  if (error) throw new Error(error.message)
  revalidatePath('/superadmin/moderacao')
  revalidatePath('/superadmin/usuarios')
  revalidatePath('/superadmin')
}

// Rejeitar também volta user_role pra 'partner' — sem isso a conta ficaria
// travada num limbo "missionário rejeitado" pra sempre; assim ela volta a
// ser uma conta normal de parceiro e pode pedir de novo mais tarde (o que
// zera verification_status pra 'pending' outra vez via becomeMissionary()).
export async function rejectMissionary(profileId: string) {
  await requireSuperAdmin()
  const service = serviceClient()
  const { error } = await service
    .from('profiles')
    .update({ verification_status: 'rejected', user_role: 'partner' satisfies UserRole })
    .eq('id', profileId)
  if (error) throw new Error(error.message)
  revalidatePath('/superadmin/moderacao')
  revalidatePath('/superadmin/usuarios')
  revalidatePath('/superadmin')
}

// Toggle simples usado na lista geral de usuários (/superadmin/usuarios) —
// não depende de denúncia, pra dar ao superadmin controle direto sobre
// qualquer conta, não só as que já bateram o limite de 2 denúncias.
export async function toggleAccountStatus(profileId: string, nextStatus: 'active' | 'suspended') {
  await requireSuperAdmin()
  const service = serviceClient()
  await service.from('profiles')
    .update({ account_status: nextStatus, account_status_changed_at: new Date().toISOString() })
    .eq('id', profileId)
  revalidatePath('/superadmin/usuarios')
  revalidatePath('/superadmin')
  revalidatePath('/superadmin/moderacao')
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
