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
])

export function isReservedUsername(value: string): boolean {
  return RESERVED_USERNAMES.has(value.toLowerCase())
}
