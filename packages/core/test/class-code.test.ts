import { describe, expect, it } from 'vitest'
import {
  CODE_ALPHABET,
  CODE_PERIOD_MS,
  codePeriod,
  encodeCode,
  LINK_CODE_LENGTH,
  normaliseTypedCode,
  TYPED_CODE_LENGTH,
} from '../src'

describe('CODE_ALPHABET', () => {
  it('has 30 distinct characters and none of 0 1 I L O U', () => {
    expect(CODE_ALPHABET).toHaveLength(30)
    expect(new Set(CODE_ALPHABET).size).toBe(30)
    for (const lookAlike of '01ILOU') expect(CODE_ALPHABET).not.toContain(lookAlike)
  })
})

describe('normaliseTypedCode', () => {
  it('upper-cases and takes out spaces and dashes', () => {
    expect(normaliseTypedCode(' ab3-x9k ')).toBe('AB3X9K')
    expect(normaliseTypedCode('ab3 x9k')).toBe('AB3X9K')
    expect(normaliseTypedCode('AB3X9K')).toBe('AB3X9K')
  })
})

describe('codePeriod', () => {
  it('is the time in whole minutes', () => {
    expect(codePeriod(0)).toBe(0)
    expect(codePeriod(CODE_PERIOD_MS - 1)).toBe(0)
    expect(codePeriod(CODE_PERIOD_MS)).toBe(1)
    expect(codePeriod(new Date(Date.UTC(2026, 2, 7, 1, 0, 59, 999)))).toBe(
      Date.UTC(2026, 2, 7, 1, 0) / CODE_PERIOD_MS,
    )
  })
})

describe('encodeCode', () => {
  const hash = Uint8Array.from({ length: 32 }, (_, i) => (i * 37) % 240)

  it('gives codes of the asked length from the alphabet', () => {
    for (const length of [TYPED_CODE_LENGTH, LINK_CODE_LENGTH]) {
      const code = encodeCode(hash, length)
      expect(code).toHaveLength(length)
      for (const ch of code) expect(CODE_ALPHABET).toContain(ch)
    }
  })

  it('maps a byte to the alphabet by its remainder and skips bytes of 240 or above', () => {
    expect(encodeCode(Uint8Array.from([0, 29, 30, 239]), 4)).toBe('2Z2Z')
    expect(encodeCode(Uint8Array.from([240, 255, 1]), 1)).toBe('3')
  })

  it('throws when too few bytes are usable', () => {
    expect(() => encodeCode(new Uint8Array(32).fill(250), TYPED_CODE_LENGTH)).toThrow(RangeError)
    expect(() => encodeCode(Uint8Array.from([1, 2]), 3)).toThrow(RangeError)
  })
})
