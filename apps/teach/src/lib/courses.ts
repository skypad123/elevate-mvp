import type {
  CourseSummary,
  CourseView,
  CreateCourse,
  QuizDefinition,
  RichTextDoc,
  UpdateCourse,
} from '@elevate/core'
import { useToast } from '@elevate/web-ui'
import { errorMessage, unwrap } from '@elevate/web-ui/portal'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'
import { api } from './api'
import { courseKeys } from './keys'
import { useCurrentProfile } from './profile'

export { courseKeys }

/** Every call below is for the profile in the URL. */
const scoped = api.teach.profiles[':profileId']

export function useCourses() {
  const { profileId } = useCurrentProfile()
  return useQuery({
    queryKey: courseKeys.list(profileId),
    queryFn: async () =>
      (await unwrap(await scoped.courses.$get({ param: { profileId } }))).items as CourseSummary[],
  })
}

export function useCourse(id: string) {
  const { profileId } = useCurrentProfile()
  return useQuery({
    queryKey: courseKeys.detail(profileId, id),
    queryFn: async () =>
      (await unwrap(await scoped.courses[':id'].$get({ param: { profileId, id } })))
        .course as CourseView,
  })
}

export async function createCourse(profileId: string, input: CreateCourse): Promise<CourseView> {
  return (await unwrap(await scoped.courses.$post({ param: { profileId }, json: input })))
    .course as CourseView
}

/** Every builder mutation returns the whole CourseView; keep the cache in step and toast failures. */
export function useCourseActions(courseId: string) {
  const { profileId } = useCurrentProfile()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  return useMemo(() => {
    const apply = (result: { course: CourseView }) => {
      queryClient.setQueryData(courseKeys.detail(profileId, courseId), result.course)
      void queryClient.invalidateQueries({ queryKey: courseKeys.list(profileId) })
      return result.course
    }
    const run = async (
      label: string,
      fn: () => Promise<{ course: CourseView }>,
    ): Promise<CourseView> => {
      try {
        return apply(await fn())
      } catch (error) {
        toast({ tone: 'danger', title: label, description: errorMessage(error) })
        // A step may have been saved before the failure; read the course again.
        void queryClient.invalidateQueries({ queryKey: courseKeys.detail(profileId, courseId) })
        throw error
      }
    }
    const course = { profileId, id: courseId }
    const on = (id: string) => ({ profileId, id })
    return {
      updateCourse: (patch: UpdateCourse) =>
        run('Could not save course', async () =>
          unwrap(await scoped.courses[':id'].$patch({ param: course, json: patch })),
        ),
      /**
       * Saves the course details and, when `priceCents` is given, the price. Price has its own
       * route, which not every role may use, so it is sent only when it changed.
       */
      saveDetails: (patch: UpdateCourse, priceCents: number | null) =>
        run('Could not save course', async () => {
          const saved = await unwrap(
            await scoped.courses[':id'].$patch({ param: course, json: patch }),
          )
          if (priceCents === null) return saved
          return unwrap(
            await scoped.courses[':id'].price.$put({ param: course, json: { priceCents } }),
          )
        }),
      submitCourse: () =>
        run('Could not submit', async () =>
          unwrap(await scoped.courses[':id'].submit.$post({ param: course })),
        ),
      addLesson: (title = 'Untitled lesson') =>
        run('Could not add lesson', async () =>
          unwrap(await scoped.courses[':id'].lessons.$post({ param: course, json: { title } })),
        ),
      updateLesson: (lessonId: string, patch: { title?: string; summary?: string | null }) =>
        run('Could not save lesson', async () =>
          unwrap(await scoped.lessons[':id'].$patch({ param: on(lessonId), json: patch })),
        ),
      deleteLesson: (lessonId: string) =>
        run('Could not delete lesson', async () =>
          unwrap(await scoped.lessons[':id'].$delete({ param: on(lessonId) })),
        ),
      reorderLessons: (ids: string[]) =>
        run('Could not reorder', async () =>
          unwrap(await scoped.courses[':id'].lessons.order.$put({ param: course, json: { ids } })),
        ),
      setPrerequisites: (lessonId: string, prerequisiteIds: string[]) =>
        run('Could not save prerequisites', async () =>
          unwrap(
            await scoped.lessons[':id'].prerequisites.$put({
              param: on(lessonId),
              json: { prerequisiteIds },
            }),
          ),
        ),
      addArtefact: (lessonId: string, type: 'video' | 'audio' | 'text' | 'quiz', title: string) =>
        run('Could not add content', async () =>
          unwrap(
            await scoped.lessons[':id'].artefacts.$post({
              param: on(lessonId),
              json: { type, title },
            }),
          ),
        ),
      updateArtefact: (
        artefactId: string,
        patch: {
          title?: string
          mediaAssetId?: string | null
          contentJson?: RichTextDoc | null
          durationSeconds?: number | null
        },
      ) =>
        run('Could not save content', async () =>
          unwrap(await scoped.artefacts[':id'].$patch({ param: on(artefactId), json: patch })),
        ),
      deleteArtefact: (artefactId: string) =>
        run('Could not delete content', async () =>
          unwrap(await scoped.artefacts[':id'].$delete({ param: on(artefactId) })),
        ),
      reorderArtefacts: (lessonId: string, ids: string[]) =>
        run('Could not reorder', async () =>
          unwrap(
            await scoped.lessons[':id'].artefacts.order.$put({
              param: on(lessonId),
              json: { ids },
            }),
          ),
        ),
      saveQuiz: (artefactId: string, quiz: QuizDefinition) =>
        run('Could not save quiz', async () =>
          unwrap(await scoped.artefacts[':id'].quiz.$put({ param: on(artefactId), json: quiz })),
        ),
    }
  }, [profileId, courseId, queryClient, toast])
}

export type CourseActions = ReturnType<typeof useCourseActions>

/**
 * Uploads a picked image through the media API and returns its public URL (for inline images).
 * The image is stored as the profile's media, so everyone on the profile can use it.
 */
export async function uploadInlineImage(profileId: string): Promise<string | null> {
  const file = await new Promise<File | null>((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/jpeg,image/png,image/webp'
    input.onchange = () => resolve(input.files?.[0] ?? null)
    input.click()
  })
  if (!file) return null
  const instructions = await unwrap(
    await api.media.uploads.$post({
      json: {
        kind: 'image',
        filename: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
        profileId,
      },
    }),
  )
  await fetch(instructions.uploadUrl, {
    method: 'PUT',
    body: file,
    headers: { 'Content-Type': file.type },
  })
  const { asset } = await unwrap(
    await api.media.assets[':id'].complete.$post({ param: { id: instructions.asset.id } }),
  )
  return asset.url
}
