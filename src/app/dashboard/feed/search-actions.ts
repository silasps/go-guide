'use server'

import { createClient } from '@/lib/supabase/server'

const RESULTS_LIMIT = 12

export interface SearchMissionary {
  id: string
  username: string
  display_name: string
  avatar_url: string | null
  accent_color: string
  bio: string | null
  location: string | null
  show_location: boolean
}

export interface SearchProject {
  id: string
  slug: string | null
  title: string
  cover_url: string | null
  cover_position: string
  profile: { username: string; display_name: string; accent_color: string }
}

// PostgREST monta o filtro de .or() como uma string separada por vírgula —
// sem escapar, o usuário poderia injetar cláusulas extra (ex: ",status.eq.hidden").
// Só letras/números/espaço/acento passam; o resto vira espaço.
function sanitizeForIlike(q: string) {
  return q.replace(/[,()%_]/g, ' ').trim()
}

export async function searchDirectory(query: string): Promise<{ missionaries: SearchMissionary[]; projects: SearchProject[] }> {
  const q = sanitizeForIlike(query)
  if (q.length < 2) return { missionaries: [], projects: [] }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let missionaryQuery = supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, accent_color, bio, location, show_location')
    .eq('privacy_mode', 'public')
    .eq('user_role', 'missionary')
    .or(`display_name.ilike.%${q}%,username.ilike.%${q}%,bio.ilike.%${q}%`)
    .limit(RESULTS_LIMIT)
  if (user) missionaryQuery = missionaryQuery.neq('user_id', user.id)

  const projectsQuery = supabase
    .from('highlights')
    .select('id, slug, title, cover_url, cover_position, profile:profiles(username, display_name, accent_color, privacy_mode, user_role)')
    .neq('status', 'hidden')
    .or(`title.ilike.%${q}%,description.ilike.%${q}%`)
    .limit(RESULTS_LIMIT * 2)

  const [{ data: missionaries }, { data: projects }] = await Promise.all([missionaryQuery, projectsQuery])

  const visibleProjects = (projects ?? [])
    .filter((p) => {
      const profile = p.profile as unknown as { privacy_mode: string; user_role: string } | null
      return profile?.privacy_mode === 'public' && profile?.user_role === 'missionary'
    })
    .slice(0, RESULTS_LIMIT)
    .map((p) => ({
      id: p.id,
      slug: p.slug,
      title: p.title,
      cover_url: p.cover_url,
      cover_position: p.cover_position,
      profile: p.profile as unknown as SearchProject['profile'],
    }))

  return { missionaries: missionaries ?? [], projects: visibleProjects }
}
