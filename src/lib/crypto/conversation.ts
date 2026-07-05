/** Deriva um ID determinístico (formato UUID) para uma conversa/recurso E2EE
 *  a partir de participantes, sem precisar de uma coluna nova no banco. */
export async function derivedResourceId(...parts: string[]): Promise<string> {
  const input = parts.join(':')
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
  const bytes = new Uint8Array(hash).slice(0, 16)
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = [...bytes].map(b => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

export async function conversationId(profileId: string, userA: string, userB: string): Promise<string> {
  const sorted = [userA, userB].sort().join(':')
  return derivedResourceId('conversation', profileId, sorted)
}
