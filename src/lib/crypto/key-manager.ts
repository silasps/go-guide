import { createClient } from '@/lib/supabase/client'
import * as e2ee from './e2ee'

let cachedPrivateKeyB64: string | null = null
let cachedPublicKeyB64: string | null = null
const dekCache = new Map<string, Uint8Array>() // `${resourceType}:${resourceId}` -> DEK

/** Chave privada cacheada localmente neste navegador/dispositivo, para que o
 *  desbloqueio seja automático (como no WhatsApp) — só é preciso o código de
 *  recuperação ao trocar de dispositivo/navegador ou limpar os dados do site. */
function localStorageKey(userId: string) {
  return `go_guide_e2ee_${userId}`
}

function saveLocalKeys(userId: string, privateKeyB64: string, publicKeyB64: string) {
  try {
    localStorage.setItem(localStorageKey(userId), JSON.stringify({ privateKeyB64, publicKeyB64 }))
  } catch {
    // localStorage indisponível (modo privado etc.) — segue funcionando só nesta sessão
  }
}

function loadLocalKeys(userId: string): { privateKeyB64: string; publicKeyB64: string } | null {
  try {
    const raw = localStorage.getItem(localStorageKey(userId))
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

/** Tenta desbloquear a partir da chave salva neste dispositivo. Retorna se conseguiu. */
export function tryAutoUnlock(userId: string): boolean {
  const local = loadLocalKeys(userId)
  if (!local) return false
  cachedPrivateKeyB64 = local.privateKeyB64
  cachedPublicKeyB64 = local.publicKeyB64
  return true
}

export function isUnlocked() {
  return cachedPrivateKeyB64 !== null
}

export function getCachedPublicKey() {
  return cachedPublicKeyB64
}

export function lock() {
  cachedPrivateKeyB64 = null
  cachedPublicKeyB64 = null
  dekCache.clear()
}

export async function hasKeysConfigured(userId: string): Promise<boolean> {
  const supabase = createClient()
  const { data } = await supabase.from('user_encryption_keys').select('user_id').eq('user_id', userId).maybeSingle()
  return !!data
}

async function setupKeysWithSecret(userId: string, secret: string): Promise<void> {
  const supabase = createClient()
  const keyPair = await e2ee.generateKeyPair()
  const salt = await e2ee.generateSalt()
  const derivedKey = await e2ee.deriveKeyFromSecret(secret, salt)
  const { ciphertext, nonce } = await e2ee.encryptPrivateKey(keyPair.privateKey, derivedKey)

  const publicKeyB64 = e2ee.toBase64(keyPair.publicKey)

  const { error } = await supabase.from('user_encryption_keys').insert({
    user_id: userId,
    public_key: publicKeyB64,
    encrypted_private_key: `${ciphertext}:${nonce}`,
    kdf_salt: salt,
  })
  if (error) throw error

  cachedPrivateKeyB64 = e2ee.toBase64(keyPair.privateKey)
  cachedPublicKeyB64 = publicKeyB64
  saveLocalKeys(userId, cachedPrivateKeyB64, cachedPublicKeyB64)
}

async function unlockWithSecret(userId: string, secret: string): Promise<void> {
  const supabase = createClient()
  const { data, error } = await supabase.from('user_encryption_keys').select('*').eq('user_id', userId).single()
  if (error || !data) throw new Error('Nenhuma chave configurada para este usuário.')

  const derivedKey = await e2ee.deriveKeyFromSecret(secret, data.kdf_salt)
  const [ciphertext, nonce] = String(data.encrypted_private_key).split(':')
  const privateKey = await e2ee.decryptPrivateKey(ciphertext, nonce, derivedKey)

  cachedPrivateKeyB64 = e2ee.toBase64(privateKey)
  cachedPublicKeyB64 = data.public_key
  if (cachedPublicKeyB64) saveLocalKeys(userId, cachedPrivateKeyB64, cachedPublicKeyB64)
}

/** Chamado logo após login/cadastro por senha: configura (1ª vez) ou desbloqueia
 *  (dispositivo novo) a criptografia automaticamente, usando a própria senha de
 *  login como segredo — nenhum código extra para o usuário guardar, funciona em
 *  qualquer dispositivo só de fazer login normalmente. Falha silenciosa: se der
 *  erro aqui, o E2EEGate ainda cobre o caso ao acessar Mensagens depois. */
export async function setupOrUnlockWithPassword(userId: string, password: string): Promise<void> {
  const has = await hasKeysConfigured(userId)
  if (has) await unlockWithSecret(userId, password)
  else await setupKeysWithSecret(userId, password)
}

/** Tenta desbloquear digitando a senha de login novamente (dispositivo novo/cache limpo). */
export async function unlockWithPassword(userId: string, password: string): Promise<void> {
  return unlockWithSecret(userId, password)
}

/** Fallback para contas sem senha (login via Google): gera um código de recuperação
 *  aleatório, já que não há senha para derivar a chave. Deve ser usado só quando
 *  não há como usar a senha (ex.: hasKeysConfigured() ainda false ao chegar no
 *  E2EEGate, sinal de que o login não passou pelo fluxo de senha). */
export async function setupKeysWithRandomRecoveryCode(userId: string): Promise<{ recoveryCode: string }> {
  const recoveryCode = e2ee.generateRecoveryCode()
  await setupKeysWithSecret(userId, recoveryCode.replace(/-/g, ''))
  return { recoveryCode }
}

async function getPublicKeyOf(userId: string): Promise<string | null> {
  const supabase = createClient()
  const { data } = await supabase.from('user_encryption_keys').select('public_key').eq('user_id', userId).maybeSingle()
  return data?.public_key ?? null
}

/** Garante que existe uma DEK para o recurso e que os `grantees` fornecidos têm acesso a ela.
 *  Retorna a DEK (para cifrar o conteúdo em seguida). */
export async function ensureResourceKey(
  resourceType: 'conversation' | 'prayer_request' | 'profile_sensitive_fields',
  resourceId: string,
  grantees: string[]
): Promise<Uint8Array> {
  if (!cachedPrivateKeyB64 || !cachedPublicKeyB64) throw new Error('Chave não desbloqueada.')
  const cacheKey = `${resourceType}:${resourceId}`
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let dek = dekCache.get(cacheKey)

  if (!dek) {
    const { data: myGrant } = await supabase
      .from('encrypted_dek_grants')
      .select('wrapped_dek')
      .eq('resource_type', resourceType)
      .eq('resource_id', resourceId)
      .eq('grantee_user_id', user!.id)
      .is('revoked_at', null)
      .maybeSingle()

    dek = myGrant
      ? await e2ee.unwrapDEK(myGrant.wrapped_dek, cachedPublicKeyB64, cachedPrivateKeyB64)
      : await e2ee.generateDEK()
    dekCache.set(cacheKey, dek)
  }

  // Auto-cura: alguém pode ter configurado a criptografia DEPOIS da primeira vez que
  // este recurso foi cifrado. A cada envio, verifica se algum grantee esperado ainda
  // não tem grant mas já publicou chave pública, e concede acesso sem recifrar para
  // quem já tinha (a DEK não muda, só ganha mais uma cópia cifrada).
  const { data: existingGrants } = await supabase
    .from('encrypted_dek_grants')
    .select('grantee_user_id')
    .eq('resource_type', resourceType)
    .eq('resource_id', resourceId)
    .is('revoked_at', null)
  const grantedIds = new Set((existingGrants ?? []).map(g => g.grantee_user_id))

  const rows = []
  for (const granteeId of grantees) {
    if (grantedIds.has(granteeId)) continue
    const publicKey = await getPublicKeyOf(granteeId)
    if (!publicKey) continue // ainda não configurou E2EE — sem acesso até configurar
    rows.push({
      resource_type: resourceType,
      resource_id: resourceId,
      grantee_user_id: granteeId,
      wrapped_dek: await e2ee.wrapDEKForRecipient(dek, publicKey),
    })
  }
  if (rows.length > 0) {
    await supabase.from('encrypted_dek_grants').upsert(rows, { onConflict: 'resource_type,resource_id,grantee_user_id' })
  }

  return dek
}

export async function decryptResource(
  resourceType: 'conversation' | 'prayer_request' | 'profile_sensitive_fields',
  resourceId: string,
  ciphertext: string,
  nonce: string
): Promise<string> {
  if (!cachedPrivateKeyB64 || !cachedPublicKeyB64) throw new Error('Chave não desbloqueada.')
  const cacheKey = `${resourceType}:${resourceId}`
  let dek = dekCache.get(cacheKey)
  if (!dek) {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const { data: grant } = await supabase
      .from('encrypted_dek_grants')
      .select('wrapped_dek')
      .eq('resource_type', resourceType)
      .eq('resource_id', resourceId)
      .eq('grantee_user_id', user!.id)
      .is('revoked_at', null)
      .maybeSingle()
    if (!grant) throw new Error('Sem acesso a este conteúdo cifrado.')
    dek = await e2ee.unwrapDEK(grant.wrapped_dek, cachedPublicKeyB64, cachedPrivateKeyB64)
    dekCache.set(cacheKey, dek)
  }
  return e2ee.decryptContent(ciphertext, nonce, dek)
}

export async function encryptForResource(
  resourceType: 'conversation' | 'prayer_request' | 'profile_sensitive_fields',
  resourceId: string,
  grantees: string[],
  plaintext: string
): Promise<{ ciphertext: string; nonce: string }> {
  const dek = await ensureResourceKey(resourceType, resourceId, grantees)
  return e2ee.encryptContent(plaintext, dek)
}

/** Concede acesso a um novo destinatário para uma DEK já existente (ex.: liberar um
 *  parceiro para ver dados sensíveis do perfil depois que a DEK já foi criada). */
export async function grantAccessToExisting(
  resourceType: 'conversation' | 'prayer_request' | 'profile_sensitive_fields',
  resourceId: string,
  newGranteeUserId: string
): Promise<void> {
  if (!cachedPrivateKeyB64 || !cachedPublicKeyB64) throw new Error('Chave não desbloqueada.')
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: myGrant } = await supabase
    .from('encrypted_dek_grants')
    .select('wrapped_dek')
    .eq('resource_type', resourceType)
    .eq('resource_id', resourceId)
    .eq('grantee_user_id', user!.id)
    .is('revoked_at', null)
    .maybeSingle()
  if (!myGrant) throw new Error('Você ainda não tem uma chave para este recurso.')

  const dek = await e2ee.unwrapDEK(myGrant.wrapped_dek, cachedPublicKeyB64, cachedPrivateKeyB64)
  const publicKey = await getPublicKeyOf(newGranteeUserId)
  if (!publicKey) throw new Error('Esta pessoa ainda não configurou a criptografia — peça para acessar Mensagens uma vez antes.')

  const wrapped = await e2ee.wrapDEKForRecipient(dek, publicKey)
  const { error } = await supabase.from('encrypted_dek_grants').upsert(
    { resource_type: resourceType, resource_id: resourceId, grantee_user_id: newGranteeUserId, wrapped_dek: wrapped },
    { onConflict: 'resource_type,resource_id,grantee_user_id' }
  )
  if (error) throw error
}

/** Revoga o acesso de um destinatário específico a um recurso, sem afetar os demais. */
export async function revokeGrant(resourceType: string, resourceId: string, granteeUserId: string) {
  const supabase = createClient()
  await supabase.from('encrypted_dek_grants')
    .update({ revoked_at: new Date().toISOString() })
    .eq('resource_type', resourceType)
    .eq('resource_id', resourceId)
    .eq('grantee_user_id', granteeUserId)
}
