import sodium from 'libsodium-wrappers-sumo'

/**
 * Camada de criptografia ponta-a-ponta usada para mensagens diretas,
 * conteúdo de pedidos de oração privados e campos sensíveis do perfil.
 *
 * Sem dependências de DOM além de libsodium-wrappers-sumo (WASM universal,
 * necessário porque a build "sumo" é a única que inclui crypto_pwhash/Argon2id),
 * para ser reutilizável tanto na web quanto no futuro app Expo.
 *
 * O servidor nunca recebe texto claro nem chaves privadas em claro —
 * apenas ciphertext, a chave pública de cada usuário, e a chave privada
 * já cifrada por uma frase de recuperação que só existe no dispositivo
 * do usuário no momento da configuração/recuperação.
 */

let readyPromise: Promise<void> | null = null
export function ready(): Promise<void> {
  if (!readyPromise) readyPromise = sodium.ready
  return readyPromise
}

export interface KeyPair {
  publicKey: Uint8Array
  privateKey: Uint8Array
}

export async function generateKeyPair(): Promise<KeyPair> {
  await ready()
  const kp = sodium.crypto_box_keypair()
  return { publicKey: kp.publicKey, privateKey: kp.privateKey }
}

const RECOVERY_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // sem caracteres ambíguos (0/O, 1/I/L)

/** Gera um código de recuperação (não é BIP39, mas cumpre o mesmo papel: um segredo memorável/anotável que só o usuário guarda). */
export function generateRecoveryCode(): string {
  const groups: string[] = []
  for (let g = 0; g < 6; g++) {
    let group = ''
    const bytes = crypto.getRandomValues(new Uint8Array(4))
    for (const b of bytes) group += RECOVERY_ALPHABET[b % RECOVERY_ALPHABET.length]
    groups.push(group)
  }
  return groups.join('-')
}

export async function generateSalt(): Promise<string> {
  await ready()
  return sodium.to_base64(sodium.randombytes_buf(sodium.crypto_pwhash_SALTBYTES))
}

/** Deriva uma chave simétrica a partir do código de recuperação (Argon2id). */
export async function deriveKeyFromRecoveryCode(recoveryCode: string, saltB64: string): Promise<Uint8Array> {
  await ready()
  const salt = sodium.from_base64(saltB64)
  return sodium.crypto_pwhash(
    sodium.crypto_secretbox_KEYBYTES,
    recoveryCode.replace(/-/g, ''),
    salt,
    sodium.crypto_pwhash_OPSLIMIT_INTERACTIVE,
    sodium.crypto_pwhash_MEMLIMIT_INTERACTIVE,
    sodium.crypto_pwhash_ALG_ARGON2ID13
  )
}

export async function encryptPrivateKey(privateKey: Uint8Array, derivedKey: Uint8Array): Promise<{ ciphertext: string; nonce: string }> {
  await ready()
  const nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES)
  const ciphertext = sodium.crypto_secretbox_easy(privateKey, nonce, derivedKey)
  return { ciphertext: sodium.to_base64(ciphertext), nonce: sodium.to_base64(nonce) }
}

export async function decryptPrivateKey(ciphertextB64: string, nonceB64: string, derivedKey: Uint8Array): Promise<Uint8Array> {
  await ready()
  const ciphertext = sodium.from_base64(ciphertextB64)
  const nonce = sodium.from_base64(nonceB64)
  const opened = sodium.crypto_secretbox_open_easy(ciphertext, nonce, derivedKey)
  if (!opened) throw new Error('Código de recuperação incorreto.')
  return opened
}

export async function generateDEK(): Promise<Uint8Array> {
  await ready()
  return sodium.crypto_secretbox_keygen()
}

/** Cifra a DEK para um destinatário específico usando a chave pública dele (sealed box — só ele consegue abrir). */
export async function wrapDEKForRecipient(dek: Uint8Array, recipientPublicKeyB64: string): Promise<string> {
  await ready()
  const recipientPublicKey = sodium.from_base64(recipientPublicKeyB64)
  const sealed = sodium.crypto_box_seal(dek, recipientPublicKey)
  return sodium.to_base64(sealed)
}

export async function unwrapDEK(wrappedB64: string, myPublicKeyB64: string, myPrivateKeyB64: string): Promise<Uint8Array> {
  await ready()
  const sealed = sodium.from_base64(wrappedB64)
  const publicKey = sodium.from_base64(myPublicKeyB64)
  const privateKey = sodium.from_base64(myPrivateKeyB64)
  const opened = sodium.crypto_box_seal_open(sealed, publicKey, privateKey)
  if (!opened) throw new Error('Não foi possível abrir a chave — sem permissão de acesso.')
  return opened
}

export async function encryptContent(plaintext: string, dek: Uint8Array): Promise<{ ciphertext: string; nonce: string }> {
  await ready()
  const nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES)
  const ciphertext = sodium.crypto_secretbox_easy(sodium.from_string(plaintext), nonce, dek)
  return { ciphertext: sodium.to_base64(ciphertext), nonce: sodium.to_base64(nonce) }
}

export async function decryptContent(ciphertextB64: string, nonceB64: string, dek: Uint8Array): Promise<string> {
  await ready()
  const ciphertext = sodium.from_base64(ciphertextB64)
  const nonce = sodium.from_base64(nonceB64)
  const opened = sodium.crypto_secretbox_open_easy(ciphertext, nonce, dek)
  if (!opened) throw new Error('Não foi possível decifrar o conteúdo.')
  return sodium.to_string(opened)
}

export function toBase64(bytes: Uint8Array): string {
  return sodium.to_base64(bytes)
}
export function fromBase64(b64: string): Uint8Array {
  return sodium.from_base64(b64)
}
