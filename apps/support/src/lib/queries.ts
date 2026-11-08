import type { Page, PersonDetail, PersonSummary } from '@elevate/core'
import { unwrap } from '@elevate/web-ui/portal'
import { useQuery } from '@tanstack/react-query'
import { api } from './api'

export type PeopleFilter = {
  q?: string
  role?: 'teacher' | 'learner' | 'staff'
  status?: 'applied' | 'approved' | 'rejected'
}

export const supportKeys = {
  people: (filter: PeopleFilter) => ['support', 'people', filter] as const,
  person: (id: string) => ['support', 'person', id] as const,
}

export function usePeople(filter: PeopleFilter) {
  return useQuery({
    queryKey: supportKeys.people(filter),
    queryFn: async () => {
      const query: Record<string, string> = { limit: '50' }
      if (filter.q) query.q = filter.q
      if (filter.role) query.role = filter.role
      if (filter.status) query.status = filter.status
      return (await unwrap(await api.support.people.$get({ query }))) as Page<PersonSummary>
    },
  })
}

export function usePerson(id: string) {
  return useQuery({
    queryKey: supportKeys.person(id),
    queryFn: async () =>
      (await unwrap(await api.support.people[':id'].$get({ param: { id } })))
        .person as PersonDetail,
  })
}

export const reviewKeys = {
  queue: ['support', 'review-queue'] as const,
  course: (id: string) => ['support', 'course', id] as const,
}

export function useReviewQueue() {
  return useQuery({
    queryKey: reviewKeys.queue,
    queryFn: async () =>
      (await unwrap(await api.support['review-queue'].$get()))
        .items as import('@elevate/core').CourseSummary[],
  })
}

export function useReviewCourse(id: string) {
  return useQuery({
    queryKey: reviewKeys.course(id),
    queryFn: async () =>
      (await unwrap(await api.support.courses[':id'].$get({ param: { id } })))
        .course as import('@elevate/core').CourseView,
  })
}
