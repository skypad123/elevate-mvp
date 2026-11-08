import type { LessonView } from '@elevate/core'
import { validateDag } from '@elevate/core'
import { Background, Controls, type Edge, MarkerType, type Node, ReactFlow } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useMemo } from 'react'

/** Read-only picture of the course DAG: lessons in dependency layers, arrows from prerequisite to lesson. */
export function CourseMap({ lessons }: { lessons: LessonView[] }) {
  const { nodes, edges } = useMemo(() => {
    const edgesIn = lessons.flatMap((l) =>
      l.prerequisiteIds.map((prerequisiteId) => ({ lessonId: l.id, prerequisiteId })),
    )
    const dag = validateDag(
      lessons.map((l) => l.id),
      edgesIn,
    )
    const order = dag.ok ? dag.order : lessons.map((l) => l.id)
    const byId = new Map(lessons.map((l) => [l.id, l]))
    const layer = new Map<string, number>()
    for (const id of order) {
      const prereqs = byId.get(id)?.prerequisiteIds ?? []
      layer.set(id, prereqs.length ? Math.max(...prereqs.map((p) => (layer.get(p) ?? 0) + 1)) : 0)
    }
    const counts = new Map<number, number>()
    const nodes: Node[] = order.map((id) => {
      const l = byId.get(id)
      const depth = layer.get(id) ?? 0
      const row = counts.get(depth) ?? 0
      counts.set(depth, row + 1)
      return {
        id,
        position: { x: depth * 280, y: row * 110 },
        data: {
          label: `${l?.title ?? 'Lesson'}${l ? ` · ${l.artefacts.length} item${l.artefacts.length === 1 ? '' : 's'}` : ''}`,
        },
        style: {
          borderRadius: 12,
          border: '1px solid var(--border-strong)',
          background: 'var(--surface)',
          color: 'var(--ink)',
          fontSize: 13,
          fontWeight: 600,
          padding: '10px 14px',
          width: 220,
        },
      }
    })
    const edges: Edge[] = edgesIn.map((e) => ({
      id: `${e.prerequisiteId}->${e.lessonId}`,
      source: e.prerequisiteId,
      target: e.lessonId,
      animated: false,
      style: { stroke: dag.ok ? 'var(--brand)' : 'var(--danger)', strokeWidth: 2 },
      markerEnd: { type: MarkerType.ArrowClosed, color: dag.ok ? 'var(--brand)' : 'var(--danger)' },
    }))
    return { nodes, edges }
  }, [lessons])

  return (
    <div className="h-[420px] overflow-hidden rounded-card border border-border bg-surface-muted">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        fitView
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={24} color="var(--border)" />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  )
}
