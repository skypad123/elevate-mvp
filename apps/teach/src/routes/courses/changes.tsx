import { Button, EmptyState, PageHeader, Skeleton } from '@elevate/web-ui'

import { useErrorMessage, useT } from '@elevate/web-ui/preferences'
import { ArrowLeft } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router'
import { ChangeSetReview } from '../../components/change-set-review'
import { useChangeSet } from '../../lib/change-sets'
import { useCourseTree } from '../../lib/courses'
import { useCurrentProfile } from '../../lib/profile'

/**
 * `/p/:profileId/courses/:id/changes`: a writer's edits to a live course, waiting for the owner or
 * a manager. It reads the change set and both versions of the course, so each change can be shown
 * as it is live and as it would be.
 */
export function CourseChangesPage() {
  const { id = '' } = useParams()
  const { path } = useCurrentProfile()
  const navigate = useNavigate()
  const t = useT()
  const errorMessage = useErrorMessage()
  const builder = path(`/courses/${id}`)
  const changeSet = useChangeSet(id)
  const live = useCourseTree(id, 'live')
  const draft = useCourseTree(id, 'draft', !!changeSet.data)

  const back = (
    <Link
      to={builder}
      className="mb-4 inline-flex items-center gap-1 text-small text-ink-secondary hover:text-ink"
    >
      <ArrowLeft className="size-4" /> {t('changes.back')}
    </Link>
  )

  if (changeSet.isPending || live.isPending) return <Skeleton className="h-96 w-full" />
  if (changeSet.isError || live.isError)
    return (
      <>
        {back}
        <EmptyState
          tone="danger"
          title={t('changes.loadFailed')}
          body={errorMessage(changeSet.error ?? live.error)}
        />
      </>
    )
  return (
    <>
      {back}
      <PageHeader
        eyebrow={t('changes.eyebrow')}
        title={live.data.title}
        description={t('changes.description')}
      />
      {changeSet.data ? (
        <ChangeSetReview
          courseId={id}
          changeSet={changeSet.data}
          live={live.data}
          draft={draft.data}
          onDecided={() => navigate(builder)}
        />
      ) : (
        <EmptyState
          title={t('changes.none.title')}
          body={t('changes.none.body')}
          action={
            <Link to={builder}>
              <Button variant="secondary">{t('changes.none.open')}</Button>
            </Link>
          }
        />
      )}
    </>
  )
}
