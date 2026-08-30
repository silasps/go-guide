'use server'

import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import type { ReportReason, ReportTargetType } from '@/types/database'

// Denunciantes distintos necessários pra ocultar automaticamente um item
// (post/comentário) ou a conta inteira do autor — ver migration 056 e
// system.architecture.md (seção de moderação).
const AUTO_HIDE_THRESHOLD = 2

function serviceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

export async function reportContent(
  targetType: ReportTargetType,
  targetId: string,
  reason: ReportReason,
  details?: string
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')

  const service = serviceClient()

  let targetProfileId: string
  if (targetType === 'profile') {
    targetProfileId = targetId
  } else {
    const table = targetType === 'post' ? 'posts' : 'post_comments'
    const { data: row } = await service.from(table).select('profile_id').eq('id', targetId).maybeSingle()
    if (!row) throw new Error('Conteúdo não encontrado')
    targetProfileId = row.profile_id
  }

  // Usa o client autenticado (não service-role) pra que a policy
  // reports_insert_self (auth.uid() = reporter_user_id) valha de verdade —
  // UNIQUE(reporter_user_id, target_type, target_id) evita denúncia
  // duplicada da mesma pessoa inflando a contagem sozinha.
  const { error: insertError } = await supabase.from('reports').insert({
    reporter_user_id: user.id,
    target_type: targetType,
    target_id: targetId,
    target_profile_id: targetProfileId,
    reason,
    details: details?.trim() || null,
  })
  if (insertError) {
    if (insertError.code === '23505') return // já denunciou esse alvo antes — silencioso
    throw new Error(insertError.message)
  }

  // Escalada 1: 2+ denunciantes distintos no MESMO item → oculta só o item.
  if (targetType === 'post' || targetType === 'comment') {
    const { count: itemReportCount } = await service
      .from('reports')
      .select('reporter_user_id', { count: 'exact', head: true })
      .eq('target_type', targetType)
      .eq('target_id', targetId)
      .eq('status', 'open')
    if ((itemReportCount ?? 0) >= AUTO_HIDE_THRESHOLD) {
      const table = targetType === 'post' ? 'posts' : 'post_comments'
      await service.from(table).update({ moderation_status: 'hidden_pending_review' }).eq('id', targetId).eq('moderation_status', 'visible')
    }
  }

  // Escalada 2: 2+ denunciantes distintos somando QUALQUER denúncia contra
  // o mesmo autor (post, comentário ou perfil) → oculta a conta inteira.
  const { data: profileReports } = await service
    .from('reports')
    .select('reporter_user_id')
    .eq('target_profile_id', targetProfileId)
    .eq('status', 'open')
  const distinctReporters = new Set((profileReports ?? []).map((r) => r.reporter_user_id))
  if (distinctReporters.size >= AUTO_HIDE_THRESHOLD) {
    await service.from('profiles')
      .update({ account_status: 'hidden_pending_review', account_status_changed_at: new Date().toISOString() })
      .eq('id', targetProfileId).eq('account_status', 'active')
  }

  revalidatePath('/dashboard/feed')
}
