import { COURSE_CATEGORIES, type CreateCourse, formatSgd } from '@elevate/core'
import {
  Badge,
  Button,
  Card,
  Dialog,
  EmptyState,
  Input,
  NativeSelect,
  PageHeader,
  Skeleton,
  statusLabel,
  statusTone,
  useToast,
} from '@elevate/web-ui'
import { errorMessage, fieldErrors } from '@elevate/web-ui/portal'
import { useQueryClient } from '@tanstack/react-query'
import { BookOpen, Plus } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { courseKeys, createCourse, useCourses } from '../../lib/courses'
import { useCurrentProfile } from '../../lib/profile'

export function CoursesPage() {
  const courses = useCourses()
  const { path, can } = useCurrentProfile()
  const [open, setOpen] = useState(false)
  // Staff fix existing content; starting a course is the teacher's to do.
  const canCreate = can('course.create')
  return (
    <>
      <PageHeader
        eyebrow="Courses"
        title="Your courses"
        description="Drafts stay private. Submit a course for review when it is ready; approval is the only path to live."
        actions={
          canCreate ? (
            <Button icon={Plus} onClick={() => setOpen(true)}>
              New course
            </Button>
          ) : undefined
        }
      />
      {courses.isPending ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {['a', 'b', 'c'].map((k) => (
            <Skeleton key={k} className="h-56 rounded-card" />
          ))}
        </div>
      ) : courses.isError ? (
        <EmptyState
          tone="danger"
          title="Could not load courses"
          body={errorMessage(courses.error)}
        />
      ) : courses.data.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No courses yet"
          body="Start with a title and a category. You can change both later."
          action={
            canCreate ? (
              <Button icon={Plus} onClick={() => setOpen(true)}>
                Create your first course
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {courses.data.map((c) => (
            <Link
              key={c.id}
              to={path(`/courses/${c.id}`)}
              className="group focus-visible:outline-none"
            >
              <Card
                padded={false}
                className="h-full overflow-hidden transition-colors group-hover:border-brand group-focus-visible:border-brand"
              >
                <div className="aspect-[4/3] bg-surface-sunken">
                  {c.thumbnailUrl ? (
                    <img src={c.thumbnailUrl} alt="" className="size-full object-cover" />
                  ) : (
                    <div className="flex size-full items-center justify-center text-ink-tertiary">
                      <BookOpen className="size-8" />
                    </div>
                  )}
                </div>
                <div className="space-y-2 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-display text-h3 font-semibold leading-tight text-ink">
                      {c.title}
                    </h3>
                    <Badge tone={statusTone[c.status]}>{statusLabel(c.status)}</Badge>
                  </div>
                  <p className="text-small text-ink-secondary">
                    {COURSE_CATEGORIES.find((k) => k.slug === c.category)?.label ?? c.category} ·{' '}
                    {c.lessonCount} lesson{c.lessonCount === 1 ? '' : 's'} ·{' '}
                    {formatSgd(c.priceCents, { showFree: true })}
                  </p>
                  <p className="text-caption text-ink-tertiary">{c.enrolCount} enrolled</p>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
      <NewCourseDialog open={open} onOpenChange={setOpen} />
    </>
  )
}

function NewCourseDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { profileId, path } = useCurrentProfile()
  const { toast } = useToast()
  const [form, setForm] = useState<CreateCourse>({ title: '', category: 'craft-making' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setErrors({})
    try {
      const course = await createCourse(profileId, form)
      await queryClient.invalidateQueries({ queryKey: courseKeys.list(profileId) })
      onOpenChange(false)
      navigate(path(`/courses/${course.id}`))
    } catch (error) {
      setErrors(fieldErrors(error))
      toast({ tone: 'danger', title: 'Could not create course', description: errorMessage(error) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="New course"
      description="A working title is fine. Everything can be edited in the builder."
    >
      <form onSubmit={submit} className="space-y-4">
        <Input
          label="Title"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          error={errors.title}
          autoFocus
          required
          minLength={3}
        />
        <NativeSelect
          label="Category"
          value={form.category}
          onChange={(e) =>
            setForm({ ...form, category: e.target.value as CreateCourse['category'] })
          }
          error={errors.category}
        >
          {COURSE_CATEGORIES.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.label}
            </option>
          ))}
        </NativeSelect>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" loading={busy}>
            Create and open builder
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
