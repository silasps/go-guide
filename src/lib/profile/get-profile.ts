import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'

// Fonte única de "qual é o perfil deste username" — usada por layout.tsx e
// por cada page.tsx da árvore [username], em vez de cada rota refazer sua
// própria query. Envolto em cache() porque o mesmo username é consultado
// várias vezes no mesmo request; React dedupe evita round-trips repetidos.
export const getProfile = cache(async (username: string) => {
  const supabase = await createClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('username', username)
    .maybeSingle()
  return profile
})
