import { cache } from 'react'
import { redirect } from 'next/navigation'
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

/** Chamada só quando getProfile(username) não achou nada — username pode
 *  ter sido trocado (ver migration 058, trigger track_username_change).
 *  Devolve o perfil ATUAL se `username` já foi um username antigo de
 *  alguém, pra quem chamou poder redirect() pro link certo em vez de
 *  notFound(). */
export const getProfileByUsernameHistory = cache(async (username: string) => {
  const supabase = await createClient()
  const { data: history } = await supabase
    .from('profile_username_history')
    .select('profile_id')
    .eq('old_username', username)
    .maybeSingle()
  if (!history) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', history.profile_id)
    .maybeSingle()
  return profile
})

/** Usada por toda page.tsx da árvore [username] no lugar de getProfile()
 *  direto: se o username na URL foi de outra pessoa que já renomeou de
 *  volta, deixa passar pra notFound() de qualquer forma (não é "achado",
 *  é conflito antigo). Se foi encontrado como username antigo de alguém
 *  que ainda existe, redirect() pro username atual + `suffix` (o resto do
 *  path daquela rota específica, ex. "/projetos/x" — cada page.tsx sabe o
 *  próprio sufixo, esta função não tenta adivinhar). Retorna o profile
 *  normalmente quando a busca direta já resolve (caminho comum, sem custo
 *  extra nenhum). */
export async function getProfileOrRedirect(username: string, suffix = '') {
  const profile = await getProfile(username)
  if (profile) return profile

  const historicalProfile = await getProfileByUsernameHistory(username)
  if (historicalProfile) redirect(`/${historicalProfile.username}${suffix}`)

  return null
}
