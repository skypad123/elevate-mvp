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
