import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { Profile } from '@/types/database'

export const ACTIVE_PROFILE_COOKIE = 'active_profile_id'

export type AccessibleProfile = Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url' | 'accent_color'>

// Perfil "ativo" da sessão de dashboard: o cookie active_profile_id decide
// qual conta está sendo administrada (a própria, ou uma gerenciada via
// profile_managers). RLS garante que só se retorna algo se o usuário
// realmente tiver acesso — cookie inválido/stale cai de volta para a
// conta própria.
export async function getActiveProfile(): Promise<Profile | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const cookieStore = await cookies()
  const activeId = cookieStore.get(ACTIVE_PROFILE_COOKIE)?.value

  if (activeId) {
    const { data } = await supabase.from('profiles').select('*').eq('id', activeId).maybeSingle()
    if (data) return data
  }

  const { data: owned } = await supabase.from('profiles').select('*').eq('user_id', user.id).maybeSingle()
  return owned
}

export async function getAccessibleProfiles(): Promise<AccessibleProfile[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const [{ data: owned }, { data: managed }] = await Promise.all([
    supabase.from('profiles').select('id, username, display_name, avatar_url, accent_color').eq('user_id', user.id),
    supabase.from('profile_managers').select('profiles(id, username, display_name, avatar_url, accent_color)').eq('user_id', user.id),
  ])

  const managedProfiles = (managed ?? [])
    .map((m) => (Array.isArray(m.profiles) ? m.profiles[0] : m.profiles))
    .filter((p): p is AccessibleProfile => Boolean(p))

  return [...(owned ?? []), ...managedProfiles]
}
