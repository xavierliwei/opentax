/**
 * Tests for Student Loan Interest Deduction (Schedule 1, Line 21)
 *
 * IRC §221 — above-the-line deduction capped at $2,500,
 * with MAGI-based phase-out. MFS always ineligible.
 */

import { describe, it, expect } from 'vitest'
import { cents } from '../../src/model/traced'
import { emptyTaxReturn } from '../../src/model/types'
import type { TaxReturn, FilingStatus } from '../../src/model/types'
import { computeStudentLoanDeduction } from '../../src/rules/2025/studentLoanDeduction'
import { computeForm1040 } from '../../src/rules/2025/form1040'
import { makeW2 } from '../fixtures/returns'

function makeReturnWithLoanInterest(
  interest: number,
  filingStatus: FilingStatus = 'single',
): TaxReturn {
  return {
    ...emptyTaxReturn(2025),
    filingStatus,
    studentLoanInterest: interest,
  }
}

describe('computeStudentLoanDeduction', () => {
  it('returns null when no student loan data', () => {
    const model = emptyTaxReturn(2025)
    expect(computeStudentLoanDeduction(model, cents(50000))).toBeNull()
  })

  it('returns null when studentLoanInterest is 0', () => {
    const model = makeReturnWithLoanInterest(0)
    expect(computeStudentLoanDeduction(model, cents(50000))).toBeNull()
  })

  it('gives full $2,500 deduction when MAGI below phase-out (single)', () => {
    const model = makeReturnWithLoanInterest(cents(3000))
    const result = computeStudentLoanDeduction(model, cents(70000))!
    expect(result).not.toBeNull()
    expect(result.interestPaid).toBe(cents(3000))
    expect(result.maxDeduction).toBe(cents(2500))
    expect(result.deductibleAmount).toBe(cents(2500))
    expect(result.phaseOutApplies).toBe(false)
  })

  it('deduction equals actual interest when less than $2,500', () => {
    const model = makeReturnWithLoanInterest(cents(1200))
    const result = computeStudentLoanDeduction(model, cents(50000))!
    expect(result.maxDeduction).toBe(cents(1200))
    expect(result.deductibleAmount).toBe(cents(1200))
  })

  it('caps deduction at $2,500 when interest exceeds cap', () => {
    const model = makeReturnWithLoanInterest(cents(5000))
    const result = computeStudentLoanDeduction(model, cents(50000))!
    expect(result.interestPaid).toBe(cents(5000))
    expect(result.maxDeduction).toBe(cents(2500))
    expect(result.deductibleAmount).toBe(cents(2500))
  })

  it('single MAGI at phase-out start ($85K) → full deduction', () => {
    const model = makeReturnWithLoanInterest(cents(2500))
    const result = computeStudentLoanDeduction(model, cents(85000))!
    expect(result.deductibleAmount).toBe(cents(2500))
    expect(result.phaseOutApplies).toBe(false)
  })

  it('single MAGI at phase-out end ($100K) → $0', () => {
    const model = makeReturnWithLoanInterest(cents(2500))
    const result = computeStudentLoanDeduction(model, cents(100000))!
    expect(result.deductibleAmount).toBe(0)
    expect(result.phaseOutApplies).toBe(true)
  })

  it('single MAGI at midpoint ($92,500) → ~50% reduction', () => {
    const model = makeReturnWithLoanInterest(cents(2500))
    const result = computeStudentLoanDeduction(model, cents(92500))!
    // reduction = 250000 * (9250000 - 8500000) / (10000000 - 8500000)
    //           = 250000 * 750000 / 1500000 = 125000
    // deductible = 250000 - 125000 = 125000 ($1,250)
    expect(result.deductibleAmount).toBe(cents(1250))
    expect(result.phaseOutApplies).toBe(true)
  })

  it('MFJ MAGI below phase-out ($150K) → full deduction', () => {
    const model = makeReturnWithLoanInterest(cents(2500), 'mfj')
    const result = computeStudentLoanDeduction(model, cents(150000))!
    expect(result.deductibleAmount).toBe(cents(2500))
    expect(result.phaseOutApplies).toBe(false)
  })

  it('MFJ MAGI in phase-out ($185K midpoint) → ~50% reduction', () => {
    const model = makeReturnWithLoanInterest(cents(2500), 'mfj')
    const result = computeStudentLoanDeduction(model, cents(185000))!
    // reduction = 250000 * (18500000 - 17000000) / (20000000 - 17000000)
    //           = 250000 * 1500000 / 3000000 = 125000
    expect(result.deductibleAmount).toBe(cents(1250))
  })

  it('MFJ MAGI at phase-out end ($200K) → $0', () => {
    const model = makeReturnWithLoanInterest(cents(2500), 'mfj')
    const result = computeStudentLoanDeduction(model, cents(200000))!
    expect(result.deductibleAmount).toBe(0)
  })

  it('MFS always returns $0 (ineligible)', () => {
    const model = makeReturnWithLoanInterest(cents(2500), 'mfs')
    const result = computeStudentLoanDeduction(model, cents(50000))!
    expect(result.deductibleAmount).toBe(0)
  })

  it('HOH uses single phase-out range', () => {
    const model = makeReturnWithLoanInterest(cents(2500), 'hoh')
    // MAGI $70K → below $85K start → full deduction
    const below = computeStudentLoanDeduction(model, cents(70000))!
    expect(below.deductibleAmount).toBe(cents(2500))
    // MAGI $92.5K → midpoint
    const mid = computeStudentLoanDeduction(model, cents(92500))!
    expect(mid.deductibleAmount).toBe(cents(1250))
    // MAGI $100K → at end
    const atEnd = computeStudentLoanDeduction(model, cents(100000))!
    expect(atEnd.deductibleAmount).toBe(0)
  })

  it('QW uses MFJ phase-out range', () => {
    const model = makeReturnWithLoanInterest(cents(2500), 'qw')
    const result = computeStudentLoanDeduction(model, cents(150000))!
    expect(result.deductibleAmount).toBe(cents(2500))
  })
})

describe('Student loan interest — integration with Form 1040', () => {
  it('student loan deduction flows into Line 10 and reduces AGI', () => {
    const model: TaxReturn = {
      ...emptyTaxReturn(2025),
      w2s: [makeW2({ id: 'w2-1', employerName: 'Acme', box1: cents(60000), box2: cents(6000) })],
      studentLoanInterest: cents(2500),
    }
    const result = computeForm1040(model)
    expect(result.studentLoanDeduction).not.toBeNull()
    expect(result.studentLoanDeduction!.deductibleAmount).toBe(cents(2500))
    expect(result.line10.amount).toBe(cents(2500))
    // AGI = $60,000 - $2,500 = $57,500
    expect(result.line11.amount).toBe(cents(57500))
  })

  it('combines with IRA and HSA deductions', () => {
    const model: TaxReturn = {
      ...emptyTaxReturn(2025),
      w2s: [makeW2({ id: 'w2-1', employerName: 'Acme', box1: cents(80000), box2: cents(10000) })],
      studentLoanInterest: cents(2000),
      retirementContributions: { traditionalIRA: cents(3000), rothIRA: 0 },
      hsa: {
        coverageType: 'self-only',
        contributions: cents(2000),
        qualifiedExpenses: 0,
        age55OrOlder: false,
        age65OrDisabled: false,
      },
    }
    const result = computeForm1040(model)
    const iraAmount = result.iraDeduction?.deductibleAmount ?? 0
    const hsaAmount = result.hsaResult?.deductibleAmount ?? 0
    const studentLoanAmount = result.studentLoanDeduction?.deductibleAmount ?? 0

    expect(iraAmount).toBe(cents(3000))
    expect(hsaAmount).toBe(cents(2000))
    expect(studentLoanAmount).toBe(cents(2000))
    expect(result.line10.amount).toBe(iraAmount + hsaAmount + studentLoanAmount)
  })
})
