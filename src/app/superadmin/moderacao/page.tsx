import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { ModerationQueue, type PendingMissionary, type ReportedItem, type ReportedAccount } from '@/components/superadmin/moderation-queue'
import type { ReportReason } from '@/types/database'

function serviceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

function groupReasons(reports: { target_id?: string; target_profile_id?: string; reason: ReportReason }[], key: 'target_id' | 'target_profile_id') {
  const map = new Map<string, ReportReason[]>()
  for (const r of reports) {
    const id = r[key]
    if (!id) continue
    const list = map.get(id) ?? []
    list.push(r.reason)
    map.set(id, list)
  }
  return map
}

export default async function SuperadminModerationPage() {
  const service = serviceClient()

  const [{ data: pendingProfiles }, { data: hiddenPosts }, { data: hiddenComments }, { data: hiddenAccounts }] = await Promise.all([
    service.from('profiles')
      .select('id, username, display_name, bio, avatar_url, created_at, verification_requested_at')
      .eq('verification_status', 'pending')
      .order('created_at', { ascending: true }),
    service.from('posts')
      .select('id, content, media_urls, type, created_at, profile:profiles(id, username, display_name)')
      .eq('moderation_status', 'hidden_pending_review')
      .order('created_at', { ascending: true }),
    service.from('post_comments')
      .select('id, content, post_id, created_at, profile:profiles(id, username, display_name)')
      .eq('moderation_status', 'hidden_pending_review')
      .order('created_at', { ascending: true }),
    service.from('profiles')
      .select('id, username, display_name, avatar_url, created_at, account_status_changed_at')
      .eq('account_status', 'hidden_pending_review')
      .order('created_at', { ascending: true }),
  ])

  const postIds = (hiddenPosts ?? []).map((p) => p.id)
  const commentIds = (hiddenComments ?? []).map((c) => c.id)
  const accountIds = (hiddenAccounts ?? []).map((a) => a.id)

  const [{ data: itemReports }, { data: accountReports }] = await Promise.all([
    postIds.length || commentIds.length
      ? service.from('reports').select('target_id, reason').in('target_id', [...postIds, ...commentIds]).eq('status', 'open')
      : Promise.resolve({ data: [] }),
    accountIds.length
      ? service.from('reports').select('target_profile_id, reason').in('target_profile_id', accountIds).eq('status', 'open')
      : Promise.resolve({ data: [] }),
  ])

  const itemReasonsMap = groupReasons(itemReports ?? [], 'target_id')
  const accountReasonsMap = groupReasons(accountReports ?? [], 'target_profile_id')

  const pendingMissionaries: PendingMissionary[] = (pendingProfiles ?? []).map((p) => ({
    id: p.id, username: p.username, display_name: p.display_name, bio: p.bio, avatar_url: p.avatar_url, created_at: p.created_at,
    verification_requested_at: p.verification_requested_at,
  }))

  const reportedPosts: ReportedItem[] = (hiddenPosts ?? []).map((p) => {
    const profile = Array.isArray(p.profile) ? p.profile[0] : p.profile
    return {
      id: p.id, type: 'post', content: p.content, media_url: p.media_urls?.[0] ?? null, created_at: p.created_at,
      author: profile ? { id: profile.id, username: profile.username, display_name: profile.display_name } : null,
      reasons: itemReasonsMap.get(p.id) ?? [],
    }
  })

  const reportedComments: ReportedItem[] = (hiddenComments ?? []).map((c) => {
    const profile = Array.isArray(c.profile) ? c.profile[0] : c.profile
    return {
      id: c.id, type: 'comment', content: c.content, media_url: null, created_at: c.created_at, postId: c.post_id,
      author: profile ? { id: profile.id, username: profile.username, display_name: profile.display_name } : null,
      reasons: itemReasonsMap.get(c.id) ?? [],
    }
  })

  const reportedAccounts: ReportedAccount[] = (hiddenAccounts ?? []).map((a) => ({
    id: a.id, username: a.username, display_name: a.display_name, avatar_url: a.avatar_url, created_at: a.created_at,
    account_status_changed_at: a.account_status_changed_at,
    reasons: accountReasonsMap.get(a.id) ?? [],
  }))

  return (
    <ModerationQueue
      pendingMissionaries={pendingMissionaries}
      reportedContent={[...reportedPosts, ...reportedComments]}
      reportedAccounts={reportedAccounts}
    />
  )
}
