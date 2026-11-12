import { COURSE_CATEGORIES } from '@elevate/core'
import {
  Badge,
  Button,
  EmptyState,
  formatDate,
  PageHeader,
  Skeleton,
  statusLabel,
  statusTone,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@elevate/web-ui'
import { errorMessage } from '@elevate/web-ui/portal'
import { ArrowLeft, GitPullRequestArrow } from 'lucide-react'
import { Link, useParams, useSearchParams } from 'react-router'
import { CurriculumEditor } from '../../components/curriculum-editor'
import { DetailsForm } from '../../components/details-form'
import { PrerequisitesEditor } from '../../components/prerequisites-editor'
import { ReviewPanel } from '../../components/review-panel'
import { useCourse } from '../../lib/courses'
import { useCurrentProfile } from '../../lib/profile'
import { SaveIndicator, SaveTrackerProvider } from '../../lib/save-tracker'

type Tab = 'curriculum' | 'map' | 'details' | 'review'
const TABS: Tab[] = ['curriculum', 'map', 'details', 'review']

export function CourseBuilder() {
  const { id = '' } = useParams()
  const { path, can } = useCurrentProfile()
  const course = useCourse(id)
  const [params, setParams] = useSearchParams()
  const tab = (TABS.find((t) => t === params.get('tab')) ?? 'curriculum') as Tab
  const setTab = (next: string) => setParams({ tab: next }, { replace: true })

  if (course.isPending) return <Skeleton className="h-96 w-full" />
  if (course.isError)
    return (
      <EmptyState tone="danger" title="Could not load course" body={errorMessage(course.error)} />
    )
  const c = course.data
  const locked = c.status === 'pending_review'
  const live = c.status === 'live'
  // On a live course, content edits by someone who cannot edit it directly wait in a change set,
  // and the course's own details are not theirs to change at all.
  const editsLive = can('course.editLive')
  const proposes = live && !editsLive && can('course.proposeLiveEdit')
  const changesPath = path(`/courses/${c.id}/changes`)

  return (
    <SaveTrackerProvider>
      <Link
        to={path('/courses')}
        className="mb-4 inline-flex items-center gap-1 text-small text-ink-secondary hover:text-ink"
      >
        <ArrowLeft className="size-4" /> Courses
      </Link>
      <PageHeader
        eyebrow={COURSE_CATEGORIES.find((k) => k.slug === c.category)?.label ?? c.category}
        title={c.title}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone={statusTone[c.status]}>{statusLabel(c.status)}</Badge>
            <span className="text-ink-tertiary">
              {c.enrolCount} enrolled · updated {formatDate(c.updatedAt)}
            </span>
            <SaveIndicator />
          </span>
        }
      />
      {locked ? (
        <div className="mb-6 rounded-card border border-warning bg-warning-tint px-4 py-3 text-small text-ink">
          <strong className="font-semibold">Under review.</strong> Editing is locked until the
          Elevate team responds. You will get an email either way.
        </div>
      ) : null}
      {c.status === 'rejected' && c.rejectionReason ? (
        <div className="mb-6 rounded-card border border-danger bg-danger-tint px-4 py-3 text-small text-ink">
          <strong className="font-semibold">Changes requested:</strong> {c.rejectionReason}
        </div>
      ) : null}
      {live && editsLive ? (
        <div className="mb-6 rounded-card border border-success bg-success-tint px-4 py-3 text-small text-ink">
          <strong className="font-semibold">Live.</strong> Edits publish immediately to enrolled
          learners.
        </div>
      ) : null}
      {proposes ? (
        <div
          role="status"
          className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-card border border-warning bg-warning-tint px-4 py-3 text-small text-ink"
        >
          {c.viewing === 'draft' ? (
            <span>
              <strong className="font-semibold">Changes waiting for approval.</strong> You are
              editing a copy of this live course. Learners see the course as it was until the owner
              or a manager approves your changes.
            </span>
          ) : (
            <span>
              <strong className="font-semibold">This course is live.</strong> Your edits to lessons
              and content are saved as changes for the owner or a manager to approve. Learners do
              not see them until then.
            </span>
          )}
          {c.viewing === 'draft' ? (
            <Link to={changesPath}>
              <Button variant="secondary" size="sm" icon={GitPullRequestArrow}>
                See what is waiting
              </Button>
            </Link>
          ) : null}
        </div>
      ) : null}
      {live && editsLive && c.changeSet ? (
        <div
          role="status"
          className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-card border border-warning bg-warning-tint px-4 py-3 text-small text-ink"
        >
          <span>
            <strong className="font-semibold">
              {c.changeSet.openedBy ?? 'A writer'} has changes waiting for approval.
            </strong>{' '}
            Learners do not see them yet. What you edit here changes the live course, and can clash
            with those changes.
          </span>
          {can('changeSet.review') ? (
            <Link to={changesPath}>
              <Button variant="secondary" size="sm" icon={GitPullRequestArrow}>
                Review changes
              </Button>
            </Link>
          ) : null}
        </div>
      ) : null}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="curriculum">Curriculum</TabsTrigger>
          <TabsTrigger value="map">Map</TabsTrigger>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger
            value="review"
            className={
              !c.checklist.ok && c.status !== 'pending_review'
                ? 'after:ml-1.5 after:inline-block after:size-1.5 after:rounded-full after:bg-accent'
                : ''
            }
          >
            Review &amp; submit
          </TabsTrigger>
        </TabsList>
        <TabsContent value="curriculum">
          <CurriculumEditor course={c} locked={locked} />
        </TabsContent>
        <TabsContent value="map">
          <PrerequisitesEditor course={c} locked={locked} />
        </TabsContent>
        <TabsContent value="details">
          {proposes ? (
            <p className="mb-4 text-small text-ink-secondary">
              The title, description, cover image and price of a live course are for the owner or a
              manager to change.
            </p>
          ) : null}
          <DetailsForm key={c.updatedAt} course={c} locked={locked || proposes} />
        </TabsContent>
        <TabsContent value="review">
          <ReviewPanel course={c} onGoTo={setTab} />
        </TabsContent>
      </Tabs>
    </SaveTrackerProvider>
  )
}
