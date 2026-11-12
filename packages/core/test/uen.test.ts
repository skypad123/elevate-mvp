import { describe, expect, it } from 'vitest'
import { ENTITY_TYPES, isValidUen, normaliseUen, UEN_EXAMPLE } from '../src'

describe('normaliseUen', () => {
  it('trims and upper-cases, and changes nothing else', () => {
    expect(normaliseUen('  201912345k ')).toBe('201912345K')
    expect(normaliseUen('t08ll1234a')).toBe('T08LL1234A')
    // an inner space or a dash is a typing error for the format check to catch
    expect(normaliseUen('2019 12345K')).toBe('2019 12345K')
  })
})

describe('isValidUen', () => {
  it('accepts a local company: the year, five digits and a check letter', () => {
    // the example in the published format, and companies incorporated before and after 2009
    for (const uen of ['199012345X', '200812345A', '201012345Z', '202512345C']) {
      expect(isValidUen(uen, 'private_limited'), uen).toBe(true)
    }
  })

  it('refuses a company UEN that is too short, too long, or has no check letter', () => {
    const wrong = [
      '12345678A', // a business (sole proprietorship or partnership): eight digits
      '20191234K', // one digit short
      '2019123456K', // one digit too many
      '2019123456', // no check letter
      '201912345k', // not normalised
      '2019 12345K',
      '2019-12345K',
      'T08LL1234A', // an LLP's number
      '',
    ]
    for (const uen of wrong) expect(isValidUen(uen, 'private_limited'), uen).toBe(false)
  })

  it('accepts a limited liability partnership: T, the year, LL, four digits and a check letter', () => {
    for (const uen of ['T08LL1234A', 'T05LL0001B', 'T24LL9999Z']) {
      expect(isValidUen(uen, 'llp'), uen).toBe(true)
    }
  })

  it('refuses an LLP UEN with another entity code, another century letter or the wrong length', () => {
    const wrong = [
      'T08LP1234A', // a limited partnership
      'T08FC1234A', // a foreign company
      'S99LL1234A', // the 1900s: before LLPs existed
      'T8LL1234A',
      'T08LL123A',
      'T08LL12345A',
      'T08LL1234',
      't08ll1234a',
      '201912345K', // a company's number
    ]
    for (const uen of wrong) expect(isValidUen(uen, 'llp'), uen).toBe(false)
  })

  it('has an example for each entity type that passes its own check', () => {
    for (const entityType of ENTITY_TYPES) {
      expect(isValidUen(UEN_EXAMPLE[entityType], entityType), entityType).toBe(true)
    }
  })
})
