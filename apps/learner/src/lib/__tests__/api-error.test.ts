import { createTranslator, translate } from '@elevate/i18n'
import { ApiError, errorMessage } from '@/lib/api-error'

const zh = createTranslator('zh')
const en = createTranslator('en')

describe('errorMessage', () => {
  it("words a known code in the reader's language, never with the API's English sentence", () => {
    const error = new ApiError(
      429,
      'rate_limited',
      'Too many attempts. Try again in a few minutes.',
    )
    expect(errorMessage(error, zh)).toBe(translate('zh', 'apiError.rate_limited'))
    expect(errorMessage(new ApiError(400, 'link_used', 'Server words'), en)).toBe(
      translate('en', 'apiError.link_used'),
    )
  })

  it('puts the titles of the lessons to finish into the locked-lesson sentence', () => {
    const error = new ApiError(403, 'lesson_locked', 'Finish A and B first', {
      blockedBy: ['1', '2'],
      blockedByTitles: ['Mixing', 'Shaping'],
    })
    expect(errorMessage(error, en)).toBe('Finish Mixing, Shaping first.')
    expect(errorMessage(new ApiError(403, 'lesson_locked', 'This lesson is locked'), en)).toBe(
      translate('en', 'apiError.lesson_locked'),
    )
  })

  it('formats the minimum charge from the details', () => {
    const error = new ApiError(422, 'below_minimum', 'x', { minimumCents: 100 })
    expect(errorMessage(error, en)).toBe(
      translate('en', 'apiError.below_minimum', { amount: 'S$1.00' }),
    )
  })

  it('gives an unknown code, an internal error or a proxy page the generic sentence', () => {
    for (const error of [
      new ApiError(400, 'wrong_kind', 'Expected a image'),
      new ApiError(500, 'internal', 'Something went wrong on our side'),
      new ApiError(502, 'request_failed', ''),
    ])
      expect(errorMessage(error, zh)).toBe(translate('zh', 'learnerCommon.error.generic'))
  })

  it('says Elevate cannot be reached when the request never left, on native and on the web', () => {
    expect(errorMessage(new Error('Network request failed'), zh)).toBe(
      translate('zh', 'learnerCommon.error.unreachable'),
    )
    expect(errorMessage(new TypeError('Failed to fetch'), zh)).toBe(
      translate('zh', 'learnerCommon.error.unreachable'),
    )
  })

  it('gives a TypeError from a bug the generic sentence, not "check your connection"', () => {
    const bug = new TypeError("Cannot read properties of undefined (reading 'ok')")
    expect(errorMessage(bug, zh)).toBe(translate('zh', 'learnerCommon.error.generic'))
  })

  it('keeps the code of a response that is not the error envelope, with no English built in', async () => {
    const error = await ApiError.fromResponse({
      status: 502,
      json: async () => {
        throw new SyntaxError('Unexpected token <')
      },
    })
    expect(error).toMatchObject({ status: 502, code: 'request_failed', message: '' })
  })
})
