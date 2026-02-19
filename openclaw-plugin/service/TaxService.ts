/**
 * TaxService — headless tax return service for the OpenClaw plugin.
 *
 * Mirrors the Zustand store mutation patterns but runs in Node.js.
 * Extends EventEmitter to notify HTTP/SSE consumers of state changes.
 * Persists state to SQLite via better-sqlite3 for atomic, durable writes.
 */

import { EventEmitter } from 'node:events'
import { readFileSync, existsSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import Database from 'better-sqlite3'
import type BetterSqlite3 from 'better-sqlite3'
import { emptyTaxReturn } from '../../src/model/types.ts'
import type {
  TaxReturn,
  FilingStatus,
  W2,
  Form1099INT,
  Form1099DIV,
  CapitalTransaction,
  Taxpayer,
  Dependent,
  RSUVestEvent,
  ItemizedDeductions,
} from '../../src/model/types.ts'
import { computeAll } from '../../src/rules/engine.ts'
import type { ComputeResult } from '../../src/rules/engine.ts'

const DB_FILE = 'opentax.db'
const LEGACY_STATE_FILE = 'opentax-state.json'
const PERSIST_DELAY = 500

export class TaxService extends EventEmitter {
  taxReturn: TaxReturn
  computeResult: ComputeResult
  stateVersion: number

  private workspace: string
  private db: BetterSqlite3.Database
  private upsertStmt: BetterSqlite3.Statement
  private persistTimer: ReturnType<typeof setTimeout> | null = null

  constructor(workspace: string) {
    super()
    this.workspace = workspace
    this.stateVersion = 0

    // Ensure workspace directory exists
    if (!existsSync(workspace)) mkdirSync(workspace, { recursive: true })

    // Open/create SQLite database
    const dbPath = join(workspace, DB_FILE)
    this.db = new Database(dbPath)
    this.db.pragma('journal_mode = WAL')

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS tax_returns (
        id         TEXT PRIMARY KEY DEFAULT 'current',
        data       TEXT NOT NULL,
        version    INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `)

    // Prepare upsert statement
    this.upsertStmt = this.db.prepare(`
      INSERT OR REPLACE INTO tax_returns (id, data, version, updated_at)
      VALUES ('current', ?, ?, datetime('now'))
    `)

    // Migrate from legacy JSON file if it exists and DB is empty
    const legacyPath = join(workspace, LEGACY_STATE_FILE)
    const row = this.db.prepare('SELECT data, version FROM tax_returns WHERE id = ?').get('current') as
      | { data: string; version: number }
      | undefined

    if (!row && existsSync(legacyPath)) {
      try {
        const raw = readFileSync(legacyPath, 'utf-8')
        const parsed = JSON.parse(raw) as TaxReturn
        this.upsertStmt.run(JSON.stringify(parsed), 0)
        this.taxReturn = parsed
        console.log(`[TaxService] Migrated state from ${LEGACY_STATE_FILE} into SQLite`)
      } catch {
        this.taxReturn = emptyTaxReturn(2025)
      }
    } else if (row) {
      try {
        this.taxReturn = JSON.parse(row.data) as TaxReturn
        this.stateVersion = row.version
      } catch {
        this.taxReturn = emptyTaxReturn(2025)
      }
    } else {
      this.taxReturn = emptyTaxReturn(2025)
    }

    this.computeResult = computeAll(this.taxReturn)
  }

  // ── Core mutation helper ────────────────────────────────────────

  private apply(taxReturn: TaxReturn): void {
    this.taxReturn = taxReturn
    this.computeResult = computeAll(taxReturn)
    this.stateVersion++
    this.emit('stateChanged', {
      taxReturn: this.taxReturn,
      computeResult: this.computeResult,
      stateVersion: this.stateVersion,
    })
    this.schedulePersist()
  }

  private schedulePersist(): void {
    if (this.persistTimer) clearTimeout(this.persistTimer)
    this.persistTimer = setTimeout(() => this.persistNow(), PERSIST_DELAY)
  }

  persistNow(): void {
    if (this.persistTimer) {
      clearTimeout(this.persistTimer)
      this.persistTimer = null
    }
    this.upsertStmt.run(JSON.stringify(this.taxReturn), this.stateVersion)
  }

  close(): void {
    this.persistNow()
    this.db.close()
  }

  // ── Filing status ──────────────────────────────────────────────

  setFilingStatus(status: FilingStatus): void {
    const tr = { ...this.taxReturn, filingStatus: status }
    if (status !== 'mfj' && this.taxReturn.filingStatus === 'mfj') {
      delete tr.spouse
    }
    this.apply(tr)
  }

  // ── Taxpayer ───────────────────────────────────────────────────

  setTaxpayer(updates: Partial<Taxpayer>): void {
    const prev = this.taxReturn
    const tr = {
      ...prev,
      taxpayer: {
        ...prev.taxpayer,
        ...updates,
        address: { ...prev.taxpayer.address, ...(updates.address ?? {}) },
      },
    }
    this.apply(tr)
  }

  // ── Spouse ─────────────────────────────────────────────────────

  setSpouse(updates: Partial<Taxpayer>): void {
    const prev = this.taxReturn
    const existing = prev.spouse ?? {
      firstName: '',
      lastName: '',
      ssn: '',
      address: { street: '', city: '', state: '', zip: '' },
    }
    const tr = {
      ...prev,
      spouse: {
        ...existing,
        ...updates,
        address: { ...existing.address, ...(updates.address ?? {}) },
      },
    }
    this.apply(tr)
  }

  removeSpouse(): void {
    const { spouse: _, ...rest } = this.taxReturn
    this.apply(rest as TaxReturn)
  }

  // ── Dependents ─────────────────────────────────────────────────

  addDependent(dep: Dependent): void {
    const tr = {
      ...this.taxReturn,
      dependents: [...this.taxReturn.dependents, dep],
    }
    this.apply(tr)
  }

  updateDependent(index: number, updates: Partial<Dependent>): void {
    const tr = {
      ...this.taxReturn,
      dependents: this.taxReturn.dependents.map((d, i) =>
        i === index ? { ...d, ...updates } : d,
      ),
    }
    this.apply(tr)
  }

  removeDependent(index: number): void {
    const tr = {
      ...this.taxReturn,
      dependents: this.taxReturn.dependents.filter((_, i) => i !== index),
    }
    this.apply(tr)
  }

  // ── W-2 ────────────────────────────────────────────────────────

  addW2(w2: W2): void {
    const tr = { ...this.taxReturn, w2s: [...this.taxReturn.w2s, w2] }
    this.apply(tr)
  }

  updateW2(id: string, updates: Partial<W2>): void {
    const tr = {
      ...this.taxReturn,
      w2s: this.taxReturn.w2s.map((w) => (w.id === id ? { ...w, ...updates } : w)),
    }
    this.apply(tr)
  }

  removeW2(id: string): void {
    const tr = {
      ...this.taxReturn,
      w2s: this.taxReturn.w2s.filter((w) => w.id !== id),
    }
    this.apply(tr)
  }

  // ── 1099-INT ───────────────────────────────────────────────────

  addForm1099INT(form: Form1099INT): void {
    const tr = {
      ...this.taxReturn,
      form1099INTs: [...this.taxReturn.form1099INTs, form],
    }
    this.apply(tr)
  }

  updateForm1099INT(id: string, updates: Partial<Form1099INT>): void {
    const tr = {
      ...this.taxReturn,
      form1099INTs: this.taxReturn.form1099INTs.map((f) =>
        f.id === id ? { ...f, ...updates } : f,
      ),
    }
    this.apply(tr)
  }

  removeForm1099INT(id: string): void {
    const tr = {
      ...this.taxReturn,
      form1099INTs: this.taxReturn.form1099INTs.filter((f) => f.id !== id),
    }
    this.apply(tr)
  }

  // ── 1099-DIV ───────────────────────────────────────────────────

  addForm1099DIV(form: Form1099DIV): void {
    const tr = {
      ...this.taxReturn,
      form1099DIVs: [...this.taxReturn.form1099DIVs, form],
    }
    this.apply(tr)
  }

  updateForm1099DIV(id: string, updates: Partial<Form1099DIV>): void {
    const tr = {
      ...this.taxReturn,
      form1099DIVs: this.taxReturn.form1099DIVs.map((f) =>
        f.id === id ? { ...f, ...updates } : f,
      ),
    }
    this.apply(tr)
  }

  removeForm1099DIV(id: string): void {
    const tr = {
      ...this.taxReturn,
      form1099DIVs: this.taxReturn.form1099DIVs.filter((f) => f.id !== id),
    }
    this.apply(tr)
  }

  // ── RSU ────────────────────────────────────────────────────────

  addRSUVestEvent(event: RSUVestEvent): void {
    const tr = {
      ...this.taxReturn,
      rsuVestEvents: [...this.taxReturn.rsuVestEvents, event],
    }
    this.apply(tr)
  }

  removeRSUVestEvent(id: string): void {
    const tr = {
      ...this.taxReturn,
      rsuVestEvents: this.taxReturn.rsuVestEvents.filter((e) => e.id !== id),
    }
    this.apply(tr)
  }

  // ── Capital transactions ───────────────────────────────────────

  setCapitalTransactions(txns: CapitalTransaction[]): void {
    const tr = { ...this.taxReturn, capitalTransactions: txns }
    this.apply(tr)
  }

  // ── Deductions ─────────────────────────────────────────────────

  setDeductionMethod(method: 'standard' | 'itemized'): void {
    const tr = {
      ...this.taxReturn,
      deductions: { ...this.taxReturn.deductions, method },
    }
    this.apply(tr)
  }

  setItemizedDeductions(itemized: Partial<ItemizedDeductions>): void {
    const prev = this.taxReturn
    const existing = prev.deductions.itemized ?? {
      medicalExpenses: 0,
      stateLocalTaxes: 0,
      mortgageInterest: 0,
      charitableCash: 0,
      charitableNoncash: 0,
      otherDeductions: 0,
    }
    const tr = {
      ...prev,
      deductions: {
        ...prev.deductions,
        itemized: { ...existing, ...itemized },
      },
    }
    this.apply(tr)
  }

  // ── Import / Reset ─────────────────────────────────────────────

  importReturn(taxReturn: TaxReturn): void {
    this.apply(taxReturn)
  }

  resetReturn(): void {
    this.apply(emptyTaxReturn(2025))
  }
}
