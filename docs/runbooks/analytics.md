# Analytics events and the four funnel metrics

Events are rows in `analytics_events` (`name`, `user_id`, `properties` jsonb, `created_at`),
written by the API through `trackEvent` and never on the hot path of a response that could fail
because of them. Names live in `packages/core/src/domain/analytics.ts`.

| Event                                                      | When                                                                 | Properties                                                           |
| ---------------------------------------------------------- | -------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `sign_in`                                                  | magic link or code verified                                          | `audience`                                                           |
| `course_viewed`                                            | public course page loaded                                            | `courseId`                                                           |
| `checkout_started`                                         | Stripe Checkout session created                                      | `courseId`, `amountCents`, `promoCode`                               |
| `checkout_completed`                                       | fulfilment (webhook or sync)                                         | `courseId`, `amountCents`                                            |
| `lesson_started`                                           | first activity on an artefact of a lesson (progress or quiz attempt) | `courseId`, `lessonId`                                               |
| `quiz_submitted`                                           | attempt graded                                                       | `courseId`, `quizId`, `score`, `passed`, `expired`                   |
| `course_completed`                                         | every lesson done and every quiz passed                              | `courseId`                                                           |
| `certificate_issued`                                       | PDF generated                                                        | `courseId`, `certificateId`                                          |
| `teacher_applied` / `teacher_approved`                     | onboarding                                                           | —                                                                    |
| `course_submitted` / `course_approved` / `course_rejected` | review                                                               | `courseId`                                                           |
| `first_payout`                                             | a teacher's first successful payment                                 | `courseId`, `amountCents`, `teacherNetCents`, `secondsSinceApproval` |
| `refund_issued`                                            | Support refund                                                       | `paymentId`, `amountCents`                                           |

`GET /api/support/analytics` (Support → Insights) computes the spec's four metrics live; the SQL
below is the same logic for a warehouse or a notebook.

```sql
-- course completion rate (active enrolments that reached completion)
select count(*) filter (where completed_at is not null)::float / nullif(count(*), 0) as completion_rate
from enrollments where status = 'active';

-- drop-off lesson index: learners who started each lesson position; the biggest step down is the drop-off
select l.position, count(distinct e.user_id) as learners_started
from analytics_events e
join lessons l on l.id::text = e.properties->>'lessonId'
where e.name = 'lesson_started'
group by l.position order by l.position;

-- checkout conversion
select
  count(*) filter (where name = 'checkout_completed')::float
  / nullif(count(*) filter (where name = 'checkout_started'), 0) as checkout_conversion
from analytics_events;

-- time to first payout (days from teacher approval to the first successful payment)
select percentile_cont(0.5) within group (order by (properties->>'secondsSinceApproval')::float / 86400) as median_days
from analytics_events where name = 'first_payout';
```
