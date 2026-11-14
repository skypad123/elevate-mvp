import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * The learner-read guard.
 *
 * `lessons`, `artefacts`, `quizzes` and `lesson_prerequisites` hold a writer's draft rows beside
 * the live ones. Learner-facing code must never read them directly: it reads the live views,
 * through `learnerDb`, whose relation keys are `liveLessons`, `liveArtefacts`, `liveQuiz` and
 * `livePrerequisites`. The types do not enforce that, because any service can still build a
 * query on a raw table, so this test reads the source instead.
 *
 * Only the two files that manage drafts may touch the raw tables. Every other file under
 * `apps/api/src` fails if it:
 * - imports a content table by name from `@elevate/db` (rule "import");
 * - refers to one as `s.lessons`, `s.artefacts`, `s.quizzes` or `s.lessonPrerequisites` (rule
 *   "table");
 * - uses a raw relation key (`lessons:`, `artefacts:`, `quiz:`, `prerequisites:`) inside the
 *   `with:` of a relational query (rule "relation").
 */
const SRC = fileURLToPath(new URL('../src', import.meta.url))
const ALLOWED = new Set(['services/courses.service.ts', 'services/change-sets.service.ts'])

const TABLES = '(?:lessons|artefacts|quizzes|lessonPrerequisites)'
const NAMED_IMPORT = new RegExp(
  `import\\s+(?:type\\s+)?\\{[^}]*\\b${TABLES}\\b[^}]*\\}\\s*from\\s*['"]@elevate/db(?:/schema)?['"]`,
)
const TABLE_REFERENCE = new RegExp(`\\bs\\.${TABLES}\\b`)
const RAW_RELATION_KEY = /\b(?:lessons|artefacts|quiz|prerequisites)\s*:/

type Rule = 'import' | 'table' | 'relation'

/** The text of every `with: { ... }` block, including the blocks nested inside it. */
function withBlocks(source: string): string[] {
  const blocks: string[] = []
  for (const match of source.matchAll(/\bwith\s*:\s*\{/g)) {
    const start = (match.index ?? 0) + match[0].length
    let depth = 1
    let end = start
    while (end < source.length && depth > 0) {
      const char = source[end]
      if (char === '{') depth++
      else if (char === '}') depth--
      end++
    }
    blocks.push(source.slice(start, end - 1))
  }
  return blocks
}

function violations(source: string): Rule[] {
  // Comments describe these tables freely; only code counts.
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  const found: Rule[] = []
  if (NAMED_IMPORT.test(code)) found.push('import')
  if (TABLE_REFERENCE.test(code)) found.push('table')
  if (withBlocks(code).some((block) => RAW_RELATION_KEY.test(block))) found.push('relation')
  return found
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return sourceFiles(path)
    return entry.name.endsWith('.ts') ? [path] : []
  })
}

describe('learner-read guard', () => {
  it('finds no raw read of course content outside the two files that manage drafts', () => {
    const files = sourceFiles(SRC)
    // If the folder moved, an empty list would pass for the wrong reason.
    expect(files.length).toBeGreaterThan(40)
    const offenders = files
      .map((path) => ({ file: relative(SRC, path), rules: violations(readFileSync(path, 'utf8')) }))
      .filter(({ file, rules }) => !ALLOWED.has(file) && rules.length > 0)
    expect(offenders).toEqual([])
  })

  it('does fire: the two allowed files and the fixture break the rules', () => {
    for (const file of ALLOWED) {
      expect(violations(readFileSync(join(SRC, file), 'utf8')), file).not.toEqual([])
    }
    const fixture = readFileSync(
      fileURLToPath(new URL('./fixtures/raw-content-read.ts.txt', import.meta.url)),
      'utf8',
    )
    expect(violations(fixture)).toEqual(['import', 'table', 'relation'])
  })

  it('fires on each rule alone, and not on the learner keys or on words in comments', () => {
    expect(violations(`import { lessons } from '@elevate/db'`)).toEqual(['import'])
    expect(violations(`import type { quizzes } from '@elevate/db/schema'`)).toEqual(['import'])
    expect(violations('db.select().from(s.artefacts)')).toEqual(['table'])
    expect(violations('db.delete(s.lessonPrerequisites)')).toEqual(['table'])
    expect(violations('findFirst({ with: { course: { with: { lessons: true } } } })')).toEqual([
      'relation',
    ])
    expect(violations('findFirst({ with: { liveArtefacts: { with: { quiz: true } } } })')).toEqual([
      'relation',
    ])

    // the learner relations' keys, the progress and attempt tables, and the live views pass
    const fine = `
      import { schema as s } from '@elevate/db'
      // s.lessons is only mentioned here, in a comment
      db.query.enrollments.findFirst({
        with: {
          course: { with: { liveLessons: { with: { livePrerequisites: true, liveArtefacts: { with: { liveQuiz: true } } } } } },
          progress: true,
        },
      })
      db.insert(s.artefactProgress); db.insert(s.quizAttempts); db.select().from(s.liveLessons)
      const view = { lessons: [], artefacts: [], quiz: null, prerequisites: [] }
    `
    expect(violations(fine)).toEqual([])
  })
})
