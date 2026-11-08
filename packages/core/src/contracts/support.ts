import { z } from 'zod'
import { roleSchema } from './common'

export const rejectSchema = z.object({ reason: z.string().trim().min(10).max(2000) })
export const reviewNoteSchema = z.object({ note: z.string().trim().max(2000).optional() })
export const commissionSchema = z.object({ commissionBps: z.number().int().min(0).max(5000) })
export const refundSchema = z.object({ reason: z.string().trim().min(3).max(500) })
export const grantRoleSchema = z.object({ role: roleSchema, grant: z.boolean() })
export const peopleQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  role: z.enum(['teacher', 'learner', 'staff']).optional(),
  status: z.enum(['applied', 'approved', 'rejected']).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
})

export type PersonSummary = {
  id: string
  email: string
  name: string | null
  avatarUrl: string | null
  roles: z.infer<typeof roleSchema>[]
  createdAt: string
  teacher: {
    status: 'applied' | 'approved' | 'rejected'
    displayName: string
    commissionBps: number
    stripeChargesEnabled: boolean
    appliedAt: string
  } | null
}

export type PersonDetail = PersonSummary & {
  teacherProfile: import('./teach').TeacherProfileView | null
  stats: { enrollments: number; courses: number; liveCourses: number }
}
