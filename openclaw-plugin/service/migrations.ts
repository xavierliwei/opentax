/**
 * Database schema versioning and migration framework.
 *
 * Manages incremental schema changes via an ordered list of migrations.
 * Each migration is applied at most once, tracked in a `schema_migrations` table.
 */

import type BetterSqlite3 from 'better-sqlite3'
import { logger } from '../utils/logger.ts'

const log = logger.child({ component: 'migrations' })

// ── Migration definition ────────────────────────────────────────────

export interface Migration {
  version: number
  description: string
  up: (db: BetterSqlite3.Database) => void
}

// ── Built-in migrations ─────────────────────────────────────────────

export const migrations: Migration[] = [
  {
    version: 1,
    description: 'Create tax_returns table',
    up(db) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS tax_returns (
          id         TEXT PRIMARY KEY DEFAULT 'current',
          data       TEXT NOT NULL,
          version    INTEGER NOT NULL DEFAULT 0,
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
      `)
    },
  },
  {
    version: 2,
    description: 'Add index on tax_returns.updated_at',
    up(db) {
      db.exec(
        `CREATE INDEX IF NOT EXISTS idx_tax_returns_updated_at ON tax_returns(updated_at)`,
      )
    },
  },
]

// ── Public API ──────────────────────────────────────────────────────

/**
 * Returns the current schema version (max applied version), or 0 if no
 * migrations have been recorded yet.
 */
export function getCurrentVersion(db: BetterSqlite3.Database): number {
  const row = db
    .prepare(
      `SELECT MAX(version) AS v FROM schema_migrations`,
    )
    .get() as { v: number | null } | undefined
  return row?.v ?? 0
}

/**
 * Ensures the `schema_migrations` tracking table exists, then applies all
 * pending migrations in order inside a single transaction.
 */
export function runMigrations(db: BetterSqlite3.Database): void {
  // Create tracking table outside the migration transaction so we can
  // query it to determine which migrations are pending.
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version     INTEGER PRIMARY KEY,
      applied_at  TEXT NOT NULL DEFAULT (datetime('now')),
      description TEXT
    )
  `)

  const currentVersion = getCurrentVersion(db)
  const pending = migrations.filter((m) => m.version > currentVersion)

  if (pending.length === 0) {
    log.debug('Schema is up to date', { version: currentVersion })
    return
  }

  // Sort ascending to guarantee order
  pending.sort((a, b) => a.version - b.version)

  const insertMigration = db.prepare(
    `INSERT INTO schema_migrations (version, description) VALUES (?, ?)`,
  )

  const applyAll = db.transaction(() => {
    for (const m of pending) {
      log.info('Applying migration', { version: m.version, description: m.description })
      m.up(db)
      insertMigration.run(m.version, m.description)
    }
  })

  applyAll()

  log.info('Migrations complete', {
    from: currentVersion,
    to: pending[pending.length - 1].version,
    applied: pending.length,
  })
}
