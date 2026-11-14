import type { ChangeSetChoice, ChangeSetView, CourseView } from '@elevate/core'
import { unwrap } from '@elevate/web-ui/portal'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'
import { api } from './api'
import { courseKeys } from './keys'
import { useCurrentProfile } from './profile'

const scoped = api.teach.profiles[':profileId']

/** The course's open change set: a writer's edits waiting for approval. Null when there is none. */
export function useChangeSet(courseId: string) {
  const { profileId } = useCurrentProfile()
  return useQuery({
    queryKey: courseKeys.changeSet(profileId, courseId),
    enabled: !!courseId,
    queryFn: async () =>
      (
        await unwrap(
          await scoped.courses[':id']['change-set'].$get({ param: { profileId, id: courseId } }),
        )
      ).changeSet as ChangeSetView | null,
  })
}

/**
 * Deciding a change set. Each call refreshes what the review screen and the builder show.
 * Failures are thrown for the caller to report: a refused approval carries the conflicts.
 */
export function useChangeSetActions(courseId: string) {
  const { profileId } = useCurrentProfile()
  const queryClient = useQueryClient()
  return useMemo(() => {
    const param = { profileId, id: courseId }
    /** Everything cached about this course, and the course list with its pending badge. */
    const refresh = async () => {
      await queryClient.invalidateQueries({ queryKey: courseKeys.detail(profileId, courseId) })
      await queryClient.invalidateQueries({ queryKey: courseKeys.list(profileId) })
    }
    const decided = async (result: { course: CourseView }) => {
      queryClient.setQueryData(courseKeys.changeSet(profileId, courseId), null)
      await refresh()
      return result.course
    }
    return {
      refresh,
      resolve: async (choices: ChangeSetChoice[]): Promise<ChangeSetView> => {
        const { changeSet } = await unwrap(
          await scoped.courses[':id']['change-set'].resolve.$post({ param, json: { choices } }),
        )
        queryClient.setQueryData(courseKeys.changeSet(profileId, courseId), changeSet)
        return changeSet as ChangeSetView
      },
      approve: async () =>
        decided(await unwrap(await scoped.courses[':id']['change-set'].approve.$post({ param }))),
      discard: async () =>
        decided(await unwrap(await scoped.courses[':id']['change-set'].discard.$post({ param }))),
    }
  }, [profileId, courseId, queryClient])
}
