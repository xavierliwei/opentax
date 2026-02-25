import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import Database from 'better-sqlite3'
import { runMigrations, getCurrentVersion, migrations } from '../../openclaw-plugin/service/migrations.ts'

// ── Helpers ──────────────────────────────────────────────────────

let tmpDir: string
let db: InstanceType<typeof Database>

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'opentax-mig-test-'))
  db = new Database(join(tmpDir, 'test.db'))
  db.pragma('journal_mode = WAL')
})

afterEach(() => {
  db.close()
  rmSync(tmpDir, { recursive: true, force: true })
})

// ── Tests ────────────────────────────────────────────────────────

describe('migrations', () => {
  describe('runMigrations', () => {
    it('creates the schema_migrations table', () => {
      runMigrations(db)

      const row = db
        .prepare(
          `SELECT name FROM sqlite_master WHERE type='table' AND name='schema_migrations'`,
        )
        .get() as { name: string } | undefined

      expect(row).toBeDefined()
      expect(row!.name).toBe('schema_migrations')
    })

    it('migration 1 creates the tax_returns table', () => {
      runMigrations(db)

      const row = db
        .prepare(
          `SELECT name FROM sqlite_master WHERE type='table' AND name='tax_returns'`,
        )
        .get() as { name: string } | undefined

      expect(row).toBeDefined()
      expect(row!.name).toBe('tax_returns')
    })

    it('migration 2 creates the idx_tax_returns_updated_at index', () => {
      runMigrations(db)

      const row = db
        .prepare(
          `SELECT name FROM sqlite_master WHERE type='index' AND name='idx_tax_returns_updated_at'`,
        )
        .get() as { name: string } | undefined

      expect(row).toBeDefined()
      expect(row!.name).toBe('idx_tax_returns_updated_at')
    })

    it('runs migrations in order', () => {
      runMigrations(db)

      const rows = db
        .prepare(`SELECT version, description FROM schema_migrations ORDER BY version`)
        .all() as { version: number; description: string }[]

      expect(rows).toHaveLength(2)
      expect(rows[0].version).toBe(1)
      expect(rows[0].description).toBe('Create tax_returns table')
      expect(rows[1].version).toBe(2)
      expect(rows[1].description).toBe('Add index on tax_returns.updated_at')
    })

    it('is idempotent: running migrations twice does not error', () => {
      runMigrations(db)
      expect(() => runMigrations(db)).not.toThrow()

      // Version should still be 2 after second run
      expect(getCurrentVersion(db)).toBe(2)

      // schema_migrations should still have exactly 2 rows
      const count = db
        .prepare(`SELECT COUNT(*) AS c FROM schema_migrations`)
        .get() as { c: number }
      expect(count.c).toBe(2)
    })

    it('works on a fresh database with no existing tables', () => {
      // db is already fresh — just run migrations
      expect(() => runMigrations(db)).not.toThrow()
      expect(getCurrentVersion(db)).toBe(2)

      // Verify we can insert into tax_returns (table exists and is usable)
      const stmt = db.prepare(
        `INSERT INTO tax_returns (id, data, version) VALUES (?, ?, ?)`,
      )
      expect(() => stmt.run('test', '{}', 0)).not.toThrow()
    })

    it('is safe on a database that already has tax_returns', () => {
      // Manually create tax_returns before running migrations
      db.exec(`
        CREATE TABLE tax_returns (
          id         TEXT PRIMARY KEY DEFAULT 'current',
          data       TEXT NOT NULL,
          version    INTEGER NOT NULL DEFAULT 0,
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
      `)
      // Insert a row to verify data is preserved
      db.prepare(
        `INSERT INTO tax_returns (id, data, version) VALUES (?, ?, ?)`,
      ).run('current', '{"taxYear":2025}', 1)

      // Running migrations should not error (CREATE TABLE IF NOT EXISTS)
      expect(() => runMigrations(db)).not.toThrow()
      expect(getCurrentVersion(db)).toBe(2)

      // Existing data should still be there
      const row = db
        .prepare(`SELECT data, version FROM tax_returns WHERE id = ?`)
        .get('current') as { data: string; version: number }
      expect(row.data).toBe('{"taxYear":2025}')
      expect(row.version).toBe(1)
    })

    it('rolls back all migrations in the transaction if one fails', () => {
      // We'll temporarily add a bad migration to the list, run it on a
      // DB that already has migrations 1-2 applied, and verify the
      // failing migration 3 does NOT get recorded.
      const badMigration = {
        version: 3,
        description: 'Intentionally broken migration',
        up(_db: InstanceType<typeof Database>) {
          // This will fail because the table does not exist
          _db.exec(`INSERT INTO nonexistent_table (col) VALUES ('boom')`)
        },
      }

      // First apply the real migrations
      runMigrations(db)
      expect(getCurrentVersion(db)).toBe(2)

      // Push the bad migration temporarily
      migrations.push(badMigration)

      try {
        expect(() => runMigrations(db)).toThrow()
      } finally {
        // Remove the bad migration so other tests aren't affected
        migrations.pop()
      }

      // Version should still be 2 — the transaction rolled back
      expect(getCurrentVersion(db)).toBe(2)

      // No version 3 row should exist
      const row = db
        .prepare(`SELECT version FROM schema_migrations WHERE version = 3`)
        .get()
      expect(row).toBeUndefined()
    })
  })

  describe('getCurrentVersion', () => {
    it('returns 0 when no migrations have been applied', () => {
      // Create schema_migrations table but don't run any migrations
      db.exec(`
        CREATE TABLE schema_migrations (
          version     INTEGER PRIMARY KEY,
          applied_at  TEXT NOT NULL DEFAULT (datetime('now')),
          description TEXT
        )
      `)
      expect(getCurrentVersion(db)).toBe(0)
    })

    it('returns the correct version after migrations', () => {
      runMigrations(db)
      expect(getCurrentVersion(db)).toBe(2)
    })
  })
})
