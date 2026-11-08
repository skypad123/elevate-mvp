import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { restrictToVerticalAxis } from '@dnd-kit/modifiers'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { cn } from '@elevate/web-ui'
import { GripVertical } from 'lucide-react'
import type { ReactNode } from 'react'

export type SortableHandleProps = Record<string, unknown>

export function SortableList<T extends { id: string }>({
  items,
  onReorder,
  renderItem,
  disabled,
  className,
}: {
  items: T[]
  onReorder: (ids: string[]) => void
  renderItem: (item: T, handle: ReactNode) => ReactNode
  disabled?: boolean
  className?: string
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const from = items.findIndex((i) => i.id === active.id)
    const to = items.findIndex((i) => i.id === over.id)
    if (from < 0 || to < 0) return
    onReorder(arrayMove(items, from, to).map((i) => i.id))
  }
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis]}
      onDragEnd={onDragEnd}
    >
      <SortableContext
        items={items.map((i) => i.id)}
        strategy={verticalListSortingStrategy}
        disabled={disabled}
      >
        <ul className={cn('flex flex-col gap-1.5', className)}>
          {items.map((item) => (
            <SortableRow key={item.id} id={item.id} disabled={disabled}>
              {(handle) => renderItem(item, handle)}
            </SortableRow>
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  )
}

function SortableRow({
  id,
  disabled,
  children,
}: {
  id: string
  disabled?: boolean
  children: (handle: ReactNode) => ReactNode
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled,
  })
  const style = { transform: CSS.Transform.toString(transform), transition }
  const handle = (
    <button
      type="button"
      aria-label="Drag to reorder"
      className={cn(
        'cursor-grab touch-none rounded-sm p-1 text-ink-tertiary hover:bg-surface-muted hover:text-ink active:cursor-grabbing',
        disabled && 'invisible',
      )}
      {...attributes}
      {...listeners}
    >
      <GripVertical className="size-4" />
    </button>
  )
  return (
    <li ref={setNodeRef} style={style} className={cn(isDragging && 'z-10 opacity-80')}>
      {children(handle)}
    </li>
  )
}
