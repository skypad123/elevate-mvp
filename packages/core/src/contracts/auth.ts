import { z } from 'zod'
import type { ProfileRole, ProfileStatus, ProfileType } from '../domain/permissions'
import { audienceSchema, emailSchema, type roleSchema } from './common'

export const magicLinkRequestSchema = z.object({
  email: emailSchema,
  audience: audienceSchema,
  /** Where the web client should land after verification (same-origin path). */
  redirectPath: z.string().startsWith('/').max(512).optional(),
})
export type MagicLinkRequest = z.infer<typeof magicLinkRequestSchema>

export const verifyRequestSchema = z.union([
  z.object({ token: z.string().min(16).max(256) }),
  z.object({ email: emailSchema, code: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code') }),
])
export type VerifyRequest = z.infer<typeof verifyRequestSchema>

export const updateMeSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  avatarMediaId: z.string().uuid().nullable().optional(),
})
export type UpdateMe = z.infer<typeof updateMeSchema>

/** A teaching profile the user owns or belongs to, with their role on it. */
export type ProfileSummary = {
  id: string
  type: ProfileType
  displayName: string
  status: ProfileStatus
  role: ProfileRole
}

export type AuthUser = {
  id: string
  email: string
  name: string | null
  avatarUrl: string | null
  roles: z.infer<typeof roleSchema>[]
  /** Every profile the user owns or is a member of; empty for a user who only learns. */
  profiles: ProfileSummary[]
  createdAt: string
}

export type VerifyResponse = { token: string; expiresAt: string; user: AuthUser }
