import { formatSgd, type Locale, withdrawalClosesAt } from '@elevate/core'
import { intlLocale, translate } from '@elevate/i18n'
import type { MailMessage } from '../providers/mailer'
import { simpleEmail } from './templates'

/**
 * The learner emails of class sales (docs/designs/scheduled-classes-selling.md, "Emails"), in the
 * learner's account language (ADR 010). Every name, title and address in them was typed by a
 * person, so each goes in only through `simpleEmail`, which escapes it.
 */

type Block = { startsAt: Date; endsAt: Date }

/** The class as the emails describe it. */
export type ClassForEmail = {
  name: string
  delivery: 'in_person' | 'remote'
  venueAddress: string | null
  timeZone: string
  blocks: readonly Block[]
}

const ordered = (blocks: readonly Block[]) =>
  [...blocks].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())

/** The time zone's name in the reader's language, such as "Singapore Standard Time". */
function zoneName(locale: Locale, timeZone: string): string {
  const parts = new Intl.DateTimeFormat(intlLocale(locale), {
    timeZone,
    timeZoneName: 'long',
  }).formatToParts(new Date())
  return parts.find((part) => part.type === 'timeZoneName')?.value ?? timeZone
}

function formatDay(locale: Locale, timeZone: string, at: Date): string {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    timeZone,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(at)
}

function formatTime(locale: Locale, timeZone: string, at: Date): string {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(at)
}

/** One instant with its time zone, as the checkout page words it: "Tue, 1 Dec 2026, 9:00 am SGT". */
function formatInstant(locale: Locale, timeZone: string, at: Date): string {
  return translate(locale, 'email.class.instant', {
    day: formatDay(locale, timeZone, at),
    time: new Intl.DateTimeFormat(intlLocale(locale), {
      timeZone,
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short',
    }).format(at),
  })
}

/** One line per block, in the class's time zone. */
export function blockLines(locale: Locale, timeZone: string, blocks: readonly Block[]): string[] {
  return ordered(blocks).map((block) =>
    translate(locale, 'email.class.block', {
      date: formatDay(locale, timeZone, block.startsAt),
      start: formatTime(locale, timeZone, block.startsAt),
      end: formatTime(locale, timeZone, block.endsAt),
    }),
  )
}

/** The receipt for a payment that got a seat: what was bought, when and where, and the terms. */
export function classReceiptEmail(input: {
  to: string
  locale: Locale
  learnerUrl: string
  enrollmentId: string
  class: ClassForEmail
  courseTitle: string
  teacher: string
  amountCents: number
  receiptUrl: string | null
}): MailMessage {
  const lang = input.locale
  const c = input.class
  const first = ordered(c.blocks)[0]
  const place =
    c.delivery === 'in_person' && c.venueAddress?.trim()
      ? translate(lang, 'email.classReceipt.where', { address: c.venueAddress.trim() })
      : translate(lang, 'email.classReceipt.online')
  return simpleEmail({
    to: input.to,
    locale: lang,
    title: translate(lang, 'email.classReceipt.title', { className: c.name }),
    paragraphs: [
      translate(lang, 'email.classReceipt.paid', {
        amount: formatSgd(input.amountCents),
        className: c.name,
        course: input.courseTitle,
        teacher: input.teacher,
      }),
      translate(lang, 'email.classReceipt.when', { timeZone: zoneName(lang, c.timeZone) }),
      ...blockLines(lang, c.timeZone, c.blocks),
      place,
      ...(first
        ? [
            translate(lang, 'email.classReceipt.terms', {
              date: formatInstant(lang, c.timeZone, withdrawalClosesAt(first.startsAt)),
            }),
          ]
        : []),
      input.receiptUrl
        ? translate(lang, 'email.receipt.stripeReceipt', { url: input.receiptUrl })
        : translate(lang, 'email.receipt.noReceipt'),
    ],
    cta: {
      href: `${input.learnerUrl}/class/${input.enrollmentId}`,
      label: translate(lang, 'email.classReceipt.button'),
    },
  })
}

/**
 * A payment whose seat was gone when it arrived, sent once the whole payment has been returned.
 * The seat refund sender sends it (Phase 4 of the plan).
 */
export function seatLostEmail(input: {
  to: string
  locale: Locale
  learnerUrl: string
  className: string
  courseSlug: string
  amountCents: number
}): MailMessage {
  const lang = input.locale
  return simpleEmail({
    to: input.to,
    locale: lang,
    title: translate(lang, 'email.seatLost.title', { className: input.className }),
    paragraphs: [
      translate(lang, 'email.seatLost.lost', { className: input.className }),
      translate(lang, 'email.seatLost.refunded', { amount: formatSgd(input.amountCents) }),
    ],
    cta: {
      href: `${input.learnerUrl}/course/${input.courseSlug}`,
      label: translate(lang, 'email.seatLost.button'),
    },
  })
}

/** A block's time changed in a class where the learner has a seat. */
export function classTimesChangedEmail(input: {
  to: string
  locale: Locale
  learnerUrl: string
  enrollmentId: string
  className: string
  timeZone: string
  before: readonly Block[]
  after: readonly Block[]
  /** The learner may now withdraw with a full refund until the class starts. */
  canWithdraw: boolean
}): MailMessage {
  const lang = input.locale
  const zone = zoneName(lang, input.timeZone)
  return simpleEmail({
    to: input.to,
    locale: lang,
    title: translate(lang, 'email.classTimesChanged.title', { className: input.className }),
    paragraphs: [
      translate(lang, 'email.classTimesChanged.changed', { className: input.className }),
      translate(lang, 'email.classTimesChanged.before', { timeZone: zone }),
      ...blockLines(lang, input.timeZone, input.before),
      translate(lang, 'email.classTimesChanged.after', { timeZone: zone }),
      ...blockLines(lang, input.timeZone, input.after),
      ...(input.canWithdraw ? [translate(lang, 'email.classTimesChanged.withdraw')] : []),
    ],
    cta: {
      href: `${input.learnerUrl}/class/${input.enrollmentId}`,
      label: translate(lang, 'email.classTimesChanged.button'),
    },
  })
}

/** The class screen in the learner app, where a learner withdraws or disputes a mark. */
const classScreen = (learnerUrl: string, enrollmentId: string) =>
  `${learnerUrl}/class/${enrollmentId}`

/**
 * The learner was marked present by hand (docs/designs/scheduled-classes-selling.md, "Telling a
 * learner about a manual mark"): the class, the block, the last day to dispute, and the way to.
 */
export function manualMarkEmail(input: {
  to: string
  locale: Locale
  learnerUrl: string
  enrollmentId: string
  className: string
  timeZone: string
  block: Block
  disputeUntil: Date
}): MailMessage {
  const lang = input.locale
  const [line] = blockLines(lang, input.timeZone, [input.block])
  return simpleEmail({
    to: input.to,
    locale: lang,
    title: translate(lang, 'email.manualMark.title', { className: input.className }),
    paragraphs: [
      translate(lang, 'email.manualMark.marked', {
        className: input.className,
        block: `${line} (${zoneName(lang, input.timeZone)})`,
      }),
      translate(lang, 'email.manualMark.dispute', {
        date: formatDay(lang, input.timeZone, input.disputeUntil),
      }),
    ],
    cta: {
      href: classScreen(input.learnerUrl, input.enrollmentId),
      label: translate(lang, 'email.manualMark.button'),
    },
  })
}

/** A cancellation's refund has been made: the whole payment, or the share of untaught blocks. */
export function classCancelledEmail(input: {
  to: string
  locale: Locale
  learnerUrl: string
  enrollmentId: string
  className: string
  amountCents: number
  part: boolean
}): MailMessage {
  const lang = input.locale
  const amount = formatSgd(input.amountCents)
  return simpleEmail({
    to: input.to,
    locale: lang,
    title: translate(lang, 'email.classCancelled.title', { className: input.className }),
    paragraphs: [
      translate(lang, 'email.classCancelled.cancelled', { className: input.className }),
      translate(
        lang,
        input.part ? 'email.classCancelled.refundedPart' : 'email.classCancelled.refunded',
        { amount },
      ),
    ],
    cta: {
      href: classScreen(input.learnerUrl, input.enrollmentId),
      label: translate(lang, 'email.classCancelled.button'),
    },
  })
}

/** A cancellation that returns nothing: every block had started and the learner attended. */
export function classCancelledAttendedEmail(input: {
  to: string
  locale: Locale
  learnerUrl: string
  enrollmentId: string
  className: string
}): MailMessage {
  const lang = input.locale
  return simpleEmail({
    to: input.to,
    locale: lang,
    title: translate(lang, 'email.classCancelledAttended.title', { className: input.className }),
    paragraphs: [
      translate(lang, 'email.classCancelledAttended.body', { className: input.className }),
    ],
    cta: {
      href: classScreen(input.learnerUrl, input.enrollmentId),
      label: translate(lang, 'email.classCancelledAttended.button'),
    },
  })
}

/** A cancellation while the learner's manual mark can still be disputed. */
export function classCancelledMarkOpenEmail(input: {
  to: string
  locale: Locale
  learnerUrl: string
  enrollmentId: string
  className: string
  timeZone: string
  disputeUntil: Date
}): MailMessage {
  const lang = input.locale
  return simpleEmail({
    to: input.to,
    locale: lang,
    title: translate(lang, 'email.classCancelledMarkOpen.title', { className: input.className }),
    paragraphs: [
      translate(lang, 'email.classCancelledMarkOpen.body', {
        className: input.className,
        date: formatDay(lang, input.timeZone, input.disputeUntil),
      }),
      translate(lang, 'email.classCancelledMarkOpen.refund'),
    ],
    cta: {
      href: classScreen(input.learnerUrl, input.enrollmentId),
      label: translate(lang, 'email.classCancelledMarkOpen.button'),
    },
  })
}

/** A withdrawal's refund has been made: less Stripe's fee, or in full after a changed class. */
export function seatWithdrawnEmail(input: {
  to: string
  locale: Locale
  learnerUrl: string
  courseSlug: string
  className: string
  amountCents: number
  full: boolean
}): MailMessage {
  const lang = input.locale
  const amount = formatSgd(input.amountCents)
  return simpleEmail({
    to: input.to,
    locale: lang,
    title: translate(lang, 'email.seatWithdrawn.title', { className: input.className }),
    paragraphs: [
      translate(lang, 'email.seatWithdrawn.withdrawn', { className: input.className }),
      translate(
        lang,
        input.full ? 'email.seatWithdrawn.refundedFull' : 'email.seatWithdrawn.refundedLessFee',
        { amount },
      ),
    ],
    cta: {
      href: `${input.learnerUrl}/course/${input.courseSlug}`,
      label: translate(lang, 'email.seatWithdrawn.button'),
    },
  })
}

/** A discretionary refund has been made; the learner keeps the seat. */
export function seatRefundedEmail(input: {
  to: string
  locale: Locale
  learnerUrl: string
  enrollmentId: string
  className: string
  amountCents: number
  reason: string | null
}): MailMessage {
  const lang = input.locale
  return simpleEmail({
    to: input.to,
    locale: lang,
    title: translate(lang, 'email.seatRefunded.title', { className: input.className }),
    paragraphs: [
      translate(lang, 'email.seatRefunded.refunded', {
        className: input.className,
        amount: formatSgd(input.amountCents),
      }),
      ...(input.reason ? [translate(lang, 'email.refund.reason', { reason: input.reason })] : []),
      translate(lang, 'email.seatRefunded.kept'),
    ],
    cta: {
      href: classScreen(input.learnerUrl, input.enrollmentId),
      label: translate(lang, 'email.seatRefunded.button'),
    },
  })
}

/** The learner was moved to another class of the course, which gives the right to withdraw. */
export function seatMovedEmail(input: {
  to: string
  locale: Locale
  learnerUrl: string
  enrollmentId: string
  fromClass: string
  courseTitle: string
  class: ClassForEmail
}): MailMessage {
  const lang = input.locale
  const c = input.class
  const place =
    c.delivery === 'in_person' && c.venueAddress?.trim()
      ? translate(lang, 'email.classReceipt.where', { address: c.venueAddress.trim() })
      : translate(lang, 'email.classReceipt.online')
  return simpleEmail({
    to: input.to,
    locale: lang,
    title: translate(lang, 'email.seatMoved.title', { className: c.name }),
    paragraphs: [
      translate(lang, 'email.seatMoved.moved', {
        fromClass: input.fromClass,
        className: c.name,
        course: input.courseTitle,
      }),
      translate(lang, 'email.seatMoved.when', { timeZone: zoneName(lang, c.timeZone) }),
      ...blockLines(lang, c.timeZone, c.blocks),
      place,
      translate(lang, 'email.seatMoved.withdraw'),
    ],
    cta: {
      href: classScreen(input.learnerUrl, input.enrollmentId),
      label: translate(lang, 'email.seatMoved.button'),
    },
  })
}
