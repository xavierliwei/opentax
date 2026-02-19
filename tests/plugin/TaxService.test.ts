import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdtempSync, writeFileSync, existsSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import Database from 'better-sqlite3'
import { TaxService } from '../../openclaw-plugin/service/TaxService.ts'
import { emptyTaxReturn } from '../../src/model/types.ts'
import type { W2, Form1099INT, Form1099DIV, CapitalTransaction } from '../../src/model/types.ts'
import { cents } from '../../src/model/traced.ts'
import { STANDARD_DEDUCTION } from '../../src/rules/2025/constants.ts'

// ── Helpers ──────────────────────────────────────────────────────

let workspace: string

beforeEach(() => {
  workspace = mkdtempSync(join(tmpdir(), 'opentax-test-'))
})

afterEach(() => {
  rmSync(workspace, { recursive: true, force: true })
})

function makeW2(overrides: Partial<W2> = {}): W2 {
  return {
    id: 'w2-1',
    employerEin: '12-3456789',
    employerName: 'Acme Corp',
    box1: cents(50000),
    box2: cents(8000),
    box3: cents(50000),
    box4: cents(3100),
    box5: cents(50000),
    box6: cents(725),
    box7: 0,
    box8: 0,
    box10: 0,
    box11: 0,
    box12: [],
    box13StatutoryEmployee: false,
    box13RetirementPlan: false,
    box13ThirdPartySickPay: false,
    box14: '',
    ...overrides,
  }
}

function make1099INT(overrides: Partial<Form1099INT> = {}): Form1099INT {
  return {
    id: '1099int-1',
    payerName: 'First Bank',
    box1: cents(1200),
    box2: 0,
    box3: 0,
    box4: 0,
    box8: 0,
    ...overrides,
  }
}

function make1099DIV(overrides: Partial<Form1099DIV> = {}): Form1099DIV {
  return {
    id: '1099div-1',
    payerName: 'Vanguard',
    box1a: cents(3000),
    box1b: cents(2000),
    box2a: cents(500),
    box3: 0,
    box4: 0,
    box5: 0,
    box11: 0,
    ...overrides,
  }
}

// ── Tests ────────────────────────────────────────────────────────

describe('TaxService', () => {
  describe('construction', () => {
    it('creates fresh state for empty workspace', () => {
      const svc = new TaxService(workspace)
      expect(svc.taxReturn.taxYear).toBe(2025)
      expect(svc.taxReturn.filingStatus).toBe('single')
      expect(svc.taxReturn.w2s).toEqual([])
      expect(svc.stateVersion).toBe(0)
      expect(svc.computeResult).toBeDefined()
      expect(svc.computeResult.form1040.line1a.amount).toBe(0)
    })

    it('loads existing state from file', () => {
      // Create a service, add data, persist
      const svc1 = new TaxService(workspace)
      svc1.addW2(makeW2())
      svc1.persistNow()

      // Create a new service from same workspace
      const svc2 = new TaxService(workspace)
      expect(svc2.taxReturn.w2s).toHaveLength(1)
      expect(svc2.taxReturn.w2s[0].employerName).toBe('Acme Corp')
      expect(svc2.computeResult.form1040.line1a.amount).toBe(cents(50000))
    })

    it('handles corrupted legacy JSON gracefully', () => {
      writeFileSync(join(workspace, 'opentax-state.json'), 'not json')
      const svc = new TaxService(workspace)
      expect(svc.taxReturn.taxYear).toBe(2025)
      expect(svc.taxReturn.w2s).toEqual([])
    })

    it('migrates legacy JSON into SQLite', () => {
      const tr = emptyTaxReturn(2025)
      tr.filingStatus = 'mfj'
      writeFileSync(join(workspace, 'opentax-state.json'), JSON.stringify(tr))
      const svc = new TaxService(workspace)
      expect(svc.taxReturn.filingStatus).toBe('mfj')
      // Verify it's in the DB
      const db = new Database(join(workspace, 'opentax.db'), { readonly: true })
      const row = db.prepare('SELECT data FROM tax_returns WHERE id = ?').get('current') as { data: string }
      db.close()
      expect(JSON.parse(row.data).filingStatus).toBe('mfj')
    })
  })

  describe('mutations', () => {
    it('setFilingStatus changes status and recomputes', () => {
      const svc = new TaxService(workspace)
      svc.setFilingStatus('mfj')
      expect(svc.taxReturn.filingStatus).toBe('mfj')
      expect(svc.computeResult.form1040.line12.amount).toBe(STANDARD_DEDUCTION['mfj'])
      expect(svc.stateVersion).toBe(1)
    })

    it('setFilingStatus away from MFJ removes spouse', () => {
      const svc = new TaxService(workspace)
      svc.setFilingStatus('mfj')
      svc.setSpouse({ firstName: 'Jane', lastName: 'Doe', ssn: '987654321' })
      expect(svc.taxReturn.spouse).toBeDefined()
      svc.setFilingStatus('single')
      expect(svc.taxReturn.spouse).toBeUndefined()
    })

    it('setTaxpayer updates taxpayer with address merge', () => {
      const svc = new TaxService(workspace)
      svc.setTaxpayer({ firstName: 'John', lastName: 'Doe' })
      expect(svc.taxReturn.taxpayer.firstName).toBe('John')
      expect(svc.taxReturn.taxpayer.lastName).toBe('Doe')

      svc.setTaxpayer({ address: { street: '123 Main St', city: 'Springfield', state: 'IL', zip: '62701' } })
      expect(svc.taxReturn.taxpayer.address.street).toBe('123 Main St')
      expect(svc.taxReturn.taxpayer.firstName).toBe('John') // preserved
    })

    it('setSpouse creates new spouse when none exists', () => {
      const svc = new TaxService(workspace)
      svc.setSpouse({ firstName: 'Jane', lastName: 'Smith', ssn: '111223333' })
      expect(svc.taxReturn.spouse).toBeDefined()
      expect(svc.taxReturn.spouse!.firstName).toBe('Jane')
    })

    it('removeSpouse removes spouse', () => {
      const svc = new TaxService(workspace)
      svc.setSpouse({ firstName: 'Jane' })
      svc.removeSpouse()
      expect(svc.taxReturn.spouse).toBeUndefined()
    })

    it('addDependent / removeDependent works', () => {
      const svc = new TaxService(workspace)
      svc.addDependent({ firstName: 'Kid', lastName: 'Doe', ssn: '111111111', relationship: 'son', monthsLived: 12 })
      expect(svc.taxReturn.dependents).toHaveLength(1)
      svc.removeDependent(0)
      expect(svc.taxReturn.dependents).toHaveLength(0)
    })

    it('updateDependent updates at index', () => {
      const svc = new TaxService(workspace)
      svc.addDependent({ firstName: 'Kid', lastName: 'Doe', ssn: '111111111', relationship: 'son', monthsLived: 12 })
      svc.updateDependent(0, { firstName: 'Updated' })
      expect(svc.taxReturn.dependents[0].firstName).toBe('Updated')
      expect(svc.taxReturn.dependents[0].lastName).toBe('Doe') // preserved
    })

    it('addW2 adds and recomputes wages', () => {
      const svc = new TaxService(workspace)
      svc.addW2(makeW2())
      expect(svc.taxReturn.w2s).toHaveLength(1)
      expect(svc.computeResult.form1040.line1a.amount).toBe(cents(50000))
      expect(svc.computeResult.form1040.line25.amount).toBe(cents(8000))
    })

    it('updateW2 modifies existing W-2', () => {
      const svc = new TaxService(workspace)
      svc.addW2(makeW2())
      svc.updateW2('w2-1', { box1: cents(75000) })
      expect(svc.taxReturn.w2s[0].box1).toBe(cents(75000))
      expect(svc.computeResult.form1040.line1a.amount).toBe(cents(75000))
    })

    it('removeW2 removes and recomputes', () => {
      const svc = new TaxService(workspace)
      svc.addW2(makeW2())
      svc.removeW2('w2-1')
      expect(svc.taxReturn.w2s).toHaveLength(0)
      expect(svc.computeResult.form1040.line1a.amount).toBe(0)
    })

    it('removeW2 with nonexistent ID is safe', () => {
      const svc = new TaxService(workspace)
      svc.addW2(makeW2())
      svc.removeW2('nonexistent')
      expect(svc.taxReturn.w2s).toHaveLength(1) // unchanged
    })

    it('addForm1099INT recomputes line2b', () => {
      const svc = new TaxService(workspace)
      svc.addForm1099INT(make1099INT())
      expect(svc.taxReturn.form1099INTs).toHaveLength(1)
      expect(svc.computeResult.form1040.line2b.amount).toBe(cents(1200))
    })

    it('addForm1099DIV recomputes line3a/3b', () => {
      const svc = new TaxService(workspace)
      svc.addForm1099DIV(make1099DIV())
      expect(svc.computeResult.form1040.line3a.amount).toBe(cents(2000))
      expect(svc.computeResult.form1040.line3b.amount).toBe(cents(3000))
    })

    it('setCapitalTransactions recomputes line7', () => {
      const svc = new TaxService(workspace)
      const txn: CapitalTransaction = {
        id: 'tx-1',
        description: 'AAPL',
        dateAcquired: '2024-01-15',
        dateSold: '2025-06-20',
        proceeds: cents(15000),
        reportedBasis: cents(10000),
        adjustedBasis: cents(10000),
        adjustmentCode: null,
        adjustmentAmount: 0,
        gainLoss: cents(5000),
        washSaleLossDisallowed: 0,
        longTerm: true,
        category: 'D',
        source1099BId: 'b-1',
      }
      svc.setCapitalTransactions([txn])
      expect(svc.computeResult.form1040.line7.amount).toBe(cents(5000))
    })

    it('setDeductionMethod switches method', () => {
      const svc = new TaxService(workspace)
      svc.setDeductionMethod('itemized')
      expect(svc.taxReturn.deductions.method).toBe('itemized')
    })

    it('setItemizedDeductions sets deduction values', () => {
      const svc = new TaxService(workspace)
      svc.setItemizedDeductions({ stateLocalIncomeTaxes: cents(12000), charitableCash: cents(5000) })
      expect(svc.taxReturn.deductions.itemized!.stateLocalIncomeTaxes).toBe(cents(12000))
      expect(svc.taxReturn.deductions.itemized!.charitableCash).toBe(cents(5000))
      expect(svc.taxReturn.deductions.itemized!.medicalExpenses).toBe(0) // default
    })
  })

  describe('events', () => {
    it('emits stateChanged on every mutation', () => {
      const svc = new TaxService(workspace)
      const events: number[] = []
      svc.on('stateChanged', ({ stateVersion }) => events.push(stateVersion))

      svc.setFilingStatus('mfj')
      svc.addW2(makeW2())
      svc.removeW2('w2-1')

      expect(events).toEqual([1, 2, 3])
    })

    it('stateChanged payload includes taxReturn and computeResult', () => {
      const svc = new TaxService(workspace)
      let payload: any = null
      svc.on('stateChanged', (p) => { payload = p })

      svc.addW2(makeW2())
      expect(payload).not.toBeNull()
      expect(payload.taxReturn.w2s).toHaveLength(1)
      expect(payload.computeResult.form1040.line1a.amount).toBe(cents(50000))
      expect(payload.stateVersion).toBe(1)
    })
  })

  describe('persistence', () => {
    it('persistNow writes to SQLite', () => {
      const svc = new TaxService(workspace)
      svc.addW2(makeW2())
      svc.persistNow()
      const db = new Database(join(workspace, 'opentax.db'), { readonly: true })
      const row = db.prepare('SELECT data, version FROM tax_returns WHERE id = ?').get('current') as { data: string; version: number }
      db.close()
      const data = JSON.parse(row.data)
      expect(data.w2s).toHaveLength(1)
      expect(row.version).toBe(1)
    })

    it('round-trip: mutate → persist → reload matches', () => {
      const svc1 = new TaxService(workspace)
      svc1.setFilingStatus('hoh')
      svc1.addW2(makeW2({ id: 'w2-rt', box1: cents(80000), box2: cents(15000) }))
      svc1.addForm1099INT(make1099INT())
      svc1.persistNow()

      const svc2 = new TaxService(workspace)
      expect(svc2.taxReturn.filingStatus).toBe('hoh')
      expect(svc2.taxReturn.w2s).toHaveLength(1)
      expect(svc2.taxReturn.w2s[0].box1).toBe(cents(80000))
      expect(svc2.taxReturn.form1099INTs).toHaveLength(1)
      expect(svc2.computeResult.form1040.line1a.amount).toBe(cents(80000))
    })

    it('debounced persist fires after delay', async () => {
      vi.useFakeTimers()
      const svc = new TaxService(workspace)
      svc.addW2(makeW2())
      // DB exists (created on construction) but version should still be 0
      const db = new Database(join(workspace, 'opentax.db'), { readonly: true })
      const before = db.prepare('SELECT version FROM tax_returns WHERE id = ?').get('current') as { version: number } | undefined
      expect(before).toBeUndefined() // no row persisted yet
      db.close()
      vi.advanceTimersByTime(600)
      const db2 = new Database(join(workspace, 'opentax.db'), { readonly: true })
      const after = db2.prepare('SELECT version FROM tax_returns WHERE id = ?').get('current') as { version: number }
      db2.close()
      expect(after.version).toBe(1)
      vi.useRealTimers()
    })
  })

  describe('importReturn / resetReturn', () => {
    it('importReturn replaces state', () => {
      const svc = new TaxService(workspace)
      const tr = emptyTaxReturn(2025)
      tr.filingStatus = 'hoh'
      tr.w2s = [makeW2({ id: 'imported', box1: cents(90000) })]
      svc.importReturn(tr)
      expect(svc.taxReturn.filingStatus).toBe('hoh')
      expect(svc.computeResult.form1040.line1a.amount).toBe(cents(90000))
    })

    it('resetReturn clears to empty', () => {
      const svc = new TaxService(workspace)
      svc.addW2(makeW2())
      svc.resetReturn()
      expect(svc.taxReturn.w2s).toHaveLength(0)
      expect(svc.computeResult.form1040.line1a.amount).toBe(0)
    })
  })

  describe('edge cases', () => {
    it('removeSpouse when none exists', () => {
      const svc = new TaxService(workspace)
      expect(svc.taxReturn.spouse).toBeUndefined()
      svc.removeSpouse()
      expect(svc.taxReturn.spouse).toBeUndefined()
    })

    it('multiple W-2s sum correctly', () => {
      const svc = new TaxService(workspace)
      svc.addW2(makeW2({ id: 'w2-a', box1: cents(50000), box2: cents(8000) }))
      svc.addW2(makeW2({ id: 'w2-b', box1: cents(30000), box2: cents(4000) }))
      expect(svc.computeResult.form1040.line1a.amount).toBe(cents(80000))
      expect(svc.computeResult.form1040.line25.amount).toBe(cents(12000))
    })
  })
})
