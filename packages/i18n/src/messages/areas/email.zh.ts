import type { emailEn } from './email.en'

/**
 * Not written yet. The Chinese text of these emails is written and checked by a person (design
 * item 50), and until it is, `test/catalog.test.ts` fails on "are fully translated" with these
 * keys, and the emails go out in English.
 *
 * To fill it in: uncomment each key, write its Chinese (keep every {placeholder}), and change the
 * `satisfies` below to `Record<keyof typeof emailEn, string>`, as the other areas have.
 */
export const emailZh = {
  // 'email.footer.ignore': '',
  //   en: If you did not request this email you can ignore it.
  // 'email.signIn.subject': '',
  //   en: Your {portal} sign-in code: {code}
  // 'email.signIn.title': '',
  //   en: Sign in to {portal}
  // 'email.signIn.body': '',
  //   en: Use the button below to sign in. The link works once and expires in {minutes} minutes.
  // 'email.signIn.button': '',
  //   en: Sign in
  // 'email.signIn.codeIntro': '',
  //   en: On your phone? Enter this code in the app instead:
  // 'email.signIn.text.open': '',
  //   en: Open this link (valid for {minutes} minutes, single use):
  // 'email.signIn.text.code': '',
  //   en: Or enter this code in the app: {code}
  // 'email.receipt.title': '',
  //   en: You're enrolled: {course}
  // 'email.receipt.paid': '',
  //   en: Thanks for your purchase. You paid {amount} for "{course}" by {teacher}.
  // 'email.receipt.stripeReceipt': '',
  //   en: Your Stripe receipt: {url}
  // 'email.receipt.noReceipt': '',
  //   en: A receipt is available from your Stripe payment confirmation.
  // 'email.receipt.start': '',
  //   en: Start whenever you like; your progress is saved as you go.
  // 'email.receipt.button': '',
  //   en: Start learning
  // 'email.certificate.title': '',
  //   en: Your certificate: {course}
  // 'email.certificate.congrats': '',
  //   en: Congratulations, {name}. You completed "{course}" by {teacher}.
  // 'email.certificate.verify': '',
  //   en: Anyone can verify it at {url} — no sign-in needed.
  // 'email.certificate.button': '',
  //   en: View certificate
  // 'email.refund.title': '',
  //   en: Refund issued for {course}
  // 'email.refund.refunded': '',
  //   en: We have refunded {amount} to your original payment method. It can take 5–10 working days to appear.
  // 'email.refund.reason': '',
  //   en: Reason: {reason}
  // 'email.refund.reasonStripe': '',
  //   en: Refunded in Stripe
  // 'email.refund.accessRemoved': '',
  //   en: Access to the course has been removed.
  // 'email.duplicate.title': '',
  //   en: Refund issued: you paid twice for {course}
  // 'email.duplicate.refunded': '',
  //   en: You paid twice for "{course}", so we have refunded your second payment of {amount} to your original payment method. It can take 5–10 working days to appear.
  // 'email.duplicate.kept': '',
  //   en: Your enrolment and your progress are not affected.
  // 'email.duplicate.removed': '',
  //   en: Your other payment for this course has been refunded too, so access to the course has been removed.
  // 'email.duplicate.button': '',
  //   en: Go to the course
} satisfies Partial<Record<keyof typeof emailEn, string>>
