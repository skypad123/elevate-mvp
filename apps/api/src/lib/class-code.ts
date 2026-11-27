import { createHmac, timingSafeEqual } from 'node:crypto'
import {
  CODE_PERIOD_MS,
  codePeriod,
  EXPIRED_PERIODS,
  encodeCode,
  LINK_CODE_LENGTH,
  TYPED_CODE_LENGTH,
} from '@elevate/core'
import QRCode from 'qrcode'
import { randomToken } from './crypto'

/**
 * The rotating check-in code (docs/designs/scheduled-classes-attendance.md, "The rotating code").
 * A block's code for a code period is an HMAC of the block's secret over the period number, so
 * any API process can work it out and check it, and nothing is stored per rotation.
 */

/** A block's code secret: 32 random bytes as base64url. Never sent to a client. */
export const newBlockSecret = () => randomToken(32)

/**
 * The value both codes are cut from. `encodeCode` skips some bytes; in the rare case a hash has
 * too few usable ones, the next is the HMAC of the period with a counter.
 */
function linkCode(secret: string, period: number): string {
  const key = Buffer.from(secret, 'base64url')
  for (let counter = 0; ; counter++) {
    const message = counter === 0 ? String(period) : `${period}:${counter}`
    const bytes = createHmac('sha256', key).update(message).digest()
    try {
      return encodeCode(bytes, LINK_CODE_LENGTH)
    } catch (error) {
      if (!(error instanceof RangeError)) throw error
    }
  }
}

/** The typed code (6 characters) and the link code (20) for one code period. */
export function codesFor(secret: string, period: number): { typed: string; link: string } {
  const link = linkCode(secret, period)
  return { typed: link.slice(0, TYPED_CODE_LENGTH), link }
}

export type CodeMatch =
  | { kind: 'current' | 'previous' | 'expired'; period: number }
  | { kind: 'none'; period: null }

function same(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  return timingSafeEqual(Buffer.from(a), Buffer.from(b))
}

/**
 * Which period a submitted code belongs to: `current` or `previous` (both accepted), `expired`
 * for any of the ten periods before those, or `none`. A 6-character code is compared with the
 * typed code and a 20-character one with the link code; the code is normalised already.
 */
export function matchCode(secret: string, submitted: string, now: Date): CodeMatch {
  const pick =
    submitted.length === TYPED_CODE_LENGTH
      ? 'typed'
      : submitted.length === LINK_CODE_LENGTH
        ? 'link'
        : null
  if (!pick) return { kind: 'none', period: null }
  const current = codePeriod(now)
  for (let age = 0; age <= EXPIRED_PERIODS + 1; age++) {
    const period = current - age
    if (same(codesFor(secret, period)[pick], submitted)) {
      return { kind: age === 0 ? 'current' : age === 1 ? 'previous' : 'expired', period }
    }
  }
  return { kind: 'none', period: null }
}

/** When a code period starts, in milliseconds since the epoch. */
export const periodStartMs = (period: number) => period * CODE_PERIOD_MS

/** The QR image for a check-in link, as SVG text. */
export function qrSvg(url: string): Promise<string> {
  return QRCode.toString(url, { type: 'svg', errorCorrectionLevel: 'M', margin: 1 })
}
