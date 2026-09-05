import Pluggy from 'pluggy-js'

const AUTH_URL = 'https://api.pluggy.ai/auth'

// API key da Pluggy dura ~2h (documentado pela própria Pluggy) — cacheada em
// memória do processo e renovada com folga de 5min antes de expirar. Cada
// instância de função serverless tem seu próprio cache (aceitável: o auth é
// barato e não tem estado compartilhado entre requests).
let cachedApiKey: { key: string; expiresAt: number } | null = null

export function isPluggyConfigured() {
  return !!process.env.PLUGGY_CLIENT_ID && !!process.env.PLUGGY_CLIENT_SECRET
}

async function getApiKey(): Promise<string> {
  if (cachedApiKey && cachedApiKey.expiresAt > Date.now()) return cachedApiKey.key

  const res = await fetch(AUTH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clientId: process.env.PLUGGY_CLIENT_ID,
      clientSecret: process.env.PLUGGY_CLIENT_SECRET,
    }),
  })
  if (!res.ok) throw new Error(`Pluggy auth falhou: ${res.status}`)
  const data = await res.json()
  cachedApiKey = { key: data.apiKey, expiresAt: Date.now() + 115 * 60 * 1000 }
  return cachedApiKey.key
}

// Cliente Pluggy com API key (uso server-side only — NUNCA expor
// PLUGGY_CLIENT_SECRET nem a API key resultante pro browser). Para o widget
// de conexão no cliente, usar sempre um connectToken de escopo restrito
// (ver POST /api/open-finance/connect-token), nunca esta API key.
export async function getPluggyClient(): Promise<Pluggy> {
  if (!isPluggyConfigured()) throw new Error('Pluggy não configurado (PLUGGY_CLIENT_ID/PLUGGY_CLIENT_SECRET ausentes)')
  const apiKey = await getApiKey()
  return new Pluggy(apiKey)
}

export function pluggyWebhookUrl(): string | undefined {
  const base = process.env.NEXT_PUBLIC_APP_URL
  // Pluggy exige uma URL pública para notificar eventos — em dev
  // (localhost) simplesmente não registra webhook; sincronização ainda
  // funciona via botão "Sincronizar agora" e via cron diário.
  if (!base || base.includes('localhost')) return undefined
  return `${base}/api/open-finance/webhook`
}
