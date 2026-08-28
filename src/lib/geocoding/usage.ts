import { createClient as createSupabaseClient } from '@supabase/supabase-js'

export type GeocodingProvider = 'google_places' | 'mapbox'

// Limites do plano gratuito de cada provider, checados em ago/2026 direto
// nas páginas oficiais de pricing. Podem mudar sem aviso — reconferir
// periodicamente contra a doc/dashboard real antes de confiar cegamente.
//
// Google: Places API (New) Nearby Search cai no SKU "Pro" (US$32/1000 até
// 100k/mês) — cota grátis do SKU Pro é 5.000/mês. Só pedir campos do tier
// Pro no fieldMask (displayName/formattedAddress/types/primaryType) —
// rating/openingHours/photos re-precificam pro SKU Enterprise e derrubam a
// cota grátis pra 1.000/mês (ver `google-places.ts`).
//
// Mapbox: NÃO é a API de Geocoding clássica (100k grátis/US$0,75/1000) —
// essa só devolve endereço/área administrativa, sem POI, não resolveria o
// caso que motivou este pedido (comércio local não cadastrado no Photon).
// É a Search Box API (`/reverse` e `/forward`, sem sessão — diferente do
// par `/suggest`+`/retrieve`, que é por sessão e serve só pra autocomplete
// interativo). Free tier do bucket "Requests": 50.000/mês, depois
// US$1,00/1000 (preço introdutório).
export const GEOCODING_FREE_CAPS: Record<GeocodingProvider, number> = {
  google_places: 5_000,
  mapbox: 50_000,
}

export const GEOCODING_USAGE_THRESHOLD = 0.9

function serviceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

/** 'YYYY-MM' em UTC — chave de período do contador. Não precisa bater
 *  exatamente com o ciclo de cobrança real de cada provider (que pode
 *  começar em outro dia do mês, dependendo de quando a conta foi criada);
 *  o desalinhamento máximo é de algumas horas, tolerável dado que o
 *  gatilho de troca de tier já é conservador (90%, não 100%). */
function currentPeriod(): string {
  return new Date().toISOString().slice(0, 7)
}

/** Deliberadamente sem lock (`FOR UPDATE`) — ficar 1-2 chamadas acima do
 *  threshold exato numa condição de corrida rara é tolerável dado o volume
 *  esperado (post composer, não alta concorrência); o gatilho de 90% já é
 *  a margem de segurança de propósito. */
export async function isOverGeocodingQuota(provider: GeocodingProvider): Promise<boolean> {
  const service = serviceClient()
  const { data } = await service
    .from('geocoding_usage')
    .select('count')
    .eq('provider', provider)
    .eq('period', currentPeriod())
    .maybeSingle()

  const count = data?.count ?? 0
  return count >= GEOCODING_FREE_CAPS[provider] * GEOCODING_USAGE_THRESHOLD
}

/** Incremento atômico via `increment_geocoding_usage` (migration 050) —
 *  `INSERT ... ON CONFLICT DO UPDATE SET count = count + 1` num statement
 *  único, sem round-trip de leitura antes. */
export async function incrementGeocodingUsage(provider: GeocodingProvider): Promise<void> {
  const service = serviceClient()
  await service.rpc('increment_geocoding_usage', { p_provider: provider, p_period: currentPeriod() })
}
