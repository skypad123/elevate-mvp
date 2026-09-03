import type { Weekday } from '../types'

export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const
export const WEEKDAYS_LONG = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const

export function startOfDay(date: Date) {
  const next = new Date(date)
  next.setHours(0, 0, 0, 0)
  return next
}

export function formatDate(isoDate: string) {
  const date = parseISODate(isoDate)
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

export function toISODate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function parseISODate(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, (month || 1) - 1, day || 1)
}

export function addDays(date: Date, amount: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + amount)
  return next
}

export function startOfWeek(date: Date) {
  const next = startOfDay(date)
  const day = next.getDay()
  next.setDate(next.getDate() - day)
  return next
}

export function weekDays(anchor = new Date()) {
  const start = startOfWeek(anchor)
  return Array.from({ length: 7 }, (_, index) => addDays(start, index))
}

export function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

export function weekdayOf(date: Date): Weekday {
  return date.getDay() as Weekday
}

export function daysUntil(isoDate: string) {
  const due = startOfDay(parseISODate(isoDate)).getTime()
  const today = startOfDay(new Date()).getTime()
  return Math.round((due - today) / 86_400_000)
}

export function dueLabel(isoDate: string) {
  const delta = daysUntil(isoDate)
  if (delta < 0) return `${Math.abs(delta)}d overdue`
  if (delta === 0) return 'Due today'
  if (delta === 1) return 'Due tomorrow'
  return `Due in ${delta}d`
}

export function formatTime(value: string) {
  const [hoursRaw, minutes = '00'] = value.split(':')
  const hours = Number(hoursRaw)
  if (Number.isNaN(hours)) return value
  const suffix = hours >= 12 ? 'PM' : 'AM'
  const hour12 = hours % 12 || 12
  return `${hour12}:${minutes} ${suffix}`
}
