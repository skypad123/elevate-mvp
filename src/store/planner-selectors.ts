import { useShallow } from 'zustand/react/shallow'
import { isEnrolled } from '../lib/catalog'
import type { Course, Task } from '../types'
import { usePlannerStore, type PlannerStore } from './planner-store'

/**
 * Derived reads over the planner store.
 *
 * Hooks that return arrays go through `useShallow`, so a component re-renders
 * only when the selected items change. Keep each selector returning a single
 * flat array of references already held in state: a nested fresh collection
 * would never be shallow-equal and would re-render forever.
 */

export function useCourse(courseId?: string): Course | undefined {
  return usePlannerStore((state) =>
    courseId ? state.courses.find((course) => course.id === courseId) : undefined
  )
}

const selectEnrolledCourses = (state: PlannerStore) => state.courses.filter(isEnrolled)

export function useEnrolledCourses(): Course[] {
  return usePlannerStore(useShallow(selectEnrolledCourses))
}

export function useCourseTasks(courseId?: string): Task[] {
  return usePlannerStore(
    useShallow((state: PlannerStore) => state.tasks.filter((task) => task.courseId === courseId))
  )
}

const byDueAt = (a: Task, b: Task) => a.dueAt.localeCompare(b.dueAt)

// `filter` returns a copy, so sorting it never mutates state
const selectOpenTasks = (state: PlannerStore) =>
  state.tasks.filter((task) => !task.done).sort(byDueAt)

export function useOpenTasks(): Task[] {
  return usePlannerStore(useShallow(selectOpenTasks))
}

const selectDoneTasks = (state: PlannerStore) => state.tasks.filter((task) => task.done)

export function useDoneTasks(): Task[] {
  return usePlannerStore(useShallow(selectDoneTasks))
}
