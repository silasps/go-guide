import type { GeocodingProvider } from './usage'
import { isOverGeocodingQuota, incrementGeocodingUsage } from './usage'
import { googlePlacesApiKey, mapboxAccessToken } from './config'
import { nearbySearchGoogle } from './google-places'
import { reverseGeocodeMapbox, forwardSearchMapbox } from './mapbox'
import { searchPhoton, reverseGeocodePhoton } from './photon'

type Tier = {
  provider: GeocodingProvider
  isConfigured: () => boolean
  fetch: () => Promise<string[]>
}

/** Tenta cada tier na ordem: pula se não tiver chave configurada, pula se
 *  já estiver em >=90% da cota grátis do mês (`isOverGeocodingQuota`),
 *  cai pro próximo se a chamada lançar erro. Resultado vazio (mas sem
 *  erro) também cai pro próximo tier, não só cota estourada/erro — o
 *  objetivo é achar o lugar, não só respeitar limite; se um provider não
 *  souber de nada perto, faz sentido tentar o próximo antes de desistir
 *  (o vazio já conta contra a cota desse provider, então o limite
 *  continua sendo respeitado). Sempre termina no `finalFallback`
 *  (Photon), que nunca precisa de chave nem é limitado por cota. */
async function runCascade(tiers: Tier[], finalFallback: () => Promise<string[]>): Promise<string[]> {
  for (const tier of tiers) {
    if (!tier.isConfigured()) continue
    if (await isOverGeocodingQuota(tier.provider)) continue
    try {
      const results = await tier.fetch()
      await incrementGeocodingUsage(tier.provider)
      if (results.length > 0) return results
    } catch (err) {
      console.error(`[geocoding] tier ${tier.provider} falhou, caindo pro próximo`, err)
    }
  }
  return finalFallback()
}

/** Sugestão "perto de você" (GPS): Google Places -> Mapbox -> Photon. */
export async function getNearbyLocationsCascade(lat: number, lon: number): Promise<string[]> {
  return runCascade(
    [
      { provider: 'google_places', isConfigured: () => !!googlePlacesApiKey(), fetch: () => nearbySearchGoogle(lat, lon) },
      { provider: 'mapbox', isConfigured: () => !!mapboxAccessToken(), fetch: () => reverseGeocodeMapbox(lat, lon) },
    ],
    () => reverseGeocodePhoton(lat, lon),
  )
}

/** Autocomplete por texto: Mapbox -> Photon. Sem Google aqui — o tier
 *  grátis-ilimitado do Google Autocomplete só vale usando "session
 *  tokens" (token de sessão reaproveitado a cada tecla + finalizado com
 *  uma chamada de Place Details), e o composer chama esta ação de forma
 *  independente a cada tecla, sem sessão nem Place Details — usar
 *  Nearby/Text Search do Google aqui provavelmente geraria cobrança sem
 *  necessidade. Mapbox `/forward` é stateless e já resolve o caso. */
export async function searchLocationsCascade(query: string): Promise<string[]> {
  return runCascade(
    [{ provider: 'mapbox', isConfigured: () => !!mapboxAccessToken(), fetch: () => forwardSearchMapbox(query) }],
    () => searchPhoton(query),
  )
}
