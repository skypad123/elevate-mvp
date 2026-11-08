import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto'

/** URL-safe random token (default 256 bits). */
export const randomToken = (bytes = 32) => randomBytes(bytes).toString('base64url')

/** Six-digit numeric code with leading zeros. */
export const randomCode = () => randomInt(0, 1_000_000).toString().padStart(6, '0')

export const sha256 = (value: string) => createHash('sha256').update(value).digest('hex')

/** Keyed hash for secrets stored in the DB (codes, tokens) so a DB leak alone is useless. */
export const hmacHex = (secret: string, value: string) =>
  createHmac('sha256', secret).update(value).digest('hex')

export function safeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  return timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'))
}

const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

/** 20-character Crockford base32 token for public certificate URLs (100 bits of entropy). */
export function certificateToken(): string {
  const bytes = randomBytes(13)
  let bits = 0
  let value = 0
  let out = ''
  for (const byte of bytes) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5 && out.length < 20) {
      out += CROCKFORD[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  return out.slice(0, 20)
}

/** Signs `${purpose}:${subject}` until `expiresAt` (unix seconds). */
export function signExpiring(
  secret: string,
  purpose: string,
  subject: string,
  expiresAt: number,
): string {
  return hmacHex(secret, `${purpose}:${subject}:${expiresAt}`)
}

export function verifyExpiring(
  secret: string,
  purpose: string,
  subject: string,
  expiresAt: number,
  signature: string,
  now = Math.floor(Date.now() / 1000),
): boolean {
  if (!Number.isFinite(expiresAt) || expiresAt < now) return false
  if (!/^[0-9a-f]{64}$/.test(signature)) return false
  return safeEqualHex(signExpiring(secret, purpose, subject, expiresAt), signature)
}
