import { joinLocationParts } from './format'

// Photon (photon.komoot.io), geocoder público baseado em dados do
// OpenStreetMap: gratuito, sem chave de API/cadastro — fallback final da
// cascata (`cascade.ts`), sempre disponível. `User-Agent` identifica o
// app, conforme a política de uso pública deles pede.

/** Autocomplete de localização mundo afora, estilo Instagram — busca por
 *  texto enquanto o usuário digita. */
export async function searchPhoton(query: string): Promise<string[]> {
  const trimmed = query.trim()
  if (trimmed.length < 2) return []

  // Sem &lang=pt: o Photon só aceita default/de/en/fr (pt devolve 400) — o
  // modo "default" já retorna o nome local de cada lugar (ex. "São Paulo",
  // "Brasil"), o que é o esperado pra um app global (nome do lugar no
  // idioma dele, não traduzido).
  const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(trimmed)}&limit=6`
  const res = await fetch(url, { headers: { 'User-Agent': 'GoGuide/1.0 (https://goguide.app)' } })
  if (!res.ok) return []

  const data = await res.json()
  const seen = new Set<string>()
  const results: string[] = []
  for (const feature of data.features ?? []) {
    const p = feature.properties ?? {}
    const label = joinLocationParts([p.name, p.city && p.city !== p.name ? p.city : null, p.state, p.country])
    if (!label || seen.has(label)) continue
    seen.add(label)
    results.push(label)
  }
  return results
}

/** Categorias OSM que são um estabelecimento/ponto de verdade (mercado,
 *  igreja, escola, restaurante, comércio, consultório...) — usado pra
 *  filtrar `reverseGeocodePhoton` pra baixo. Deliberadamente exclui
 *  `highway` (rua) e `place` (bairro/CEP/cidade): perto de qualquer ponto
 *  sempre tem uma rua a 0m de distância, que dominaria o resultado se não
 *  fosse filtrada — o pedido era estabelecimento, não endereço genérico. */
const NEARBY_POI_KEYS = new Set(['amenity', 'shop', 'office', 'leisure', 'tourism', 'craft', 'healthcare', 'historic'])

/** Sugestões de localização perto de onde o usuário está agora, estilo
 *  Instagram (o picker de localização já abre com lugares próximos — igreja,
 *  mercado, empresa etc. — antes de digitar nada) — reverse geocoding a
 *  partir de lat/lon lidos no browser (`navigator.geolocation`, client-side
 *  em `StepDetails`). Busca um raio maior de candidatos (`limit=20`) porque
 *  a maioria costuma ser rua/endereço solto — só sobra um punhado de
 *  estabelecimento de verdade depois do filtro de `NEARBY_POI_KEYS`. */
export async function reverseGeocodePhoton(lat: number, lon: number): Promise<string[]> {
  const url = `https://photon.komoot.io/reverse?lon=${lon}&lat=${lat}&limit=20`
  const res = await fetch(url, { headers: { 'User-Agent': 'GoGuide/1.0 (https://goguide.app)' } })
  if (!res.ok) return []

  const data = await res.json()
  const seen = new Set<string>()
  const results: string[] = []
  for (const feature of data.features ?? []) {
    const p = feature.properties ?? {}
    if (!p.name || !NEARBY_POI_KEYS.has(p.osm_key)) continue
    const label = joinLocationParts([p.name, p.city && p.city !== p.name ? p.city : null, p.state, p.country])
    if (!label || seen.has(label)) continue
    seen.add(label)
    results.push(label)
    if (results.length >= 5) break
  }
  return results
}
