import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { mergeCatalog } from '../lib/catalog'
import { addDays, toISODate } from '../lib/dates'
import { createId } from '../lib/id'
import { STORAGE_KEYS, storage } from './store-utils'
import type { Course, Meeting, PlannerState, Task } from '../types'

/**
 * Sample tasks shown on a fresh install, with due dates relative to `today`.
 */
export function createSeedTasks(today: Date): Task[] {
  return [
    {
      id: 'task_ps2',
      courseId: 'course_algo',
      title: 'Problem set 2',
      notes: 'Graph traversals and runtime proofs',
      dueAt: toISODate(addDays(today, 2)),
      done: false,
    },
    {
      id: 'task_critique',
      courseId: 'course_design',
      title: 'Usability critique',
      notes: 'Review a campus app flow',
      dueAt: toISODate(addDays(today, 5)),
      done: false,
    },
    {
      id: 'task_lab',
      courseId: 'course_stats',
      title: 'Lab 3 write-up',
      notes: '',
      dueAt: toISODate(addDays(today, -1)),
      done: false,
    },
    {
      id: 'task_project',
      courseId: 'course_webdev',
      title: 'Final project proposal',
      notes: 'Submit project idea and tech stack',
      dueAt: toISODate(addDays(today, 7)),
      done: false,
    },
    {
      id: 'task_portfolio',
      courseId: 'course_photography',
      title: 'Portfolio review',
      notes: 'Select 10 best photos for critique',
      dueAt: toISODate(addDays(today, 4)),
      done: false,
    },
  ]
}

export interface PlannerStore extends PlannerState {
  addCourse: (course: Omit<Course, 'id' | 'meetings'> & { meetings?: Meeting[] }) => string
  enrollCourse: (courseId: string) => void
  updateCourse: (course: Course) => void
  deleteCourse: (courseId: string) => void
  addMeeting: (courseId: string, meeting: Omit<Meeting, 'id'>) => void
  removeMeeting: (courseId: string, meetingId: string) => void
  addTask: (task: Omit<Task, 'id' | 'done'> & { done?: boolean }) => string
  updateTask: (task: Task) => void
  toggleTask: (taskId: string) => void
  deleteTask: (taskId: string) => void
}

export const usePlannerStore = create<PlannerStore>()(
  persist(
    (set) => ({
      courses: mergeCatalog([]),
      tasks: [],

      addCourse: (course) => {
        const id = createId('course')
        set((state) => ({
          courses: [
            ...state.courses,
            {
              ...course,
              id,
              meetings: course.meetings ?? [],
              enrolled: course.enrolled ?? true,
            },
          ],
        }))
        return id
      },

      enrollCourse: (courseId) => {
        set((state) => ({
          courses: state.courses.map((course) =>
            course.id === courseId ? { ...course, enrolled: true } : course
          ),
        }))
      },

      updateCourse: (course) => {
        set((state) => ({
          courses: state.courses.map((item) => (item.id === course.id ? course : item)),
        }))
      },

      deleteCourse: (courseId) => {
        set((state) => ({
          courses: state.courses.filter((course) => course.id !== courseId),
          tasks: state.tasks.filter((task) => task.courseId !== courseId),
        }))
      },

      addMeeting: (courseId, meeting) => {
        const id = createId('meeting')
        set((state) => ({
          courses: state.courses.map((course) =>
            course.id === courseId
              ? { ...course, meetings: [...course.meetings, { ...meeting, id }] }
              : course
          ),
        }))
      },

      removeMeeting: (courseId, meetingId) => {
        set((state) => ({
          courses: state.courses.map((course) =>
            course.id === courseId
              ? {
                  ...course,
                  meetings: course.meetings.filter((meeting) => meeting.id !== meetingId),
                }
              : course
          ),
        }))
      },

      addTask: (task) => {
        const id = createId('task')
        set((state) => ({
          tasks: [...state.tasks, { ...task, id, done: task.done ?? false }],
        }))
        return id
      },

      updateTask: (task) => {
        set((state) => ({
          tasks: state.tasks.map((item) => (item.id === task.id ? task : item)),
        }))
      },

      toggleTask: (taskId) => {
        set((state) => ({
          tasks: state.tasks.map((task) =>
            task.id === taskId ? { ...task, done: !task.done } : task
          ),
        }))
      },

      deleteTask: (taskId) => {
        set((state) => ({
          tasks: state.tasks.filter((task) => task.id !== taskId),
        }))
      },
    }),
    {
      name: STORAGE_KEYS.planner,
      storage,
      // Hydrated by bootstrapStores() once the storage migrations have run
      skipHydration: true,
      partialize: (state) => ({ courses: state.courses, tasks: state.tasks }),
      // Hydration replaces the whole state, so spread `current` to keep the
      // actions. Pick the persisted fields explicitly: envelopes written by
      // earlier builds also carry a stale `ready` flag that must not come back.
      merge: (persisted, current) => {
        const saved = persisted as Partial<PlannerState> | undefined
        return {
          ...current,
          courses: mergeCatalog(saved?.courses ?? []),
          // Seed the sample tasks only when nothing was ever persisted
          tasks: saved ? saved.tasks ?? [] : createSeedTasks(new Date()),
        }
      },
      // To change the persisted shape later: bump `version` and add `migrate`.
    }
  )
)
