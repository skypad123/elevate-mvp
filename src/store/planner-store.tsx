import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { addDays, toISODate } from '../lib/dates'
import { createId } from '../lib/id'
import type { Course, Meeting, PlannerState, Task } from '../types'

const STORAGE_KEY = '@elvate/planner'

const today = new Date()

const seedState: PlannerState = {
  courses: [
    {
      id: 'course_algo',
      name: 'Intro to Algorithms',
      code: 'CS 161',
      instructor: 'Dr. Chen',
      location: 'Hall 204',
      color: 'teal',
      meetings: [
        { id: 'm1', day: 1, start: '09:00', end: '10:20' },
        { id: 'm2', day: 3, start: '09:00', end: '10:20' },
      ],
    },
    {
      id: 'course_design',
      name: 'Interaction Design',
      code: 'DES 220',
      instructor: 'Prof. Alvarez',
      location: 'Studio B',
      color: 'purple',
      meetings: [
        { id: 'm3', day: 2, start: '13:00', end: '15:30' },
        { id: 'm4', day: 4, start: '13:00', end: '15:30' },
      ],
    },
    {
      id: 'course_stats',
      name: 'Applied Statistics',
      code: 'STAT 110',
      instructor: 'Dr. Patel',
      location: 'Science 18',
      color: 'orange',
      meetings: [{ id: 'm5', day: 5, start: '11:00', end: '12:15' }],
    },
  ],
  tasks: [
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
  ],
}

type PlannerContextValue = PlannerState & {
  ready: boolean
  addCourse: (course: Omit<Course, 'id' | 'meetings'> & { meetings?: Meeting[] }) => string
  updateCourse: (course: Course) => void
  deleteCourse: (courseId: string) => void
  addMeeting: (courseId: string, meeting: Omit<Meeting, 'id'>) => void
  removeMeeting: (courseId: string, meetingId: string) => void
  addTask: (task: Omit<Task, 'id' | 'done'> & { done?: boolean }) => string
  updateTask: (task: Task) => void
  toggleTask: (taskId: string) => void
  deleteTask: (taskId: string) => void
  getCourse: (courseId?: string) => Course | undefined
}

const PlannerContext = createContext<PlannerContextValue | null>(null)

export function PlannerProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PlannerState>({ courses: [], tasks: [] })
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (cancelled) return
        if (!raw) {
          setState(seedState)
          return
        }
        const parsed = JSON.parse(raw) as PlannerState
        setState({
          courses: parsed.courses ?? [],
          tasks: parsed.tasks ?? [],
        })
      })
      .catch(() => {
        if (!cancelled) setState(seedState)
      })
      .finally(() => {
        if (!cancelled) setReady(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!ready) return
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch(() => {})
  }, [ready, state])

  const addCourse = useCallback(
    (course: Omit<Course, 'id' | 'meetings'> & { meetings?: Meeting[] }) => {
      const id = createId('course')
      setState((current) => ({
        ...current,
        courses: [
          ...current.courses,
          { ...course, id, meetings: course.meetings ?? [] },
        ],
      }))
      return id
    },
    []
  )

  const updateCourse = useCallback((course: Course) => {
    setState((current) => ({
      ...current,
      courses: current.courses.map((item) => (item.id === course.id ? course : item)),
    }))
  }, [])

  const deleteCourse = useCallback((courseId: string) => {
    setState((current) => ({
      courses: current.courses.filter((course) => course.id !== courseId),
      tasks: current.tasks.filter((task) => task.courseId !== courseId),
    }))
  }, [])

  const addMeeting = useCallback((courseId: string, meeting: Omit<Meeting, 'id'>) => {
    const id = createId('meeting')
    setState((current) => ({
      ...current,
      courses: current.courses.map((course) =>
        course.id === courseId
          ? { ...course, meetings: [...course.meetings, { ...meeting, id }] }
          : course
      ),
    }))
  }, [])

  const removeMeeting = useCallback((courseId: string, meetingId: string) => {
    setState((current) => ({
      ...current,
      courses: current.courses.map((course) =>
        course.id === courseId
          ? {
              ...course,
              meetings: course.meetings.filter((meeting) => meeting.id !== meetingId),
            }
          : course
      ),
    }))
  }, [])

  const addTask = useCallback((task: Omit<Task, 'id' | 'done'> & { done?: boolean }) => {
    const id = createId('task')
    setState((current) => ({
      ...current,
      tasks: [...current.tasks, { ...task, id, done: task.done ?? false }],
    }))
    return id
  }, [])

  const updateTask = useCallback((task: Task) => {
    setState((current) => ({
      ...current,
      tasks: current.tasks.map((item) => (item.id === task.id ? task : item)),
    }))
  }, [])

  const toggleTask = useCallback((taskId: string) => {
    setState((current) => ({
      ...current,
      tasks: current.tasks.map((task) =>
        task.id === taskId ? { ...task, done: !task.done } : task
      ),
    }))
  }, [])

  const deleteTask = useCallback((taskId: string) => {
    setState((current) => ({
      ...current,
      tasks: current.tasks.filter((task) => task.id !== taskId),
    }))
  }, [])

  const getCourse = useCallback(
    (courseId?: string) =>
      courseId ? state.courses.find((course) => course.id === courseId) : undefined,
    [state.courses]
  )

  const value = useMemo(
    () => ({
      ...state,
      ready,
      addCourse,
      updateCourse,
      deleteCourse,
      addMeeting,
      removeMeeting,
      addTask,
      updateTask,
      toggleTask,
      deleteTask,
      getCourse,
    }),
    [
      state,
      ready,
      addCourse,
      updateCourse,
      deleteCourse,
      addMeeting,
      removeMeeting,
      addTask,
      updateTask,
      toggleTask,
      deleteTask,
      getCourse,
    ]
  )

  return <PlannerContext.Provider value={value}>{children}</PlannerContext.Provider>
}

export function usePlanner() {
  const context = useContext(PlannerContext)
  if (!context) {
    throw new Error('usePlanner must be used inside PlannerProvider')
  }
  return context
}
