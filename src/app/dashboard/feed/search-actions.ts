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

interface SearchHighlightRow {
  id: string
  slug: string | null
  title: string
  cover_url: string | null
  cover_position: string
  profile_username: string
  profile_display_name: string
  profile_accent_color: string
}

// search_missionaries/search_highlights (migration 059) recebem `q` como
// parâmetro de função (sem risco de injeção de filtro); só limpamos aqui
// pra evitar que % ou _ digitados pelo usuário virem coringa dentro do
// LIKE que a função monta internamente.
function sanitizeQuery(q: string) {
  return q.replace(/[%_]/g, ' ').trim()
}

export async function searchDirectory(query: string): Promise<{ missionaries: SearchMissionary[]; projects: SearchProject[] }> {
  const q = sanitizeQuery(query)
  if (q.length < 2) return { missionaries: [], projects: [] }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Busca por similaridade de trigrama (pg_trgm) tolerante a acento —
  // resultados diretos primeiro, depois os "parecidos" acima do piso de
  // similaridade, em vez de sumir quando não há match exato (ver 059).
  const [{ data: missionaries }, { data: projects }] = await Promise.all([
    supabase.rpc('search_missionaries', { q, viewer_user_id: user?.id ?? null, result_limit: RESULTS_LIMIT }),
    supabase.rpc('search_highlights', { q, result_limit: RESULTS_LIMIT }),
  ])

  return {
    missionaries: missionaries ?? [],
    projects: ((projects ?? []) as SearchHighlightRow[]).map((p) => ({
      id: p.id,
      slug: p.slug,
      title: p.title,
      cover_url: p.cover_url,
      cover_position: p.cover_position,
      profile: { username: p.profile_username, display_name: p.profile_display_name, accent_color: p.profile_accent_color },
    })),
  }
}
