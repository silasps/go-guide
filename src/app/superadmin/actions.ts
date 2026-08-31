'use server'

import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { isSuperAdmin } from '@/lib/auth/superadmin'
import type { ReportTargetType } from '@/types/database'

function serviceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

async function requireSuperAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !isSuperAdmin(user.email)) throw new Error('Não autorizado')
}

async function markReports(service: ReturnType<typeof serviceClient>, targetType: ReportTargetType, targetId: string, status: 'actioned' | 'dismissed') {
  await service.from('reports').update({ status }).eq('target_type', targetType).eq('target_id', targetId).eq('status', 'open')
}

export async function removeReportedPost(postId: string) {
  await requireSuperAdmin()
  const service = serviceClient()
  await service.from('posts').update({ moderation_status: 'removed' }).eq('id', postId)
  await markReports(service, 'post', postId, 'actioned')
  revalidatePath('/superadmin/moderacao')
}

export async function restoreReportedPost(postId: string) {
  await requireSuperAdmin()
  const service = serviceClient()
  await service.from('posts').update({ moderation_status: 'visible' }).eq('id', postId)
  await markReports(service, 'post', postId, 'dismissed')
  revalidatePath('/superadmin/moderacao')
}

export async function removeReportedComment(commentId: string) {
  await requireSuperAdmin()
  const service = serviceClient()
  await service.from('post_comments').update({ moderation_status: 'removed' }).eq('id', commentId)
  await markReports(service, 'comment', commentId, 'actioned')
  revalidatePath('/superadmin/moderacao')
}

export async function restoreReportedComment(commentId: string) {
  await requireSuperAdmin()
  const service = serviceClient()
  await service.from('post_comments').update({ moderation_status: 'visible' }).eq('id', commentId)
  await markReports(service, 'comment', commentId, 'dismissed')
  revalidatePath('/superadmin/moderacao')
}

async function markProfileReports(service: ReturnType<typeof serviceClient>, profileId: string, status: 'actioned' | 'dismissed') {
  await service.from('reports').update({ status }).eq('target_profile_id', profileId).eq('status', 'open')
}

export async function suspendAccount(profileId: string) {
  await requireSuperAdmin()
  const service = serviceClient()
  await service.from('profiles')
    .update({ account_status: 'suspended', account_status_changed_at: new Date().toISOString() })
    .eq('id', profileId)
  await markProfileReports(service, profileId, 'actioned')
  revalidatePath('/superadmin/moderacao')
  revalidatePath('/superadmin/usuarios')
  revalidatePath('/superadmin')
}

export async function restoreAccount(profileId: string) {
  await requireSuperAdmin()
  const service = serviceClient()
  await service.from('profiles')
    .update({ account_status: 'active', account_status_changed_at: new Date().toISOString() })
    .eq('id', profileId)
  await markProfileReports(service, profileId, 'dismissed')
  revalidatePath('/superadmin/moderacao')
  revalidatePath('/superadmin/usuarios')
  revalidatePath('/superadmin')
}
