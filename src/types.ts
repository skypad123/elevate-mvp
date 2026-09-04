export const COURSE_COLORS = [
  'teal',
  'blue',
  'purple',
  'pink',
  'orange',
  'yellow',
  'green',
  'red',
] as const

export type CourseColor = (typeof COURSE_COLORS)[number]

export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6

export type Meeting = {
  id: string
  day: Weekday
  start: string
  end: string
}

export type Course = {
  id: string
  name: string
  code: string
  instructor: string
  location: string
  color: CourseColor
  meetings: Meeting[]
  thumbnail?: string
}

export type Task = {
  id: string
  courseId: string
  title: string
  notes: string
  dueAt: string
  done: boolean
}

export type PlannerState = {
  courses: Course[]
  tasks: Task[]
}
