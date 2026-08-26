import crypto from 'node:crypto'

// Wrapper server-side pra API do Bunny Stream. Nunca importar isso de um
// componente client — BUNNY_API_KEY só pode viver no servidor.

function env(name: string) {
  const value = process.env[name]
  if (!value) throw new Error(`${name} não configurada`)
  return value
}

function libraryId() {
  return env('BUNNY_LIBRARY_ID')
}

function apiKey() {
  return env('BUNNY_API_KEY')
}

export async function createBunnyVideo(title: string): Promise<{ guid: string }> {
  const res = await fetch(`https://video.bunnycdn.com/library/${libraryId()}/videos`, {
    method: 'POST',
    headers: { AccessKey: apiKey(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  })
  if (!res.ok) throw new Error(`Falha ao criar vídeo na Bunny: ${res.status}`)
  return res.json()
}

/** Assinatura pro upload TUS direto do navegador — só os bytes vão pro
 *  client, a API key nunca sai do servidor. */
export function signBunnyTusUpload(videoId: string, expiresInSeconds = 3600) {
  const expiration = Math.floor(Date.now() / 1000) + expiresInSeconds
  const signature = crypto
    .createHash('sha256')
    .update(`${libraryId()}${apiKey()}${expiration}${videoId}`)
    .digest('hex')
  return { signature, expiration, libraryId: libraryId() }
}

export async function getBunnyVideo(guid: string): Promise<{ status: number; length: number }> {
  const res = await fetch(`https://video.bunnycdn.com/library/${libraryId()}/videos/${guid}`, {
    headers: { AccessKey: apiKey() },
  })
  if (!res.ok) throw new Error(`Falha ao consultar vídeo na Bunny: ${res.status}`)
  return res.json()
}

export async function deleteBunnyVideo(guid: string): Promise<void> {
  await fetch(`https://video.bunnycdn.com/library/${libraryId()}/videos/${guid}`, {
    method: 'DELETE',
    headers: { AccessKey: apiKey() },
  })
}

export function bunnyPlaybackUrl(guid: string): string {
  return `https://${env('BUNNY_PULL_ZONE_HOSTNAME')}/${guid}/playlist.m3u8`
}

/** Comparação em tempo constante — evita timing attack na validação do webhook. */
export function verifyBunnyWebhookSignature(rawBody: string, signatureHeader: string | null): boolean {
  if (!signatureHeader) return false
  const expected = crypto.createHmac('sha256', env('BUNNY_WEBHOOK_SECRET')).update(rawBody).digest('hex')
  const a = Buffer.from(signatureHeader)
  const b = Buffer.from(expected)
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

export const BUNNY_STATUS_FINISHED = 3
export const BUNNY_STATUS_FAILED = 5
