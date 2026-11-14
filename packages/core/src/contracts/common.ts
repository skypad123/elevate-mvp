import { z } from 'zod'

export const audienceSchema = z.enum(['learner', 'teach', 'support'])
export type Audience = z.infer<typeof audienceSchema>

/** Platform staff roles. Teaching comes from a profile (`AuthUser.profiles`), not from a role. */
export const roleSchema = z.enum(['support_agent', 'super_admin'])
export type Role = z.infer<typeof roleSchema>

export const uuidSchema = z.string().uuid()

export const emailSchema = z.string().trim().toLowerCase().email().max(254)

export const paginationSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
})
export type Pagination = z.infer<typeof paginationSchema>

export type Page<T> = { items: T[]; nextCursor: string | null }

export const idsSchema = z.object({ ids: z.array(uuidSchema).min(1).max(500) })
