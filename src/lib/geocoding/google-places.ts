import { joinLocationParts } from './format'
import { googlePlacesApiKey } from './config'

/** Sugestão "perto de você" via Google Places API (New) — Nearby Search.
 *  Melhor cobertura de estabelecimento (mercado, igreja, empresa) que o
 *  Photon/OpenStreetMap, mas paga: manter o fieldMask mínimo abaixo é o
 *  que garante cair no SKU "Pro" (5.000 grátis/mês, ver `usage.ts`) —
 *  pedir campos como rating/openingHours/photos reclassifica a chamada
 *  pro SKU "Enterprise" e derruba a cota grátis pra 1.000/mês.
 *
 *  Raio fixo em 500m: a API exige um raio (não existe "N pontos mais
 *  próximos, sem limite de distância" como no `/reverse` do Photon) — 500m
 *  é uma distância "a pé, perto daqui" razoável pra marcar localização num
 *  post.
 *
 *  Sem filtro de `types[]`/`primaryType`: ao contrário do Photon (geocoder
 *  genérico, devolve rua/CEP junto), a Nearby Search já é inerentemente
 *  sobre lugares/estabelecimentos — não devolve segmento de rua nem área
 *  administrativa pura. NÃO confirmado contra uma resposta real (sem chave
 *  de API disponível nesta implementação) — revisar `types`/`primaryType`
 *  retornados assim que houver uma chave de verdade, e adicionar um filtro
 *  se algum tipo genérico demais aparecer na prática. */
export async function nearbySearchGoogle(lat: number, lon: number): Promise<string[]> {
  const apiKey = googlePlacesApiKey()
  if (!apiKey) return []

  const res = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.types,places.primaryType',
    },
    body: JSON.stringify({
      maxResultCount: 10,
      locationRestriction: {
        circle: { center: { latitude: lat, longitude: lon }, radius: 500 },
      },
    }),
  })
  if (!res.ok) return []

  const data = await res.json()
  const seen = new Set<string>()
  const results: string[] = []
  for (const place of data.places ?? []) {
    const label = joinLocationParts([place.displayName?.text, place.formattedAddress])
    if (!label || seen.has(label)) continue
    seen.add(label)
    results.push(label)
    if (results.length >= 5) break
  }
  return results
}
