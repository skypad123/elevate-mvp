/** A company's application form. */
export const companyApplyEn = {
  // Shown instead of the form when a member who is not the owner opens a company's application
  'companyApply.ownerOnly.title': 'Only the owner can resubmit',
  'companyApply.ownerOnly.body':
    'The application of this company profile can be changed by its owner.',

  // The top of the form
  // The small line above the heading: a first application, and one that is corrected and sent again
  'companyApply.eyebrow.apply': 'Teach as a company',
  'companyApply.eyebrow.reapply': 'Update your application',
  // The heading
  'companyApply.title': 'A profile for your company.',
  'companyApply.intro':
    'For a private limited company or a limited liability partnership registered in Singapore. Courses are sold under the company’s name and paid to the company’s own Stripe account. We check the company against its business profile, then review the teaching, usually within two working days.',
  // {link} is `companyApply.personalInstead.link`, which opens the application form for a person
  'companyApply.personalInstead': 'Teaching under your own name, or as a sole proprietor? {link}.',
  'companyApply.personalInstead.link': 'Apply as a person instead',
  // A badge above the note Support wrote when it turned the application down
  'companyApply.reviewerNote': 'Reviewer note',

  // Section: the company. Its field labels are `company.legalForm`, `company.uen` and
  // `company.legalName`; the legal forms to choose from are `entityType.*`.
  'companyApply.company.title': 'The company',
  // Under the UEN field. {example} is a sample number of the chosen legal form, such as 201912345K
  'companyApply.uen.hint':
    'The Unique Entity Number, as on the business profile. It looks like {example}.',
  // The error under the UEN field when the number does not have the format of the chosen legal form
  'companyApply.uen.invalid':
    'That is not the UEN of this kind of company. It looks like {example}.',
  // Under the legal name field
  'companyApply.legalName.hint': 'The registered name, exactly as on the business profile.',
  // The label above the file upload: for a first document, and when an earlier application had one
  'companyApply.document.upload': 'Business profile (PDF)',
  'companyApply.document.replace': 'Replace the business profile (PDF)',
  // Inside the upload area. Bizfile is the website of ACRA, the registrar of companies
  'companyApply.document.hint':
    'The company’s business profile from ACRA’s Bizfile. Only the Elevate team reads it.',
  'companyApply.document.kept':
    'The document sent with the earlier application is kept unless you upload another.',
  // The error under the upload when the form is sent without a document
  'companyApply.document.required': 'Upload the company’s business profile as a PDF',

  // Section: what learners see. The label of the headline field is `profileField.headline`.
  'companyApply.public.title': 'How learners see it',
  // Field label: the name the company teaches under
  'companyApply.publicName': 'Public name',
  'companyApply.publicName.hint': 'Shown on courses and certificates. It can be the trading name.',
  // Under the headline field. The words in quotation marks are an example of a headline
  'companyApply.headline.hint': 'One line, e.g. “Studio ceramics classes by working potters”.',
  // Field label: a longer text about the company
  'companyApply.about': 'About',
  'companyApply.about.hint': '50–3000 characters. Learners read this on the course pages.',

  // Section: teaching
  'companyApply.teaching.title': 'Teaching',
  // Field label
  'companyApply.credentials': 'Credentials and experience',
  'companyApply.credentials.hint':
    'Who teaches, their qualifications, how long the company has been teaching.',
  // The label above the video upload, and the text inside the upload area
  'companyApply.sample.upload': 'A teaching sample: upload a video',
  'companyApply.sample.upload.hint': 'A few minutes of one of your teachers teaching. MP4 or MOV.',
  // The label of the web address field under the video upload; "one" is a teaching sample
  'companyApply.sample.link': 'Or a link to one',

  // Sending the form
  // Agreement wording, beside the button. "It" in "while it is listed" is the content
  'companyApply.agreement':
    'By applying you confirm that you may act for this company, and agree to the teacher agreement: the company owns its content; Elevate holds a non-exclusive hosting licence while it is listed.',
  // The button: for a first application, and for one that is sent again
  'companyApply.submit.apply': 'Submit application',
  'companyApply.submit.reapply': 'Resubmit',
  // Toast once the application is sent: its title and its description
  'companyApply.sent.title': 'Application sent',
  'companyApply.sent.description': 'We will email you when it has been reviewed.',
  // Title of the toast when sending fails; the description is the error itself
  'companyApply.submit.failed': 'Could not submit',
} as const
