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
