import { ADMIN_ENC_PUBLIC, ADMIN_SIGN_PUBLIC } from './adminKeys'

/*
 * Criptografia do painel de admin (Web Crypto, P-256):
 * - ECDSA: o admin assina comandos ("encerrar sala"); cada Host verifica com a chave pública.
 * - ECDH + AES-GCM: cada Host criptografa os dados da sala para o admin; só o link mágico decifra.
 */

const ECDSA = { name: 'ECDSA', namedCurve: 'P-256' }
const ECDH = { name: 'ECDH', namedCurve: 'P-256' }
const AES = { name: 'AES-GCM', length: 256 }
const COMMAND_MAX_AGE_MS = 2 * 60_000

const toB64 = (buf) =>
  btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const fromB64 = (str) =>
  Uint8Array.from(atob(str.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0))

const jwk = (pub, d) => ({ kty: 'EC', crv: 'P-256', ext: true, ...pub, ...(d ? { d } : {}) })

let signPublic
let encPublic
const getSignPublic = () => (signPublic ??= crypto.subtle.importKey('jwk', jwk(ADMIN_SIGN_PUBLIC), ECDSA, false, ['verify']))
const getEncPublic = () => (encPublic ??= crypto.subtle.importKey('jwk', jwk(ADMIN_ENC_PUBLIC), ECDH, false, []))

// ---------- lado do Host ----------

export async function encryptForAdmin(data) {
  const eph = await crypto.subtle.generateKey(ECDH, true, ['deriveKey'])
  const key = await crypto.subtle.deriveKey({ name: 'ECDH', public: await getEncPublic() }, eph.privateKey, AES, false, ['encrypt'])
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(JSON.stringify(data)))
  return { epk: toB64(await crypto.subtle.exportKey('raw', eph.publicKey)), iv: toB64(iv), ct: toB64(ct) }
}

// Retorna o comando se a assinatura for válida, recente e destinada a esta sala
export async function verifyAdminCommand(cmd, sig, roomCode) {
  try {
    const ok = await crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      await getSignPublic(),
      fromB64(sig),
      new TextEncoder().encode(cmd),
    )
    if (!ok) return null
    const parsed = JSON.parse(cmd)
    if (parsed.code !== roomCode || Math.abs(Date.now() - parsed.ts) > COMMAND_MAX_AGE_MS) return null
    return parsed
  } catch {
    return null
  }
}

// ---------- lado do admin ----------

// Lê as chaves privadas do link (#admin=<assinatura>.<cifra>) e confere se batem com as públicas
export async function loadAdminKeys(secret) {
  const [dSign, dEnc] = (secret || '').split('.')
  if (!dSign || !dEnc) throw new Error('Link incompleto')

  const sign = await crypto.subtle.importKey('jwk', jwk(ADMIN_SIGN_PUBLIC, dSign), ECDSA, false, ['sign'])
  const enc = await crypto.subtle.importKey('jwk', jwk(ADMIN_ENC_PUBLIC, dEnc), ECDH, false, ['deriveKey'])
  const keys = { sign, enc }

  // Prova real: assinar/verificar e cifrar/decifrar
  const probe = await signAdminCommand(keys, { action: 'probe', code: 'X', ts: Date.now() })
  if (!(await verifyAdminCommand(probe.cmd, probe.sig, 'X'))) throw new Error('Chave de assinatura inválida')
  const roundTrip = await decryptAsAdmin(keys, await encryptForAdmin({ ok: true }))
  if (!roundTrip?.ok) throw new Error('Chave de leitura inválida')

  return keys
}

export async function decryptAsAdmin(keys, blob) {
  const epk = await crypto.subtle.importKey('raw', fromB64(blob.epk), ECDH, false, [])
  const key = await crypto.subtle.deriveKey({ name: 'ECDH', public: epk }, keys.enc, AES, false, ['decrypt'])
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(blob.iv) }, key, fromB64(blob.ct))
  return JSON.parse(new TextDecoder().decode(plain))
}

export async function signAdminCommand(keys, command) {
  const cmd = JSON.stringify(command)
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, keys.sign, new TextEncoder().encode(cmd))
  return { cmd, sig: toB64(sig) }
}
