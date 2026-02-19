/**
 * Education Credits (Form 8863) — AOTC + LLC tests.
 *
 * Tests the computation module and integration via computeForm1040 Lines 20 and 29.
 */

import { describe, it, expect } from 'vitest'
import { cents } from '../../src/model/traced'
import { emptyTaxReturn } from '../../src/model/types'
import type { EducationExpenses, StudentEducationExpense } from '../../src/model/types'
import { computeEducationCredit } from '../../src/rules/2025/educationCredit'
import { computeForm1040 } from '../../src/rules/2025/form1040'
import { makeW2 } from '../fixtures/returns'

// ── Helpers ──────────────────────────────────────────────────────

function makeStudent(overrides: Partial<StudentEducationExpense> = {}): StudentEducationExpense {
  return {
    studentName: 'Test Student',
    creditType: 'aotc',
    qualifiedExpenses: 0,
    isAtLeastHalfTime: true,
    hasCompletedFourYears: false,
    priorYearsAOTCClaimed: 0,
    ...overrides,
  }
}

function makeExpenses(students: StudentEducationExpense[]): EducationExpenses {
  return { students }
}

// ── AOTC unit tests ─────────────────────────────────────────────

describe('AOTC computation', () => {
  it('$4K expenses → $2,500 credit (100% × $2K + 25% × $2K)', () => {
    const result = computeEducationCredit(
      makeExpenses([makeStudent({ qualifiedExpenses: cents(4000) })]),
      'single',
      cents(50000), // MAGI below phase-out
    )
    expect(result.aotcStudents).toHaveLength(1)
    expect(result.aotcStudents[0].rawCredit).toBe(cents(2500))
    expect(result.aotcStudents[0].creditAfterPhaseOut).toBe(cents(2500))
    expect(result.aotcTotalCredit).toBe(cents(2500))
  })

  it('$1K expenses → $1,000 credit', () => {
    const result = computeEducationCredit(
      makeExpenses([makeStudent({ qualifiedExpenses: cents(1000) })]),
      'single',
      cents(50000),
    )
    expect(result.aotcStudents[0].rawCredit).toBe(cents(1000))
  })

  it('$10K expenses → capped at $2,500', () => {
    const result = computeEducationCredit(
      makeExpenses([makeStudent({ qualifiedExpenses: cents(10000) })]),
      'single',
      cents(50000),
    )
    expect(result.aotcStudents[0].rawCredit).toBe(cents(2500))
  })

  it('not half-time → $0 AOTC (student skipped)', () => {
    const result = computeEducationCredit(
      makeExpenses([makeStudent({ qualifiedExpenses: cents(4000), isAtLeastHalfTime: false })]),
      'single',
      cents(50000),
    )
    expect(result.aotcStudents).toHaveLength(0)
    expect(result.aotcTotalCredit).toBe(0)
  })

  it('completed 4 years → $0 AOTC', () => {
    const result = computeEducationCredit(
      makeExpenses([makeStudent({ qualifiedExpenses: cents(4000), hasCompletedFourYears: true })]),
      'single',
      cents(50000),
    )
    expect(result.aotcStudents).toHaveLength(0)
  })

  it('prior years claimed = 4 → $0 AOTC', () => {
    const result = computeEducationCredit(
      makeExpenses([makeStudent({ qualifiedExpenses: cents(4000), priorYearsAOTCClaimed: 4 })]),
      'single',
      cents(50000),
    )
    expect(result.aotcStudents).toHaveLength(0)
  })

  it('multiple students → sum of per-student credits', () => {
    const result = computeEducationCredit(
      makeExpenses([
        makeStudent({ studentName: 'Alice', qualifiedExpenses: cents(4000) }),
        makeStudent({ studentName: 'Bob', qualifiedExpenses: cents(2000) }),
      ]),
      'single',
      cents(50000),
    )
    expect(result.aotcStudents).toHaveLength(2)
    expect(result.aotcStudents[0].rawCredit).toBe(cents(2500)) // Alice: $2K + 25% × $2K
    expect(result.aotcStudents[1].rawCredit).toBe(cents(2000)) // Bob: 100% × $2K
    expect(result.aotcTotalCredit).toBe(cents(4500))
  })

  it('refundable split: 40% refundable, 60% non-refundable', () => {
    const result = computeEducationCredit(
      makeExpenses([makeStudent({ qualifiedExpenses: cents(4000) })]),
      'single',
      cents(50000),
    )
    const student = result.aotcStudents[0]
    expect(student.refundable).toBe(cents(1000))     // 40% of $2,500
    expect(student.nonRefundable).toBe(cents(1500))   // 60% of $2,500
    expect(result.aotcRefundable).toBe(cents(1000))
    expect(result.aotcNonRefundable).toBe(cents(1500))
    expect(result.totalRefundable).toBe(cents(1000))
  })
})

// ── LLC unit tests ──────────────────────────────────────────────

describe('LLC computation', () => {
  it('$5K expenses → $1,000 credit (20%)', () => {
    const result = computeEducationCredit(
      makeExpenses([makeStudent({ creditType: 'llc', qualifiedExpenses: cents(5000) })]),
      'single',
      cents(50000),
    )
    expect(result.llcQualifiedExpenses).toBe(cents(5000))
    expect(result.llcRawCredit).toBe(cents(1000))
    expect(result.llcCreditAfterPhaseOut).toBe(cents(1000))
    expect(result.totalNonRefundable).toBe(cents(1000))
    expect(result.totalRefundable).toBe(0)
  })

  it('multiple students, $8K total → $1,600 credit', () => {
    const result = computeEducationCredit(
      makeExpenses([
        makeStudent({ studentName: 'A', creditType: 'llc', qualifiedExpenses: cents(3000) }),
        makeStudent({ studentName: 'B', creditType: 'llc', qualifiedExpenses: cents(5000) }),
      ]),
      'single',
      cents(50000),
    )
    expect(result.llcQualifiedExpenses).toBe(cents(8000))
    expect(result.llcRawCredit).toBe(cents(1600))
  })

  it('multiple students, $15K total → capped at $10K → $2,000 credit', () => {
    const result = computeEducationCredit(
      makeExpenses([
        makeStudent({ studentName: 'A', creditType: 'llc', qualifiedExpenses: cents(8000) }),
        makeStudent({ studentName: 'B', creditType: 'llc', qualifiedExpenses: cents(7000) }),
      ]),
      'single',
      cents(50000),
    )
    expect(result.llcQualifiedExpenses).toBe(cents(10000))
    expect(result.llcRawCredit).toBe(cents(2000))
    expect(result.llcCreditAfterPhaseOut).toBe(cents(2000))
  })

  it('LLC student has no half-time requirement', () => {
    const result = computeEducationCredit(
      makeExpenses([makeStudent({ creditType: 'llc', qualifiedExpenses: cents(5000), isAtLeastHalfTime: false })]),
      'single',
      cents(50000),
    )
    expect(result.llcRawCredit).toBe(cents(1000))
  })
})

// ── Phase-out tests ─────────────────────────────────────────────

describe('Education credit phase-out', () => {
  it('MAGI below start → full credit', () => {
    const result = computeEducationCredit(
      makeExpenses([makeStudent({ qualifiedExpenses: cents(4000) })]),
      'single',
      cents(79000), // below $80K start
    )
    expect(result.phaseOutApplies).toBe(false)
    expect(result.aotcStudents[0].creditAfterPhaseOut).toBe(cents(2500))
  })

  it('MAGI in range → proportional reduction (single, $85K)', () => {
    const result = computeEducationCredit(
      makeExpenses([makeStudent({ qualifiedExpenses: cents(4000) })]),
      'single',
      cents(85000), // midpoint of $80K–$90K → 50% phase-out
    )
    expect(result.phaseOutApplies).toBe(true)
    expect(result.aotcStudents[0].creditAfterPhaseOut).toBe(cents(1250)) // 50% of $2,500
  })

  it('MAGI above end → $0', () => {
    const result = computeEducationCredit(
      makeExpenses([makeStudent({ qualifiedExpenses: cents(4000) })]),
      'single',
      cents(95000), // above $90K end
    )
    expect(result.aotcStudents[0].creditAfterPhaseOut).toBe(0)
  })

  it('MFS → $0 with mfsIneligible flag', () => {
    const result = computeEducationCredit(
      makeExpenses([makeStudent({ qualifiedExpenses: cents(4000) })]),
      'mfs',
      cents(50000),
    )
    expect(result.mfsIneligible).toBe(true)
    expect(result.aotcStudents).toHaveLength(0)
    expect(result.totalNonRefundable).toBe(0)
    expect(result.totalRefundable).toBe(0)
  })

  it('MFJ MAGI in range → proportional reduction ($170K)', () => {
    const result = computeEducationCredit(
      makeExpenses([makeStudent({ qualifiedExpenses: cents(4000) })]),
      'mfj',
      cents(170000), // midpoint of $160K–$180K → 50% phase-out
    )
    expect(result.phaseOutApplies).toBe(true)
    expect(result.aotcStudents[0].creditAfterPhaseOut).toBe(cents(1250))
  })

  it('LLC also phases out', () => {
    const result = computeEducationCredit(
      makeExpenses([makeStudent({ creditType: 'llc', qualifiedExpenses: cents(10000) })]),
      'single',
      cents(85000), // 50% phase-out
    )
    expect(result.llcRawCredit).toBe(cents(2000))
    expect(result.llcCreditAfterPhaseOut).toBe(cents(1000))
  })
})

// ── Both AOTC and LLC on same return ────────────────────────────

describe('AOTC + LLC on same return', () => {
  it('correctly splits AOTC and LLC students', () => {
    const result = computeEducationCredit(
      makeExpenses([
        makeStudent({ studentName: 'Alice', creditType: 'aotc', qualifiedExpenses: cents(4000) }),
        makeStudent({ studentName: 'Bob', creditType: 'llc', qualifiedExpenses: cents(5000) }),
      ]),
      'single',
      cents(50000),
    )
    expect(result.aotcStudents).toHaveLength(1)
    expect(result.aotcTotalCredit).toBe(cents(2500))
    expect(result.aotcNonRefundable).toBe(cents(1500))
    expect(result.aotcRefundable).toBe(cents(1000))
    expect(result.llcRawCredit).toBe(cents(1000))
    expect(result.llcCreditAfterPhaseOut).toBe(cents(1000))
    expect(result.totalNonRefundable).toBe(cents(2500)) // $1,500 AOTC + $1,000 LLC
    expect(result.totalRefundable).toBe(cents(1000))
  })
})

// ── Integration — computeForm1040 ──────────────────────────────

describe('Education credits in Form 1040', () => {
  it('Line 20 includes non-refundable, Line 29 has refundable', () => {
    const tr = {
      ...emptyTaxReturn(2025),
      filingStatus: 'single' as const,
      w2s: [makeW2({ id: 'w1', employerName: 'Acme', box1: cents(60000), box2: cents(8000) })],
      educationExpenses: makeExpenses([
        makeStudent({ studentName: 'Kid', qualifiedExpenses: cents(4000) }),
      ]),
    }
    const result = computeForm1040(tr)

    // AOTC: $2,500 → $1,500 non-refundable, $1,000 refundable (MAGI $60K, no phase-out)
    expect(result.educationCredit).not.toBeNull()
    expect(result.educationCredit!.aotcTotalCredit).toBe(cents(2500))
    expect(result.line20.amount).toBeGreaterThanOrEqual(cents(1500))
    expect(result.line29.amount).toBe(cents(1000))
  })

  it('no education expenses → Line 29 is $0', () => {
    const tr = {
      ...emptyTaxReturn(2025),
      filingStatus: 'single' as const,
      w2s: [makeW2({ id: 'w1', employerName: 'Acme', box1: cents(60000), box2: cents(8000) })],
    }
    const result = computeForm1040(tr)
    expect(result.educationCredit).toBeNull()
    expect(result.line29.amount).toBe(0)
  })

  it('both AOTC and LLC students → correct split in Line 20 and 29', () => {
    const tr = {
      ...emptyTaxReturn(2025),
      filingStatus: 'single' as const,
      w2s: [makeW2({ id: 'w1', employerName: 'Acme', box1: cents(60000), box2: cents(8000) })],
      educationExpenses: makeExpenses([
        makeStudent({ studentName: 'Alice', creditType: 'aotc', qualifiedExpenses: cents(4000) }),
        makeStudent({ studentName: 'Bob', creditType: 'llc', qualifiedExpenses: cents(10000) }),
      ]),
    }
    const result = computeForm1040(tr)

    // AOTC: $2,500 → $1,500 NR + $1,000 ref
    // LLC: $10K × 20% = $2,000 NR
    expect(result.educationCredit!.totalNonRefundable).toBe(cents(3500))
    expect(result.educationCredit!.totalRefundable).toBe(cents(1000))
    expect(result.line29.amount).toBe(cents(1000))
  })
})
