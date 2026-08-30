// Nomes que colidem com segmentos estáticos reais do app (proxy.ts,
// src/app/*) — sem essa lista, alguém poderia registrar profiles.username
// igual a uma dessas rotas e quebrar o próprio roteamento (ex.: /login/parceria
// caindo no catch-all [username] com username="login", em vez de bater
// numa rota própria — foi exatamente esse caso, sem malícia nenhuma, que
// gerou ruído de log em getPartnershipData).
export const RESERVED_USERNAMES = new Set([
  'login',
  'cadastro',
  'recuperar-senha',
  'auth',
  'onboarding',
  'dashboard',
  'planos',
  'conta',
  'api',
  'explorar',
  'superadmin',
])

export function isReservedUsername(value: string): boolean {
  return RESERVED_USERNAMES.has(value.toLowerCase())
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MinimalSupabaseClient = { from: (table: string) => any }

/** Indisponível se o username já pertence a OUTRO perfil hoje, ou se já foi
 *  username de OUTRO perfil no passado (profile_username_history, gravado
 *  por trigger — ver migration 058) — sem essa segunda checagem, alguém
 *  poderia reivindicar o @handle antigo de outra pessoa e sequestrar link
 *  de doação já compartilhado por aí. Reivindicar o PRÓPRIO username antigo
 *  de volta continua permitido (profile_id igual não conta como ocupado). */
export async function checkUsernameAvailability(
  supabase: MinimalSupabaseClient,
  value: string,
  currentProfileId: string
): Promise<'available' | 'taken'> {
  const [{ data: activeMatch }, { data: historyMatch }] = await Promise.all([
    supabase.from('profiles').select('id').eq('username', value).neq('id', currentProfileId).maybeSingle(),
    supabase.from('profile_username_history').select('profile_id').eq('old_username', value).neq('profile_id', currentProfileId).maybeSingle(),
  ])
  return activeMatch || historyMatch ? 'taken' : 'available'
}
