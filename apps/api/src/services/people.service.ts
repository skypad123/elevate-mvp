import type { Page, PersonDetail, PersonSummary, Role } from '@elevate/core'
import { schema as s } from '@elevate/db'
import { and, desc, eq, exists, ilike, inArray, notExists, or, type SQL, sql } from 'drizzle-orm'
import type { Deps } from '../deps'
import { errors } from '../lib/errors'
import type { SessionUser } from '../middleware/auth'
import { recordAudit } from './audit.service'
import { teacherProfileView } from './teachers.service'

export type PeopleQuery = {
  q?: string
  role?: 'teacher' | 'learner' | 'staff'
  status?: 'applied' | 'approved' | 'rejected'
  cursor?: string
  limit: number
}

type UserWithRelations = typeof s.users.$inferSelect & {
  roles: (typeof s.userRoles.$inferSelect)[]
  teacherProfile: typeof s.teacherProfiles.$inferSelect | null
}

const STAFF_ROLES = ['support_agent', 'super_admin'] as const

function encodeCursor(createdAt: Date, id: string): string {
  return Buffer.from(JSON.stringify([createdAt.toISOString(), id])).toString('base64url')
}
function decodeCursor(cursor: string): { createdAt: Date; id: string } | null {
  try {
    const [iso, id] = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as [
      string,
      string,
    ]
    const createdAt = new Date(iso)
    if (Number.isNaN(createdAt.getTime()) || typeof id !== 'string') return null
    return { createdAt, id }
  } catch {
    return null
  }
}

export function personSummary(user: UserWithRelations): PersonSummary {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
    roles: user.roles.map((r) => r.role),
    createdAt: user.createdAt.toISOString(),
    teacher: user.teacherProfile
      ? {
          status: user.teacherProfile.status,
          displayName: user.teacherProfile.displayName,
          commissionBps: user.teacherProfile.commissionBps,
          stripeChargesEnabled: user.teacherProfile.stripeChargesEnabled,
          appliedAt: user.teacherProfile.appliedAt.toISOString(),
        }
      : null,
  }
}

export class PeopleService {
  constructor(private readonly deps: Deps) {}

  async list(query: PeopleQuery): Promise<Page<PersonSummary>> {
    const { db } = this.deps
    const conditions: SQL[] = []

    const teacherExists = (extra?: SQL) =>
      exists(
        db
          .select({ one: sql`1` })
          .from(s.teacherProfiles)
          .where(
            extra
              ? and(eq(s.teacherProfiles.userId, s.users.id), extra)
              : eq(s.teacherProfiles.userId, s.users.id),
          ),
      )
    const staffExists = exists(
      db
        .select({ one: sql`1` })
        .from(s.userRoles)
        .where(
          and(eq(s.userRoles.userId, s.users.id), inArray(s.userRoles.role, [...STAFF_ROLES])),
        ),
    )

    if (query.role === 'teacher')
      conditions.push(
        teacherExists(query.status ? eq(s.teacherProfiles.status, query.status) : undefined),
      )
    if (query.role === 'staff') conditions.push(staffExists)
    if (query.role === 'learner') {
      conditions.push(
        notExists(
          db
            .select({ one: sql`1` })
            .from(s.teacherProfiles)
            .where(eq(s.teacherProfiles.userId, s.users.id)),
        ),
      )
      conditions.push(
        notExists(
          db
            .select({ one: sql`1` })
            .from(s.userRoles)
            .where(
              and(eq(s.userRoles.userId, s.users.id), inArray(s.userRoles.role, [...STAFF_ROLES])),
            ),
        ),
      )
    }
    if (query.q) {
      const like = `%${query.q.replace(/[%_]/g, '\\$&')}%`
      const nameMatch = exists(
        db
          .select({ one: sql`1` })
          .from(s.teacherProfiles)
          .where(
            and(
              eq(s.teacherProfiles.userId, s.users.id),
              ilike(s.teacherProfiles.displayName, like),
            ),
          ),
      )
      const q = or(ilike(sql`${s.users.email}::text`, like), ilike(s.users.name, like), nameMatch)
      if (q) conditions.push(q)
    }
    const cursor = query.cursor ? decodeCursor(query.cursor) : null
    if (cursor)
      conditions.push(
        sql`(${s.users.createdAt}, ${s.users.id}) < (${cursor.createdAt.toISOString()}::timestamptz, ${cursor.id}::uuid)`,
      )

    const rows = await db.query.users.findMany({
      where: conditions.length ? and(...conditions) : undefined,
      with: { roles: true, teacherProfile: true },
      orderBy: [desc(s.users.createdAt), desc(s.users.id)],
      limit: query.limit + 1,
    })
    const items = rows.slice(0, query.limit).map(personSummary)
    const last = rows.length > query.limit ? rows[query.limit - 1] : null
    return { items, nextCursor: last ? encodeCursor(last.createdAt, last.id) : null }
  }

  async detail(userId: string): Promise<PersonDetail> {
    const { db } = this.deps
    const user = await db.query.users.findFirst({
      where: eq(s.users.id, userId),
      with: { roles: true, teacherProfile: true },
    })
    if (!user) throw errors.notFound('Person')
    const [[enrollments], [courses]] = await Promise.all([
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(s.enrollments)
        .where(and(eq(s.enrollments.userId, userId), inArray(s.enrollments.status, ['active']))),
      db
        .select({
          count: sql<number>`count(*)::int`,
          live: sql<number>`count(*) filter (where ${s.courses.status} = 'live')::int`,
        })
        .from(s.courses)
        .where(eq(s.courses.teacherId, userId)),
    ])
    return {
      ...personSummary(user),
      teacherProfile: user.teacherProfile
        ? teacherProfileView(user.teacherProfile, user.email)
        : null,
      stats: {
        enrollments: enrollments?.count ?? 0,
        courses: courses?.count ?? 0,
        liveCourses: courses?.live ?? 0,
      },
    }
  }

  async setRole(
    actor: SessionUser,
    userId: string,
    role: Role,
    grant: boolean,
  ): Promise<PersonDetail> {
    const { db } = this.deps
    if (role === 'teacher')
      throw errors.badRequest(
        'use_approval',
        'Teacher access is granted by approving an application',
      )
    if (userId === actor.id && role === 'super_admin' && !grant)
      throw errors.badRequest('self_demotion', 'You cannot remove your own super admin role')
    const user = await db.query.users.findFirst({ where: eq(s.users.id, userId) })
    if (!user) throw errors.notFound('Person')
    if (grant)
      await db
        .insert(s.userRoles)
        .values({ userId, role, grantedBy: actor.id })
        .onConflictDoNothing()
    else
      await db
        .delete(s.userRoles)
        .where(and(eq(s.userRoles.userId, userId), eq(s.userRoles.role, role)))
    await recordAudit(this.deps, {
      actorId: actor.id,
      action: grant ? 'role.grant' : 'role.revoke',
      entityType: 'user',
      entityId: userId,
      metadata: { role },
    })
    return this.detail(userId)
  }
}
