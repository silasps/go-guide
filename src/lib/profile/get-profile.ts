import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'

// Fonte única de "qual é o perfil deste username" — usada por layout.tsx e
// por cada page.tsx da árvore [username], em vez de cada rota refazer sua
// própria query. Envolto em cache() porque o mesmo username é consultado
// várias vezes no mesmo request; React dedupe evita round-trips repetidos.
export const getProfile = cache(async (username: string) => {
  const supabase = await createClient()
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('username', username)
    .maybeSingle()
  // Erro de rede/timeout não é a mesma coisa que "perfil não existe" — sem essa
  // distinção, um blip transitório vira notFound() permanente pra quem chama.
  if (error) throw new Error(`getProfile(${username}): ${error.message}`)
  return profile
})
