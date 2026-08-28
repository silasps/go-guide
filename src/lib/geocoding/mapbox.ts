import { joinLocationParts } from './format'
import { mapboxAccessToken } from './config'

// Mapbox Search Box API — /reverse e /forward, sem sessão (diferente do
// par /suggest+/retrieve, que é por sessão e serve só pra autocomplete
// interativo com token reaproveitado a cada tecla). Devolve POI de
// verdade (mercado, igreja, comércio), ao contrário da API de Geocoding
// clássica do Mapbox (que só devolve endereço/área administrativa, não
// resolveria o caso que motivou esta feature) — ver `usage.ts` pros
// números de cota grátis.
//
// NÃO confirmado nesta implementação (sem conta/chave real disponível):
// se o token precisa ser do tipo "secret" (sk.*) em vez do "public"
// (pk.*) tradicional pra essa API específica, e o `limit` máximo aceito
// por request — checar no dashboard da conta ao criar o token.

function locationLabel(p: Record<string, unknown>): string {
  const ctx = (p.context ?? {}) as Record<string, { name?: string } | undefined>
  return joinLocationParts([p.name as string | undefined, ctx.place?.name, ctx.region?.name, ctx.country?.name])
}

/** Sugestão "perto de você" — reverse geocoding, filtrado a
 *  `feature_type === 'poi'` (equivalente ao `NEARBY_POI_KEYS` do Photon):
 *  só estabelecimento de verdade, não rua/bairro/CEP. */
export async function reverseGeocodeMapbox(lat: number, lon: number): Promise<string[]> {
  const token = mapboxAccessToken()
  if (!token) return []

  const url = `https://api.mapbox.com/search/searchbox/v1/reverse?longitude=${lon}&latitude=${lat}&limit=10&access_token=${token}`
  const res = await fetch(url)
  if (!res.ok) return []

  const data = await res.json()
  const seen = new Set<string>()
  const results: string[] = []
  for (const feature of data.features ?? []) {
    const p = feature.properties ?? {}
    if (p.feature_type !== 'poi') continue
    const label = locationLabel(p)
    if (!label || seen.has(label)) continue
    seen.add(label)
    results.push(label)
    if (results.length >= 5) break
  }
  return results
}

/** Autocomplete de localização mundo afora — busca por texto. Sem filtro
 *  de tipo (mesmo comportamento livre que `searchPhoton` já tem: cidade,
 *  rua ou POI são todos resultados válidos numa busca digitada). */
export async function forwardSearchMapbox(query: string): Promise<string[]> {
  const trimmed = query.trim()
  if (trimmed.length < 2) return []

  const token = mapboxAccessToken()
  if (!token) return []

  const url = `https://api.mapbox.com/search/searchbox/v1/forward?q=${encodeURIComponent(trimmed)}&limit=6&access_token=${token}`
  const res = await fetch(url)
  if (!res.ok) return []

  const data = await res.json()
  const seen = new Set<string>()
  const results: string[] = []
  for (const feature of data.features ?? []) {
    const p = feature.properties ?? {}
    const label = locationLabel(p)
    if (!label || seen.has(label)) continue
    seen.add(label)
    results.push(label)
  }
  return results
}
