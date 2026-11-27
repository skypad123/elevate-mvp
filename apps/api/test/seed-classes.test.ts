import { schema as s } from '@elevate/db'
import { seedDatabase } from '@elevate/db/seed'
import { isNotNull } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createTestApp, type TestApp } from './helpers/test-app'

/**
 * The demo seed's class (docs/designs/scheduled-classes-attendance.md, entry 2.19): one published
 * class with 20 class enrollments, nothing new on a second run, testers added without renaming
 * anyone, a fresh class once the last has ended, and nothing at all with `classes` off.
 */
let t: TestApp
// 2026-11-08 12:00 in Singapore.
const NOW = new Date('2026-11-08T04:00:00.000Z')

const seed = (options: { classes?: boolean; classLearnerEmails?: string[]; now?: Date }) =>
  seedDatabase(t.db, {
    superAdminEmail: 'admin@test.local',
    mode: 'demo',
    storage: null,
    ...options,
  })

const demoClasses = () =>
  t.db.query.classes.findMany({
    where: { name: { like: 'Demo class %' } },
    orderBy: { createdAt: 'asc' },
    with: { blocks: { orderBy: { position: 'asc' } }, enrollments: true },
  })

beforeAll(async () => {
  t = await createTestApp()
})
afterAll(async () => {
  await t.close()
})

describe('the demo class', () => {
  it('creates one published class with three blocks and 20 class enrollments', async () => {
    await seed({ classes: true, now: NOW })
    const [demo, ...more] = await demoClasses()
    expect(more).toEqual([])
    expect(demo).toMatchObject({
      name: 'Demo class 2026-11-08',
      status: 'published',
      delivery: 'in_person',
      seats: 30,
      timeZone: 'Asia/Singapore',
    })
    const writer = await t.db.query.users.findFirst({ where: { email: 'writer@example.com' } })
    expect(demo?.instructorUserId).toBe(writer?.id)
    expect(demo?.blocks.map((b) => [b.startsAt.toISOString(), b.endsAt.toISOString()])).toEqual([
      ['2026-11-08T01:00:00.000Z', '2026-11-08T09:00:00.000Z'],
      ['2026-11-09T01:00:00.000Z', '2026-11-09T09:00:00.000Z'],
      ['2026-11-10T01:00:00.000Z', '2026-11-10T09:00:00.000Z'],
    ])
    expect(new Set(demo?.blocks.map((b) => b.codeSecret)).size).toBe(3)
    expect(demo?.enrollments).toHaveLength(20)
    expect(demo?.enrollments.every((e) => e.status === 'active')).toBe(true)
    const course = await t.db.query.courses.findFirst({ where: { id: demo?.courseId } })
    expect(course?.status).toBe('live')
    // the demo learner's self-paced Sourdough enrollment is still the only self-paced one
    const learner = await t.db.query.users.findFirst({ where: { email: 'learner@example.com' } })
    const own = await t.db.query.enrollments.findMany({
      where: { userId: learner?.id, classId: { isNull: true } },
    })
    expect(own).toHaveLength(1)
  })

  it('creates no class and no enrollment on a second run the same day', async () => {
    await seed({ classes: true, now: new Date(NOW.getTime() + 60 * 60_000) })
    const classes = await demoClasses()
    expect(classes).toHaveLength(1)
    expect(classes[0]?.enrollments).toHaveLength(20)
  })

  it('adds a tester’s address without renaming an existing user', async () => {
    await t.db.insert(s.users).values({ email: 'tester@example.com', name: 'Real Tester' })
    await seed({
      classes: true,
      classLearnerEmails: ['tester@example.com', 'new-tester@example.com'],
      now: NOW,
    })
    const [demo] = await demoClasses()
    expect(demo?.enrollments).toHaveLength(22)
    const tester = await t.db.query.users.findFirst({ where: { email: 'tester@example.com' } })
    expect(tester?.name).toBe('Real Tester')
    const fresh = await t.db.query.users.findFirst({ where: { email: 'new-tester@example.com' } })
    expect(fresh).toBeDefined()
  })

  it('creates a second class once the last block has ended', async () => {
    const later = new Date('2026-11-11T04:00:00.000Z')
    await seed({ classes: true, now: later })
    const classes = await demoClasses()
    expect(classes.map((c) => c.name)).toEqual(['Demo class 2026-11-08', 'Demo class 2026-11-11'])
    expect(classes[1]?.enrollments).toHaveLength(20)
    // the first class kept its enrollments
    expect(classes[0]?.enrollments).toHaveLength(22)
  })
})

describe('with classes off', () => {
  it('creates no class data', async () => {
    const off = await createTestApp()
    try {
      await seedDatabase(off.db, {
        superAdminEmail: 'admin@test.local',
        mode: 'demo',
        storage: null,
      })
      expect(await off.db.query.classes.findMany()).toEqual([])
      expect(
        await off.db.select().from(s.enrollments).where(isNotNull(s.enrollments.classId)),
      ).toEqual([])
    } finally {
      await off.close()
    }
  })
})
