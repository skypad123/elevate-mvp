/** My Learning, the course overview, the lesson player and its media, quizzes and the trail. */
export const learnerLearnEn = {
  // Shared by the screens in this area
  'learnerLearn.completed': 'Completed',
  'learnerLearn.resume': 'Resume',
  'learnerLearn.backToCourse': 'Back to course',
  // A whole-number percentage: "40%"
  'learnerLearn.percent': '{percent}%',
  // Joins the separate facts of a meta line: "3 items · 12 min · 40%"
  'learnerLearn.meta.separator': ' · ',
  // A numbered item in a list: a lesson's item or a quiz question. {title} is the teacher's text.
  'learnerLearn.numbered': '{number}. {title}',

  // A lesson item's type, by the stored value
  'learnerLearn.artefactType.video': 'video',
  'learnerLearn.artefactType.audio': 'audio',
  'learnerLearn.artefactType.text': 'text',
  'learnerLearn.artefactType.quiz': 'quiz',

  // An enrolment that is not active, shown as a badge on My Learning, by the stored value
  'learnerLearn.enrollmentStatus.pending_payment': 'pending payment',
  'learnerLearn.enrollmentStatus.active': 'active',
  'learnerLearn.enrollmentStatus.refunded': 'refunded',
  'learnerLearn.enrollmentStatus.cancelled': 'cancelled',

  // My Learning (the learning tab)
  'learnerLearn.learning.eyebrow': 'My Learning',
  // {name} is the learner's first name
  'learnerLearn.learning.welcomeName': 'Welcome back, {name}.',
  'learnerLearn.learning.welcome': 'Welcome back.',
  'learnerLearn.learning.loadError': 'Could not load your courses',
  'learnerLearn.learning.empty.title': 'Nothing in progress yet',
  'learnerLearn.learning.empty.body':
    'Courses you enrol in appear here with your progress and certificates.',
  'learnerLearn.learning.empty.action': 'Explore courses',
  'learnerLearn.learning.continue': 'Continue',
  // The resume card's progress, by {total} (lesson items: videos, texts, quizzes)
  'learnerLearn.learning.progress.one': '{completed} of {total} item · {percent}%',
  'learnerLearn.learning.progress.other': '{completed} of {total} items · {percent}%',
  // {teacher} is the teacher's name, {date} the day the learner enrolled
  'learnerLearn.learning.byline': '{teacher} · enrolled {date}',
  // {price} is "S$49.00" or "Free"
  'learnerLearn.learning.summary': '{percent}% · {price}',
  'learnerLearn.learning.summaryCertified': '{percent}% · {price} · Certificate earned',

  // The course overview (learn/[enrollmentId])
  'learnerLearn.overview.loadError': 'Could not open this course',
  'learnerLearn.overview.backToLearning': 'My Learning',
  // By {total}, the number of lessons in the course
  'learnerLearn.overview.progress.one': '{percent}% · {completed} of {total} lesson complete',
  'learnerLearn.overview.progress.other': '{percent}% · {completed} of {total} lessons complete',
  'learnerLearn.overview.complete.title': 'Course complete',
  'learnerLearn.overview.complete.ready':
    'You finished every lesson and passed every quiz. Your certificate is ready to download and share.',
  'learnerLearn.overview.complete.preparing':
    'You finished every lesson and passed every quiz. Your certificate is being prepared and will appear here.',
  'learnerLearn.overview.viewCertificate': 'View certificate',
  'learnerLearn.overview.upNext': 'Up next',
  'learnerLearn.overview.start': 'Start',
  'learnerLearn.overview.lessons': 'Lessons',
  // A lesson's number of items (videos, texts, quizzes), one fact of its meta line
  'learnerLearn.overview.items.one': '{count} item',
  'learnerLearn.overview.items.other': '{count} items',

  // The trail of lessons. {list} is the titles of the lessons to finish first.
  'learnerLearn.trail.after': '· after {list}',

  // The lesson player
  'learnerLearn.lesson.locked.eyebrow': 'Locked',
  'learnerLearn.lesson.locked.title': 'Finish the earlier lessons first',
  'learnerLearn.lesson.loadError': 'Could not load this lesson',
  // One fact of a lesson item's meta line: "video · 12 min · in progress"
  'learnerLearn.lesson.inProgress': 'in progress',
  'learnerLearn.lesson.video.processing': 'This video is still processing. Check back shortly.',
  'learnerLearn.lesson.video.unavailable': 'This video is unavailable.',
  'learnerLearn.lesson.audio.unavailable': 'This audio is unavailable.',
  'learnerLearn.lesson.markRead': 'Mark as read',
  // Also used for audio
  'learnerLearn.lesson.markWatched': 'Mark as watched',
  'learnerLearn.lesson.previous': 'Previous',
  'learnerLearn.lesson.next': 'Next',
  // {title} is the next lesson's title
  'learnerLearn.lesson.unlockNext': 'Complete this lesson to unlock “{title}”',
  'learnerLearn.lesson.nextLesson': 'Next lesson: {title}',
  'learnerLearn.lesson.empty.title': 'This lesson has no content yet',
  'learnerLearn.lesson.empty.body': 'Check back soon.',
  // {number} counts from 1; {title} is the previous lesson's title
  'learnerLearn.lesson.number': 'Lesson {number}',
  'learnerLearn.lesson.numberAfter': 'Lesson {number} · after {title}',
  'learnerLearn.lesson.contents': 'In this lesson',

  // The quiz
  'learnerLearn.quiz.noQuestions': 'This quiz has no questions yet.',
  'learnerLearn.quiz.passed.title': 'Quiz passed',
  'learnerLearn.quiz.questions.one': '{count} question',
  'learnerLearn.quiz.questions.other': '{count} questions',
  'learnerLearn.quiz.passMark': 'Pass mark {percent}%',
  // By {max}, the number of attempts allowed: "1/3 attempts used"
  'learnerLearn.quiz.attemptsUsed.one': '{used}/{max} attempt used',
  'learnerLearn.quiz.attemptsUsed.other': '{used}/{max} attempts used',
  'learnerLearn.quiz.timeLimit': '{minutes} min limit',
  // {score} is the learner's best score, a whole-number percent
  'learnerLearn.quiz.passedBody': "You scored {score}%. This lesson's quiz is complete.",
  // {score} is the learner's best score, a whole-number percent
  'learnerLearn.quiz.exhausted':
    'You have used all attempts. Best score: {score}%. Ask your teacher if you need another go.',
  // The quiz's instructions before an attempt. {count} is the attempts left; {score} the best
  // score so far, in the ".best" forms.
  'learnerLearn.quiz.intro.single':
    'Answer every question, then submit. You have a single attempt.',
  'learnerLearn.quiz.intro.single.best':
    'Answer every question, then submit. You have a single attempt. Your best so far is {score}%.',
  'learnerLearn.quiz.intro.more.one':
    'Answer every question, then submit. You can try {count} more time.',
  'learnerLearn.quiz.intro.more.other':
    'Answer every question, then submit. You can try {count} more times.',
  'learnerLearn.quiz.intro.more.one.best':
    'Answer every question, then submit. You can try {count} more time. Your best so far is {score}%.',
  'learnerLearn.quiz.intro.more.other.best':
    'Answer every question, then submit. You can try {count} more times. Your best so far is {score}%.',
  'learnerLearn.quiz.resumeAttempt': 'Resume attempt',
  'learnerLearn.quiz.start': 'Start quiz',
  // {answered} is the questions answered so far, {total} all the questions in the quiz
  'learnerLearn.quiz.answered': '{answered} of {total} answered',
  'learnerLearn.quiz.submit': 'Submit answers',
  'learnerLearn.quiz.result.passed': 'Passed',
  'learnerLearn.quiz.result.notYet': 'Not yet',
  // {correct} is the questions answered correctly, {total} all the questions, {passMark} the
  // whole-number percent needed to pass
  'learnerLearn.quiz.result.summary': '{correct} of {total} correct · pass mark {passMark}%',
  // {count} is the attempts left
  'learnerLearn.quiz.tryAgain': 'Try again ({count} left)',
  'learnerLearn.quiz.noAttemptsLeft': 'No attempts left for this quiz.',
  // {answer} is the text of the option the learner chose
  'learnerLearn.quiz.yourAnswer': 'Your answer: {answer}',
  'learnerLearn.quiz.noAnswer': 'Your answer: —',
  // {answer} is the text of the correct option
  'learnerLearn.quiz.correctAnswer': 'Correct answer: {answer}',

  // The audio player
  'learnerLearn.audio.eyebrow': 'Audio lesson',
  'learnerLearn.audio.play': 'Play',
  'learnerLearn.audio.pause': 'Pause',
  'learnerLearn.audio.restart': 'Restart',
} as const
