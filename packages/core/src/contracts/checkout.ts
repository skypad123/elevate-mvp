import { z } from 'zod'
import { uuidSchema } from './common'
import { localeSchema } from './preferences'

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
  /** The language on screen; Stripe Checkout and the return pages follow it. */
  locale: localeSchema.optional(),
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

/**
 * A class payment answers `paid` with its `classId`, or `seat_lost` when the payment got no seat
 * and is being returned in full. An older app reads `seat_lost` as not paid.
 */
export type CheckoutSyncResponse =
  | { status: 'paid'; enrollmentId: string; courseSlug: string; classId?: string }
  | { status: 'seat_lost'; classId: string; courseSlug: string }
  | { status: 'pending' | 'expired' }
