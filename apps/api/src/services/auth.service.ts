import type {
  Audience,
  AuthUser,
  MagicLinkRequest,
  ProfileSummary,
  VerifyRequest,
  VerifyResponse,
} from '@elevate/core'
import { schema as s } from '@elevate/db'
import { and, eq, gt, isNull, sql } from 'drizzle-orm'
import type { Deps } from '../deps'
import { magicLinkEmail } from '../emails/templates'
import { hmacHex, randomCode, randomToken } from '../lib/crypto'
import { errors } from '../lib/errors'
import type { ProfileActor, SessionUser } from '../middleware/auth'

const MAGIC_LINK_TTL_MS = 15 * 60 * 1000
const MAGIC_LINK_MAX_PER_WINDOW = 5
const MAGIC_LINK_MAX_ATTEMPTS = 5
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000
const SESSION_TOUCH_MS = 60 * 60 * 1000

export const PORTAL_NAMES: Record<Audience, string> = {
  learner: 'Elevate',
  teach: 'Elevate Teach',
  support: 'Elevate Support',
}

export class AuthService {
  constructor(private readonly deps: Deps) {}

  private hash(value: string) {
    return hmacHex(this.deps.env.SESSION_SECRET, value)
  }

  portalUrl(audience: Audience): string {
    const { env } = this.deps
    return audience === 'teach'
      ? env.TEACH_URL
      : audience === 'support'
        ? env.SUPPORT_URL
        : env.LEARNER_URL
  }

  async requestMagicLink(
    input: MagicLinkRequest,
  ): Promise<{ ok: true; dev?: { code: string; link: string } }> {
    const { db, env, mailer, now } = this.deps
    const since = new Date(now().getTime() - MAGIC_LINK_TTL_MS)
    const [recent] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(s.magicLinks)
      .where(and(eq(s.magicLinks.email, input.email), gt(s.magicLinks.createdAt, since)))
    if ((recent?.count ?? 0) >= MAGIC_LINK_MAX_PER_WINDOW) throw errors.tooMany()

    const token = randomToken(32)
    const code = randomCode()
    await db.insert(s.magicLinks).values({
      email: input.email,
      audience: input.audience,
      tokenHash: this.hash(token),
      codeHash: this.hash(code),
      redirectPath: input.redirectPath ?? null,
      expiresAt: new Date(now().getTime() + MAGIC_LINK_TTL_MS),
    })

    const url = new URL('/verify', this.portalUrl(input.audience))
    url.searchParams.set('token', token)
    if (input.redirectPath) url.searchParams.set('redirect', input.redirectPath)
    const link = url.toString()

    await mailer.send(
      magicLinkEmail({
        to: input.email,
        link,
        code,
        portalName: PORTAL_NAMES[input.audience],
        expiresMinutes: MAGIC_LINK_TTL_MS / 60000,
      }),
    )

    const exposeDev = env.DEV_ENDPOINTS_ENABLED && !env.isProd
    return exposeDev ? { ok: true, dev: { code, link } } : { ok: true }
  }

  async verify(
    input: VerifyRequest,
    userAgent?: string,
  ): Promise<VerifyResponse & { redirectPath: string | null }> {
    const { db, now } = this.deps
    const current = now()

    const link =
      'token' in input
        ? await db.query.magicLinks.findFirst({
            where: { tokenHash: this.hash(input.token), consumedAt: { isNull: true } },
          })
        : await db.query.magicLinks.findFirst({
            where: { email: input.email, consumedAt: { isNull: true } },
            orderBy: { createdAt: 'desc' },
          })

    if (!link)
      throw errors.badRequest(
        'link_invalid',
        'That sign-in link or code is not valid. Request a new one.',
      )
    if (link.expiresAt.getTime() < current.getTime())
      throw errors.badRequest('link_expired', 'That sign-in link has expired. Request a new one.')

    if ('code' in input) {
      if (link.attempts >= MAGIC_LINK_MAX_ATTEMPTS)
        throw errors.badRequest('code_locked', 'Too many incorrect codes. Request a new one.')
      if (this.hash(input.code) !== link.codeHash) {
        const attempts = link.attempts + 1
        await db
          .update(s.magicLinks)
          .set({
            attempts,
            ...(attempts >= MAGIC_LINK_MAX_ATTEMPTS ? { consumedAt: current } : {}),
          })
          .where(eq(s.magicLinks.id, link.id))
        throw errors.badRequest(
          'code_invalid',
          'That code is not right. Check the email and try again.',
        )
      }
    }

    const consumed = await db
      .update(s.magicLinks)
      .set({ consumedAt: current })
      .where(and(eq(s.magicLinks.id, link.id), isNull(s.magicLinks.consumedAt)))
      .returning()
    if (consumed.length === 0)
      throw errors.badRequest('link_invalid', 'That sign-in link was already used.')

    const user = await this.findOrCreateUser(link.email)
    const authUser = await this.buildAuthUser(user.id)

    if (
      link.audience === 'support' &&
      !authUser.roles.some((r) => r === 'support_agent' || r === 'super_admin')
    ) {
      throw errors.forbidden('This account does not have access to Elevate Support.')
    }

    const session = await this.createSession(user.id, link.audience, userAgent)
    return { ...session, user: authUser, redirectPath: link.redirectPath }
  }

  private async findOrCreateUser(email: string) {
    const { db } = this.deps
    const existing = await db.query.users.findFirst({ where: { email } })
    if (existing) return existing
    const [created] = await db.insert(s.users).values({ email }).onConflictDoNothing().returning()
    const user = created ?? (await db.query.users.findFirst({ where: { email } }))
    if (!user) throw new Error('failed to create user')
    await db
      .insert(s.identities)
      .values({ userId: user.id, provider: 'email', providerSubject: email.toLowerCase() })
      .onConflictDoNothing()
    return user
  }

  async createSession(
    userId: string,
    audience: Audience,
    userAgent?: string,
  ): Promise<{ token: string; expiresAt: string }> {
    const token = randomToken(32)
    const expiresAt = new Date(this.deps.now().getTime() + SESSION_TTL_MS)
    const now = this.deps.now()
    await this.deps.db.insert(s.sessions).values({
      userId,
      audience,
      tokenHash: this.hash(token),
      userAgent: userAgent?.slice(0, 512) ?? null,
      expiresAt,
      lastSeenAt: now,
      // The sign-in time. Written from the app clock, like every check that reads it.
      createdAt: now,
    })
    return { token, expiresAt: expiresAt.toISOString() }
  }

  async getSessionUser(token: string): Promise<SessionUser | null> {
    const { db, now } = this.deps
    const current = now()
    const session = await db.query.sessions.findFirst({
      where: { tokenHash: this.hash(token), expiresAt: { gt: current } },
    })
    if (!session) return null
    if (current.getTime() - session.lastSeenAt.getTime() > SESSION_TOUCH_MS) {
      await db
        .update(s.sessions)
        .set({ lastSeenAt: current, expiresAt: new Date(current.getTime() + SESSION_TTL_MS) })
        .where(eq(s.sessions.id, session.id))
    }
    const user = await this.buildAuthUser(session.userId)
    return {
      ...user,
      sessionId: session.id,
      audience: session.audience,
      signedInAt: session.createdAt,
    }
  }

  async signOut(sessionId: string): Promise<void> {
    await this.deps.db.delete(s.sessions).where(eq(s.sessions.id, sessionId))
  }

  async buildAuthUser(userId: string): Promise<AuthUser> {
    const user = await this.deps.db.query.users.findFirst({
      where: { id: userId },
      with: {
        roles: true,
        ownedProfiles: {
          columns: { id: true, type: true, displayName: true, status: true },
          orderBy: { appliedAt: 'asc' },
        },
        memberships: {
          columns: { role: true },
          orderBy: { createdAt: 'asc' },
          with: {
            profile: { columns: { id: true, type: true, displayName: true, status: true } },
          },
        },
      },
    })
    if (!user) throw errors.notFound('User')
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      roles: user.roles.map((r) => r.role),
      // Owned profiles first, then the ones the user is a manager or writer of.
      profiles: [
        ...user.ownedProfiles.map((p) => profileSummary(p, 'owner')),
        ...user.memberships.map((m) => profileSummary(m.profile, m.role)),
      ],
      createdAt: user.createdAt.toISOString(),
    }
  }
}

export function profileSummary(
  profile: Pick<typeof s.profiles.$inferSelect, 'id' | 'type' | 'displayName' | 'status'>,
  role: ProfileSummary['role'],
): ProfileSummary {
  return {
    id: profile.id,
    type: profile.type,
    displayName: profile.displayName,
    status: profile.status,
    role,
  }
}

/**
 * Who `user` is on a profile: its owner, a member with a role, or platform staff (`super_admin`)
 * acting inside it, checked in that order. Returns null when the profile does not exist or the
 * user has no access, and callers answer 404 for both, so a profile's ID is never confirmed to
 * someone outside it.
 */
export async function loadActor(
  deps: Deps,
  user: Pick<AuthUser, 'id' | 'roles'>,
  profileId: string,
): Promise<ProfileActor | null> {
  const profile = await deps.db.query.profiles.findFirst({
    where: { id: profileId },
    columns: { id: true, type: true, status: true, ownerUserId: true },
  })
  if (!profile) return null
  const on = {
    profileId: profile.id,
    profileType: profile.type,
    profileStatus: profile.status,
    userId: user.id,
  }
  if (profile.ownerUserId === user.id) return { ...on, role: 'owner' }
  const membership = await deps.db.query.profileMemberships.findFirst({
    where: { profileId: profile.id, userId: user.id },
    columns: { role: true },
  })
  if (membership) return { ...on, role: membership.role }
  if (user.roles.includes('super_admin')) return { ...on, role: 'staff' }
  return null
}
