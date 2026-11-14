/**
 * A writer's held changes to a live course, and their review.
 *
 * `{writer}` is the name of the writer who made the changes (their email address if they have no
 * name), or `changes.writer.unknown`. An "item" is a video, audio, reading or quiz inside a lesson;
 * a key segment that is looked up by a stored value uses that value: `artefact` for an item,
 * `text` for a reading.
 */
export const changesEn = {
  // The page: the link above the header, the header, and its two states with nothing to review
  'changes.back': 'Back to the course',
  'changes.loadFailed': 'Could not load the changes',
  'changes.eyebrow': 'Changes waiting for approval',
  'changes.description':
    'Edits a writer made to this live course. Learners do not see them until they are approved.',
  'changes.none.title': 'Nothing is waiting',
  'changes.none.body': 'This course has no changes waiting for approval.',
  // A button
  'changes.none.open': 'Open the course',

  // Stands in for {writer} when the writer is not known. It is put at the start of a sentence, in
  // the middle of one, and before a possessive.
  'changes.writer.unknown': 'The writer',

  // The clashes with the live course, above the list of changes
  'changes.clashes.title.one': '{count} clash with the live course',
  'changes.clashes.title.other': '{count} clashes with the live course',
  'changes.clashes.description':
    'The live course was changed after {writer} started. For each one, choose which version to keep. Nothing is merged.',

  // One clash: what happened (also read out as the name of its pair of choices), then the choice
  // that keeps the live side and the choice that keeps the writer's side. {title} is the title of
  // the lesson, item or quiz.
  // The prerequisites of a lesson were changed on both sides
  'changes.clash.prerequisites.story':
    'The prerequisites of “{title}” were changed on the live course, and {writer} changed them too.',
  'changes.clash.prerequisites.keepLive': 'Keep the live prerequisites',
  'changes.clash.prerequisites.keepDraft': 'Use {writer}’s prerequisites',
  // The writer changed something that was then deleted from the live course
  'changes.clash.deleted.story.lesson':
    'The lesson “{title}” was deleted from the live course after {writer} started.',
  'changes.clash.deleted.story.artefact':
    'The item “{title}” was deleted from the live course after {writer} started.',
  'changes.clash.deleted.story.quiz':
    'The quiz “{title}” was deleted from the live course after {writer} started.',
  'changes.clash.deleted.keepLive': 'Leave it deleted',
  'changes.clash.deleted.keepDraft': 'Bring it back, with {writer}’s changes',
  // A warning under a deleted lesson: {count} is how many items the writer added to that lesson
  'changes.clash.deleted.dropped.one':
    'Leaving it deleted also drops {count} new item {writer} added to it.',
  'changes.clash.deleted.dropped.other':
    'Leaving it deleted also drops {count} new items {writer} added to it.',
  // The writer removed something that was then edited on the live course
  'changes.clash.removed.story.lesson':
    '{writer} removed the lesson “{title}”, and it was edited on the live course after that.',
  'changes.clash.removed.story.artefact':
    '{writer} removed the item “{title}”, and it was edited on the live course after that.',
  'changes.clash.removed.story.quiz':
    '{writer} removed the quiz “{title}”, and it was edited on the live course after that.',
  'changes.clash.removed.keepLive': 'Keep it, as it is live',
  'changes.clash.removed.keepDraft': 'Remove it',
  // Edited on both sides
  'changes.clash.edited.story.lesson':
    'The lesson “{title}” was edited on the live course after {writer} started.',
  'changes.clash.edited.story.artefact':
    'The item “{title}” was edited on the live course after {writer} started.',
  'changes.clash.edited.story.quiz':
    'The quiz “{title}” was edited on the live course after {writer} started.',
  'changes.clash.edited.keepLive': 'Keep the live version',
  'changes.clash.edited.keepDraft': 'Use {writer}’s version',
  // Under the two choices of a clash that has neither chosen
  'changes.clash.noChoice': 'No choice made yet.',

  // One clash that was edited on both sides: its two versions, side by side. The first is headed
  // `changes.compare.live`, the second with the writer's name.
  'changes.versions.label': 'The two versions',
  'changes.versions.theirs': '{writer}’s version',

  // The list of changes
  'changes.count.one': '{count} change',
  'changes.count.other': '{count} changes',
  'changes.empty.title': 'Nothing has changed yet',
  'changes.empty.body':
    '{writer} started editing this course but has not changed anything. You can discard this, or wait.',
  // One change: a badge for the kind of change, then the kind of thing that changed, in small
  // capitals, then its title
  'changes.change.added': 'Added',
  'changes.change.edited': 'Edited',
  'changes.change.removed': 'Removed',
  'changes.kind.lesson': 'Lesson',
  'changes.kind.artefact': 'Content',
  'changes.kind.quiz': 'Quiz questions',
  'changes.kind.prerequisites': 'Prerequisites',

  // One change: a lesson
  'changes.lesson.added': 'A new lesson. Its content is listed below.',
  // {summary} is the summary the writer gave the lesson
  'changes.lesson.added.withSummary': 'A new lesson: {summary}. Its content is listed below.',
  'changes.lesson.removed.one':
    'The lesson and the {count} item in it are removed. Learners lose their progress on them.',
  'changes.lesson.removed.other':
    'The lesson and the {count} items in it are removed. Learners lose their progress on them.',
  // An edited lesson: what was edited, each above its live and its new version. The title label
  // is also used for an edited item.
  'changes.field.title': 'Title',
  'changes.field.summary': 'Summary',
  'changes.field.lessonPosition': 'Place in the course',
  // A lesson's place in the course: {n} counts from 1
  'changes.position.lesson': 'Lesson {n}',

  // One change: the prerequisites of a lesson. The label is followed, in each version, by the
  // titles of the lessons to complete first.
  'changes.field.prerequisites': 'Unlocks after completing',
  // In that list of titles, a lesson whose title is not known
  'changes.prerequisites.unknownLesson': 'another lesson',
  // In place of that list, for a lesson with no prerequisites
  'changes.prerequisites.none': 'Nothing: open from the start',

  // One change: the questions of a quiz, above its live and its new version
  'changes.field.questions': 'Questions',

  // One change: an item, by its type
  'changes.item.removed.video': 'This video is removed. Learners lose their progress on it.',
  'changes.item.removed.audio': 'This audio is removed. Learners lose their progress on it.',
  'changes.item.removed.text': 'This reading is removed. Learners lose their progress on it.',
  'changes.item.removed.quiz': 'This quiz is removed. Learners lose their progress on it.',
  // … when its type is not known
  'changes.item.removed.unknown': 'This item is removed. Learners lose their progress on it.',
  'changes.item.added.video': 'A new video.',
  'changes.item.added.audio': 'A new audio.',
  'changes.item.added.text': 'A new reading.',
  'changes.item.added.quiz': 'A new quiz.',
  // An edited item: what was edited (after `changes.field.title`)
  'changes.field.itemPosition': 'Place in the lesson',
  // An item's place in its lesson: {n} counts from 1
  'changes.position.item': 'Item {n}',
  'changes.field.file': 'File',
  // In place of a file name, for an item with no file
  'changes.file.none': 'No file',
  // The text of a reading
  'changes.field.text': 'Text',

  // Two versions side by side: the heading of each. A clash heads the second one with
  // `changes.versions.theirs` instead.
  'changes.compare.live': 'Live now',
  'changes.compare.afterApproval': 'After approval',

  // What an item holds, shown for a new item and for both versions of a clash
  'changes.body.noText': 'No text yet.',
  'changes.body.file': 'File: {filename}',
  'changes.body.noFile': 'No file uploaded yet.',

  // A quiz: its settings on one line, joined with " · ", then its questions
  'changes.quiz.noQuestions': 'No questions.',
  'changes.quiz.passMark': 'Pass mark {percent}%',
  // How many times a learner may take the quiz
  'changes.quiz.attempts.one': '{count} attempt',
  'changes.quiz.attempts.other': '{count} attempts',
  // The time limit of the quiz, in minutes
  'changes.quiz.timeLimit': '{minutes} min',
  // What a screen reader says for the tick beside the right option
  'changes.quiz.correct': 'Correct answer',

  // Deciding: the card beside the list. {date} is the day the writer started.
  'changes.decide.title': 'Decide',
  'changes.decide.description':
    'Started by {writer} on {date}. Learners see the course as it was until you approve.',
  // A button
  'changes.decide.approve': 'Approve and publish',
  // Under that button, while some clashes have no choice yet
  'changes.decide.unresolved.one': 'Choose a version for the clash before approving.',
  'changes.decide.unresolved.other':
    'Choose a version for each of the {count} clashes before approving.',
  // Under that button, once nothing stands in the way
  'changes.decide.together':
    'All of these changes go live together. Learners keep their progress on everything that stays.',
  // A button: it opens the dialog below
  'changes.decide.discard': 'Discard these changes',
  // In place of the buttons, for someone who may not decide
  'changes.decide.notAllowed': 'The owner or a manager approves or discards these changes.',

  // Discarding: the dialog that asks first
  'changes.discard.title': 'Discard these changes?',
  'changes.discard.description':
    'Everything {writer} changed here is thrown away, and they are told by email. The live course is not touched. This cannot be undone.',
  // The button that confirms
  'changes.discard.confirm': 'Discard',

  // Toasts: a title and, for some, a second line. When something fails, the second line is the
  // error itself.
  // A choice for a clash could not be saved, because the live course has changed again
  'changes.toast.chooseAgain': 'Choose again',
  'changes.toast.approved': 'Changes are live',
  'changes.toast.approved.description': 'Learners see the updated course now.',
  'changes.toast.approveFailed': 'Not approved',
  'changes.toast.discarded': 'Changes discarded',
  'changes.toast.discarded.description': 'The course is unchanged.',
  'changes.toast.discardFailed': 'Could not discard',

  // A badge on a change that also clashes with the live course; it links to the clash
  'changes.item.clash': 'Clash above',
  // Under an item's title: the lesson it is in. {lesson} is the lesson's title.
  'changes.item.inLesson': 'In “{lesson}”',
  // An edited item with no field to compare: a quiz (its questions are listed separately) or anything else
  'changes.item.edited.quiz': 'Its questions or settings changed; they are compared below.',
  'changes.item.edited.other': 'Its details changed.',
  // The unresolved count is a button that jumps to the first clash without a choice
  'changes.decide.firstOpen': 'Go to the first open clash',
} as const
