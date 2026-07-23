'use server'

import { createClient } from '@/lib/supabase/server'

const PAGE_SIZE = 30

export interface FollowListEntry {
  profileId: string
  username: string
  displayName: string
  avatarUrl: string | null
  accentColor: string
  userRole: string
  followedAt: string
}

function mapRow(row: {
  profile_id: string
  username: string
  display_name: string
  avatar_url: string | null
  accent_color: string
  user_role: string
  followed_at: string
}): FollowListEntry {
  return {
    profileId: row.profile_id,
    username: row.username,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    accentColor: row.accent_color,
    userRole: row.user_role,
    followedAt: row.followed_at,
  }
}

export async function getFollowers(profileId: string, offset = 0): Promise<FollowListEntry[]> {
  const supabase = await createClient()
  const { data } = await supabase.rpc('get_followers', { p_profile_id: profileId, p_limit: PAGE_SIZE, p_offset: offset })
  return (data ?? []).map(mapRow)
}

export async function getFollowing(profileId: string, offset = 0): Promise<FollowListEntry[]> {
  const supabase = await createClient()
  const { data } = await supabase.rpc('get_following', { p_profile_id: profileId, p_limit: PAGE_SIZE, p_offset: offset })
  return (data ?? []).map(mapRow)
}

export async function getFollowCounts(profileId: string): Promise<{ followers: number; following: number }> {
  const supabase = await createClient()
  const [{ data: followers }, { data: following }] = await Promise.all([
    supabase.rpc('follower_count', { p_profile_id: profileId }),
    supabase.rpc('following_count', { p_profile_id: profileId }),
  ])
  return { followers: followers ?? 0, following: following ?? 0 }
}

// Ids de quem segue o dono do perfil de volta — usado só para calcular o
// badge "Segue você" na aba Seguindo (mútuo), sem trazer dados de exibição.
export async function getFollowerProfileIds(profileId: string): Promise<string[]> {
  const supabase = await createClient()
  const { data } = await supabase.rpc('get_followers', { p_profile_id: profileId, p_limit: 1000, p_offset: 0 })
  return (data ?? []).map((r: { profile_id: string }) => r.profile_id)
}
