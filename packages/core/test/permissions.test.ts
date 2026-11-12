import { describe, expect, it } from 'vitest'
import {
  type Actor,
  type ActorRole,
  CAPABILITIES,
  type Capability,
  can,
  type ProfileType,
} from '../src'

/**
 * The role table, written out. It is the security boundary for Teach, so it is repeated here in
 * full: a change to the rules has to change this table too.
 *
 * Columns: owner, manager (corporate profiles only), writer, staff.
 */
const EXPECTED: Record<
  Capability,
  [owner: boolean, manager: boolean, writer: boolean, staff: boolean]
> = {
  'profile.read': [true, true, true, true],
  'profile.edit': [true, true, false, true],
  'course.create': [true, true, true, false],
  'course.editDraft': [true, true, true, true],
  'course.editLive': [true, true, false, true],
  'course.proposeLiveEdit': [true, true, true, false],
  'course.setPrice': [true, true, false, false],
  'course.submit': [true, true, false, false],
  'course.delete': [true, true, false, false],
  'changeSet.review': [true, true, false, false],
  'media.upload': [true, true, true, true],
  'earnings.read': [true, true, false, true],
  'members.read': [true, true, false, true],
  'members.manageWriters': [true, true, false, false],
  'members.manageManagers': [true, false, false, false],
  'stripe.links': [true, false, false, false],
}

const ROLES: ActorRole[] = ['owner', 'manager', 'writer', 'staff']
const TYPES: ProfileType[] = ['personal', 'corporate']

function actor(role: ActorRole, profileType: ProfileType, overrides: Partial<Actor> = {}): Actor {
  return { role, profileType, profileStatus: 'approved', ...overrides }
}

describe('can', () => {
  it('has an expected row for every capability', () => {
    expect(Object.keys(EXPECTED).sort()).toEqual([...CAPABILITIES].sort())
  })

  for (const profileType of TYPES) {
    for (const [index, role] of ROLES.entries()) {
      it(`matches the table for ${role} on an approved ${profileType} profile`, () => {
        for (const capability of CAPABILITIES) {
          // A manager on a personal profile is covered by its own test below.
          const expected =
            role === 'manager' && profileType === 'personal' ? false : EXPECTED[capability][index]
          expect(can(actor(role, profileType), capability), `${role} ${capability}`).toBe(expected)
        }
      })
    }
  }

  it('gives a manager nothing on a personal profile', () => {
    for (const capability of CAPABILITIES) {
      expect(can(actor('manager', 'personal'), capability), capability).toBe(false)
    }
  })

  it('keeps Stripe links and choosing managers with the owner alone', () => {
    for (const profileType of TYPES) {
      for (const role of ROLES) {
        const ownerOnly = role === 'owner'
        expect(can(actor(role, profileType), 'stripe.links')).toBe(ownerOnly)
        expect(can(actor(role, profileType), 'members.manageManagers')).toBe(ownerOnly)
      }
    }
  })

  it('lets the owner and members at most read and edit a profile that is not approved', () => {
    for (const profileStatus of ['applied', 'rejected'] as const) {
      for (const profileType of TYPES) {
        for (const [index, role] of (['owner', 'manager', 'writer'] as const).entries()) {
          for (const capability of CAPABILITIES) {
            const readOrEdit = capability === 'profile.read' || capability === 'profile.edit'
            // Never more than the role has on an approved profile: a writer still cannot edit
            // the profile, and a manager on a personal profile still has nothing.
            const onApproved =
              role === 'manager' && profileType === 'personal' ? false : EXPECTED[capability][index]
            expect(
              can(actor(role, profileType, { profileStatus }), capability),
              `${role} ${profileType} ${profileStatus} ${capability}`,
            ).toBe(readOrEdit && onApproved)
          }
        }
      }
    }
  })

  it('gives a writer on a profile that is not approved read access only', () => {
    for (const profileStatus of ['applied', 'rejected'] as const) {
      const writer = actor('writer', 'personal', { profileStatus })
      expect(CAPABILITIES.filter((capability) => can(writer, capability))).toEqual(['profile.read'])
    }
  })

  it('gives staff the same row whatever the profile status', () => {
    for (const profileStatus of ['applied', 'approved', 'rejected'] as const) {
      for (const capability of CAPABILITIES) {
        expect(can(actor('staff', 'personal', { profileStatus }), capability), capability).toBe(
          EXPECTED[capability][3],
        )
      }
    }
  })

  it('never lets staff touch money, publishing or membership', () => {
    const forbidden: Capability[] = [
      'course.create',
      'course.proposeLiveEdit',
      'course.setPrice',
      'course.submit',
      'course.delete',
      'changeSet.review',
      'members.manageWriters',
      'members.manageManagers',
      'stripe.links',
    ]
    for (const capability of forbidden) {
      expect(can(actor('staff', 'corporate'), capability), capability).toBe(false)
    }
  })
})
