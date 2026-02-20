/**
 * Tests for Schedule CA (540) — California Adjustments
 *
 * Verifies federal AGI → CA AGI conversion via additions/subtractions.
 * Phase 1: HSA add-back is the only adjustment.
 */

import { describe, it, expect } from 'vitest'
import { cents } from '../../../src/model/traced'
import { emptyTaxReturn } from '../../../src/model/types'
import type { TaxReturn } from '../../../src/model/types'
import { computeForm1040 } from '../../../src/rules/2025/form1040'
import { computeScheduleCA } from '../../../src/rules/2025/ca/scheduleCA'
import { makeW2 } from '../../fixtures/returns'

function makeReturn(overrides: Partial<TaxReturn> = {}): TaxReturn {
  return {
    ...emptyTaxReturn(2025),
    w2s: [makeW2({ id: 'w2-1', employerName: 'Acme', box1: cents(100000), box2: cents(15000) })],
    ...overrides,
  }
}

describe('computeScheduleCA', () => {
  it('CA AGI equals federal AGI when no adjustments apply', () => {
    const model = makeReturn()
    const form1040 = computeForm1040(model)
    const sca = computeScheduleCA(form1040)

    expect(sca.federalAGI).toBe(form1040.line11.amount)
    expect(sca.hsaAddBack).toBe(0)
    expect(sca.additions).toBe(0)
    expect(sca.subtractions).toBe(0)
    expect(sca.caAGI).toBe(sca.federalAGI)
  })

  it('adds back HSA deduction (CA does not recognize IRC §223)', () => {
    const model = makeReturn({
      hsa: {
        coverageType: 'self-only',
        contributions: cents(4000),
        qualifiedExpenses: 0,
        age55OrOlder: false,
        age65OrDisabled: false,
      },
    })
    const form1040 = computeForm1040(model)
    const sca = computeScheduleCA(form1040)

    // Federal AGI has HSA deduction subtracted; CA adds it back
    expect(sca.hsaAddBack).toBe(cents(4000))
    expect(sca.additions).toBe(cents(4000))
    expect(sca.caAGI).toBe(sca.federalAGI + cents(4000))
  })

  it('adds back family HSA deduction', () => {
    const model = makeReturn({
      hsa: {
        coverageType: 'family',
        contributions: cents(8000),
        qualifiedExpenses: 0,
        age55OrOlder: false,
        age65OrDisabled: false,
      },
    })
    const form1040 = computeForm1040(model)
    const sca = computeScheduleCA(form1040)

    expect(sca.hsaAddBack).toBe(cents(8000))
    expect(sca.caAGI).toBe(sca.federalAGI + cents(8000))
  })

  it('adds back HSA with catch-up contribution (age 55+)', () => {
    const model = makeReturn({
      hsa: {
        coverageType: 'self-only',
        contributions: cents(5300),  // $4,300 base + $1,000 catch-up
        qualifiedExpenses: 0,
        age55OrOlder: true,
        age65OrDisabled: false,
      },
    })
    const form1040 = computeForm1040(model)
    const sca = computeScheduleCA(form1040)

    expect(sca.hsaAddBack).toBe(cents(5300))
    expect(sca.caAGI).toBe(sca.federalAGI + cents(5300))
  })

  it('HSA add-back only includes deductible amount, not excess', () => {
    const model = makeReturn({
      hsa: {
        coverageType: 'self-only',
        contributions: cents(6000),  // exceeds $4,300 limit
        qualifiedExpenses: 0,
        age55OrOlder: false,
        age65OrDisabled: false,
      },
    })
    const form1040 = computeForm1040(model)
    const sca = computeScheduleCA(form1040)

    // Only the deductible portion ($4,300) gets added back, not the excess
    expect(form1040.hsaResult).not.toBeNull()
    expect(sca.hsaAddBack).toBe(form1040.hsaResult!.deductibleAmount)
    expect(sca.hsaAddBack).toBeLessThan(cents(6000))
  })

  it('no HSA add-back when employer covers all contributions (W-2 Box 12 code W)', () => {
    const model = makeReturn({
      w2s: [makeW2({
        id: 'w2-1',
        employerName: 'Acme',
        box1: cents(100000),
        box2: cents(15000),
        box12: [{ code: 'W', amount: cents(4300) }],
      })],
      hsa: {
        coverageType: 'self-only',
        contributions: 0,  // no taxpayer contributions
        qualifiedExpenses: 0,
        age55OrOlder: false,
        age65OrDisabled: false,
      },
    })
    const form1040 = computeForm1040(model)
    const sca = computeScheduleCA(form1040)

    // Employer contributions aren't deductible by taxpayer, so no add-back
    expect(sca.hsaAddBack).toBe(0)
    expect(sca.caAGI).toBe(sca.federalAGI)
  })

  it('subtractions are zero in Phase 1', () => {
    const model = makeReturn({
      hsa: {
        coverageType: 'self-only',
        contributions: cents(4000),
        qualifiedExpenses: 0,
        age55OrOlder: false,
        age65OrDisabled: false,
      },
    })
    const form1040 = computeForm1040(model)
    const sca = computeScheduleCA(form1040)

    expect(sca.subtractions).toBe(0)
  })

  it('student loan and IRA deductions do not create CA adjustments', () => {
    const model = makeReturn({
      studentLoanInterest: cents(2500),
      retirementContributions: { traditionalIRA: cents(5000), rothIRA: 0 },
    })
    const form1040 = computeForm1040(model)
    const sca = computeScheduleCA(form1040)

    // CA conforms to federal student loan and IRA deductions — no adjustment
    expect(sca.additions).toBe(0)
    expect(sca.subtractions).toBe(0)
    expect(sca.caAGI).toBe(sca.federalAGI)
  })
})
