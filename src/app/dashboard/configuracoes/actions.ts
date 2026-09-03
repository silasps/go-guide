'use server'

import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient, SupabaseClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { isSuperAdmin } from '@/lib/auth/superadmin'
import type { ProfileManagerRole } from '@/types/database'

function serviceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

async function findUserIdByEmail(service: SupabaseClient, email: string): Promise<string | null> {
  const target = email.toLowerCase()
  let page = 1
  for (;;) {
    const { data, error } = await service.auth.admin.listUsers({ page, perPage: 1000 })
    if (error || !data?.users?.length) return null
    const found = data.users.find((u) => u.email?.toLowerCase() === target)
    if (found) return found.id
    if (data.users.length < 1000) return null
    page += 1
  }
}

/**
 * Convite de gestor sem limite de assento — só pra superadmin (ver isSuperAdmin,
 * SUPERADMIN_EMAILS). Rota separada da RPC `invite_profile_manager` (que aplica
 * planLimits().managersIncluded + extra_manager_seats no banco) porque o limite
 * ali é checado em SQL: em vez de alterar a função pra reconhecer superadmin
 * (exigiria migration), o client chama a RPC normal primeiro e só cai aqui
 * quando ela recusa por `seat_limit_reached` e quem chamou é superadmin —
 * replica a mesma lógica (dono/gestor autorizado, lookup em auth.users, upsert
 * em profile_managers), mas sem a checagem de assento.
 */
export async function inviteManagerBypass(profileId: string, email: string, role: ProfileManagerRole) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !isSuperAdmin(user.email)) return { error: 'not_authorized' as const }

  const service = serviceClient()

  const { data: profileRow } = await service.from('profiles').select('id, user_id').eq('id', profileId).single()
  if (!profileRow) return { error: 'not_found' as const }

  let authorized = profileRow.user_id === user.id
  if (!authorized) {
    const { data: manager } = await service
      .from('profile_managers')
      .select('id')
      .eq('profile_id', profileId)
      .eq('user_id', user.id)
      .eq('role', 'manager')
      .maybeSingle()
    authorized = Boolean(manager)
  }
  if (!authorized) return { error: 'not_authorized' as const }

  const targetUserId = await findUserIdByEmail(service, email)
  if (!targetUserId) return { error: 'user_not_found' as const }

  const { error: insertError } = await service
    .from('profile_managers')
    .upsert(
      { profile_id: profileId, user_id: targetUserId, role, invited_by_user_id: user.id },
      { onConflict: 'profile_id,user_id' }
    )
  if (insertError) return { error: 'insert_failed' as const }

  revalidatePath('/dashboard/configuracoes')
  return { error: null }
}
