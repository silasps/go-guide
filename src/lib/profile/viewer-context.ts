import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'

export interface ProfileViewerContext {
  viewerUserId: string | null
  isOwner: boolean
  canEdit: boolean
  isViewerRole: boolean
}

const NO_ACCESS: ProfileViewerContext = {
  viewerUserId: null,
  isOwner: false,
  canEdit: false,
  isViewerRole: false,
}

// Fonte única de "quem está olhando este perfil público" — usada por
// layout.tsx (tab bar) e por cada page.tsx da árvore [username], em vez de
// cada rota refazer seu próprio supabase.auth.getUser() + comparação de
// user_id. Envolto em cache() porque o mesmo username é consultado várias
// vezes no mesmo request (layout + page); React dedupe evita round-trips
// repetidos ao Supabase.
export const getProfileViewerContext = cache(async (username: string): Promise<ProfileViewerContext> => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NO_ACCESS

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, user_id')
    .eq('username', username)
    .maybeSingle()
  if (!profile) return { ...NO_ACCESS, viewerUserId: user.id }

  const isOwner = profile.user_id === user.id
  if (isOwner) return { viewerUserId: user.id, isOwner: true, canEdit: true, isViewerRole: false }

  const { data: manager } = await supabase
    .from('profile_managers')
    .select('role')
    .eq('profile_id', profile.id)
    .eq('user_id', user.id)
    .maybeSingle()

  return {
    viewerUserId: user.id,
    isOwner: false,
    canEdit: manager?.role === 'manager',
    isViewerRole: manager?.role === 'viewer',
  }
})
