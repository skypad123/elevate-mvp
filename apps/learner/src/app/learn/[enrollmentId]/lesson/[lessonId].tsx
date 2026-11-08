import type { ArtefactContentView, CourseProgressView } from '@elevate/core'
import { useQueryClient } from '@tanstack/react-query'
import { Link, useLocalSearchParams, useRouter } from 'expo-router'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  FileAudio,
  FileText,
  Film,
  HelpCircle,
  Lock,
  type LucideIcon,
} from 'lucide-react-native'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Pressable, ScrollView, View } from 'react-native'
import { AudioArtefact } from '@/components/media/AudioArtefact'
import { VideoArtefact } from '@/components/media/VideoArtefact'
import { QuizRunner } from '@/components/QuizRunner'
import { RichText } from '@/components/RichText'
import { ApiError, errorMessage } from '@/lib/api-error'
import { formatMinutes } from '@/lib/format'
import { learningKeys, saveProgress, useEnrollment, useLesson } from '@/lib/learning'
import { useBreakpoint } from '@/lib/responsive'
import { useTheme } from '@/theme/ThemeProvider'
import { Badge, Button, Card, EmptyState, ProgressBar, Screen, Skeleton, Text } from '@/ui'

const ICON: Record<ArtefactContentView['type'], LucideIcon> = {
  video: Film,
  audio: FileAudio,
  text: FileText,
  quiz: HelpCircle,
}

export default function LessonPlayer() {
  const {
    enrollmentId = '',
    lessonId = '',
    artefact: artefactParam,
  } = useLocalSearchParams<{ enrollmentId: string; lessonId: string; artefact?: string }>()
  const theme = useTheme()
  const router = useRouter()
  const queryClient = useQueryClient()
  const { isLg } = useBreakpoint()
  const lesson = useLesson(enrollmentId, lessonId)
  const enrollment = useEnrollment(enrollmentId)
  const [activeId, setActiveId] = useState<string | null>(null)
  const lastSaved = useRef<Record<string, number>>({})

  const artefacts = lesson.data?.artefacts ?? []
  useEffect(() => {
    if (!lesson.data || activeId) return
    const fromParam =
      typeof artefactParam === 'string' ? artefacts.find((a) => a.id === artefactParam) : undefined
    const next =
      fromParam ?? artefacts.find((a) => a.progress.status !== 'completed') ?? artefacts[0]
    if (next) setActiveId(next.id)
  }, [lesson.data, activeId, artefactParam, artefacts])

  const active = artefacts.find((a) => a.id === activeId) ?? null
  const activeIndex = active ? artefacts.indexOf(active) : -1

  const applyProgress = useCallback(
    (
      artefactId: string,
      patch: Partial<ArtefactContentView['progress']>,
      progress?: CourseProgressView,
    ) => {
      queryClient.setQueryData(
        learningKeys.lesson(enrollmentId, lessonId),
        (old: typeof lesson.data) =>
          old
            ? {
                ...old,
                artefacts: old.artefacts.map((a) =>
                  a.id === artefactId ? { ...a, progress: { ...a.progress, ...patch } } : a,
                ),
              }
            : old,
      )
      if (progress) {
        queryClient.setQueryData(
          learningKeys.enrollment(enrollmentId),
          (old: typeof enrollment.data) => (old ? { ...old, progress } : old),
        )
        void queryClient.invalidateQueries({ queryKey: learningKeys.enrollment(enrollmentId) })
      }
    },
    [enrollmentId, lessonId, queryClient],
  )

  const persist = useCallback(
    async (
      artefactId: string,
      input: { status?: 'in_progress' | 'completed'; positionSeconds?: number },
    ) => {
      applyProgress(artefactId, {
        ...(input.status ? { status: input.status } : {}),
        ...(input.positionSeconds !== undefined ? { positionSeconds: input.positionSeconds } : {}),
      })
      try {
        const result = await saveProgress(enrollmentId, artefactId, input)
        applyProgress(artefactId, result.artefact, result.progress)
      } catch {
        // keep optimistic state; the next update retries
      }
    },
    [applyProgress, enrollmentId],
  )

  const onMediaProgress = useCallback(
    (artefactId: string, seconds: number) => {
      const last = lastSaved.current[artefactId] ?? -10
      if (seconds - last >= 10) {
        lastSaved.current[artefactId] = seconds
        void persist(artefactId, { positionSeconds: seconds, status: 'in_progress' })
      }
    },
    [persist],
  )

  const lessonTitleById = useMemo(
    () => new Map((enrollment.data?.lessons ?? []).map((l) => [l.id, l.title])),
    [enrollment.data],
  )

  if (lesson.isPending) {
    return (
      <Screen>
        <View style={{ gap: theme.space[4] }}>
          <Skeleton width="30%" height={14} />
          <Skeleton width="70%" height={32} />
          <Skeleton height={320} radius={theme.radii.card} />
        </View>
      </Screen>
    )
  }
  if (lesson.isError) {
    const locked = lesson.error instanceof ApiError && lesson.error.code === 'lesson_locked'
    return (
      <Screen maxWidth={640}>
        <EmptyState
          icon={Lock}
          tone={locked ? 'neutral' : 'danger'}
          eyebrow={locked ? 'Locked' : undefined}
          title={locked ? 'Finish the earlier lessons first' : 'Could not load this lesson'}
          body={errorMessage(lesson.error)}
          action={{
            label: 'Back to course',
            onPress: () => router.replace(`/learn/${enrollmentId}`),
          }}
        />
      </Screen>
    )
  }
  const l = lesson.data
  const allDone = artefacts.every((a) => a.progress.status === 'completed')
  const lessonPercent = artefacts.length
    ? Math.round(
        (artefacts.filter((a) => a.progress.status === 'completed').length / artefacts.length) *
          100,
      )
    : 0

  const strip = (
    <View style={{ gap: theme.space[2] }}>
      {artefacts.map((a, i) => {
        const Icon = ICON[a.type]
        const isActive = a.id === activeId
        const done = a.progress.status === 'completed'
        return (
          <Pressable
            key={a.id}
            onPress={() => setActiveId(a.id)}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive }}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: theme.space[3],
              padding: theme.space[3],
              borderRadius: theme.radii.control,
              borderWidth: 1,
              borderColor: isActive ? theme.colors.brand : theme.colors.border,
              backgroundColor: isActive ? theme.colors.brandTint : theme.colors.surface,
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <View
              style={{
                width: 28,
                height: 28,
                borderRadius: 14,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: done ? theme.colors.brand : theme.colors.surfaceMuted,
              }}
            >
              {done ? (
                <Check size={16} color={theme.colors.brandInk} strokeWidth={3} />
              ) : (
                <Icon size={15} color={theme.colors.inkSecondary} />
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="smallStrong" numberOfLines={1} tone={isActive ? 'brand' : 'ink'}>
                {i + 1}. {a.title}
              </Text>
              <Text variant="caption" tone="tertiary">
                {a.type}
                {a.durationSeconds ? ` · ${formatMinutes(a.durationSeconds)}` : ''}
                {a.progress.status === 'in_progress' ? ' · in progress' : ''}
              </Text>
            </View>
          </Pressable>
        )
      })}
    </View>
  )

  const content = active ? (
    <View style={{ gap: theme.space[4] }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space[2] }}>
        <Badge label={active.type} tone="neutral" />
        {active.progress.status === 'completed' ? <Badge label="Completed" tone="success" /> : null}
        {active.durationSeconds ? <Badge label={formatMinutes(active.durationSeconds)} /> : null}
      </View>
      <Text variant="h2">{active.title}</Text>
      {active.type === 'video' ? (
        active.playback && active.playback.kind === 'video' ? (
          <VideoArtefact
            key={active.id}
            playback={active.playback}
            startAt={active.progress.positionSeconds}
            onProgress={(s) => onMediaProgress(active.id, s)}
            onEnded={() => void persist(active.id, { status: 'completed' })}
          />
        ) : (
          <Card muted>
            <Text tone="secondary">
              {active.mediaStatus === 'processing' || active.mediaStatus === 'pending'
                ? 'This video is still processing. Check back shortly.'
                : 'This video is unavailable.'}
            </Text>
          </Card>
        )
      ) : null}
      {active.type === 'audio' ? (
        active.playback && active.playback.kind === 'audio' ? (
          <AudioArtefact
            key={active.id}
            url={active.playback.url}
            title={active.title}
            startAt={active.progress.positionSeconds}
            onProgress={(s) => onMediaProgress(active.id, s)}
            onEnded={() => void persist(active.id, { status: 'completed' })}
          />
        ) : (
          <Card muted>
            <Text tone="secondary">This audio is unavailable.</Text>
          </Card>
        )
      ) : null}
      {active.type === 'text' ? (
        <Card style={{ gap: theme.space[4] }}>
          <RichText doc={active.content} />
          {active.progress.status !== 'completed' ? (
            <Button
              label="Mark as read"
              variant="primary"
              icon={Check}
              onPress={() => void persist(active.id, { status: 'completed' })}
            />
          ) : null}
        </Card>
      ) : null}
      {active.type === 'quiz' ? (
        <QuizRunner
          key={active.id}
          enrollmentId={enrollmentId}
          artefact={active}
          onUpdated={(result) => {
            applyProgress(
              active.id,
              result.passed ? { status: 'completed' } : { status: 'in_progress' },
              result.progress,
            )
            void queryClient.invalidateQueries({
              queryKey: learningKeys.lesson(enrollmentId, lessonId),
            })
          }}
        />
      ) : null}
      {(active.type === 'video' || active.type === 'audio') &&
      active.progress.status !== 'completed' ? (
        <Button
          label="Mark as watched"
          variant="ghost"
          size="sm"
          onPress={() => void persist(active.id, { status: 'completed' })}
        />
      ) : null}
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: theme.space[3],
          flexWrap: 'wrap',
        }}
      >
        <Button
          label="Previous"
          variant="secondary"
          icon={ArrowLeft}
          disabled={activeIndex <= 0}
          onPress={() => setActiveId(artefacts[activeIndex - 1]?.id ?? null)}
        />
        {activeIndex < artefacts.length - 1 ? (
          <Button
            label="Next"
            variant="primary"
            iconRight={ArrowRight}
            onPress={() => setActiveId(artefacts[activeIndex + 1]?.id ?? null)}
          />
        ) : l.next ? (
          l.next.status === 'locked' && !allDone ? (
            <Text variant="small" tone="tertiary">
              Complete this lesson to unlock “{l.next.title}”
            </Text>
          ) : (
            <Button
              label={`Next lesson: ${l.next.title}`}
              variant="accent"
              iconRight={ArrowRight}
              onPress={() =>
                router.push({
                  pathname: '/learn/[enrollmentId]/lesson/[lessonId]',
                  params: { enrollmentId, lessonId: l.next?.lessonId ?? '' },
                })
              }
            />
          )
        ) : (
          <Button
            label="Back to course"
            variant="accent"
            iconRight={ArrowRight}
            onPress={() => router.replace(`/learn/${enrollmentId}`)}
          />
        )}
      </View>
    </View>
  ) : (
    <EmptyState title="This lesson has no content yet" body="Check back soon." />
  )

  return (
    <Screen maxWidth={1200}>
      <View style={{ gap: theme.space[5] }}>
        <Link href={`/learn/${enrollmentId}`} asChild>
          <Pressable
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' }}
          >
            <ArrowLeft size={16} color={theme.colors.inkSecondary} />
            <Text variant="small" tone="secondary" numberOfLines={1}>
              {l.course.title}
            </Text>
          </Pressable>
        </Link>
        <View style={{ gap: theme.space[2] }}>
          <Text variant="eyebrow" tone="tertiary">
            Lesson {l.lesson.position + 1}
            {l.previous
              ? ` · after ${lessonTitleById.get(l.previous.lessonId) ?? l.previous.title}`
              : ''}
          </Text>
          <Text variant="h1">{l.lesson.title}</Text>
          {l.lesson.summary ? <Text tone="secondary">{l.lesson.summary}</Text> : null}
          <ProgressBar percent={lessonPercent} />
        </View>
        {isLg ? (
          <View style={{ flexDirection: 'row', gap: theme.space[6], alignItems: 'flex-start' }}>
            <View style={{ flex: 1, minWidth: 0 }}>{content}</View>
            <View style={{ width: 320 }}>
              <Card style={{ gap: theme.space[3] }}>
                <Text variant="eyebrow" tone="tertiary">
                  In this lesson
                </Text>
                {strip}
              </Card>
            </View>
          </View>
        ) : (
          <View style={{ gap: theme.space[5] }}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: theme.space[2] }}
            >
              {artefacts.map((a, i) => {
                const isActive = a.id === activeId
                const done = a.progress.status === 'completed'
                return (
                  <Pressable
                    key={a.id}
                    onPress={() => setActiveId(a.id)}
                    style={{
                      paddingHorizontal: theme.space[3],
                      height: 36,
                      borderRadius: theme.radii.pill,
                      borderWidth: 1,
                      borderColor: isActive ? theme.colors.brand : theme.colors.border,
                      backgroundColor: isActive ? theme.colors.brandTint : theme.colors.surface,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    {done ? <Check size={14} color={theme.colors.brand} strokeWidth={3} /> : null}
                    <Text variant="smallStrong" tone={isActive ? 'brand' : 'secondary'}>
                      {i + 1}. {a.title}
                    </Text>
                  </Pressable>
                )
              })}
            </ScrollView>
            {content}
          </View>
        )}
      </View>
    </Screen>
  )
}
