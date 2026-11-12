import type { Page, PersonDetail, PersonSummary, Role } from '@elevate/core'
import { schema as s } from '@elevate/db'
import {
  and,
  EmptyFilter,
  eq,
  exists,
  ilike,
  inArray,
  notExists,
  or,
  type SQL,
  sql,
} from 'drizzle-orm'
import type { Deps } from '../deps'
import { errors } from '../lib/errors'
import type { SessionUser } from '../middleware/auth'
import { recordAudit } from './audit.service'
import { profileSummary } from './auth.service'

export type PeopleQuery = {
  q?: string
  role?: 'learner' | 'staff'
  cursor?: string
  limit: number
}

type UserWithRelations = typeof s.users.$inferSelect & {
  roles: (typeof s.userRoles.$inferSelect)[]
  ownedProfiles: Pick<typeof s.profiles.$inferSelect, 'id' | 'type' | 'displayName' | 'status'>[]
}

/** The relations a person is listed with. Memberships join `ownedProfiles` when they exist. */
const PERSON_RELATIONS = {
  roles: true,
  ownedProfiles: {
    columns: { id: true, type: true, displayName: true, status: true },
    orderBy: { appliedAt: 'asc' },
  },
} as const

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
    profiles: user.ownedProfiles.map((p) => profileSummary(p, 'owner')),
  }
}

export class PeopleService {
  constructor(private readonly deps: Deps) {}

  async list(query: PeopleQuery): Promise<Page<PersonSummary>> {
    const { db } = this.deps
    const cursor = query.cursor ? decodeCursor(query.cursor) : null

    /**
     * The filters as SQL. `users` is the alias the relational query gives the table; the
     * subqueries have to refer to it, because `s.users` is not in scope inside that query.
     */
    const conditionsFor = (users: typeof s.users): SQL[] => {
      const conditions: SQL[] = []

      const ownsProfile = (extra?: SQL) =>
        db
          .select({ one: sql`1` })
          .from(s.profiles)
          .where(
            extra
              ? and(eq(s.profiles.ownerUserId, users.id), extra)
              : eq(s.profiles.ownerUserId, users.id),
          )
      const staffExists = exists(
        db
          .select({ one: sql`1` })
          .from(s.userRoles)
          .where(
            and(eq(s.userRoles.userId, users.id), inArray(s.userRoles.role, [...STAFF_ROLES])),
          ),
      )

      if (query.role === 'staff') conditions.push(staffExists)
      // A learner owns no profile and is not staff.
      if (query.role === 'learner') {
        conditions.push(notExists(ownsProfile()))
        conditions.push(
          notExists(
            db
              .select({ one: sql`1` })
              .from(s.userRoles)
              .where(
                and(eq(s.userRoles.userId, users.id), inArray(s.userRoles.role, [...STAFF_ROLES])),
              ),
          ),
        )
      }
      if (query.q) {
        const like = `%${query.q.replace(/[%_]/g, '\\$&')}%`
        const nameMatch = exists(ownsProfile(ilike(s.profiles.displayName, like)))
        const q = or(ilike(sql`${users.email}::text`, like), ilike(users.name, like), nameMatch)
        if (q) conditions.push(q)
      }
      if (cursor)
        conditions.push(
          sql`(${users.createdAt}, ${users.id}) < (${cursor.createdAt.toISOString()}::timestamptz, ${cursor.id}::uuid)`,
        )
      return conditions
    }

    const rows = await db.query.users.findMany({
      // No conditions means no filter; Drizzle wants that said with EmptyFilter, not undefined.
      where: { RAW: (users) => and(...conditionsFor(users)) ?? EmptyFilter },
      with: PERSON_RELATIONS,
      orderBy: { createdAt: 'desc', id: 'desc' },
      limit: query.limit + 1,
    })
    const items = rows.slice(0, query.limit).map(personSummary)
    const last = rows.length > query.limit ? rows[query.limit - 1] : null
    return { items, nextCursor: last ? encodeCursor(last.createdAt, last.id) : null }
  }

  async detail(userId: string): Promise<PersonDetail> {
    const { db } = this.deps
    const user = await db.query.users.findFirst({
      where: { id: userId },
      with: PERSON_RELATIONS,
    })
    if (!user) throw errors.notFound('Person')
    const [enrollments] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(s.enrollments)
      .where(and(eq(s.enrollments.userId, userId), inArray(s.enrollments.status, ['active'])))
    return {
      ...personSummary(user),
      stats: { enrollments: enrollments?.count ?? 0 },
    }
  }

  async setRole(
    actor: SessionUser,
    userId: string,
    role: Role,
    grant: boolean,
  ): Promise<PersonDetail> {
    const { db } = this.deps
    if (userId === actor.id && role === 'super_admin' && !grant)
      throw errors.badRequest('self_demotion', 'You cannot remove your own super admin role')
    const user = await db.query.users.findFirst({ where: { id: userId } })
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
