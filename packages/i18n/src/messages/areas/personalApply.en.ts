/**
 * The application for a personal profile, in Teach: one person teaching under their own name. Its
 * field labels for the display name, headline and bio are `profileField.*`.
 */
export const personalApplyEn = {
  // The top of the form
  // The small line above the heading: a first application, and one that is corrected and sent again
  'personalApply.eyebrow.apply': 'Become a teacher',
  'personalApply.eyebrow.reapply': 'Update your application',
  // The heading. "Practise" means the craft or skill the person works at
  'personalApply.title': 'Teach what you practise.',
  'personalApply.intro':
    'Elevate is a small, curated platform. Tell us who you are, what you teach and show us a few minutes of you teaching. A human reviews every application, usually within two working days.',
  // {link} is `personalApply.companyInstead.link`, which opens the application form for a company
  'personalApply.companyInstead':
    'This application is for a person teaching under their own name, a sole proprietor included. Teaching as a private limited company or an LLP? {link}.',
  'personalApply.companyInstead.link': 'Apply as a company instead',
  // A badge above the note Support wrote when it turned the application down
  'personalApply.reviewerNote': 'Reviewer note',

  // Shown instead of the form when the earlier application cannot be loaded. The body is the
  // error itself, and the button is `common.tryAgain`
  'personalApply.loadFailed.title': 'Could not load your application',

  // Section: about the applicant
  'personalApply.about.title': 'About you',
  // Under the display name field
  'personalApply.displayName.hint': 'Shown on your courses and certificates.',
  // Under the headline field. The words in quotation marks are an example of a headline;
  // Jalan Bahar is a place in Singapore
  'personalApply.headline.hint': 'One line, e.g. “Ceramicist and studio teacher, Jalan Bahar”.',
  // Under the bio field
  'personalApply.bio.hint': '50–3000 characters. Learners read this on your course pages.',

  // Section: credentials and experience
  'personalApply.experience.title': 'Credentials and experience',
  // Field label, and the hint under it
  'personalApply.credentials': 'Credentials',
  'personalApply.credentials.hint': 'Qualifications, years of practice, where you have taught.',

  // Section: a sample of the applicant's teaching
  'personalApply.sample.title': 'Teaching sample',
  'personalApply.sample.intro':
    'Upload a short video of you teaching, or paste a link to one. Either is fine.',
  // The label above the video upload, and the text inside the upload area
  'personalApply.sample.upload': 'Upload a video',
  'personalApply.sample.upload.hint': 'MP4 or MOV, up to a few minutes',
  // Under the video uploader when the earlier application had a video and no new one is chosen
  'personalApply.sample.kept':
    'The video from your last application is kept unless you upload a new one.',
  // The label of the web address field under the video upload, and its placeholder
  'personalApply.sample.link': 'Or a link',
  'personalApply.sample.link.placeholder': 'https://youtube.com/…',

  // Sending the form
  // Agreement wording, beside the button. "It" in "while it is listed" is the content
  'personalApply.agreement':
    'By applying you agree to the teacher agreement: you own your content; Elevate holds a non-exclusive hosting licence while it is listed.',
  // The button: for a first application, and for one that is sent again
  'personalApply.submit.apply': 'Submit application',
  'personalApply.submit.reapply': 'Resubmit',
  // Toast once the application is sent: its title and its description
  'personalApply.sent.title': 'Application sent',
  'personalApply.sent.description': 'We will email you when it has been reviewed.',
  // Title of the toast when sending fails; the description is the error itself
  'personalApply.submit.failed': 'Could not submit',
} as const
