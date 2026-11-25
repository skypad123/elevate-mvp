import type { ClassCheckoutView, ClassForSale, CoursePublicView, LearnerClass } from '@elevate/core'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { fireEvent, screen, waitFor } from '@testing-library/react-native'
import { renderRouter } from 'expo-router/testing-library'
import { Platform, Text } from 'react-native'
import ClassCheckout from '@/app/checkout/class/[classId]'
import CheckoutSuccess from '@/app/checkout/success'
import { ClassChoice } from '@/components/ClassChoice'
import { api } from '@/lib/api'
import { queryClient } from '@/lib/query-client'
import { tokenStorage } from '@/lib/token-storage'
import { jsonResponse } from '@/test-utils/api'
import { TestProviders } from '@/test-utils/providers'

const getMe = api.auth.me.$get as unknown as jest.Mock
const getClasses = api.me.classes.$get as unknown as jest.Mock
const getCheckout = api.checkout.classes[':classId'].$get as unknown as jest.Mock
const postCheckout = api.checkout.classes[':classId'].$post as unknown as jest.Mock
const getSync = api.checkout.sessions[':id'].sync.$get as unknown as jest.Mock

const CLASS_ID = '7a1f2c3e-0000-4000-8000-0000000000c1'
const ENROLLMENT_ID = '7a1f2c3e-0000-4000-8000-0000000000e1'

const forSale: ClassForSale = {
  id: CLASS_ID,
  name: 'Saturday mornings',
  delivery: 'in_person',
  venueAddress: '1 Fixture Road',
  timeZone: 'Asia/Singapore',
  blocks: [
    { startsAt: '2026-12-19T01:00:00.000Z', endsAt: '2026-12-19T04:00:00.000Z' },
    { startsAt: '2026-12-26T01:00:00.000Z', endsAt: '2026-12-26T04:00:00.000Z' },
  ],
  seatsLeft: 4,
  instructorName: 'Mei Lin',
}

const quote = {
  listPriceCents: 50_000,
  discountCents: 0,
  amountCents: 50_000,
  stripeFeeEstimateCents: 1_750,
  commissionCents: 7_238,
  teacherNetCents: 41_012,
  applicationFeeCents: 8_988,
  platformNetEstimateCents: 7_238,
  isFree: false,
  belowMinimum: false,
}

const view = (overrides: Partial<ClassForSale> = {}, version = '2026-12'): ClassCheckoutView => ({
  class: { ...forSale, ...overrides },
  courseSlug: 'wheel-throwing',
  courseTitle: 'Wheel throwing',
  quote: {
    quote,
    promo: null,
    course: {
      id: 'course-1',
      slug: 'wheel-throwing',
      title: 'Wheel throwing',
      priceCents: 50_000,
      thumbnailUrl: null,
      teacherName: 'Clay Studio',
    },
  },
  refundTermsVersion: version,
  stripeFeeBps: 340,
  stripeFixedCents: 50,
})

const user = {
  id: 'u1',
  email: 'learner@example.com',
  name: 'Ada Learner',
  avatarUrl: null,
  roles: [],
  profiles: [],
  locale: 'en',
  localeChosen: true,
  createdAt: '2026-01-01T00:00:00.000Z',
}

const refusal = (status: number, code: string, details?: Record<string, unknown>) =>
  jsonResponse({ error: { code, message: 'English from the API', details } }, status)

async function signIn() {
  await tokenStorage.set('token')
  getMe.mockResolvedValue(jsonResponse({ user }))
}

/** The JSON body of the n-th class checkout request. */
const sent = (n = 0): Record<string, unknown> => {
  const [request] = postCheckout.mock.calls[n] ?? []
  return (request as { json: Record<string, unknown> }).json
}

/** Every text on screen, in the order it renders. */
function textsInOrder(): string[] {
  const out: string[] = []
  const walk = (node: unknown) => {
    if (typeof node === 'string') out.push(node)
    else if (Array.isArray(node)) node.forEach(walk)
    else if (node && typeof node === 'object' && 'children' in node) {
      walk((node as { children: unknown }).children)
    }
  }
  walk(screen.toJSON())
  return out
}

// Jest runs as iOS; class checkout is a web page. Only the platform is switched back afterwards:
// restoreAllMocks would also wipe the AsyncStorage mock's implementation.
let os: { restore: () => void }

beforeEach(async () => {
  jest.clearAllMocks()
  queryClient.clear()
  await AsyncStorage.clear()
  await tokenStorage.clear()
  os = jest.replaceProperty(Platform, 'OS', 'web')
  getMe.mockResolvedValue(jsonResponse({ error: { code: 'unauthorized', message: '' } }, 401))
  getClasses.mockResolvedValue(jsonResponse({ items: [] }))
  getCheckout.mockResolvedValue(jsonResponse(view()))
})

afterEach(() => os.restore())

const renderCheckout = () =>
  renderRouter(
    {
      'checkout/class/[classId]': ClassCheckout,
      'class/[enrollmentId]': () => <Text>Class screen</Text>,
      'sign-in': () => <Text>Sign in</Text>,
      index: () => null,
    },
    { initialUrl: `/checkout/class/${CLASS_ID}`, wrapper: TestProviders },
  )

describe('class checkout', () => {
  it('shows the class and the refund terms before the pay button, and sends the terms version', async () => {
    await signIn()
    await renderCheckout()
    expect(await screen.findByText('Saturday mornings')).toBeTruthy()
    expect(screen.getByText('A class of Wheel throwing')).toBeTruthy()
    expect(screen.getByText('Taught by Mei Lin')).toBeTruthy()
    expect(screen.getByText('Venue: 1 Fixture Road')).toBeTruthy()
    expect(screen.getByText('4 seats left')).toBeTruthy()
    expect(screen.getByText('Version 2026-12')).toBeTruthy()
    expect(
      screen.getByText(/^For this class, you can withdraw for a refund until .*12 Dec/),
    ).toBeTruthy()
    // Term 3 with the fee, and the rates of term 13, as whole sentences
    expect(
      screen.getByText(/^If you withdraw in time, we refund the price you paid less/),
    ).toBeTruthy()
    expect(
      screen.getByText('For a card issued in Singapore, the fee is 3.4% of the price plus S$0.50.'),
    ).toBeTruthy()
    expect(screen.getByText('For PayNow, the fee is 1.3% of the price.')).toBeTruthy()

    const texts = textsInOrder()
    const terms = texts.indexOf('Refund terms')
    const pay = texts.indexOf('Pay S$500.00 with Stripe')
    expect(terms).toBeGreaterThan(-1)
    expect(pay).toBeGreaterThan(terms)
    expect(texts.indexOf('Saturday mornings')).toBeLessThan(terms)

    postCheckout.mockResolvedValue(jsonResponse({ kind: 'enrolled', enrollmentId: ENROLLMENT_ID }))
    await fireEvent.press(screen.getByTestId('class-checkout-pay'))
    await waitFor(() => expect(postCheckout).toHaveBeenCalledTimes(1))
    expect(postCheckout.mock.calls[0]?.[0]).toMatchObject({ param: { classId: CLASS_ID } })
    expect(sent()).toEqual({ locale: 'en', termsVersion: '2026-12' })
    expect(await screen.findByText('Class screen')).toBeTruthy()
  })

  it.each([
    ['class_full', refusal(409, 'class_full'), 'This class is full.'],
    [
      'already_in_class',
      refusal(409, 'already_in_class', { enrollmentId: ENROLLMENT_ID }),
      'You already have a seat in this class.',
    ],
    [
      'own_class',
      refusal(403, 'own_class'),
      'You cannot book a seat in a class you teach or manage.',
    ],
    [
      'class_not_on_sale',
      refusal(409, 'class_not_on_sale', { reason: 'started' }),
      'This class is not open for booking.',
    ],
    [
      'too_many_reservations',
      refusal(429, 'too_many_reservations', { retryAt: '2026-11-26T00:00:00.000Z' }),
      'You have started paying for this class too many times. Try again later.',
    ],
    [
      'class_requires_payment',
      refusal(422, 'class_requires_payment'),
      'This code cannot be used on a class.',
    ],
    ['below_minimum', refusal(422, 'below_minimum', { minimumCents: 100 }), /S\$1\.00/],
  ])('words %s when paying from its code', async (_, answer, message) => {
    await signIn()
    postCheckout.mockResolvedValue(answer)
    await renderCheckout()
    await fireEvent.press(await screen.findByTestId('class-checkout-pay'))
    expect(await screen.findByText(message)).toBeTruthy()
    expect(screen.queryByText('English from the API')).toBeNull()
  })

  it('reloads the terms on terms_changed and sends the new version next time', async () => {
    await signIn()
    getCheckout
      .mockResolvedValueOnce(jsonResponse(view()))
      .mockResolvedValue(jsonResponse(view({}, '2027-01')))
    postCheckout
      .mockResolvedValueOnce(refusal(409, 'terms_changed', { current: '2027-01' }))
      .mockResolvedValue(jsonResponse({ kind: 'enrolled', enrollmentId: ENROLLMENT_ID }))
    await renderCheckout()
    await fireEvent.press(await screen.findByTestId('class-checkout-pay'))
    expect(
      await screen.findByText(
        'The refund terms have changed. Read them again below, then press Pay.',
      ),
    ).toBeTruthy()
    expect(getCheckout).toHaveBeenCalledTimes(2)
    expect(screen.getByText('Version 2027-01')).toBeTruthy()
    expect(screen.queryByText('English from the API')).toBeNull()
    expect(sent(0)).toMatchObject({ termsVersion: '2026-12' })
    await fireEvent.press(screen.getByTestId('class-checkout-pay'))
    await waitFor(() => expect(postCheckout).toHaveBeenCalledTimes(2))
    expect(sent(1)).toMatchObject({ termsVersion: '2027-01' })
  })

  it('words an error loading the page from its code', async () => {
    await signIn()
    getCheckout.mockResolvedValue(refusal(409, 'class_not_on_sale', { reason: 'cancelled' }))
    await renderCheckout()
    expect(await screen.findByText('This class is not open for booking.')).toBeTruthy()
    expect(screen.queryByTestId('class-checkout-pay')).toBeNull()
  })

  it('words a refused promo code under the field and keeps the page', async () => {
    await signIn()
    await renderCheckout()
    await fireEvent.changeText(await screen.findByTestId('class-checkout-promo'), 'FREE100')
    getCheckout.mockResolvedValue(refusal(422, 'class_requires_payment'))
    await fireEvent.press(screen.getByTestId('class-checkout-apply'))
    expect(await screen.findByText('This code cannot be used on a class.')).toBeTruthy()
    expect(getCheckout.mock.calls[1]?.[0]).toMatchObject({ query: { promoCode: 'FREE100' } })
    expect(screen.getByTestId('class-checkout-pay')).toBeTruthy()
  })

  it('has no pay button for a full class', async () => {
    await signIn()
    getCheckout.mockResolvedValue(jsonResponse(view({ seatsLeft: 0 })))
    await renderCheckout()
    expect(await screen.findByTestId('class-checkout-full')).toBeTruthy()
    expect(screen.queryByTestId('class-checkout-pay')).toBeNull()
  })

  it('sends a signed-out visitor to sign in and back', async () => {
    await renderCheckout()
    expect(await screen.findByText('Sign in')).toBeTruthy()
    expect(getCheckout).not.toHaveBeenCalled()
  })
})

const course: CoursePublicView = {
  id: 'course-1',
  slug: 'wheel-throwing',
  title: 'Wheel throwing',
  summary: null,
  descriptionJson: null,
  category: 'arts',
  priceCents: 50_000,
  currency: 'SGD',
  thumbnailUrl: null,
  publishedAt: '2026-10-01T00:00:00.000Z',
  enrolCount: 0,
  lessonCount: 0,
  artefactCount: 0,
  durationSeconds: 0,
  teacher: { id: 't1', displayName: 'Clay Studio', headline: null, bio: null, avatarUrl: null },
  lessons: [],
  viewer: null,
  classes: [],
  viewerClassSeats: [],
}

const renderChoice = (value: CoursePublicView, chosen?: string) =>
  renderRouter(
    {
      index: () => <ClassChoice course={value} chosenClassId={chosen} cancelled={false} />,
      'checkout/class/[classId]': () => <Text>Class checkout</Text>,
      'class/[enrollmentId]': () => <Text>Class screen</Text>,
    },
    { initialUrl: '/', wrapper: TestProviders },
  )

describe('the class choice on the course page', () => {
  it('lists a class with its seats and books it on the web', async () => {
    await renderChoice({ ...course, classes: [forSale] })
    expect(await screen.findByText('Take it as a class')).toBeTruthy()
    expect(screen.getByText('4 seats left')).toBeTruthy()
    await fireEvent.press(screen.getByTestId(`class-book-${CLASS_ID}`))
    expect(await screen.findByText('Class checkout')).toBeTruthy()
  })

  it('shows a full class as full, with no button', async () => {
    await renderChoice({ ...course, classes: [{ ...forSale, seatsLeft: 0 }] })
    expect(await screen.findByText('This class is full.')).toBeTruthy()
    expect(screen.queryByTestId(`class-book-${CLASS_ID}`)).toBeNull()
  })

  it('links a class the learner has a seat in to the class screen', async () => {
    await renderChoice({
      ...course,
      classes: [forSale],
      viewerClassSeats: [{ classId: CLASS_ID, enrollmentId: ENROLLMENT_ID, status: 'active' }],
    })
    expect(await screen.findByText('You have a seat')).toBeTruthy()
    expect(screen.queryByTestId(`class-book-${CLASS_ID}`)).toBeNull()
    await fireEvent.press(screen.getByTestId(`class-view-${ENROLLMENT_ID}`))
    expect(await screen.findByText('Class screen')).toBeTruthy()
  })

  it('is not shown for a course with no class on sale', async () => {
    await renderChoice(course)
    expect(screen.queryByTestId('class-choice')).toBeNull()
  })
})

const learnerClass: LearnerClass = {
  enrollmentId: ENROLLMENT_ID,
  class: {
    id: CLASS_ID,
    name: 'Saturday mornings',
    courseTitle: 'Wheel throwing',
    delivery: 'in_person',
    venueAddress: '1 Fixture Road',
    timeZone: 'Asia/Singapore',
  },
  blocks: [
    {
      id: 'b1',
      startsAt: '2026-12-19T01:00:00.000Z',
      endsAt: '2026-12-19T04:00:00.000Z',
      checkInOpen: false,
      state: 'not_arrived',
      flagReason: null,
      manualMark: null,
      overturn: null,
    },
  ],
  seat: {
    withdrawKind: 'learner_withdrew',
    withdrawRefundCents: null,
    withdrawClosesAt: '2026-12-12T01:00:00.000Z',
    movedAt: null,
    classChangedAt: null,
    classCancelled: false,
    refund: null,
    openMarks: [],
  },
}

const renderSuccess = () =>
  renderRouter(
    {
      'checkout/success': CheckoutSuccess,
      'course/[slug]': () => <Text>Course page</Text>,
      'class/[enrollmentId]': () => <Text>Class screen</Text>,
      index: () => null,
    },
    { initialUrl: '/checkout/success?session_id=cs_test_1', wrapper: TestProviders },
  )

describe('the confirmation page for a seat', () => {
  it('says the seat was lost and the payment is being returned in full', async () => {
    await signIn()
    getSync.mockResolvedValue(
      jsonResponse({ status: 'seat_lost', classId: CLASS_ID, courseSlug: 'wheel-throwing' }),
    )
    await renderSuccess()
    expect(await screen.findByText('The seat was taken while you paid')).toBeTruthy()
    expect(screen.getByText(/We are returning the price you paid in full/)).toBeTruthy()
    expect(screen.queryByText('Start learning')).toBeNull()
    await fireEvent.press(screen.getByText('Back to the course'))
    expect(await screen.findByText('Course page')).toBeTruthy()
  })

  it('shows a booked seat with its sessions and place, and links to the class screen', async () => {
    await signIn()
    getSync.mockResolvedValue(
      jsonResponse({
        status: 'paid',
        enrollmentId: ENROLLMENT_ID,
        courseSlug: 'wheel-throwing',
        classId: CLASS_ID,
      }),
    )
    getClasses.mockResolvedValue(jsonResponse({ items: [learnerClass] }))
    await renderSuccess()
    expect(await screen.findByText('Your seat is booked')).toBeTruthy()
    expect(await screen.findByText('Venue: 1 Fixture Road')).toBeTruthy()
    expect(screen.getByText(/19 Dec/)).toBeTruthy()
    expect(screen.queryByText('Start learning')).toBeNull()
    await fireEvent.press(screen.getByTestId('class-booked-view'))
    expect(await screen.findByText('Class screen')).toBeTruthy()
  })
})
