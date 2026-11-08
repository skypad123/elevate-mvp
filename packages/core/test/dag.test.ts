import { describe, expect, it } from 'vitest'
import { topologicalOrder, validateDag } from '../src/domain/dag'

describe('validateDag', () => {
  it('orders lessons by prerequisites while respecting position order', () => {
    const r = validateDag(
      ['a', 'b', 'c', 'd'],
      [
        { lessonId: 'c', prerequisiteId: 'a' },
        { lessonId: 'd', prerequisiteId: 'c' },
        { lessonId: 'd', prerequisiteId: 'b' },
      ],
    )
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.order).toEqual(['a', 'b', 'c', 'd'])
  })

  it('reports a cycle with its path', () => {
    const r = validateDag(
      ['a', 'b', 'c'],
      [
        { lessonId: 'b', prerequisiteId: 'a' },
        { lessonId: 'c', prerequisiteId: 'b' },
        { lessonId: 'a', prerequisiteId: 'c' },
      ],
    )
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.reason).toBe('cycle')
      expect(r.cycle?.length).toBeGreaterThanOrEqual(3)
    }
  })

  it('rejects self references and unknown lessons', () => {
    expect(validateDag(['a'], [{ lessonId: 'a', prerequisiteId: 'a' }])).toMatchObject({
      ok: false,
      reason: 'self_reference',
    })
    expect(validateDag(['a'], [{ lessonId: 'a', prerequisiteId: 'zz' }])).toMatchObject({
      ok: false,
      reason: 'unknown_lesson',
      lessonId: 'zz',
    })
  })

  it('ignores duplicate edges and handles no edges', () => {
    expect(
      topologicalOrder(
        ['x', 'y'],
        [
          { lessonId: 'y', prerequisiteId: 'x' },
          { lessonId: 'y', prerequisiteId: 'x' },
        ],
      ),
    ).toEqual(['x', 'y'])
    expect(topologicalOrder(['p', 'q'], [])).toEqual(['p', 'q'])
  })
})
