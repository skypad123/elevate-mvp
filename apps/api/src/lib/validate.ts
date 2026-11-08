import { zValidator } from '@hono/zod-validator'
import type { ZodType } from 'zod'

/** zod validation with a stable error envelope: { error: { code: 'validation', details: [{ path, message }] } }. */
export const validate = <T extends ZodType, Target extends 'json' | 'query' | 'param' | 'form'>(
  target: Target,
  schema: T,
) =>
  zValidator(target, schema, (result, c) => {
    if (!result.success) {
      return c.json(
        {
          error: {
            code: 'validation',
            message: 'Check the highlighted fields',
            details: result.error.issues.map((issue) => ({
              path: issue.path.map(String).join('.'),
              message: issue.message,
            })),
          },
        },
        400,
      )
    }
  })
