/**
 * Earned Income Credit (EITC) tests.
 *
 * Tests isEITCQualifyingChild, computeEICAtIncome, and computeEarnedIncomeCredit
 * against IRS rules for tax year 2025.
 */

import { describe, it, expect } from 'vitest'
import { cents } from '../../src/model/traced'
import {
  isEITCQualifyingChild,
  computeEICAtIncome,
  computeEarnedIncomeCredit,
} from '../../src/rules/2025/earnedIncomeCredit'
import { EIC_SCHEDULES } from '../../src/rules/2025/constants'
import { computeForm1040 } from '../../src/rules/2025/form1040'
import { makeDependent, makeW2, lowIncomeWithChildReturn, lowIncomeNoChildReturn } from '../fixtures/returns'
import { emptyTaxReturn } from '../../src/model/types'
import type { Dependent } from '../../src/model/types'

// ── isEITCQualifyingChild ──────────────────────────────────────

describe('isEITCQualifyingChild', () => {
  it('qualifies: child under 19 with valid SSN, relationship, and residency', () => {
    const dep = makeDependent({
      firstName: 'Alice',
      dateOfBirth: '2010-06-15', // age 15
      relationship: 'daughter',
      ssn: '123456789',
      monthsLived: 12,
    })
    expect(isEITCQualifyingChild(dep)).toBe(true)
  })

  it('does not qualify: child exactly 19 at Dec 31 2025', () => {
    // Born 2006 → age = 2025 - 2006 = 19 → NOT under 19
    const dep = makeDependent({
      firstName: 'Bob',
      dateOfBirth: '2006-01-01',
    })
    expect(isEITCQualifyingChild(dep)).toBe(false)
  })

  it('qualifies: 17-year-old (qualifies for EITC but not CTC)', () => {
    // Born 2008 → age = 2025 - 2008 = 17 → under 19 ✓ (but NOT under 17 for CTC)
    const dep = makeDependent({
      firstName: 'Charlie',
      dateOfBirth: '2008-03-15',
      relationship: 'son',
    })
    expect(isEITCQualifyingChild(dep)).toBe(true)
  })

  it('qualifies: 18-year-old (under 19)', () => {
    // Born 2007 → age = 2025 - 2007 = 18 → under 19 ✓
    const dep = makeDependent({
      firstName: 'Dave',
      dateOfBirth: '2007-12-31',
      relationship: 'son',
    })
    expect(isEITCQualifyingChild(dep)).toBe(true)
  })

  it('does not qualify: missing SSN', () => {
    const dep = makeDependent({
      firstName: 'Eve',
      dateOfBirth: '2015-06-15',
      ssn: '',
    })
    expect(isEITCQualifyingChild(dep)).toBe(false)
  })

  it('does not qualify: missing date of birth', () => {
    const dep: Dependent = {
      firstName: 'Frank',
      lastName: 'Doe',
      ssn: '123456789',
      relationship: 'son',
      monthsLived: 12,
      dateOfBirth: '',
    }
    expect(isEITCQualifyingChild(dep)).toBe(false)
  })

  it('does not qualify: non-qualifying relationship', () => {
    const dep = makeDependent({
      firstName: 'Grace',
      dateOfBirth: '2015-05-01',
      relationship: 'parent',
    })
    expect(isEITCQualifyingChild(dep)).toBe(false)
  })

  it('does not qualify: lived 6 months or less', () => {
    const dep = makeDependent({
      firstName: 'Helen',
      dateOfBirth: '2015-03-01',
      monthsLived: 6,
    })
    expect(isEITCQualifyingChild(dep)).toBe(false)
  })
})

// ── computeEICAtIncome ──────────────────────────────────────────

describe('computeEICAtIncome', () => {
  const schedule1 = EIC_SCHEDULES[1] // 1 child
  const phaseOutStartSingle = schedule1.phaseOutStartSingle

  it('income at 0 → $0', () => {
    expect(computeEICAtIncome(0, schedule1, phaseOutStartSingle)).toBe(0)
  })

  it('income in phase-in range → proportional credit', () => {
    // $5,000 earned income, 1 child: $5,000 × 0.34 = $1,700
    const credit = computeEICAtIncome(cents(5000), schedule1, phaseOutStartSingle)
    expect(credit).toBe(Math.round(cents(5000) * 0.34))
  })

  it('income at plateau → max credit', () => {
    // $15,000 earned income: above earnedIncomeAmount ($12,730), below phaseOutStart ($23,350)
    const credit = computeEICAtIncome(cents(15000), schedule1, phaseOutStartSingle)
    expect(credit).toBe(schedule1.maxCredit)
  })

  it('income in phase-out → reduced credit', () => {
    // $30,000 earned income, 1 child, single
    // reduction = ($30,000 - $23,350) × 0.1598 = $6,650 × 0.1598 = $1,062.67 → rounds to $1,063
    const credit = computeEICAtIncome(cents(30000), schedule1, phaseOutStartSingle)
    const expectedReduction = Math.round((cents(30000) - phaseOutStartSingle) * schedule1.phaseOutRate)
    expect(credit).toBe(schedule1.maxCredit - expectedReduction)
    expect(credit).toBeGreaterThan(0)
  })

  it('income far above phase-out → $0', () => {
    const credit = computeEICAtIncome(cents(100000), schedule1, phaseOutStartSingle)
    expect(credit).toBe(0)
  })

  it('schedule 0: small credit range', () => {
    const schedule0 = EIC_SCHEDULES[0]
    // $8,490 (exactly at earnedIncomeAmount) → phase-in end
    const credit = computeEICAtIncome(schedule0.earnedIncomeAmount, schedule0, schedule0.phaseOutStartSingle)
    expect(credit).toBe(Math.round(schedule0.earnedIncomeAmount * schedule0.phaseInRate))
  })
})

// ── computeEarnedIncomeCredit ───────────────────────────────────

describe('computeEarnedIncomeCredit', () => {
  it('single, 1 child, income in plateau → max credit ($4,328)', () => {
    const deps = [
      makeDependent({ firstName: 'A', dateOfBirth: '2015-03-15', relationship: 'daughter' }),
    ]
    const result = computeEarnedIncomeCredit(deps, 'single', cents(20000), cents(20000), 0, null)

    expect(result.eligible).toBe(true)
    expect(result.numQualifyingChildren).toBe(1)
    expect(result.scheduleIndex).toBe(1)
    expect(result.creditAmount).toBe(cents(4328))
  })

  it('MFJ, 2 children, income near phase-out end → small credit', () => {
    const deps = [
      makeDependent({ firstName: 'A', dateOfBirth: '2015-03-15', relationship: 'daughter' }),
      makeDependent({ firstName: 'B', dateOfBirth: '2017-07-22', relationship: 'son', ssn: '987654322' }),
    ]
    // MFJ phase-out start for 2 children: $30,470
    // High income near phase-out end
    const result = computeEarnedIncomeCredit(deps, 'mfj', cents(63000), cents(63000), 0, null)

    expect(result.eligible).toBe(true)
    expect(result.scheduleIndex).toBe(2)
    expect(result.creditAmount).toBeGreaterThan(0)
    expect(result.creditAmount).toBeLessThan(cents(1000))
  })

  it('MFS → ineligible', () => {
    const deps = [
      makeDependent({ firstName: 'A', dateOfBirth: '2015-03-15', relationship: 'daughter' }),
    ]
    const result = computeEarnedIncomeCredit(deps, 'mfs', cents(20000), cents(20000), 0, null)

    expect(result.eligible).toBe(false)
    expect(result.ineligibleReason).toBe('mfs')
    expect(result.creditAmount).toBe(0)
  })

  it('investment income > $11,950 → ineligible', () => {
    const deps = [
      makeDependent({ firstName: 'A', dateOfBirth: '2015-03-15', relationship: 'daughter' }),
    ]
    const result = computeEarnedIncomeCredit(deps, 'single', cents(20000), cents(20000), cents(12000), null)

    expect(result.eligible).toBe(false)
    expect(result.ineligibleReason).toBe('investment_income')
  })

  it('investment income exactly $11,950 → eligible', () => {
    const deps = [
      makeDependent({ firstName: 'A', dateOfBirth: '2015-03-15', relationship: 'daughter' }),
    ]
    const result = computeEarnedIncomeCredit(deps, 'single', cents(20000), cents(20000), cents(11950), null)

    expect(result.eligible).toBe(true)
  })

  it('0 children, filer age 30, low income → small credit ($649 max)', () => {
    const result = computeEarnedIncomeCredit([], 'single', cents(10000), cents(10000), 0, 30)

    expect(result.eligible).toBe(true)
    expect(result.numQualifyingChildren).toBe(0)
    expect(result.scheduleIndex).toBe(0)
    expect(result.creditAmount).toBe(cents(649))
  })

  it('0 children, filer age 20 → ineligible (under 25)', () => {
    const result = computeEarnedIncomeCredit([], 'single', cents(8000), cents(8000), 0, 20)

    expect(result.eligible).toBe(false)
    expect(result.ineligibleReason).toBe('age')
  })

  it('0 children, filer age 65 → ineligible (over 64)', () => {
    const result = computeEarnedIncomeCredit([], 'single', cents(8000), cents(8000), 0, 65)

    expect(result.eligible).toBe(false)
    expect(result.ineligibleReason).toBe('age')
  })

  it('0 children, filer age 25 → eligible (boundary)', () => {
    const result = computeEarnedIncomeCredit([], 'single', cents(8000), cents(8000), 0, 25)

    expect(result.eligible).toBe(true)
  })

  it('0 children, filer age 64 → eligible (boundary)', () => {
    const result = computeEarnedIncomeCredit([], 'single', cents(8000), cents(8000), 0, 64)

    expect(result.eligible).toBe(true)
  })

  it('0 children, filer age null → eligible (skip age check)', () => {
    const result = computeEarnedIncomeCredit([], 'single', cents(8000), cents(8000), 0, null)

    expect(result.eligible).toBe(true)
  })

  it('3+ children → uses schedule index 3', () => {
    const deps = [
      makeDependent({ firstName: 'A', dateOfBirth: '2015-01-01', relationship: 'daughter' }),
      makeDependent({ firstName: 'B', dateOfBirth: '2016-01-01', relationship: 'son', ssn: '987654322' }),
      makeDependent({ firstName: 'C', dateOfBirth: '2017-01-01', relationship: 'daughter', ssn: '987654323' }),
      makeDependent({ firstName: 'D', dateOfBirth: '2018-01-01', relationship: 'son', ssn: '987654324' }),
    ]
    const result = computeEarnedIncomeCredit(deps, 'single', cents(20000), cents(20000), 0, null)

    expect(result.scheduleIndex).toBe(3)
    expect(result.creditAmount).toBe(EIC_SCHEDULES[3].maxCredit) // in plateau
  })

  it('earned income and AGI differ → takes smaller credit', () => {
    const deps = [
      makeDependent({ firstName: 'A', dateOfBirth: '2015-03-15', relationship: 'daughter' }),
    ]
    // Earned income $15K (plateau for sched 1) but AGI $30K (well into phase-out for sched 1)
    const result = computeEarnedIncomeCredit(deps, 'single', cents(15000), cents(30000), 0, null)

    expect(result.eligible).toBe(true)
    expect(result.creditAtEarnedIncome).toBe(cents(4328)) // max credit (plateau)
    expect(result.creditAtAGI).toBeLessThan(cents(4328))   // reduced by phase-out
    expect(result.creditAmount).toBe(result.creditAtAGI)   // min of the two
  })

  it('no earned income → ineligible', () => {
    const result = computeEarnedIncomeCredit([], 'single', 0, cents(5000), 0, 30)

    expect(result.eligible).toBe(false)
    expect(result.ineligibleReason).toBe('no_income')
  })

  it('MFJ uses higher phase-out start', () => {
    const deps = [
      makeDependent({ firstName: 'A', dateOfBirth: '2015-03-15', relationship: 'daughter' }),
    ]
    // Income $28,000: above single phase-out start ($23,350) but below MFJ ($30,470)
    const singleResult = computeEarnedIncomeCredit(deps, 'single', cents(28000), cents(28000), 0, null)
    const mfjResult = computeEarnedIncomeCredit(deps, 'mfj', cents(28000), cents(28000), 0, null)

    // MFJ should get max credit (still in plateau), single should be reduced
    expect(mfjResult.creditAmount).toBe(cents(4328))
    expect(singleResult.creditAmount).toBeLessThan(cents(4328))
  })
})

// ── Integration: computeForm1040 with EITC ──────────────────────

describe('Form 1040 with Earned Income Credit', () => {
  it('low-income return with child: Line 27 populated, flows to Line 33', () => {
    const tr = lowIncomeWithChildReturn()
    const result = computeForm1040(tr)

    expect(result.earnedIncomeCredit).not.toBeNull()
    expect(result.earnedIncomeCredit!.eligible).toBe(true)
    expect(result.earnedIncomeCredit!.numQualifyingChildren).toBe(1)
    expect(result.line27.amount).toBeGreaterThan(0)

    // Line 27 flows through Line 32 to Line 33
    expect(result.line32.amount).toBeGreaterThanOrEqual(result.line27.amount)
    expect(result.line33.amount).toBe(result.line25.amount + result.line32.amount)
  })

  it('low-income return without child: EITC for childless worker', () => {
    const tr = lowIncomeNoChildReturn()
    const result = computeForm1040(tr)

    expect(result.earnedIncomeCredit).not.toBeNull()
    expect(result.earnedIncomeCredit!.eligible).toBe(true)
    expect(result.earnedIncomeCredit!.numQualifyingChildren).toBe(0)
    expect(result.earnedIncomeCredit!.scheduleIndex).toBe(0)
    expect(result.line27.amount).toBe(cents(649)) // max credit, schedule 0
  })

  it('no income → EITC = $0', () => {
    const tr = emptyTaxReturn(2025)
    const result = computeForm1040(tr)

    expect(result.earnedIncomeCredit).not.toBeNull()
    expect(result.earnedIncomeCredit!.eligible).toBe(false)
    expect(result.earnedIncomeCredit!.ineligibleReason).toBe('no_income')
    expect(result.line27.amount).toBe(0)
  })

  it('high income → EITC = $0', () => {
    const tr = {
      ...emptyTaxReturn(2025),
      w2s: [makeW2({ id: 'w2-1', employerName: 'BigCo', box1: cents(200000), box2: cents(40000) })],
    }
    const result = computeForm1040(tr)

    expect(result.earnedIncomeCredit!.eligible).toBe(true)
    expect(result.earnedIncomeCredit!.creditAmount).toBe(0)
    expect(result.line27.amount).toBe(0)
  })

  it('existing CTC tests still pass: no dependents', () => {
    const tr = {
      ...emptyTaxReturn(2025),
      w2s: [makeW2({ id: 'w2-1', employerName: 'Acme', box1: cents(75000), box2: cents(8000) })],
    }
    const result = computeForm1040(tr)

    expect(result.childTaxCredit).toBeNull()
    expect(result.line19.amount).toBe(0)
    expect(result.line28.amount).toBe(0)
  })
})
