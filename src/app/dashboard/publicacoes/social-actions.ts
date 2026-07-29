'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

async function currentProfileId(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')
  const { data: profile } = await supabase.from('profiles').select('id').eq('user_id', user.id).single()
  if (!profile) throw new Error('Perfil não encontrado')
  return profile.id
}

export async function recordShare(postId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  let profileId: string | null = null
  if (user) {
    const { data: profile } = await supabase.from('profiles').select('id').eq('user_id', user.id).maybeSingle()
    profileId = profile?.id ?? null
  }
  await supabase.from('post_shares').insert({ post_id: postId, profile_id: profileId })
}

export async function toggleLike(postId: string): Promise<{ liked: boolean }> {
  const supabase = await createClient()
  const profileId = await currentProfileId(supabase)

  const { data: existing } = await supabase
    .from('post_likes')
    .select('id')
    .eq('post_id', postId)
    .eq('profile_id', profileId)
    .maybeSingle()

  if (existing) {
    const { error } = await supabase.from('post_likes').delete().eq('id', existing.id)
    if (error) throw new Error(error.message)
    revalidatePath('/dashboard/feed')
    return { liked: false }
  }

  const { error } = await supabase.from('post_likes').insert({ post_id: postId, profile_id: profileId })
  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/feed')
  return { liked: true }
}

export async function addComment(postId: string, content: string, parentCommentId?: string | null) {
  const trimmed = content.trim()
  if (!trimmed) throw new Error('Comentário vazio')

  const supabase = await createClient()
  const profileId = await currentProfileId(supabase)

  const { data, error } = await supabase
    .from('post_comments')
    .insert({ post_id: postId, profile_id: profileId, content: trimmed, parent_comment_id: parentCommentId ?? null })
    .select('id, post_id, profile_id, parent_comment_id, content, created_at, updated_at, deleted_at, profile:profiles(id, username, display_name, avatar_url)')
    .single()
  if (error) throw new Error(error.message)

  revalidatePath('/dashboard/feed')
  return { ...data, like_count: 0, viewer_has_liked: false }
}

export async function toggleCommentLike(commentId: string): Promise<{ liked: boolean }> {
  const supabase = await createClient()
  const profileId = await currentProfileId(supabase)

  const { data: existing } = await supabase
    .from('comment_likes')
    .select('id')
    .eq('comment_id', commentId)
    .eq('profile_id', profileId)
    .maybeSingle()

  if (existing) {
    const { error } = await supabase.from('comment_likes').delete().eq('id', existing.id)
    if (error) throw new Error(error.message)
    return { liked: false }
  }

  const { error } = await supabase.from('comment_likes').insert({ comment_id: commentId, profile_id: profileId })
  if (error) throw new Error(error.message)
  return { liked: true }
}

export async function deleteComment(commentId: string) {
  const supabase = await createClient()
  await currentProfileId(supabase)

  const { error } = await supabase.from('post_comments').update({ deleted_at: new Date().toISOString() }).eq('id', commentId)
  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/feed')
}

export async function updateComment(commentId: string, content: string) {
  const trimmed = content.trim()
  if (!trimmed) throw new Error('Comentário vazio')

  const supabase = await createClient()
  await currentProfileId(supabase)

  const { error } = await supabase
    .from('post_comments')
    .update({ content: trimmed, updated_at: new Date().toISOString() })
    .eq('id', commentId)
  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/feed')
}

export async function getComments(postId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data, error } = await supabase
    .from('post_comments')
    .select('id, post_id, profile_id, parent_comment_id, content, created_at, updated_at, deleted_at, profile:profiles(id, username, display_name, avatar_url)')
    .eq('post_id', postId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
  if (error) throw new Error(error.message)
  if (!data.length) return []

  let viewerProfileId: string | null = null
  if (user) {
    const { data: profile } = await supabase.from('profiles').select('id').eq('user_id', user.id).maybeSingle()
    viewerProfileId = profile?.id ?? null
  }

  const { data: likes } = await supabase
    .from('comment_likes')
    .select('comment_id, profile_id')
    .in('comment_id', data.map((c) => c.id))

  return data.map((comment) => {
    const commentLikes = (likes ?? []).filter((l) => l.comment_id === comment.id)
    return {
      ...comment,
      like_count: commentLikes.length,
      viewer_has_liked: viewerProfileId ? commentLikes.some((l) => l.profile_id === viewerProfileId) : false,
    }
  })
}
