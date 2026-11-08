import { z } from 'zod'
import { uuidSchema } from './common'

export const promoCodeInputSchema = z
  .string()
  .trim()
  .toUpperCase()
  .min(3)
  .max(32)
  .regex(/^[A-Z0-9-]+$/, 'Letters, numbers and dashes only')

export const quoteRequestSchema = z.object({
  courseId: uuidSchema,
  promoCode: promoCodeInputSchema.optional(),
})
export type QuoteRequest = z.infer<typeof quoteRequestSchema>

export const checkoutRequestSchema = z.object({
  promoCode: promoCodeInputSchema.optional(),
})
export type CheckoutRequest = z.infer<typeof checkoutRequestSchema>

export type QuoteResponse = {
  quote: import('../domain/money').Quote
  promo: { code: string; type: 'percent' | 'fixed'; value: number } | null
  course: {
    id: string
    slug: string
    title: string
    priceCents: number
    thumbnailUrl: string | null
    teacherName: string
  }
}

export type CheckoutStartResponse =
  | { kind: 'redirect'; url: string; sessionId: string }
  | { kind: 'enrolled'; enrollmentId: string }

export type CheckoutSyncResponse =
  | { status: 'paid'; enrollmentId: string; courseSlug: string }
  | { status: 'pending' | 'expired' }
