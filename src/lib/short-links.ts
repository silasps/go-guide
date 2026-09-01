import type { SupabaseClient } from '@supabase/supabase-js'

// Sem 0/O, 1/l/I — evita ambiguidade se alguém precisar digitar o código
// à mão em vez de colar o link.
const ALPHABET = '23456789abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ'

function generateShortLinkCode(length = 6): string {
  let code = ''
  for (let i = 0; i < length; i++) code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)]
  return code
}

type ShortLinkTarget =
  | { targetType: 'profile' }
  | { targetType: 'project'; highlightId: string }

// Reaproveita o link já existente pro alvo (perfil ou projeto) ou cria um
// novo, tentando de novo em caso de colisão de código (constraint UNIQUE
// em short_links.code).
export async function getOrCreateShortLinkCode(
  supabase: SupabaseClient,
  profileId: string,
  target: ShortLinkTarget
): Promise<string> {
  async function fetchExisting(): Promise<string | null> {
    let query = supabase
      .from('short_links')
      .select('code')
      .eq('profile_id', profileId)
      .eq('target_type', target.targetType)
    query = target.targetType === 'project'
      ? query.eq('highlight_id', target.highlightId)
      : query.is('highlight_id', null)
    const { data } = await query.maybeSingle()
    return data?.code ?? null
  }

  const existing = await fetchExisting()
  if (existing) return existing

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateShortLinkCode()
    const { data, error } = await supabase
      .from('short_links')
      .insert({
        profile_id: profileId,
        code,
        target_type: target.targetType,
        highlight_id: target.targetType === 'project' ? target.highlightId : null,
      })
      .select('code')
      .single()
    if (!error) return data.code
    if (error.code !== '23505') throw error
    // Colisão: pode ser código duplicado (tenta outro) ou uma corrida —
    // outra chamada concorrente já criou o link pro mesmo alvo (índice
    // único parcial da migration 070) — nesse caso reaproveita o dela.
    const raceWinner = await fetchExisting()
    if (raceWinner) return raceWinner
  }
  throw new Error('Não foi possível gerar um código de link curto único.')
}

export function shortLinkUrl(code: string): string {
  return `${process.env.NEXT_PUBLIC_APP_URL}/l/${code}`
}

// Camada temporária (ver migration 073): sem domínio curto próprio ainda,
// embrulha o nosso /l/[code] num encurtador público gratuito (TinyURL, sem
// API key). Só server-side — chamada de terceiro, evita CORS e mantém a
// URL sempre a que a gente acabou de gerar (nunca input arbitrário do
// client). Retorna null em qualquer falha (rede, timeout, resposta de
// erro) pra quem chama cair de volta no link próprio sem quebrar nada.
//
// Não é is.gd (cogitado inicialmente, domínio final mais curto): testado
// em produção e is.gd bloqueia `*.vercel.app` de propósito (comum em
// encurtador, contra abuso via domínio de hospedagem gratuita — nosso
// domínio de produção hoje é literalmente esse, sem domínio próprio
// ainda) — falha 100% das vezes, não é instabilidade. TinyURL não bloqueia.
export async function shortenWithExternalProvider(longUrl: string): Promise<string | null> {
  try {
    const res = await fetch(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(longUrl)}`, {
      headers: { 'User-Agent': 'GoGuide-ShortLinks/1.0' },
      signal: AbortSignal.timeout(5000),
    })
    const text = (await res.text()).trim()
    if (res.ok && text.startsWith('https://tinyurl.com/')) return text
    console.warn('[short-links] TinyURL não devolveu um link curto', { status: res.status, body: text.slice(0, 200) })
    return null
  } catch (err) {
    console.warn('[short-links] falha ao chamar TinyURL', err)
    return null
  }
}
