import { z } from 'zod'
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

export type TeacherSummary = {
  status: 'applied' | 'approved' | 'rejected'
  displayName: string
  stripeChargesEnabled: boolean
  stripePayoutsEnabled: boolean
  stripeDetailsSubmitted: boolean
  commissionBps: number
}

export type AuthUser = {
  id: string
  email: string
  name: string | null
  avatarUrl: string | null
  roles: z.infer<typeof roleSchema>[]
  teacher: TeacherSummary | null
  createdAt: string
}

export type VerifyResponse = { token: string; expiresAt: string; user: AuthUser }
