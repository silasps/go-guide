// Chaves de API dos providers pagos de geocoding (Google Places, Mapbox) —
// nunca lançam se a variável não estiver configurada (diferente do padrão
// de `bunny.ts`), retornam `null` em vez disso: a cascata (`cascade.ts`)
// trata "sem chave" igual a "sem cota", pulando pro próximo provider —
// a feature continua funcionando só com o Photon enquanto essas duas
// contas (Google Cloud + Mapbox) não existirem.

export function googlePlacesApiKey(): string | null {
  return process.env.GOOGLE_PLACES_API_KEY || null
}

export function mapboxAccessToken(): string | null {
  return process.env.MAPBOX_ACCESS_TOKEN || null
}
