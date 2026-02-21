/**
 * Child Tax Credit and Additional CTC tests.
 *
 * Tests isQualifyingChild, isOtherDependent, and computeChildTaxCredit
 * against IRS rules for tax year 2025.
 */

import { describe, it, expect } from 'vitest'
import { cents } from '../../src/model/traced'
import { isQualifyingChild, isOtherDependent, computeChildTaxCredit } from '../../src/rules/2025/childTaxCredit'
import { computeForm1040 } from '../../src/rules/2025/form1040'
import { makeDependent, makeW2, familyWithChildrenReturn, highIncomeWithChildReturn } from '../fixtures/returns'
import { emptyTaxReturn } from '../../src/model/types'
import type { Dependent } from '../../src/model/types'

// ── isQualifyingChild ──────────────────────────────────────────

describe('isQualifyingChild', () => {
  it('qualifies: child under 17 with valid SSN, relationship, and residency', () => {
    const dep = makeDependent({
      firstName: 'Alice',
      dateOfBirth: '2015-06-15',
      relationship: 'daughter',
      ssn: '123456789',
      monthsLived: 12,
    })
    expect(isQualifyingChild(dep)).toBe(true)
  })

  it('does not qualify: child exactly 17 at Dec 31 2025', () => {
    // Born 2008 → age = 2025 - 2008 = 17 → NOT under 17
    const dep = makeDependent({
      firstName: 'Bob',
      dateOfBirth: '2008-01-01',
    })
    expect(isQualifyingChild(dep)).toBe(false)
  })

  it('qualifies: child who turns 16 during 2025 (born 2009)', () => {
    // Born 2009 → age = 2025 - 2009 = 16 → under 17 ✓
    const dep = makeDependent({
      firstName: 'Carol',
      dateOfBirth: '2009-12-31',
    })
    expect(isQualifyingChild(dep)).toBe(true)
  })

  it('does not qualify: born Dec 31 2008 (turns 17 on Dec 31 2025)', () => {
    const dep = makeDependent({
      firstName: 'Dave',
      dateOfBirth: '2008-12-31',
    })
    expect(isQualifyingChild(dep)).toBe(false)
  })

  it('qualifies: born Jan 1 2009 (is 16 on Dec 31 2025)', () => {
    const dep = makeDependent({
      firstName: 'Eve',
      dateOfBirth: '2009-01-01',
    })
    expect(isQualifyingChild(dep)).toBe(true)
  })

  it('does not qualify: lived with taxpayer 6 months or less', () => {
    const dep = makeDependent({
      firstName: 'Frank',
      dateOfBirth: '2015-03-01',
      monthsLived: 6,
    })
    expect(isQualifyingChild(dep)).toBe(false)
  })

  it('qualifies: lived with taxpayer 7 months', () => {
    const dep = makeDependent({
      firstName: 'Grace',
      dateOfBirth: '2015-03-01',
      monthsLived: 7,
    })
    expect(isQualifyingChild(dep)).toBe(true)
  })

  it('does not qualify: non-qualifying relationship (parent)', () => {
    const dep = makeDependent({
      firstName: 'Helen',
      dateOfBirth: '1960-05-01',
      relationship: 'parent',
    })
    expect(isQualifyingChild(dep)).toBe(false)
  })

  it('does not qualify: missing SSN', () => {
    const dep = makeDependent({
      firstName: 'Iris',
      dateOfBirth: '2015-06-15',
      ssn: '',
    })
    expect(isQualifyingChild(dep)).toBe(false)
  })

  it('does not qualify: missing date of birth', () => {
    const dep: Dependent = {
      firstName: 'Jack',
      lastName: 'Doe',
      ssn: '123456789',
      relationship: 'son',
      monthsLived: 12,
      dateOfBirth: '',
    }
    expect(isQualifyingChild(dep)).toBe(false)
  })

  it('qualifies: all qualifying relationships', () => {
    const relationships = ['son', 'daughter', 'stepchild', 'foster child', 'sibling', 'grandchild']
    for (const rel of relationships) {
      const dep = makeDependent({
        firstName: 'Test',
        dateOfBirth: '2015-06-15',
        relationship: rel,
      })
      expect(isQualifyingChild(dep)).toBe(true)
    }
  })

  it('does not qualify: "other" relationship', () => {
    const dep = makeDependent({
      firstName: 'Kyle',
      dateOfBirth: '2015-06-15',
      relationship: 'other',
    })
    expect(isQualifyingChild(dep)).toBe(false)
  })
})

// ── isOtherDependent ───────────────────────────────────────────

describe('isOtherDependent', () => {
  it('parent with DOB and SSN → other dependent', () => {
    const dep = makeDependent({
      firstName: 'Mom',
      dateOfBirth: '1960-05-01',
      relationship: 'parent',
      ssn: '111223333',
    })
    expect(isOtherDependent(dep)).toBe(true)
  })

  it('child over 17 with DOB and SSN → other dependent', () => {
    const dep = makeDependent({
      firstName: 'Adult',
      dateOfBirth: '2005-01-01', // 20 years old
      relationship: 'son',
      ssn: '111223334',
    })
    expect(isOtherDependent(dep)).toBe(true)
  })

  it('child under 17 → not an other dependent (is qualifying child)', () => {
    const dep = makeDependent({
      firstName: 'Young',
      dateOfBirth: '2015-06-15',
      relationship: 'daughter',
      ssn: '111223335',
    })
    expect(isOtherDependent(dep)).toBe(false)
  })

  it('dependent with no DOB → not an other dependent', () => {
    const dep = makeDependent({
      firstName: 'NoDOB',
      dateOfBirth: '',
      ssn: '111223336',
    })
    expect(isOtherDependent(dep)).toBe(false)
  })
})

// ── computeChildTaxCredit ──────────────────────────────────────

describe('computeChildTaxCredit', () => {
  it('two children below threshold: $4,400 credit, fully non-refundable', () => {
    // AGI $120K, MFJ threshold $400K → no phase-out
    // Tax liability high enough to absorb full credit
    const deps = [
      makeDependent({ firstName: 'A', dateOfBirth: '2015-03-15', relationship: 'daughter' }),
      makeDependent({ firstName: 'B', dateOfBirth: '2018-07-22', ssn: '987654322' }),
    ]
    const result = computeChildTaxCredit(deps, 'mfj', cents(120000), cents(15000), cents(120000))

    expect(result.numQualifyingChildren).toBe(2)
    expect(result.numOtherDependents).toBe(0)
    expect(result.initialCredit).toBe(cents(4400))
    expect(result.phaseOutReduction).toBe(0)
    expect(result.creditAfterPhaseOut).toBe(cents(4400))
    expect(result.nonRefundableCredit).toBe(cents(4400))
    expect(result.additionalCTC).toBe(0)
  })

  it('AGI phase-out: single $250K, 1 child → fully phased out', () => {
    // Excess = $250K - $200K = $50K → 50 × $50 = $2,500 reduction
    // Initial = $2,200 → after phase-out = max(0, 2200 - 2500) = $0
    const deps = [
      makeDependent({ firstName: 'C', dateOfBirth: '2012-06-01', relationship: 'son' }),
    ]
    const result = computeChildTaxCredit(deps, 'single', cents(250000), cents(30000), cents(250000))

    expect(result.initialCredit).toBe(cents(2200))
    expect(result.phaseOutReduction).toBe(cents(2200)) // capped at initial
    expect(result.creditAfterPhaseOut).toBe(0)
    expect(result.nonRefundableCredit).toBe(0)
    expect(result.additionalCTC).toBe(0)
  })

  it('tax liability < CTC → Additional CTC kicks in', () => {
    // Low income: tax = $800, credit = $2,200, earned income = $20,000
    // Non-refundable = min($2,200, $800) = $800
    // Refundable: min($1,700, (20000 - 2500) × 15% = $2,625) = $1,700
    // Capped at unused: min($1,700, $2,200 - $800) = $1,400
    const deps = [
      makeDependent({ firstName: 'D', dateOfBirth: '2016-01-15', relationship: 'daughter' }),
    ]
    const result = computeChildTaxCredit(deps, 'single', cents(20000), cents(800), cents(20000))

    expect(result.nonRefundableCredit).toBe(cents(800))
    expect(result.additionalCTC).toBe(cents(1400))
  })

  it('dependent over 17 → $500 ODC', () => {
    const deps = [
      makeDependent({ firstName: 'E', dateOfBirth: '2005-01-01', relationship: 'son', ssn: '111223344' }),
    ]
    const result = computeChildTaxCredit(deps, 'single', cents(80000), cents(10000), cents(80000))

    expect(result.numQualifyingChildren).toBe(0)
    expect(result.numOtherDependents).toBe(1)
    expect(result.initialCredit).toBe(cents(500))
    expect(result.nonRefundableCredit).toBe(cents(500))
    expect(result.additionalCTC).toBe(0) // ODC is never refundable
  })

  it('MFJ $400K threshold: AGI exactly at threshold → no phase-out', () => {
    const deps = [
      makeDependent({ firstName: 'F', dateOfBirth: '2014-08-01', relationship: 'daughter' }),
    ]
    const result = computeChildTaxCredit(deps, 'mfj', cents(400000), cents(50000), cents(400000))

    expect(result.phaseOutReduction).toBe(0)
    expect(result.creditAfterPhaseOut).toBe(cents(2200))
  })

  it('MFJ $401K: $1K over threshold → $50 reduction', () => {
    const deps = [
      makeDependent({ firstName: 'G', dateOfBirth: '2014-08-01', relationship: 'daughter' }),
    ]
    const result = computeChildTaxCredit(deps, 'mfj', cents(401000), cents(50000), cents(401000))

    expect(result.phaseOutReduction).toBe(cents(50))
    expect(result.creditAfterPhaseOut).toBe(cents(2150))
  })

  it('partially phased out at $240K AGI', () => {
    // Single, $240K AGI, 1 child: excess = $40K → 40 × $50 = $2,000 reduction
    // Initial = $2,200, after phase-out = $2,200 - $2,000 = $200
    const deps = [
      makeDependent({ firstName: 'H', dateOfBirth: '2016-01-01', relationship: 'son' }),
    ]
    const result = computeChildTaxCredit(deps, 'single', cents(240000), cents(30000), cents(240000))

    expect(result.phaseOutReduction).toBe(cents(2000))
    expect(result.creditAfterPhaseOut).toBe(cents(200))
  })

  it('low earned income limits refundable ACTC', () => {
    // Earned income = $5,000, tax liability = $0, 1 child
    // Refundable: min($1,700, ($5,000 - $2,500) × 15%) = min($1,700, $375) = $375
    // Unused portion = $2,200 - $0 = $2,200
    // ACTC = min($375, $2,200) = $375
    const deps = [
      makeDependent({ firstName: 'I', dateOfBirth: '2016-01-01', relationship: 'son' }),
    ]
    const result = computeChildTaxCredit(deps, 'single', cents(5000), 0, cents(5000))

    expect(result.nonRefundableCredit).toBe(0)
    expect(result.additionalCTC).toBe(cents(375))
  })

  it('no qualifying dependents → zero result', () => {
    const deps = [
      makeDependent({ firstName: 'J', dateOfBirth: '', ssn: '' }), // no DOB/SSN
    ]
    const result = computeChildTaxCredit(deps, 'single', cents(80000), cents(10000), cents(80000))

    expect(result.initialCredit).toBe(0)
    expect(result.nonRefundableCredit).toBe(0)
    expect(result.additionalCTC).toBe(0)
  })

  it('mixed: 1 qualifying child + 1 other dependent', () => {
    const deps = [
      makeDependent({ firstName: 'K', dateOfBirth: '2015-06-15', relationship: 'daughter', ssn: '111111111' }),
      makeDependent({ firstName: 'L', dateOfBirth: '1960-05-01', relationship: 'parent', ssn: '222222222' }),
    ]
    const result = computeChildTaxCredit(deps, 'single', cents(80000), cents(10000), cents(80000))

    expect(result.numQualifyingChildren).toBe(1)
    expect(result.numOtherDependents).toBe(1)
    expect(result.initialCredit).toBe(cents(2700)) // $2,200 + $500
    expect(result.nonRefundableCredit).toBe(cents(2700))
    expect(result.additionalCTC).toBe(0) // all fits in non-refundable
  })

  it('earned income below $2,500 threshold → no refundable ACTC', () => {
    const deps = [
      makeDependent({ firstName: 'M', dateOfBirth: '2016-01-01', relationship: 'son' }),
    ]
    const result = computeChildTaxCredit(deps, 'single', cents(2000), 0, cents(2000))

    expect(result.nonRefundableCredit).toBe(0)
    expect(result.additionalCTC).toBe(0)
  })
})

// ── Integration: computeForm1040 with CTC ──────────────────────

describe('Form 1040 with Child Tax Credit', () => {
  it('family with children: Line 19 and Line 28 flow correctly', () => {
    const tr = familyWithChildrenReturn()
    const result = computeForm1040(tr)

    // AGI = $120,000, MFJ → no phase-out
    // 2 qualifying children → $4,400 credit
    expect(result.childTaxCredit).not.toBeNull()
    expect(result.childTaxCredit!.numQualifyingChildren).toBe(2)
    expect(result.childTaxCredit!.initialCredit).toBe(cents(4400))

    // Line 19 should be $4,400 (tax is well above $4.4K)
    expect(result.line19.amount).toBe(cents(4400))

    // Line 28 should be $0 (all credit used non-refundably)
    expect(result.line28.amount).toBe(0)

    // Line 24 = line 22 + line 23 (tax after credits)
    // Line 18 - Line 21 = tax - credits
    expect(result.line22.amount).toBe(result.line18.amount - result.line21.amount)
    expect(result.line24.amount).toBe(result.line22.amount)
  })

  it('high income single: CTC fully phased out', () => {
    const tr = highIncomeWithChildReturn()
    const result = computeForm1040(tr)

    // $250K single, 1 child: $50K over → $2,500 phase-out > $2,200 credit
    expect(result.childTaxCredit!.creditAfterPhaseOut).toBe(0)
    expect(result.line19.amount).toBe(0)
    expect(result.line28.amount).toBe(0)
  })

  it('no dependents: lines 17-23 and 27-32 are zero, line 24 = line 16', () => {
    const tr = {
      ...emptyTaxReturn(2025),
      w2s: [makeW2({ id: 'w2-1', employerName: 'Acme', box1: cents(75000), box2: cents(8000) })],
    }
    const result = computeForm1040(tr)

    expect(result.childTaxCredit).toBeNull()
    expect(result.line17.amount).toBe(0)
    expect(result.line18.amount).toBe(result.line16.amount)
    expect(result.line19.amount).toBe(0)
    expect(result.line20.amount).toBe(0)
    expect(result.line21.amount).toBe(0)
    expect(result.line22.amount).toBe(result.line18.amount)
    expect(result.line23.amount).toBe(0)
    expect(result.line24.amount).toBe(result.line22.amount)
    // line24 = line22 = line18 = line16 (all zeros on 17,19-21,23)
    expect(result.line24.amount).toBe(result.line16.amount)

    expect(result.line27.amount).toBe(0)
    expect(result.line28.amount).toBe(0)
    expect(result.line29.amount).toBe(0)
    expect(result.line31.amount).toBe(0)
    expect(result.line32.amount).toBe(0)
    expect(result.line33.amount).toBe(result.line25.amount)
  })
})
