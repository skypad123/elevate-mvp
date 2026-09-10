import type { Course } from '../types'

export const CATALOG_COURSES: Course[] = [
  {
    id: 'course_algo',
    name: 'Intro to Algorithms',
    code: 'CS 161',
    instructor: 'Dr. Chen',
    location: 'Hall 204',
    color: 'teal',
    thumbnail: 'https://images.unsplash.com/photo-1515879218367-8466d910aaa4?w=400&h=400&fit=crop',
    description:
      'Learn algorithmic thinking, graph traversals, and runtime analysis for coding interviews and systems work.',
    tags: ['programming', 'computer-science', 'algorithms', 'problem-solving'],
    popularity: 92,
    enrolled: true,
    meetings: [
      { id: 'm1', day: 1, start: '09:00', end: '10:20' },
      { id: 'm2', day: 3, start: '09:00', end: '10:20' },
    ],
  },
  {
    id: 'course_design',
    name: 'Interaction Design',
    code: 'DES 220',
    instructor: 'Prof. Alvarez',
    location: 'Studio B',
    color: 'purple',
    thumbnail: 'https://images.unsplash.com/photo-1561070791-2526d30994b5?w=400&h=400&fit=crop',
    description:
      'Prototype usable interfaces and critique real product flows with a focus on accessibility and craft.',
    tags: ['design', 'ux', 'ui', 'product'],
    popularity: 88,
    enrolled: true,
    meetings: [
      { id: 'm3', day: 2, start: '13:00', end: '15:30' },
      { id: 'm4', day: 4, start: '13:00', end: '15:30' },
    ],
  },
  {
    id: 'course_stats',
    name: 'Applied Statistics',
    code: 'STAT 110',
    instructor: 'Dr. Patel',
    location: 'Science 18',
    color: 'orange',
    thumbnail: 'https://images.unsplash.com/photo-1543286386-713bdd548da4?w=400&h=400&fit=crop',
    description:
      'Build intuition for probability, inference, and data-backed decision making across research and product.',
    tags: ['math', 'data', 'statistics', 'analysis'],
    popularity: 76,
    enrolled: true,
    meetings: [{ id: 'm5', day: 5, start: '11:00', end: '12:15' }],
  },
  {
    id: 'course_webdev',
    name: 'Web Development',
    code: 'CS 290',
    instructor: 'Prof. Martinez',
    location: 'Tech Lab 3',
    color: 'blue',
    thumbnail: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=400&h=400&fit=crop',
    description:
      'Ship modern websites with HTML, CSS, JavaScript, and a practical full-stack workflow.',
    tags: ['programming', 'web', 'javascript', 'coding'],
    popularity: 95,
    enrolled: true,
    meetings: [
      { id: 'm6', day: 2, start: '10:00', end: '11:30' },
      { id: 'm7', day: 4, start: '10:00', end: '11:30' },
    ],
  },
  {
    id: 'course_photography',
    name: 'Digital Photography',
    code: 'ART 155',
    instructor: 'Ms. Kim',
    location: 'Arts Building',
    color: 'pink',
    thumbnail: 'https://images.unsplash.com/photo-1452587925148-ce544e77e70d?w=400&h=400&fit=crop',
    description:
      'Capture stronger images through composition, lighting, and a critique-driven portfolio practice.',
    tags: ['art', 'visual', 'creative', 'photography'],
    popularity: 71,
    enrolled: true,
    meetings: [{ id: 'm8', day: 1, start: '14:00', end: '16:30' }],
  },
  {
    id: 'course_ml',
    name: 'Machine Learning Basics',
    code: 'CS 331',
    instructor: 'Dr. Nguyen',
    location: 'Tech Lab 1',
    color: 'blue',
    thumbnail: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=400&h=400&fit=crop',
    description:
      'Train your first models, evaluate them honestly, and connect ML ideas to real product questions.',
    tags: ['programming', 'ai', 'data', 'python', 'computer-science'],
    popularity: 98,
    enrolled: false,
    meetings: [
      { id: 'm9', day: 1, start: '15:00', end: '16:20' },
      { id: 'm10', day: 3, start: '15:00', end: '16:20' },
    ],
  },
  {
    id: 'course_algebra',
    name: 'Linear Algebra',
    code: 'MATH 232',
    instructor: 'Dr. Okonkwo',
    location: 'Science 12',
    color: 'teal',
    thumbnail: 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=400&h=400&fit=crop',
    description:
      'Master vectors, matrices, and linear transforms — the language behind graphics, data, and ML.',
    tags: ['math', 'data', 'engineering', 'analysis'],
    popularity: 84,
    enrolled: false,
    meetings: [
      { id: 'm11', day: 2, start: '09:00', end: '10:15' },
      { id: 'm12', day: 4, start: '09:00', end: '10:15' },
    ],
  },
  {
    id: 'course_mobile_design',
    name: 'Mobile App Design',
    code: 'DES 310',
    instructor: 'Prof. Alvarez',
    location: 'Studio A',
    color: 'purple',
    thumbnail: 'https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=400&h=400&fit=crop',
    description:
      'Design native-feeling mobile flows, from navigation patterns to motion and visual hierarchy.',
    tags: ['design', 'ux', 'mobile', 'product', 'ui'],
    popularity: 90,
    enrolled: false,
    meetings: [{ id: 'm13', day: 3, start: '13:00', end: '15:30' }],
  },
  {
    id: 'course_dataviz',
    name: 'Data Visualization',
    code: 'STAT 240',
    instructor: 'Dr. Patel',
    location: 'Science 18',
    color: 'orange',
    thumbnail: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=400&h=400&fit=crop',
    description:
      'Turn messy datasets into clear visual stories using charts, color, and narrative structure.',
    tags: ['data', 'design', 'statistics', 'analysis'],
    popularity: 86,
    enrolled: false,
    meetings: [{ id: 'm14', day: 5, start: '13:30', end: '15:00' }],
  },
  {
    id: 'course_writing',
    name: 'Creative Writing Workshop',
    code: 'ENG 210',
    instructor: 'Prof. Ellison',
    location: 'Humanities 7',
    color: 'yellow',
    thumbnail: 'https://images.unsplash.com/photo-1455390582262-044cdead277a?w=400&h=400&fit=crop',
    description:
      'Write with more voice and structure through weekly critiques, revision, and close reading.',
    tags: ['writing', 'humanities', 'creative'],
    popularity: 68,
    enrolled: false,
    meetings: [{ id: 'm15', day: 2, start: '16:00', end: '18:00' }],
  },
  {
    id: 'course_speaking',
    name: 'Public Speaking',
    code: 'COMM 101',
    instructor: 'Ms. Brooks',
    location: 'Forum Hall',
    color: 'red',
    thumbnail: 'https://images.unsplash.com/photo-1475721027785-f74eccf877e2?w=400&h=400&fit=crop',
    description:
      'Build confidence presenting ideas — from class critiques to interviews and team standups.',
    tags: ['communication', 'career', 'speaking'],
    popularity: 80,
    enrolled: false,
    meetings: [{ id: 'm16', day: 4, start: '11:00', end: '12:30' }],
  },
  {
    id: 'course_psych',
    name: 'Intro to Psychology',
    code: 'PSY 101',
    instructor: 'Dr. Rahman',
    location: 'Social Sci 3',
    color: 'green',
    thumbnail: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=400&h=400&fit=crop',
    description:
      'Explore cognition, motivation, and behavior — useful context for design, learning, and teamwork.',
    tags: ['social-science', 'humanities', 'psychology'],
    popularity: 74,
    enrolled: false,
    meetings: [
      { id: 'm17', day: 1, start: '11:00', end: '12:20' },
      { id: 'm18', day: 3, start: '11:00', end: '12:20' },
    ],
  },
  {
    id: 'course_startup',
    name: 'Entrepreneurship',
    code: 'BUS 250',
    instructor: 'Prof. Hale',
    location: 'Business 110',
    color: 'yellow',
    thumbnail: 'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=400&h=400&fit=crop',
    description:
      'Test product ideas, talk to users, and turn a campus project into something people actually want.',
    tags: ['business', 'career', 'product', 'startup'],
    popularity: 82,
    enrolled: false,
    meetings: [{ id: 'm19', day: 5, start: '14:00', end: '16:00' }],
  },
  {
    id: 'course_music',
    name: 'Music Production',
    code: 'MUS 180',
    instructor: 'Mr. Diaz',
    location: 'Arts Annex',
    color: 'pink',
    thumbnail: 'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=400&h=400&fit=crop',
    description:
      'Arrange, mix, and finish original tracks with a practical studio-and-laptop workflow.',
    tags: ['art', 'creative', 'music', 'audio'],
    popularity: 79,
    enrolled: false,
    meetings: [{ id: 'm20', day: 4, start: '16:00', end: '18:30' }],
  },
]

export function isEnrolled(course: Course) {
  return course.enrolled !== false
}

export function mergeCatalog(courses: Course[]): Course[] {
  const byId = new Map(courses.map((course) => [course.id, course]))
  const catalogIds = new Set(CATALOG_COURSES.map((course) => course.id))

  const mergedCatalog = CATALOG_COURSES.map((catalogCourse) => {
    const existing = byId.get(catalogCourse.id)
    if (!existing) return catalogCourse
    return {
      ...catalogCourse,
      ...existing,
      description: existing.description || catalogCourse.description,
      tags: existing.tags?.length ? existing.tags : catalogCourse.tags,
      popularity: existing.popularity ?? catalogCourse.popularity,
      enrolled: existing.enrolled ?? catalogCourse.enrolled,
      thumbnail: existing.thumbnail || catalogCourse.thumbnail,
    }
  })

  const extras = courses
    .filter((course) => !catalogIds.has(course.id))
    .map((course) => ({ ...course, enrolled: course.enrolled ?? true }))

  return [...mergedCatalog, ...extras]
}

export function getTrendingCourses(courses: Course[], limit = 6) {
  return [...courses]
    .sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0))
    .slice(0, limit)
}

export function getRecommendedCourses(courses: Course[], limit = 6) {
  const enrolled = courses.filter(isEnrolled)
  const enrolledTags = new Set(enrolled.flatMap((course) => course.tags ?? []))
  const enrolledIds = new Set(enrolled.map((course) => course.id))

  const scored = courses
    .filter((course) => !enrolledIds.has(course.id))
    .map((course) => {
      const overlap = (course.tags ?? []).filter((tag) => enrolledTags.has(tag)).length
      const score = overlap * 12 + (course.popularity ?? 0)
      return { course, score, overlap }
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)

  const picks = scored.map((item) => item.course)

  if (picks.length < limit) {
    const continueLearning = enrolled
      .slice()
      .sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0))
    for (const course of continueLearning) {
      if (picks.length >= limit) break
      if (!picks.some((item) => item.id === course.id)) picks.push(course)
    }
  }

  if (picks.length < limit) {
    for (const course of getTrendingCourses(courses, courses.length)) {
      if (picks.length >= limit) break
      if (!picks.some((item) => item.id === course.id)) picks.push(course)
    }
  }

  return picks.slice(0, limit)
}
