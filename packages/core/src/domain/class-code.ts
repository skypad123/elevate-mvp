/**
 * The rotating check-in code (docs/designs/scheduled-classes-attendance.md, "The rotating code").
 * The API works the code out as an HMAC of the block's secret over the code period, and encodes
 * it here; the learner app normalises what is typed with the same rules. Hashing stays in the
 * API, which has `node:crypto`.
 */

/** A new code every 60 seconds. */
export const CODE_PERIOD_MS = 60_000
/** A code from one of the ten periods before the previous one is `expired`, not `wrong`. */
export const EXPIRED_PERIODS = 10
/** The code screen gets the current period's code and the next two in one answer. */
export const CODES_PER_ANSWER = 3
/** The code a learner types. */
export const TYPED_CODE_LENGTH = 6
/** The code the QR link carries; longer, since nobody types it. */
export const LINK_CODE_LENGTH = 20
/** The digits 2 to 9 and the letters A to Z without I, L, O and U: no look-alikes. */
export const CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWXYZ'

/** Bytes at or above this are skipped, so each of the 30 characters is equally likely. */
const BYTE_LIMIT = 256 - (256 % CODE_ALPHABET.length)

/** The code period `now` falls in: the server time in whole minutes. */
export function codePeriod(now: Date | number): number {
  const ms = now instanceof Date ? now.getTime() : now
  return Math.floor(ms / CODE_PERIOD_MS)
}

/**
 * Maps hash bytes onto the alphabet, skipping bytes of 240 or above. Throws when fewer than
 * `length` characters result; a 32-byte hash gives 20 in all but a negligible share of cases, and
 * the caller then rehashes with a counter.
 */
export function encodeCode(bytes: Uint8Array, length: number): string {
  let code = ''
  for (const byte of bytes) {
    if (code.length === length) break
    if (byte < BYTE_LIMIT) code += CODE_ALPHABET[byte % CODE_ALPHABET.length]
  }
  if (code.length < length) {
    throw new RangeError(`not enough usable bytes for a ${length}-character code`)
  }
  return code
}

/** What a learner typed, upper-cased, with spaces and dashes taken out. */
export function normaliseTypedCode(input: string): string {
  return input.replace(/[\s-]/g, '').toUpperCase()
}
