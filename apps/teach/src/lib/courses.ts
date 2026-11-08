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

export const courseKeys = {
  list: ['teach', 'courses'] as const,
  detail: (id: string) => ['teach', 'course', id] as const,
}

export function useCourses() {
  return useQuery({
    queryKey: courseKeys.list,
    queryFn: async () => (await unwrap(await api.teach.courses.$get())).items as CourseSummary[],
  })
}

export function useCourse(id: string) {
  return useQuery({
    queryKey: courseKeys.detail(id),
    queryFn: async () =>
      (await unwrap(await api.teach.courses[':id'].$get({ param: { id } }))).course as CourseView,
  })
}

export async function createCourse(input: CreateCourse): Promise<CourseView> {
  return (await unwrap(await api.teach.courses.$post({ json: input }))).course as CourseView
}

/** Every builder mutation returns the whole CourseView; keep the cache in step and toast failures. */
export function useCourseActions(courseId: string) {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  return useMemo(() => {
    const apply = (result: { course: CourseView }) => {
      queryClient.setQueryData(courseKeys.detail(courseId), result.course)
      void queryClient.invalidateQueries({ queryKey: courseKeys.list })
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
        throw error
      }
    }
    const id = courseId
    return {
      updateCourse: (patch: UpdateCourse) =>
        run('Could not save course', async () =>
          unwrap(await api.teach.courses[':id'].$patch({ param: { id }, json: patch })),
        ),
      submitCourse: () =>
        run('Could not submit', async () =>
          unwrap(await api.teach.courses[':id'].submit.$post({ param: { id } })),
        ),
      addLesson: (title = 'Untitled lesson') =>
        run('Could not add lesson', async () =>
          unwrap(await api.teach.courses[':id'].lessons.$post({ param: { id }, json: { title } })),
        ),
      updateLesson: (lessonId: string, patch: { title?: string; summary?: string | null }) =>
        run('Could not save lesson', async () =>
          unwrap(await api.teach.lessons[':id'].$patch({ param: { id: lessonId }, json: patch })),
        ),
      deleteLesson: (lessonId: string) =>
        run('Could not delete lesson', async () =>
          unwrap(await api.teach.lessons[':id'].$delete({ param: { id: lessonId } })),
        ),
      reorderLessons: (ids: string[]) =>
        run('Could not reorder', async () =>
          unwrap(
            await api.teach.courses[':id'].lessons.order.$put({ param: { id }, json: { ids } }),
          ),
        ),
      setPrerequisites: (lessonId: string, prerequisiteIds: string[]) =>
        run('Could not save prerequisites', async () =>
          unwrap(
            await api.teach.lessons[':id'].prerequisites.$put({
              param: { id: lessonId },
              json: { prerequisiteIds },
            }),
          ),
        ),
      addArtefact: (lessonId: string, type: 'video' | 'audio' | 'text' | 'quiz', title: string) =>
        run('Could not add content', async () =>
          unwrap(
            await api.teach.lessons[':id'].artefacts.$post({
              param: { id: lessonId },
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
          unwrap(
            await api.teach.artefacts[':id'].$patch({ param: { id: artefactId }, json: patch }),
          ),
        ),
      deleteArtefact: (artefactId: string) =>
        run('Could not delete content', async () =>
          unwrap(await api.teach.artefacts[':id'].$delete({ param: { id: artefactId } })),
        ),
      reorderArtefacts: (lessonId: string, ids: string[]) =>
        run('Could not reorder', async () =>
          unwrap(
            await api.teach.lessons[':id'].artefacts.order.$put({
              param: { id: lessonId },
              json: { ids },
            }),
          ),
        ),
      saveQuiz: (artefactId: string, quiz: QuizDefinition) =>
        run('Could not save quiz', async () =>
          unwrap(
            await api.teach.artefacts[':id'].quiz.$put({ param: { id: artefactId }, json: quiz }),
          ),
        ),
    }
  }, [courseId, queryClient, toast])
}

export type CourseActions = ReturnType<typeof useCourseActions>

/** Uploads a picked image through the media API and returns its public URL (for inline images). */
export async function uploadInlineImage(): Promise<string | null> {
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
      json: { kind: 'image', filename: file.name, mimeType: file.type, sizeBytes: file.size },
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
