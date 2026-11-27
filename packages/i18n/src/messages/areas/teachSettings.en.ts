/** Teach's Settings page: the profile form, the picture, the member's own role, the account card. */
export const teachSettingsEn = {
  // The profile form. Its field labels are `profileField.*`.
  // Button
  'settings.teach.save': 'Save changes',
  // Toast once the form is saved
  'settings.teach.saved': 'Profile saved',
  // Title of the toast when saving fails; the description is the error itself
  'settings.teach.saveFailed': 'Could not save',

  // The profile picture card
  'settings.teach.picture': 'Profile picture',
  'settings.teach.picture.description':
    'Shown beside your name on course pages. A square JPG, PNG or WebP works best.',
  // Button
  'settings.teach.picture.remove': 'Remove picture',
  // The label above the uploader: when the profile has no picture, and when it has one
  'settings.teach.picture.upload': 'Upload a picture',
  'settings.teach.picture.replace': 'Replace picture',
  // Toasts
  'settings.teach.picture.saved': 'Picture saved',
  'settings.teach.picture.removed': 'Picture removed',
  // Title of the toast when saving the picture fails; the description is the error itself
  'settings.teach.picture.saveFailed': 'Could not save picture',

  // The card a manager or writer sees: their role, and the way to leave the profile
  // Card title. {role} is the name of the role: Manager or Writer
  'membership.yourRole': 'Your role: {role}',
  // Button: opens the dialog below
  'membership.leave': 'Leave this profile',
  // The dialog. {name} is the profile's display name
  'membership.leave.title': 'Leave {name}?',
  'membership.leave.description':
    'You lose access to this profile and its courses at once. What you wrote stays with the profile. To come back you need a new invitation.',
  // Its buttons: close the dialog and stay a member, or leave
  'membership.leave.stay': 'Stay',
  'membership.leave.confirm': 'Leave',
  // Toast after leaving. {name} is the profile's display name
  'membership.leave.done': 'You left {name}',
  // Title of the toast when leaving fails; the description is the error itself
  'membership.leave.failed': 'Could not leave',

  // The Account card: two labels, each beside an email address
  // The user's own address
  'account.signedInAs': 'Signed in as',
  // The address of the profile's owner
  'account.owner': 'Owner',

  // Above the profile form, for someone who can read it but not change it (a writer, staff)
  'settings.teach.readOnly':
    'Only the owner or a manager can change what learners see about this profile.',

  // ── The class-sales card, for the owner ──
  // The held-payout terms below follow docs/terms/held-payout-terms.md, which is the source: when
  // the two differ, that file is right. A change to what a term means is a new terms version.
  // Card title
  'classSales.title': 'Class sales',
  'classSales.description':
    'Sell seats in your scheduled classes. Read the held-payout terms before you accept them.',
  // The badge beside the title, one per state
  'classSales.badge.off': 'Not selling',
  'classSales.badge.switching': 'Finishing set-up',
  'classSales.badge.on': 'Selling classes',
  'classSales.badge.leaving': 'Stopping',
  'classSales.loadFailed': 'Could not load class sales.',
  // Shown instead of the accept button while the Stripe account cannot take payments
  'classSales.notPayable': 'Finish setting up payouts with Stripe before you accept these terms.',
  // For a profile that stopped selling classes before and can opt in again
  'classSales.leftBefore': 'You stopped selling classes. You can accept these terms again.',

  // The terms. {version} is the terms version, such as 2026-12
  'classSales.terms.title': 'Held-payout terms',
  'classSales.terms.version': 'Version {version}',
  'classSales.terms.intro':
    '“You” is the teaching profile. A “session” is one dated meeting of a class. “Your share” of a sale is the price the learner paid less Elevate’s fee.',
  // Section headings, in order
  'classSales.terms.accepting': 'What accepting does',
  'classSales.terms.leaving': 'Leaving',
  'classSales.terms.paid': 'When you are paid',
  'classSales.terms.held': 'When class money is held',
  'classSales.terms.fee': 'Elevate’s fee',
  'classSales.terms.refunds': 'Refunds, and who bears Stripe’s fee',
  'classSales.terms.refunds.intro': 'Stripe keeps its processing fee when a payment is refunded.',
  'classSales.terms.elevateCancels': 'When Elevate cancels a class',
  'classSales.terms.attended': 'What “attended” means',
  'classSales.terms.disputes': 'Disputes at a learner’s bank',
  'classSales.terms.owe': 'Money you owe',
  // The numbered terms. A `.lead` is shown in bold before its term.
  'classSales.term.1':
    'Only the owner of the profile can accept these terms. Once they are accepted, the profile can sell seats in its classes.',
  'classSales.term.2':
    'From then on, Elevate decides when money in your Stripe account is paid to your bank. This covers every sale you make through Elevate, self-paced courses included. Stripe no longer pays you automatically.',
  'classSales.term.3':
    'You cannot change your payout schedule or pay yourself out from your Stripe dashboard.',
  'classSales.term.4':
    'The owner can stop selling classes at any time, in Teach Settings. From that moment none of your classes is on sale. Seats already sold are not affected: those classes run, and their money is held and paid as these terms say.',
  'classSales.term.5':
    'Thirty days after you stop, or later if money from a class is still held then, Elevate pays you what is due and hands your payouts back to Stripe’s own schedule. We email you when that is done. You can accept these terms again later.',
  'classSales.term.6':
    'Elevate pays you at most once a day, after 10:00 Singapore time, when at least S$1 can be paid.',
  'classSales.term.7':
    'A payout is made of whole sales, oldest first. A sale that does not fit in one day’s payout waits for the next day, and so do the sales after it.',
  'classSales.term.8':
    'Money from a self-paced sale can be paid as soon as Stripe makes it available in your balance.',
  'classSales.term.9':
    'Money that was in your Stripe balance when you accepted is paid to you in the same daily payouts.',
  'classSales.term.10':
    'Your share of a class seat is held in your Stripe account until 7 days after the last session of the class ends. If the class is cancelled, it is held until 7 days after the cancellation.',
  'classSales.term.11':
    'The money for a class is not released while a learner can still dispute a mark that says they were present. A learner has 7 days to dispute a mark made by hand.',
  'classSales.term.12':
    'If no learner has attended a class, Elevate looks at the class before its money is released.',
  'classSales.term.13':
    'The money for one seat stays held while a refund for that seat is in progress, or while the learner’s bank is deciding a dispute about the payment.',
  'classSales.term.14':
    'No sale’s money is held for more than 85 days from the payment. For that reason a class can be sold only if it ends within 75 days.',
  // Term 15 is an introduction, a list of two parts, and a paragraph
  'classSales.term.15': 'Elevate’s fee on each sale has two parts:',
  'classSales.term.15.commission':
    'a commission, which is your profile’s commission rate (15% unless Elevate has agreed another rate with you) of the price less the estimate below;',
  'classSales.term.15.estimate':
    'an estimate of Stripe’s processing fee: 3.4% of the price plus S$0.50.',
  'classSales.term.15.note':
    'The estimate is the same however the learner pays. Stripe’s real fee can be lower, as on a payment by PayNow (1.3%), or higher, as on a card issued outside Singapore (3.9% plus S$0.50). Elevate keeps the difference when the real fee is lower and bears it when it is higher. Your share of a sale does not change. On a seat of S$500, Elevate’s fee is S$89.88 and your share is S$410.12.',
  'classSales.term.16.lead': 'A learner withdraws.',
  'classSales.term.16':
    'A learner who has not attended can withdraw until 7 days before the first session. They are refunded the price less Stripe’s fee. Your share of that sale is taken back, and it costs you nothing more.',
  'classSales.term.17.lead': 'You change a session’s date or time after a seat is sold.',
  'classSales.term.17':
    'Every learner with a seat is emailed. A learner who has not attended can then withdraw until the class starts and is refunded in full. You bear Stripe’s fee on each seat refunded this way.',
  'classSales.term.18.lead': 'You move a learner to another class.',
  'classSales.term.18':
    'The owner or a manager can move a learner who has not attended to another class of the same course. The learner is emailed and has the same right to withdraw as in term 17.',
  'classSales.term.19.lead': 'You cancel a class.',
  'classSales.term.19':
    'Every learner who has not attended is refunded in full. Your share of each of those sales is taken back, and you bear Stripe’s fee on each.',
  'classSales.term.20':
    'A learner who has attended a session of a class you cancel is refunded the part of the price for the sessions that had not started. The same part of your share is taken back, and Elevate returns to you the same part of what it kept of its fee. Stripe’s fee falls on you and Elevate in the same proportion.',
  'classSales.term.21':
    'You cannot cancel a class after its money has been released. Write to Elevate.',
  'classSales.term.22.lead': 'You give a refund.',
  'classSales.term.22':
    'The owner or a manager can refund a learner any part of what they paid, until the money for the seat is released. The learner keeps the seat. Elevate returns to you the same proportion of what it kept of its fee.',
  'classSales.term.23.lead': 'A learner pays but gets no seat.',
  'classSales.term.23':
    'This happens when the class filled or started while they were paying. They are refunded in full at Elevate’s cost.',
  // Term 24 is an introduction and a list of five grounds
  'classSales.term.24': 'Elevate may cancel one of your classes only when:',
  'classSales.term.24.absent': 'the teacher did not turn up, or cannot teach the class;',
  'classSales.term.24.venue': 'the venue is unsafe or cannot be used;',
  'classSales.term.24.rules': 'you have broken Elevate’s rules or acted dishonestly;',
  'classSales.term.24.suspended': 'your profile is suspended; or',
  'classSales.term.24.law': 'the law requires it.',
  'classSales.term.25':
    'When there is time, Elevate tells you before it cancels and gives you a chance to answer. It always tells you the reason.',
  'classSales.term.26':
    'When Elevate cancels a class, every learner is refunded in full, whether or not they attended. Your share of each of those sales is taken back. Elevate bears Stripe’s fee. Elevate never takes back more than it refunds.',
  'classSales.term.27': 'A learner has attended a session when they checked in to it themselves.',
  'classSales.term.28':
    'A learner has also attended a session when your instructor marked them present by hand, Elevate emailed the learner to say so, and the learner did not dispute the mark within 7 days.',
  'classSales.term.29':
    'If a learner asks their bank to reverse a card payment and the bank decides for the learner, your whole share of that sale is taken back. Elevate bears Stripe’s fee and the bank’s dispute fee.',
  'classSales.term.30': 'If the bank decides for Elevate, nothing changes for you.',
  'classSales.term.31':
    'A refund or a bank’s decision can take back money you were already paid, or more than your Stripe balance holds. That amount is a debt. It is taken from your next payouts before anything else is paid.',
  'classSales.term.32':
    'If your payouts have not covered a debt, Elevate can ask you to pay what remains. It sends you a statement that lists each amount. You can question any amount on it.',

  // Opting in. Button below the terms
  'classSales.accept': 'Accept and start selling classes',
  // Toasts after accepting: when it is done, and when Stripe's side finishes in a few minutes
  'classSales.accept.done': 'You can now sell classes',
  'classSales.accept.switching': 'Terms accepted. Finishing set-up.',
  // Title of the toast when accepting fails; the description is the error itself
  'classSales.accept.failed': 'Could not accept the terms',
  // When the terms on screen are no longer the current version
  'classSales.accept.termsChanged': 'The terms have changed. Reload this page to read them.',

  // While the Stripe account is being switched to payouts made by Elevate
  'classSales.switching':
    'Elevate is switching your Stripe account to payouts made by Elevate. This takes a few minutes. Your classes go on sale when it is done.',

  // The accepted state. {version} is the terms version; {date} is when the owner accepted
  'classSales.accepted':
    'You accepted version {version} of the held-payout terms on {date}. Your published classes can be sold, and Elevate pays you once a day.',
  // A toggle that shows or hides the terms in the accepted state
  'classSales.terms.show': 'Read the terms',
  'classSales.terms.hide': 'Hide the terms',

  // Leaving. Button, then the dialog it opens
  'classSales.leave': 'Stop selling classes',
  'classSales.leave.title': 'Stop selling classes?',
  'classSales.leave.description':
    'From now on none of your classes is on sale. Seats already sold are not affected: those classes run, and their money is held and paid as the terms say. Thirty days from now, or later if money from a class is still held then, Elevate pays you what is due and hands your payouts back to Stripe’s own schedule.',
  // The dialog's buttons: close it and keep selling, or stop
  'classSales.leave.keep': 'Keep selling',
  'classSales.leave.confirm': 'Stop selling classes',
  // Toast once notice is given
  'classSales.leave.done': 'You have stopped selling classes',
  // Title of the toast when giving notice fails; the description is the error itself
  'classSales.leave.failed': 'Could not stop selling classes',
  // The notice state. {requested} is when notice was given; {leaveOn} is 30 days later
  'classSales.leaving':
    'You stopped selling classes on {requested}. None of your classes is on sale. On {leaveOn}, or later if money from a class is still held then, Elevate pays you what is due and hands your payouts back to Stripe’s own schedule. We email you when that is done.',
} as const
