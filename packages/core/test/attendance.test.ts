import { describe, expect, it } from 'vitest'
import {
  type AttendanceEventFacts,
  type AttendanceState,
  attemptsLeft,
  attendanceState,
  CHECK_IN_CLOSES_AFTER_MS,
  CHECK_IN_OPENS_BEFORE_MS,
  canCheckIn,
  canDecide,
  canDispute,
  canManualMark,
  canOverturn,
  checkInMix,
  checkInWindow,
  checkInWindowStatus,
  DISPUTE_WINDOW_MS,
  distanceMeters,
  FLAG_REASONS,
  type FlagReason,
  LOCATION_STATUSES,
  LOCKOUT_MS,
  LOCKOUT_WINDOW_MS,
  type LocationStatus,
  locationStatus,
  lockedUntil,
  moneyAttendance,
  type RefusalReason,
  type Venue,
} from '../src'

const MIN = 60_000
const T0 = Date.UTC(2026, 2, 7, 1, 0) // 09:00 in Singapore
const at = (offsetMs: number) => new Date(T0 + offsetMs)

let seq = 0
function event(
  type: AttendanceEventFacts['type'],
  offsetMs: number,
  extra: Partial<AttendanceEventFacts> = {},
): AttendanceEventFacts {
  seq += 1
  return { id: `e${seq}`, type, createdAt: at(offsetMs), ...extra }
}
const checkIn = (status: LocationStatus = 'ok', offsetMs = 0) =>
  event('check_in', offsetMs, { locationStatus: status })
const overturn = (of: AttendanceEventFacts, offsetMs = MIN) =>
  event('overturn', offsetMs, { refersToEventId: of.id })
const mark = (offsetMs = 2 * MIN) => event('manual_mark', offsetMs)
const dispute = (of: AttendanceEventFacts, offsetMs = 3 * MIN) =>
  event('dispute', offsetMs, { refersToEventId: of.id })
const decision = (of: AttendanceEventFacts, value: 'upheld' | 'voided', offsetMs = 4 * MIN) =>
  event('dispute_decision', offsetMs, { refersToEventId: of.id, decision: value })
const refusal = (reason: RefusalReason, offsetMs: number) =>
  event('attempt_refused', offsetMs, { refusalReason: reason })

/** A mark that was disputed and voided. */
function voidedMark(offsetMs = 2 * MIN): AttendanceEventFacts[] {
  const m = mark(offsetMs)
  const d = dispute(m, offsetMs + MIN)
  return [m, d, decision(d, 'voided', offsetMs + 2 * MIN)]
}

const NOW = at(10 * MIN)
const state = (events: AttendanceEventFacts[], now: Date = NOW) => attendanceState(events, now)

describe('attendanceState', () => {
  it('is Not arrived with no events, or only refused attempts', () => {
    expect(state([])).toEqual({
      state: 'not_arrived',
      flagReason: null,
      subState: null,
      disputeUntil: null,
    })
    expect(state([refusal('code_wrong', 0)]).state).toBe('not_arrived')
  })

  it('is Present for a standing check-in that is ok or needs no location', () => {
    expect(state([checkIn('ok')]).state).toBe('present')
    expect(state([checkIn('not_required')])).toMatchObject({ state: 'present', flagReason: null })
  })

  it('is Present, flagged, with the status as the reason, for every other status', () => {
    for (const reason of FLAG_REASONS) {
      expect(state([checkIn(reason)])).toMatchObject({
        state: 'present_flagged',
        flagReason: reason,
        subState: null,
      })
    }
  })

  it('is Overturned when an overturn refers to the check-in', () => {
    const c = checkIn('out_of_range')
    expect(state([c, overturn(c)])).toMatchObject({ state: 'overturned', flagReason: null })
  })

  it('is Present, marked by hand, for a standing manual mark, ahead of an overturned check-in', () => {
    const c = checkIn('denied')
    expect(state([c, overturn(c), mark(2 * MIN)])).toEqual({
      state: 'marked_by_hand',
      flagReason: null,
      subState: 'open',
      disputeUntil: at(2 * MIN + DISPUTE_WINDOW_MS),
    })
  })

  it('is Mark voided when the latest mark does not stand, ahead of an overturned check-in', () => {
    const c = checkIn('denied', 0)
    expect(state([c, overturn(c), ...voidedMark()]).state).toBe('mark_voided')
    expect(state(voidedMark()).state).toBe('mark_voided')
  })

  it('is Present, marked by hand again when a new mark follows a voided one', () => {
    expect(state([...voidedMark(2 * MIN), mark(6 * MIN)]).state).toBe('marked_by_hand')
  })

  it('puts a standing check-in ahead of an earlier voided mark', () => {
    expect(state([...voidedMark(0), checkIn('unsupported', 5 * MIN)])).toMatchObject({
      state: 'present_flagged',
      flagReason: 'unsupported',
    })
  })

  it('does not count a decision of upheld as a void', () => {
    const m = mark()
    const d = dispute(m)
    expect(state([m, d, decision(d, 'upheld')]).state).toBe('marked_by_hand')
  })

  it('takes events in any order', () => {
    const c = checkIn('ok')
    expect(state([overturn(c), c]).state).toBe('overturned')
  })

  describe('subState', () => {
    it('is Upheld, then Disputed, then Settled, then Open', () => {
      const m = mark(0)
      const d = dispute(m)
      expect(state([m, d, decision(d, 'upheld')]).subState).toBe('upheld')
      expect(state([m, d]).subState).toBe('disputed')
      // A dispute keeps the mark Disputed past the 7 days.
      expect(state([m, d], at(DISPUTE_WINDOW_MS + 1)).subState).toBe('disputed')
      expect(state([m], at(DISPUTE_WINDOW_MS + 1)).subState).toBe('settled')
      expect(state([m], at(DISPUTE_WINDOW_MS)).subState).toBe('open')
    })

    it('gives the end of the dispute window', () => {
      const m = mark(0)
      expect(state([m]).disputeUntil).toEqual(at(DISPUTE_WINDOW_MS))
    })
  })
})

describe('what may follow what', () => {
  describe('canManualMark', () => {
    it('allows a mark when Not arrived, Overturned or Mark voided', () => {
      const c = checkIn('out_of_range')
      expect(canManualMark([], NOW)).toBe(true)
      expect(canManualMark([c, overturn(c)], NOW)).toBe(true)
      expect(canManualMark(voidedMark(), NOW)).toBe(true)
    })

    it('refuses a mark when the learner is present in any way', () => {
      expect(canManualMark([checkIn('ok')], NOW)).toBe('already_present')
      expect(canManualMark([checkIn('denied')], NOW)).toBe('already_present')
      expect(canManualMark([mark()], NOW)).toBe('already_present')
    })
  })

  describe('canCheckIn', () => {
    it('allows a check-in with no check-in row and no standing mark', () => {
      expect(canCheckIn([])).toBe(true)
      expect(canCheckIn([refusal('code_wrong', 0)])).toBe(true)
      expect(canCheckIn(voidedMark())).toBe(true)
    })

    it('answers a repeat when the learner already has a standing check-in or mark', () => {
      expect(canCheckIn([checkIn('ok')])).toBe('repeat')
      expect(canCheckIn([checkIn('denied')])).toBe('repeat')
      expect(canCheckIn([mark()])).toBe('repeat')
    })

    it('refuses a learner whose check-in was overturned, even after a voided mark', () => {
      const c = checkIn('out_of_range')
      expect(canCheckIn([c, overturn(c)])).toBe('overturned')
      expect(canCheckIn([c, overturn(c), ...voidedMark(5 * MIN)])).toBe('overturned')
    })
  })

  describe('canOverturn', () => {
    it('needs a standing check-in', () => {
      const c = checkIn('out_of_range')
      expect(canOverturn([], NOW)).toBe('no_check_in')
      expect(canOverturn([c, overturn(c)], NOW)).toBe('no_check_in')
      expect(canOverturn([mark()], NOW)).toBe('no_check_in')
    })

    it('needs the check-in to be flagged', () => {
      expect(canOverturn([checkIn('ok')], NOW)).toBe('not_flagged')
      expect(canOverturn([checkIn('not_required')], NOW)).toBe('not_flagged')
      for (const reason of FLAG_REASONS) expect(canOverturn([checkIn(reason)], NOW)).toBe(true)
    })
  })

  describe('canDispute', () => {
    it('allows a dispute of a standing mark up to exactly 7 days after it', () => {
      const m = mark(0)
      expect(canDispute([m], m.id, NOW)).toBe(true)
      expect(canDispute([m], m.id, at(DISPUTE_WINDOW_MS))).toBe(true)
      expect(canDispute([m], m.id, at(DISPUTE_WINDOW_MS + 1))).toBe('dispute_window_closed')
    })

    it('allows one dispute per mark', () => {
      const m = mark(0)
      expect(canDispute([m, dispute(m)], m.id, NOW)).toBe('already_disputed')
    })

    it('does not find a mark that is not among the learner events, not a mark, or voided', () => {
      const c = checkIn('ok')
      const [voided] = voidedMark()
      expect(canDispute([mark()], 'someone-elses-mark', NOW)).toBe('not_found')
      expect(canDispute([c], c.id, NOW)).toBe('not_found')
      expect(canDispute(voidedMark(), (voided as AttendanceEventFacts).id, NOW)).toBe('not_found')
      const events = voidedMark()
      expect(canDispute(events, (events[0] as AttendanceEventFacts).id, NOW)).toBe('not_found')
    })
  })

  describe('canDecide', () => {
    it('allows one decision per dispute', () => {
      const m = mark()
      const d = dispute(m)
      expect(canDecide([m, d], d.id, NOW)).toBe(true)
      expect(canDecide([m, d, decision(d, 'upheld')], d.id, NOW)).toBe('dispute_already_decided')
      expect(canDecide([m, d], m.id, NOW)).toBe('not_found')
      expect(canDecide([m, d], 'unknown', NOW)).toBe('not_found')
    })
  })
})

describe('checkInWindow', () => {
  const block = { startsAt: at(0), endsAt: at(120 * MIN) }

  it('opens 30 minutes before the start and closes 30 minutes after the end', () => {
    expect(checkInWindow(block)).toEqual({
      opensAt: at(-CHECK_IN_OPENS_BEFORE_MS),
      closesAt: at(120 * MIN + CHECK_IN_CLOSES_AFTER_MS),
    })
  })

  it('is open at exactly both edges and not a millisecond beyond', () => {
    expect(checkInWindowStatus(block, at(-30 * MIN - 1))).toBe('not_open_yet')
    expect(checkInWindowStatus(block, at(-30 * MIN))).toBe('open')
    expect(checkInWindowStatus(block, at(150 * MIN))).toBe('open')
    expect(checkInWindowStatus(block, at(150 * MIN + 1))).toBe('closed')
  })
})

describe('lockout', () => {
  const wrong = (count: number, firstAt = 0) =>
    Array.from({ length: count }, (_, i) =>
      refusal(i % 2 ? 'code_expired' : 'code_wrong', firstAt + i * 1000),
    )

  it('does not lock after 4 refusals', () => {
    const events = wrong(4)
    expect(lockedUntil(events, at(5000))).toBeNull()
    expect(attemptsLeft(events, at(5000))).toBe(1)
  })

  it('locks after 5 refusals until 5 minutes after the latest', () => {
    const events = wrong(5)
    const latest = 4000
    expect(lockedUntil(events, at(latest))).toEqual(at(latest + LOCKOUT_MS))
    expect(lockedUntil(events, at(latest + LOCKOUT_MS - 1))).toEqual(at(latest + LOCKOUT_MS))
    expect(lockedUntil(events, at(latest + LOCKOUT_MS))).toBeNull()
  })

  it('does not count a refusal 10 minutes and one millisecond old', () => {
    const old = refusal('code_wrong', 0)
    const recent = wrong(4, 5 * MIN)
    const now = at(LOCKOUT_WINDOW_MS + 1)
    expect(lockedUntil([old, ...recent], now)).toBeNull()
    expect(attemptsLeft([old, ...recent], now)).toBe(1)
    // At exactly 10 minutes it still counts.
    expect(lockedUntil([old, ...recent], at(LOCKOUT_WINDOW_MS))).toEqual(
      at(5 * MIN + 3000 + LOCKOUT_MS),
    )
  })

  it('counts only wrong and expired codes', () => {
    const others = [
      refusal('not_open_yet', 0),
      refusal('closed', 1000),
      refusal('too_many_attempts', 2000),
    ]
    expect(attemptsLeft([...others, ...wrong(4, 3000)], at(10_000))).toBe(1)
    expect(lockedUntil([...others, ...wrong(4, 3000)], at(10_000))).toBeNull()
  })

  it('counts attemptsLeft down from 4 to 0 and never below', () => {
    const now = at(10 * 1000)
    expect([1, 2, 3, 4, 5, 6].map((n) => attemptsLeft(wrong(n), now))).toEqual([4, 3, 2, 1, 0, 0])
    expect(attemptsLeft([], now)).toBe(5)
  })
})

describe('location', () => {
  const venue: Venue = { lat: 1.3, lng: 103.8, accuracyM: 20, radiusM: 200 }
  /** A point `metres` north of the venue. */
  const north = (metres: number) => ({ lat: venue.lat + metres / 111_195, lng: venue.lng })

  it('measures distance in metres', () => {
    expect(distanceMeters({ lat: 0, lng: 0 }, { lat: 1, lng: 0 })).toBeCloseTo(111_195, -1)
    expect(distanceMeters(venue, venue)).toBe(0)
  })

  it('gives each of the seven statuses', () => {
    const inPerson = (sent: Parameters<typeof locationStatus>[0]['sent']) =>
      locationStatus({ delivery: 'in_person', venue, sent })
    const seen = new Set<LocationStatus>([
      locationStatus({ delivery: 'remote', venue: null, sent: { status: 'unsupported' } }),
      inPerson({ ...north(100), accuracyM: 10 }),
      inPerson({ ...north(1000), accuracyM: 10 }),
      inPerson({ ...north(0), accuracyM: 501 }),
      inPerson({ status: 'denied' }),
      inPerson({ status: 'unavailable' }),
      inPerson({ status: 'unsupported' }),
    ])
    expect([...seen].sort()).toEqual([...LOCATION_STATUSES].sort())
  })

  it('needs no location for a remote class, whatever was sent', () => {
    expect(
      locationStatus({ delivery: 'remote', venue, sent: { ...north(5000), accuracyM: 900 } }),
    ).toBe('not_required')
  })

  it('takes both accuracies off the distance before comparing with the radius', () => {
    // 300 m away: 300 - 60 - 20 = 220, more than the 200 m radius; 300 - 81 - 20 = 199, not.
    const inPerson = (accuracyM: number) =>
      locationStatus({ delivery: 'in_person', venue, sent: { ...north(300), accuracyM } })
    expect(inPerson(60)).toBe('out_of_range')
    expect(inPerson(81)).toBe('ok')
  })

  it('calls a reading of exactly 500 m accurate enough, and 500.1 m not', () => {
    const inPerson = (accuracyM: number) =>
      locationStatus({ delivery: 'in_person', venue, sent: { ...north(0), accuracyM } })
    expect(inPerson(500)).toBe('ok')
    expect(inPerson(500.1)).toBe('inaccurate')
  })

  it('throws for an in-person reading with no venue', () => {
    expect(() =>
      locationStatus({ delivery: 'in_person', venue: null, sent: { ...north(0), accuracyM: 5 } }),
    ).toThrow()
  })
})

describe('checkInMix', () => {
  const row = (s: AttendanceState, flagReason: FlagReason | null = null) => ({
    state: s,
    flagReason,
  })

  it('counts each state, and the two kinds of flag apart', () => {
    const mix = checkInMix([
      row('present'),
      row('present_flagged', 'unsupported'),
      row('present_flagged', 'out_of_range'),
      row('present_flagged', 'denied'),
      row('overturned'),
      row('marked_by_hand'),
      row('not_arrived'),
      row('mark_voided'),
    ])
    expect(mix).toEqual({
      enrolled: 8,
      selfCheckIn: 1,
      flaggedFromApp: 1,
      flaggedOther: 2,
      overturned: 1,
      markedByHand: 1,
      notArrived: 2,
    })
    const { enrolled, ...parts } = mix
    expect(Object.values(parts).reduce((a, b) => a + b, 0)).toBe(enrolled)
  })

  it('is all zero for no learners', () => {
    expect(checkInMix([])).toEqual({
      enrolled: 0,
      selfCheckIn: 0,
      flaggedFromApp: 0,
      flaggedOther: 0,
      overturned: 0,
      markedByHand: 0,
      notArrived: 0,
    })
  })
})

describe('moneyAttendance', () => {
  const NONE = { counted: false, openMarkUntil: null }

  it('counts a check-in that stands, flagged or not', () => {
    expect(moneyAttendance({ b1: [checkIn('ok')] }, at(MIN))).toEqual({
      counted: true,
      openMarkUntil: null,
    })
    expect(moneyAttendance({ b1: [checkIn('out_of_range')] }, at(MIN)).counted).toBe(true)
  })

  it('does not count an overturned check-in', () => {
    const c = checkIn('out_of_range')
    expect(moneyAttendance({ b1: [c, overturn(c)] }, at(2 * MIN))).toEqual(NONE)
  })

  it('reads a manual mark by its sub-state, at exactly 7 days and one millisecond after', () => {
    const m = mark(0)
    // Open: not counted, and its deadline is the one the learner can still dispute until.
    expect(moneyAttendance({ b1: [m] }, at(DISPUTE_WINDOW_MS))).toEqual({
      counted: false,
      openMarkUntil: at(DISPUTE_WINDOW_MS),
    })
    // Settled.
    expect(moneyAttendance({ b1: [m] }, at(DISPUTE_WINDOW_MS + 1))).toEqual({
      counted: true,
      openMarkUntil: null,
    })
    // Disputed, and upheld: a mark the learner disputed never counts.
    const d = dispute(m, MIN)
    expect(moneyAttendance({ b1: [m, d] }, at(DISPUTE_WINDOW_MS + 1))).toEqual(NONE)
    expect(
      moneyAttendance({ b1: [m, d, decision(d, 'upheld', 2 * MIN)] }, at(DISPUTE_WINDOW_MS + 1)),
    ).toEqual(NONE)
    // Voided: the mark no longer stands.
    expect(moneyAttendance({ b1: voidedMark(0) }, at(DISPUTE_WINDOW_MS + 1))).toEqual(NONE)
  })

  it('counts any block, and keeps the latest open deadline', () => {
    const early = mark(0)
    const late = mark(60 * MIN)
    const now = at(DISPUTE_WINDOW_MS)
    expect(
      moneyAttendance(
        new Map([
          ['b1', [early]],
          ['b2', [late]],
        ]),
        now,
      ),
    ).toEqual({
      counted: false,
      openMarkUntil: at(60 * MIN + DISPUTE_WINDOW_MS),
    })
    expect(moneyAttendance({ b1: [early], b2: [late], b3: [checkIn()] }, now).counted).toBe(true)
    expect(moneyAttendance({}, now)).toEqual(NONE)
  })
})
