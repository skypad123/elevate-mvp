import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * The attendance-record guard (docs/designs/scheduled-classes-attendance.md, "The API's database
 * user"). The database refuses the API an update or delete of an attendance row; this test reads
 * the source so a pull request that tries one fails before it reaches the database.
 *
 * Every file under `apps/api/src` fails if it:
 * - inserts into `attendanceEvents` or `attendanceEventLocations`, other than
 *   `services/attendance.service.ts`, the one writer (rule "insert");
 * - calls `update` or `delete` on `attendanceEvents` (rule "change");
 * - deletes from `attendanceEventLocations`, other than the writer, whose Support erasure of one
 *   learner's coordinates is the only delete (rule "erase");
 * - sets `classId` in an insert into, or an update of, `enrollments`: no route creates a class
 *   enrollment (rule "class enrollment").
 */
const SRC = fileURLToPath(new URL('../src', import.meta.url))
const WRITER = 'services/attendance.service.ts'

type Rule = 'insert' | 'change' | 'erase' | 'class enrollment'

const INSERT = /\.insert\(\s*(?:s\.)?attendanceEvent(?:s|Locations)\b/
const CHANGE = /\.(?:update|delete)\(\s*(?:s\.)?attendanceEvents\b/
const ERASE = /\.delete\(\s*(?:s\.)?attendanceEventLocations\b/
const ENROLLMENT_WRITE = /\.(?:insert|update)\(\s*(?:s\.)?enrollments\s*\)/g

/** The text of the object passed to the next `.values(` or `.set(` after `from`. */
function payloadAfter(code: string, from: number): string {
  const call = /\.(?:values|set)\(\s*/g
  call.lastIndex = from
  const match = call.exec(code)
  if (!match) return ''
  let index = match.index + match[0].length
  const open = code[index]
  if (open !== '{' && open !== '[') return code.slice(index, code.indexOf(')', index))
  const start = index
  let depth = 0
  for (; index < code.length; index++) {
    const char = code[index]
    if (char === '{' || char === '[' || char === '(') depth++
    else if (char === '}' || char === ']' || char === ')') depth--
    if (depth === 0) break
  }
  return code.slice(start, index + 1)
}

function violations(source: string, file = ''): Rule[] {
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  const found: Rule[] = []
  if (file !== WRITER && INSERT.test(code)) found.push('insert')
  if (CHANGE.test(code)) found.push('change')
  if (file !== WRITER && ERASE.test(code)) found.push('erase')
  for (const match of code.matchAll(ENROLLMENT_WRITE)) {
    if (/\bclassId\b/.test(payloadAfter(code, (match.index ?? 0) + match[0].length))) {
      found.push('class enrollment')
      break
    }
  }
  return found
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return sourceFiles(path)
    return entry.name.endsWith('.ts') ? [path] : []
  })
}

describe('attendance-record guard', () => {
  it('finds no other writer of attendance rows, no change to one, no other erasure, and no class enrollment made', () => {
    const files = sourceFiles(SRC)
    expect(files.length).toBeGreaterThan(40)
    const offenders = files
      .map((path) => {
        const file = relative(SRC, path)
        return { file, rules: violations(readFileSync(path, 'utf8'), file) }
      })
      .filter(({ rules }) => rules.length > 0)
    expect(offenders).toEqual([])
    // the writer, and the one erasure, are where the guard expects them
    const writer = readFileSync(join(SRC, WRITER), 'utf8')
    expect(INSERT.test(writer)).toBe(true)
    expect(ERASE.test(writer)).toBe(true)
  })

  it('fires on each rule, and not on reads or on words in comments', () => {
    expect(violations('tx.insert(s.attendanceEvents).values(v)', 'services/other.ts')).toEqual([
      'insert',
    ])
    expect(violations('db.insert(attendanceEventLocations).values(v)', 'x.ts')).toEqual(['insert'])
    expect(violations('tx.insert(s.attendanceEvents).values(v)', WRITER)).toEqual([])
    expect(violations('db.update(s.attendanceEvents).set({ reason: null })', WRITER)).toEqual([
      'change',
    ])
    expect(violations('db.delete(attendanceEvents).where(w)', 'x.ts')).toEqual(['change'])
    expect(violations('tx.delete(s.attendanceEventLocations).where(w)', 'x.ts')).toEqual(['erase'])
    expect(violations('tx.delete(s.attendanceEventLocations).where(w)', WRITER)).toEqual([])
    expect(
      violations(
        'db.insert(s.enrollments).values({ userId, courseId, classId: id, status })',
        'x.ts',
      ),
    ).toEqual(['class enrollment'])
    expect(violations('tx.update(s.enrollments).set({ classId }).where(eq(a, b))', 'x.ts')).toEqual(
      ['class enrollment'],
    )

    const fine = `
      // db.insert(s.attendanceEvents) is only mentioned here
      db.query.attendanceEvents.findMany({ where: { classId } })
      // db.delete(s.attendanceEventLocations) is only mentioned here
      db.query.attendanceEventLocations.findMany({ where: { eventId } })
      db.insert(s.enrollments).values({ userId, courseId, status: 'active' })
      db.update(s.enrollments).set({ status: 'active' }).where(eq(s.enrollments.classId, x))
    `
    expect(violations(fine, 'x.ts')).toEqual([])
  })
})
