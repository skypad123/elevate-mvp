import { describe, expect, it } from 'vitest'
import { CLASS_TIME_ZONE, instantToZoned, MAX_BLOCKS, validateBlocks, zonedToInstant } from '../src'

const NEW_YORK = 'America/New_York'

describe('Singapore conversions', () => {
  it('turns a wall-clock time into an instant 8 hours earlier in UTC', () => {
    expect(zonedToInstant('2026-03-07', '09:00', CLASS_TIME_ZONE).toISOString()).toBe(
      '2026-03-07T01:00:00.000Z',
    )
    // Early morning in Singapore is the evening before in UTC.
    expect(zonedToInstant('2026-03-07', '07:30', CLASS_TIME_ZONE).toISOString()).toBe(
      '2026-03-06T23:30:00.000Z',
    )
  })

  it('turns an instant back into the wall-clock date and time', () => {
    expect(instantToZoned('2026-03-06T23:30:00.000Z', CLASS_TIME_ZONE)).toEqual({
      date: '2026-03-07',
      time: '07:30',
    })
    expect(instantToZoned(new Date('2026-12-31T16:00:00Z'), CLASS_TIME_ZONE)).toEqual({
      date: '2027-01-01',
      time: '00:00',
    })
  })

  it('round-trips every hour of a day', () => {
    for (let hour = 0; hour < 24; hour++) {
      const time = `${String(hour).padStart(2, '0')}:15`
      const instant = zonedToInstant('2026-06-01', time, CLASS_TIME_ZONE)
      expect(instantToZoned(instant, CLASS_TIME_ZONE)).toEqual({ date: '2026-06-01', time })
    }
  })
})

describe('a zone with daylight saving', () => {
  it('uses the offset in force on the day', () => {
    expect(zonedToInstant('2026-01-15', '09:00', NEW_YORK).toISOString()).toBe(
      '2026-01-15T14:00:00.000Z',
    )
    expect(zonedToInstant('2026-07-15', '09:00', NEW_YORK).toISOString()).toBe(
      '2026-07-15T13:00:00.000Z',
    )
    expect(instantToZoned('2026-07-15T13:00:00.000Z', NEW_YORK)).toEqual({
      date: '2026-07-15',
      time: '09:00',
    })
  })

  it('moves a time the clocks skip past the change', () => {
    // 8 March 2026: 02:00 EST becomes 03:00 EDT.
    expect(zonedToInstant('2026-03-08', '01:30', NEW_YORK).toISOString()).toBe(
      '2026-03-08T06:30:00.000Z',
    )
    expect(zonedToInstant('2026-03-08', '02:30', NEW_YORK).toISOString()).toBe(
      '2026-03-08T07:30:00.000Z',
    )
    expect(zonedToInstant('2026-03-08', '03:30', NEW_YORK).toISOString()).toBe(
      '2026-03-08T07:30:00.000Z',
    )
  })

  it('takes the earlier instant for a time the clocks repeat', () => {
    // 1 November 2026: 02:00 EDT becomes 01:00 EST, so 01:30 happens twice.
    expect(zonedToInstant('2026-11-01', '01:30', NEW_YORK).toISOString()).toBe(
      '2026-11-01T05:30:00.000Z',
    )
    expect(instantToZoned('2026-11-01T06:30:00.000Z', NEW_YORK)).toEqual({
      date: '2026-11-01',
      time: '01:30',
    })
  })
})

describe('zonedToInstant input', () => {
  it('refuses a date or time that does not exist on the calendar', () => {
    expect(() => zonedToInstant('2026-02-30', '09:00', CLASS_TIME_ZONE)).toThrow(RangeError)
    expect(() => zonedToInstant('2026-03-07', '24:00', CLASS_TIME_ZONE)).toThrow(RangeError)
    expect(() => zonedToInstant('2026-03-07', '9:00', CLASS_TIME_ZONE)).toThrow(RangeError)
  })
})

describe('validateBlocks', () => {
  const hour = (h: number) => new Date(Date.UTC(2026, 2, 7, h))
  const block = (start: number, end: number) => ({ startsAt: hour(start), endsAt: hour(end) })

  it('finds no problem in blocks that only touch', () => {
    expect(validateBlocks([block(1, 3), block(3, 5)])).toEqual([])
    expect(validateBlocks([])).toEqual([])
  })

  it('finds a block that does not end after it starts', () => {
    expect(validateBlocks([block(1, 3), block(5, 5), block(7, 6)])).toEqual([
      { index: 1, problem: 'end_not_after_start' },
      { index: 2, problem: 'end_not_after_start' },
    ])
  })

  it('finds both blocks of an overlap', () => {
    expect(validateBlocks([block(1, 3), block(5, 6), block(2, 4)])).toEqual([
      { index: 0, problem: 'overlaps' },
      { index: 2, problem: 'overlaps' },
    ])
  })

  it('finds each block past the limit', () => {
    const blocks = Array.from({ length: MAX_BLOCKS + 2 }, (_, i) => ({
      startsAt: new Date(Date.UTC(2026, 0, 1) + i * 86_400_000),
      endsAt: new Date(Date.UTC(2026, 0, 1) + i * 86_400_000 + 3_600_000),
    }))
    expect(validateBlocks(blocks)).toEqual([
      { index: MAX_BLOCKS, problem: 'too_many' },
      { index: MAX_BLOCKS + 1, problem: 'too_many' },
    ])
    expect(validateBlocks(blocks.slice(0, MAX_BLOCKS))).toEqual([])
  })
})
