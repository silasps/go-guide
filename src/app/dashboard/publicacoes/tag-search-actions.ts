'use server'

import { createClient } from '@/lib/supabase/server'

const RESULTS_LIMIT = 8

export interface TaggableProfile {
  id: string
  username: string
  display_name: string
  avatar_url: string | null
}

function sanitizeForIlike(q: string) {
  return q.replace(/[,()%_]/g, ' ').trim()
}

/** Busca perfis marcáveis numa foto: missionários/organizações públicos da
 *  plataforma, mais parceiros da própria conta que já têm login (vínculo
 *  real via partners.user_id), para o autor poder marcar quem apoia. */
export async function searchTaggableProfiles(profileId: string, query: string): Promise<TaggableProfile[]> {
  const q = sanitizeForIlike(query)
  if (q.length < 2) return []

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const [{ data: directory }, { data: connectedPartners }] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url')
      .eq('privacy_mode', 'public')
      .or(`display_name.ilike.%${q}%,username.ilike.%${q}%`)
      .neq('user_id', user.id)
      .limit(RESULTS_LIMIT),
    supabase
      .from('partners')
      .select('user_id')
      .eq('profile_id', profileId)
      .not('user_id', 'is', null)
      .ilike('name', `%${q}%`)
      .limit(RESULTS_LIMIT),
  ])

  // partners.user_id referencia auth.users, não profiles — sem FK direta
  // para embed no PostgREST, então busca os profiles correspondentes à parte.
  const partnerUserIds = (connectedPartners ?? []).map((p) => p.user_id).filter((id): id is string => Boolean(id))
  const fromPartners = partnerUserIds.length
    ? (await supabase.from('profiles').select('id, username, display_name, avatar_url').in('user_id', partnerUserIds)).data ?? []
    : []

  const merged = [...(directory ?? []), ...fromPartners]
  const unique = Array.from(new Map(merged.map((p) => [p.id, p])).values())
  return unique.slice(0, RESULTS_LIMIT)
}
