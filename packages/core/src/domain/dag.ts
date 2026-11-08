/** A course is a DAG of lessons: `lessonId` requires `prerequisiteId` to be completed first. */
export type PrerequisiteEdge = { lessonId: string; prerequisiteId: string }

export type DagValidation =
  | { ok: true; order: string[] }
  | {
      ok: false
      reason: 'self_reference' | 'unknown_lesson' | 'cycle'
      message: string
      lessonId?: string
      cycle?: string[]
    }

/**
 * Validates prerequisites with Kahn's algorithm. On success returns lessons in an order that
 * respects both prerequisites and the original (position) order. On failure identifies the loop.
 */
export function validateDag(
  lessonIds: readonly string[],
  edges: readonly PrerequisiteEdge[],
): DagValidation {
  const ids = new Set(lessonIds)
  const seen = new Set<string>()
  const unique: PrerequisiteEdge[] = []
  for (const edge of edges) {
    const key = `${edge.lessonId}→${edge.prerequisiteId}`
    if (seen.has(key)) continue
    seen.add(key)
    if (edge.lessonId === edge.prerequisiteId) {
      return {
        ok: false,
        reason: 'self_reference',
        lessonId: edge.lessonId,
        message: 'A lesson cannot be its own prerequisite.',
      }
    }
    if (!ids.has(edge.lessonId) || !ids.has(edge.prerequisiteId)) {
      return {
        ok: false,
        reason: 'unknown_lesson',
        lessonId: ids.has(edge.lessonId) ? edge.prerequisiteId : edge.lessonId,
        message: 'A prerequisite points at a lesson that is not in this course.',
      }
    }
    unique.push(edge)
  }

  const indegree = new Map<string, number>(lessonIds.map((id) => [id, 0]))
  const dependants = new Map<string, string[]>(lessonIds.map((id) => [id, []]))
  for (const edge of unique) {
    dependants.get(edge.prerequisiteId)?.push(edge.lessonId)
    indegree.set(edge.lessonId, (indegree.get(edge.lessonId) ?? 0) + 1)
  }

  const order: string[] = []
  const emitted = new Set<string>()
  // O(n²) but deterministic: always emit the earliest-positioned unlocked lesson next.
  while (order.length < lessonIds.length) {
    const next = lessonIds.find((id) => !emitted.has(id) && indegree.get(id) === 0)
    if (!next) break
    emitted.add(next)
    order.push(next)
    for (const dependant of dependants.get(next) ?? []) {
      indegree.set(dependant, (indegree.get(dependant) ?? 1) - 1)
    }
  }

  if (order.length === lessonIds.length) return { ok: true, order }

  const remaining = lessonIds.filter((id) => !emitted.has(id))
  const cycle = findCycle(remaining, dependants)
  return {
    ok: false,
    reason: 'cycle',
    cycle,
    message: `Prerequisites form a loop (${cycle.length} lessons).`,
  }
}

function findCycle(nodes: readonly string[], dependants: Map<string, string[]>): string[] {
  const state = new Map<string, 'visiting' | 'done'>()
  const stack: string[] = []
  const visit = (node: string): string[] | null => {
    state.set(node, 'visiting')
    stack.push(node)
    for (const next of dependants.get(node) ?? []) {
      const s = state.get(next)
      if (s === 'visiting') {
        const start = stack.indexOf(next)
        return [...stack.slice(start), next]
      }
      if (s === undefined) {
        const found = visit(next)
        if (found) return found
      }
    }
    stack.pop()
    state.set(node, 'done')
    return null
  }
  for (const node of nodes) {
    if (!state.has(node)) {
      const found = visit(node)
      if (found) return found
    }
  }
  return [...nodes]
}

/** Convenience: ordered lesson ids, throwing when the graph is invalid. */
export function topologicalOrder(
  lessonIds: readonly string[],
  edges: readonly PrerequisiteEdge[],
): string[] {
  const result = validateDag(lessonIds, edges)
  if (!result.ok) throw new Error(result.message)
  return result.order
}
