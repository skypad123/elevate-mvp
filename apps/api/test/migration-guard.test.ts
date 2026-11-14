import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { migrationsFolder } from '@elevate/db'
import { describe, expect, it } from 'vitest'

/**
 * Reads the generated `init` migration as text. It guards two things a regenerated migration could
 * lose without any other test noticing: the extension lines added by `packages/db/scripts/
 * generate.ts`, and the rule that courses, payments and course media belong to a profile, not to
 * a user.
 */
const initFolders = readdirSync(migrationsFolder, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && entry.name.endsWith('_init'))
  .map((entry) => entry.name)
const sql =
  initFolders.length === 1
    ? readFileSync(join(migrationsFolder, initFolders[0] as string, 'migration.sql'), 'utf8')
    : ''

/** `table.column` → the table its foreign key points at. */
const foreignKeys = new Map<string, string>()
for (const match of sql.matchAll(
  /ALTER TABLE "(\w+)" ADD CONSTRAINT "[^"]+" FOREIGN KEY \("(\w+)"\) REFERENCES "(\w+)"\("\w+"\)/g,
)) {
  foreignKeys.set(`${match[1]}.${match[2]}`, match[3] as string)
}

function createTable(table: string): string {
  const start = sql.indexOf(`CREATE TABLE "${table}" (`)
  if (start === -1) return ''
  return sql.slice(start, sql.indexOf('\n);', start))
}

describe('init migration', () => {
  it('is the only init migration', () => {
    expect(initFolders).toHaveLength(1)
    expect(sql.length).toBeGreaterThan(0)
  })

  it('creates the extensions the schema needs before any table', () => {
    const firstTable = sql.indexOf('CREATE TABLE')
    for (const extension of ['citext', 'pg_trgm']) {
      const at = sql.search(new RegExp(`^CREATE EXTENSION IF NOT EXISTS ${extension};`, 'm'))
      expect(at, extension).toBeGreaterThanOrEqual(0)
      expect(at, extension).toBeLessThan(firstTable)
    }
  })

  it('ties courses, payments and course media to profiles, never to users', () => {
    expect(foreignKeys.get('courses.profile_id')).toBe('profiles')
    expect(foreignKeys.get('payments.profile_id')).toBe('profiles')
    expect(foreignKeys.get('payments.payout_account_id')).toBe('payout_accounts')
    expect(foreignKeys.get('media_assets.profile_id')).toBe('profiles')
  })

  it('has no teacher column left on courses or payments', () => {
    expect(createTable('courses')).toContain('"profile_id" uuid NOT NULL')
    expect(createTable('payments')).toContain('"payout_account_id" uuid NOT NULL')
    expect(createTable('courses')).not.toContain('teacher_id')
    expect(createTable('payments')).not.toContain('teacher_id')
    expect(sql).not.toContain('teacher_profiles')
  })

  it('still points the reviewer and the learner at users', () => {
    // These two are correct as they are, and are here so the guard above is not read as "no
    // foreign key to users".
    expect(foreignKeys.get('courses.reviewed_by')).toBe('users')
    expect(foreignKeys.get('payments.user_id')).toBe('users')
  })

  it('gives every profile one required owner and at most one personal profile per owner', () => {
    expect(createTable('profiles')).toContain('"owner_user_id" uuid NOT NULL')
    expect(foreignKeys.get('profiles.owner_user_id')).toBe('users')
    expect(sql).toMatch(
      /CREATE UNIQUE INDEX "profiles_one_personal_per_owner" ON "profiles" \("owner_user_id"\) WHERE "type" = 'personal'/,
    )
  })

  it('backs every corporate profile, and only those, with one registered company', () => {
    expect(foreignKeys.get('profiles.legal_entity_id')).toBe('legal_entities')
    // one company backs one profile, and one UEN is one company
    expect(createTable('profiles')).toContain('"legal_entity_id" uuid UNIQUE')
    expect(createTable('legal_entities')).toContain('"uen" text NOT NULL UNIQUE')
    expect(createTable('profiles')).toContain(
      `CONSTRAINT "profiles_corporate_has_legal_entity" CHECK (("type" = 'corporate') = ("legal_entity_id" is not null))`,
    )
  })
})
