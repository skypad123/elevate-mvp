/** The in-app certificate screen, the certificate card and the public /c/[token] page. */
export const learnerCertificateEn = {
  // The learner's own certificate (learn/[enrollmentId]/certificate)
  'learnerCertificate.own.back': 'Back to course',
  // The course isn't finished yet, so there is no certificate
  'learnerCertificate.own.notYet.title': 'Finish the course to earn your certificate',
  'learnerCertificate.own.notYet.body':
    'Complete every lesson and pass every quiz. Your certificate is issued the moment you do.',
  'learnerCertificate.own.notYet.action': 'Back to the course',
  'learnerCertificate.own.loadFailed.title': 'Could not load your certificate',
  'learnerCertificate.own.eyebrow': 'Your certificate',
  'learnerCertificate.own.title': 'You did it.',
  'learnerCertificate.own.intro':
    'Download the PDF or share the verify link. Anyone can open the link to confirm your certificate, no sign-in needed; it is also printed on the PDF with a QR code.',
  // Shown when the account has no name, so the certificate shows the email address
  'learnerCertificate.own.noName.title': 'Put your name on it',
  'learnerCertificate.own.noName.body':
    'Your profile has no name yet, so the certificate shows your email. Add your name under Profile and it is reprinted here automatically, same verify link.',
  'learnerCertificate.own.noName.action': 'Go to Profile',
  // The caption above the public verify URL
  'learnerCertificate.own.verifyLink': 'Verify link',

  // The public verify page (/c/[token])
  'learnerCertificate.verify.loadFailed.title': 'Could not check this certificate',
  'learnerCertificate.verify.revoked.title': 'Certificate revoked',
  // {date}: the day the certificate was withdrawn, already formatted
  'learnerCertificate.verify.revoked.body':
    'This certificate was withdrawn by Elevate on {date} and is no longer valid.',
  'learnerCertificate.verify.notFound.title': 'Certificate not found',
  'learnerCertificate.verify.notFound.body':
    'No certificate matches this link. Check the address, or ask the holder for the link printed on their PDF.',
  'learnerCertificate.verify.notFound.action': 'Explore courses',
  'learnerCertificate.verify.title': 'Verified certificate',
  // {name}: the learner's name as printed on the certificate
  'learnerCertificate.verify.body':
    'Elevate confirms this certificate is genuine: it was issued when {name} completed every lesson and passed every quiz in this course. Anyone with this link can check it, no account needed.',
  'learnerCertificate.verify.viewCourse': 'View the course',

  // The certificate card, the on-screen twin of the (English) PDF
  'learnerCertificate.card.eyebrow': 'Certificate of completion',
  // One sentence laid out as lines: {name} and {course} each get their own large line, and the
  // text between them is the small lines (a divider follows the name). {teacher} stays inline.
  // Order the three placeholders as the language needs.
  'learnerCertificate.card.statement':
    'This certifies that {name} has completed {course} taught by {teacher} on Elevate',
  // {token}: the certificate's ID, as in its verify link
  'learnerCertificate.card.id': 'Certificate ID {token}',
  'learnerCertificate.card.download': 'Download PDF',
  'learnerCertificate.card.share': 'Share verify link',
  // Shown for two seconds after the verify link is copied to the clipboard
  'learnerCertificate.card.copied': 'Link copied',
  // The title of the web share sheet
  'learnerCertificate.card.shareTitle': 'Elevate certificate',
  // The shared message. {course}: the course title; {url}: the verify link
  'learnerCertificate.card.shareMessage':
    'I completed “{course}” on Elevate. Verify it here: {url}',
} as const
