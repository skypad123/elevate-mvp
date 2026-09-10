import { isEnrolled } from './catalog'
import type { Course, Task } from '../types'

export type ChatRole = 'user' | 'assistant'

export type AssistantReply = {
  text: string
  courses: Course[]
}

type AssistantContext = {
  courses: Course[]
  tasks: Task[]
  profileName: string
}

const STOP_WORDS = new Set([
  'a',
  'an',
  'and',
  'are',
  'can',
  'for',
  'from',
  'have',
  'i',
  "i'm",
  'in',
  'into',
  'is',
  'it',
  'me',
  'my',
  'of',
  'on',
  'or',
  'show',
  'some',
  'something',
  'the',
  'to',
  'want',
  'what',
  'with',
  'you',
])

const TOPIC_SYNONYMS: Record<string, string[]> = {
  design: ['design', 'ux', 'ui', 'visual', 'interface', 'figma', 'prototype', 'usability'],
  programming: [
    'code',
    'coding',
    'programming',
    'developer',
    'software',
    'computer',
    'cs',
    'algorithm',
    'algorithms',
  ],
  web: ['web', 'website', 'html', 'css', 'javascript', 'frontend', 'fullstack'],
  data: ['data', 'analytics', 'dataset', 'charts', 'visualization', 'ml', 'model'],
  math: ['math', 'calculus', 'algebra', 'statistics', 'stats', 'quantitative'],
  ai: ['ai', 'ml', 'machine', 'learning', 'model', 'models', 'intelligence'],
  art: ['art', 'photo', 'photography', 'creative', 'music', 'audio', 'visual'],
  writing: ['write', 'writing', 'essay', 'story', 'stories', 'workshop'],
  business: ['business', 'startup', 'entrepreneur', 'product', 'career'],
  speaking: ['speaking', 'presentation', 'present', 'communication', 'interview'],
  psychology: ['psychology', 'behavior', 'cognition', 'mind'],
  mobile: ['mobile', 'app', 'apps', 'ios', 'android', 'phone'],
}

function tokenize(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token))
}

function courseHaystack(course: Course) {
  return [
    course.name,
    course.code,
    course.instructor,
    course.description ?? '',
    ...(course.tags ?? []),
  ]
    .join(' ')
    .toLowerCase()
}

function scoreCourse(course: Course, tokens: string[], enrolledTags: Set<string>) {
  const haystack = courseHaystack(course)
  let score = 0

  for (const token of tokens) {
    if (haystack.includes(token)) score += 8
    if (course.code.toLowerCase().includes(token)) score += 10
    if (course.name.toLowerCase().includes(token)) score += 6
  }

  for (const [topic, synonyms] of Object.entries(TOPIC_SYNONYMS)) {
    const hit = tokens.some((token) => synonyms.includes(token) || token === topic)
    if (!hit) continue
    if ((course.tags ?? []).includes(topic) || haystack.includes(topic)) score += 14
    if (synonyms.some((word) => haystack.includes(word))) score += 8
  }

  const overlap = (course.tags ?? []).filter((tag) => enrolledTags.has(tag)).length
  if (overlap) score += overlap * 4
  score += (course.popularity ?? 0) / 20
  return score
}

function uniqueCourses(courses: Course[]) {
  const seen = new Set<string>()
  return courses.filter((course) => {
    if (seen.has(course.id)) return false
    seen.add(course.id)
    return true
  })
}

function courseList(courses: Course[]) {
  if (courses.length === 0) return ''
  if (courses.length === 1) return `${courses[0].name} (${courses[0].code})`
  const head = courses
    .slice(0, -1)
    .map((course) => course.name)
    .join(', ')
  const last = courses[courses.length - 1]
  return `${head}, and ${last.name}`
}

export function getWelcomeMessage(profileName: string) {
  const first = profileName.trim().split(/\s+/)[0] || 'there'
  return `Hi, ${first}. Tell me what you want to learn — a skill, a subject, or a goal — and I’ll recommend courses from Elevate.`
}

export function replyToUser(message: string, context: AssistantContext): AssistantReply {
  const { courses, tasks, profileName } = context
  const enrolled = courses.filter(isEnrolled)
  const enrolledTags = new Set(enrolled.flatMap((course) => course.tags ?? []))
  const tokens = tokenize(message)
  const lower = message.toLowerCase()

  const ranked = courses
    .map((course) => ({ course, score: scoreCourse(course, tokens, enrolledTags) }))
    .sort((a, b) => b.score - a.score)

  const matched = ranked.filter((item) => item.score >= 8).map((item) => item.course)
  const trending = [...courses]
    .sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0))
    .slice(0, 3)

  const wantsTrending =
    /hot|trend|popular|what.?s good|best|everyone/.test(lower) ||
    tokens.includes('trending')
  const wantsHelp =
    /stuck|overwhelmed|help|behind|homework|assignment|task/.test(lower)
  const greeting = /^(hi|hey|hello|yo|sup)\b/.test(lower.trim())

  if (greeting && tokens.length <= 2) {
    return {
      text: getWelcomeMessage(profileName),
      courses: [],
    }
  }

  if (wantsTrending) {
    return {
      text: `Here’s what’s getting the most attention right now: ${courseList(trending)}. I can also narrow this to a topic if you tell me what you’re curious about.`,
      courses: trending,
    }
  }

  if (wantsHelp && enrolled.length) {
    const openTasks = tasks.filter((task) => !task.done)
    const busy = enrolled
      .map((course) => ({
        course,
        open: openTasks.filter((task) => task.courseId === course.id).length,
      }))
      .sort((a, b) => b.open - a.open)
    const focus = busy[0]?.course
    const related = ranked
      .map((item) => item.course)
      .filter((course) => course.id !== focus?.id)
      .slice(0, 2)
    const picks = uniqueCourses([focus, ...related].filter(Boolean) as Course[]).slice(0, 3)
    return {
      text: focus
        ? `You’re enrolled in ${enrolled.length} courses. ${focus.name} looks like the best place to focus next. If you want a lighter lift or a related skill, I also like ${courseList(related)}.`
        : `You’re enrolled in ${courseList(enrolled.slice(0, 3))}. Tell me which subject feels hardest and I’ll map a path.`,
      courses: picks,
    }
  }

  if (matched.length) {
    const top = uniqueCourses(matched).slice(0, 3)
    const enrolledHit = top.filter(isEnrolled)
    const fresh = top.filter((course) => !isEnrolled(course))
    const lead = fresh[0] ?? top[0]
    const extra =
      enrolledHit.length > 0
        ? ` You’re already in ${courseList(enrolledHit)}, so these picks build on that.`
        : enrolled.length
          ? ` This sits nicely next to ${courseList(enrolled.slice(0, 2))}.`
          : ''
    return {
      text: `Based on that, I’d start with ${lead.name}. ${lead.description ?? ''}${extra}`.trim(),
      courses: top,
    }
  }

  const fallback = uniqueCourses([
    ...trending,
    ...courses.filter((course) => !isEnrolled(course)),
  ]).slice(0, 3)

  return {
    text: `I didn’t find an exact match, but these are strong starting points from the catalog: ${courseList(fallback)}. Try a subject like design, data, coding, or something creative.`,
    courses: fallback,
  }
}

export const SEARCH_PROMPTS = [
  'I want to learn design',
  'Something for data skills',
  'What’s trending?',
]
