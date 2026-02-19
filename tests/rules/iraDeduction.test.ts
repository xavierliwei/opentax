/**
 * IRA Deduction (Schedule 1, Line 20) tests.
 *
 * Tests computeIRADeduction against IRS rules for tax year 2025.
 * Covers contribution limits, age catch-up, employer plan phase-outs,
 * spouse-covered scenarios, and integration with Form 1040.
 */

import { describe, it, expect } from 'vitest'
import { cents } from '../../src/model/traced'
import { computeIRADeduction } from '../../src/rules/2025/iraDeduction'
import type { IRADeductionResult } from '../../src/rules/2025/iraDeduction'
import { computeForm1040 } from '../../src/rules/2025/form1040'
import { emptyTaxReturn } from '../../src/model/types'
import { makeW2 } from '../fixtures/returns'

// ── Helper: build a return with IRA contributions ─────────────

function makeIRAReturn(overrides: {
  traditionalIRA: number
  filingStatus?: 'single' | 'mfj' | 'mfs' | 'hoh' | 'qw'
  dateOfBirth?: string
  w2s?: ReturnType<typeof makeW2>[]
  retirementPlan?: boolean
}) {
  const w2s = overrides.w2s ?? [
    makeW2({
      id: 'w2-1',
      employerName: 'Acme Corp',
      box1: cents(80000),
      box2: cents(10000),
      box13RetirementPlan: overrides.retirementPlan ?? false,
    }),
  ]

  return {
    ...emptyTaxReturn(2025),
    filingStatus: overrides.filingStatus ?? 'single' as const,
    taxpayer: {
      firstName: 'Jane',
      lastName: 'Doe',
      ssn: '123456789',
      dateOfBirth: overrides.dateOfBirth ?? '1990-06-15',
      address: { street: '123 Main St', city: 'Anytown', state: 'CA', zip: '90210' },
    },
    w2s,
    retirementContributions: {
      traditionalIRA: overrides.traditionalIRA,
      rothIRA: 0,
    },
  }
}

// ── Unit tests for computeIRADeduction ──────────────────────────

describe('computeIRADeduction', () => {
  it('returns null when no traditional IRA contributions', () => {
    const model = makeIRAReturn({ traditionalIRA: 0 })
    const result = computeIRADeduction(model, cents(80000))
    expect(result).toBeNull()
  })

  it('returns null when retirementContributions is undefined', () => {
    const model = { ...emptyTaxReturn(2025) }
    const result = computeIRADeduction(model, cents(80000))
    expect(result).toBeNull()
  })

  it('full deduction for $5K contribution, not covered by employer plan', () => {
    const model = makeIRAReturn({ traditionalIRA: cents(5000) })
    const result = computeIRADeduction(model, cents(80000))!
    expect(result).not.toBeNull()
    expect(result.contribution).toBe(cents(5000))
    expect(result.contributionLimit).toBe(cents(7000))
    expect(result.allowableContribution).toBe(cents(5000))
    expect(result.coveredByEmployerPlan).toBe(false)
    expect(result.phaseOutApplies).toBe(false)
    expect(result.deductibleAmount).toBe(cents(5000))
  })

  it('full deduction at $7K limit, not covered', () => {
    const model = makeIRAReturn({ traditionalIRA: cents(7000) })
    const result = computeIRADeduction(model, cents(80000))!
    expect(result.allowableContribution).toBe(cents(7000))
    expect(result.deductibleAmount).toBe(cents(7000))
  })

  it('caps contribution at $7K when contributing $10K', () => {
    const model = makeIRAReturn({ traditionalIRA: cents(10000) })
    const result = computeIRADeduction(model, cents(80000))!
    expect(result.contribution).toBe(cents(10000))
    expect(result.allowableContribution).toBe(cents(7000))
    expect(result.deductibleAmount).toBe(cents(7000))
  })

  it('age 50+ gets $8K catch-up limit', () => {
    // Born 1975 → age 50 in 2025
    const model = makeIRAReturn({ traditionalIRA: cents(8000), dateOfBirth: '1975-01-01' })
    const result = computeIRADeduction(model, cents(80000))!
    expect(result.contributionLimit).toBe(cents(8000))
    expect(result.allowableContribution).toBe(cents(8000))
    expect(result.deductibleAmount).toBe(cents(8000))
  })

  it('age 49 gets standard $7K limit', () => {
    // Born 1976 → age 49 in 2025
    const model = makeIRAReturn({ traditionalIRA: cents(8000), dateOfBirth: '1976-01-01' })
    const result = computeIRADeduction(model, cents(80000))!
    expect(result.contributionLimit).toBe(cents(7000))
    expect(result.allowableContribution).toBe(cents(7000))
  })

  // ── Employer plan phase-out tests ──────────────────────────

  it('covered by employer plan, MAGI below phase-out start → full deduction', () => {
    // Single: phase-out starts at $79K
    const model = makeIRAReturn({
      traditionalIRA: cents(7000),
      retirementPlan: true,
    })
    const result = computeIRADeduction(model, cents(70000))!
    expect(result.coveredByEmployerPlan).toBe(true)
    expect(result.phaseOutApplies).toBe(true)
    expect(result.deductibleAmount).toBe(cents(7000))
  })

  it('covered by employer plan, MAGI at phase-out start → full deduction', () => {
    const model = makeIRAReturn({
      traditionalIRA: cents(7000),
      retirementPlan: true,
    })
    const result = computeIRADeduction(model, cents(79000))!
    expect(result.deductibleAmount).toBe(cents(7000))
  })

  it('covered by employer plan, MAGI in phase-out range → partial deduction', () => {
    // Single: $79K–$89K range
    // MAGI = $84K → excess = $5K, range = $10K
    // Raw reduction = $7K × $5K / $10K = $3,500
    // Round UP to next $10 → $3,500 (already on $10 boundary in cents: 350000)
    // Deductible = $7K - $3,500 = $3,500
    const model = makeIRAReturn({
      traditionalIRA: cents(7000),
      retirementPlan: true,
    })
    const result = computeIRADeduction(model, cents(84000))!
    expect(result.coveredByEmployerPlan).toBe(true)
    expect(result.phaseOutApplies).toBe(true)
    expect(result.deductibleAmount).toBe(cents(3500))
  })

  it('covered by employer plan, MAGI above phase-out end → $0', () => {
    // Single: phase-out ends at $89K
    const model = makeIRAReturn({
      traditionalIRA: cents(7000),
      retirementPlan: true,
    })
    const result = computeIRADeduction(model, cents(95000))!
    expect(result.deductibleAmount).toBe(0)
  })

  it('covered by employer plan, MAGI at phase-out end → $0', () => {
    const model = makeIRAReturn({
      traditionalIRA: cents(7000),
      retirementPlan: true,
    })
    const result = computeIRADeduction(model, cents(89000))!
    expect(result.deductibleAmount).toBe(0)
  })

  it('MFS covered by employer plan → nearly full phase-out ($0–$10K range)', () => {
    // MFS: $0–$10K range
    // MAGI = $5K → excess = $5K, range = $10K
    // Raw reduction = $7K × $5K / $10K = $3,500
    // Deductible = $7K - $3,500 = $3,500
    const model = makeIRAReturn({
      traditionalIRA: cents(7000),
      filingStatus: 'mfs',
      retirementPlan: true,
    })
    const result = computeIRADeduction(model, cents(5000))!
    expect(result.phaseOutStart).toBe(0)
    expect(result.phaseOutEnd).toBe(cents(10000))
    expect(result.deductibleAmount).toBe(cents(3500))
  })

  it('MFJ covered by employer plan, MAGI in phase-out → partial deduction', () => {
    // MFJ: $126K–$146K range
    // MAGI = $136K → excess = $10K, range = $20K
    // Raw reduction = $7K × $10K / $20K = $3,500
    // Deductible = $7K - $3,500 = $3,500
    const model = makeIRAReturn({
      traditionalIRA: cents(7000),
      filingStatus: 'mfj',
      retirementPlan: true,
    })
    const result = computeIRADeduction(model, cents(136000))!
    expect(result.deductibleAmount).toBe(cents(3500))
  })

  it('not covered by employer plan → full deduction regardless of MAGI', () => {
    const model = makeIRAReturn({
      traditionalIRA: cents(7000),
      retirementPlan: false,
    })
    // Even at $500K MAGI, no phase-out when not covered
    const result = computeIRADeduction(model, cents(500000))!
    expect(result.coveredByEmployerPlan).toBe(false)
    expect(result.phaseOutApplies).toBe(false)
    expect(result.deductibleAmount).toBe(cents(7000))
  })

  it('phase-out rounding: reduction rounds UP to next $10', () => {
    // Single covered: $79K–$89K
    // MAGI = $80K → excess = $1K, range = $10K
    // Raw reduction = $7K × $1K / $10K = $700
    // $700 → ceil($700 / $10) × $10 = $700 (already on boundary)
    // Deductible = $7K - $700 = $6,300
    const model = makeIRAReturn({
      traditionalIRA: cents(7000),
      retirementPlan: true,
    })
    const result = computeIRADeduction(model, cents(80000))!
    expect(result.deductibleAmount).toBe(cents(6300))
  })

  it('phase-out rounding: non-round reduction rounds UP', () => {
    // Single covered: $79K–$89K
    // MAGI = $80,500 → excess = $1,500, range = $10K
    // Raw reduction = $7K × $1,500 / $10K = $1,050
    // ceil($1,050 / $10) × $10 = $1,050 (already on boundary)
    // But in cents: raw = 700000 × 150000 / 1000000 = 105000 cents
    // ceil(105000 / 1000) × 1000 = 105000 (on boundary)
    // Deductible = 700000 - 105000 = 595000 = $5,950
    const model = makeIRAReturn({
      traditionalIRA: cents(7000),
      retirementPlan: true,
    })
    const result = computeIRADeduction(model, cents(80500))!
    expect(result.deductibleAmount).toBe(cents(5950))
  })

  it('no dateOfBirth → standard $7K limit', () => {
    const model = makeIRAReturn({ traditionalIRA: cents(7000) })
    model.taxpayer.dateOfBirth = undefined
    const result = computeIRADeduction(model, cents(50000))!
    expect(result.contributionLimit).toBe(cents(7000))
  })

  // ── Spouse coverage tests (W-2 owner field) ──────────────

  it('MFJ: taxpayer not covered, spouse covered → spouse phase-out ($236K–$246K)', () => {
    // Taxpayer W-2 has no retirement plan; spouse W-2 does.
    // Spouse-covered phase-out for MFJ: $236K–$246K
    // MAGI = $241K → midpoint → 50% reduction
    // Reduction = $7K × $5K / $10K = $3,500 → deductible = $3,500
    const model = makeIRAReturn({
      traditionalIRA: cents(7000),
      filingStatus: 'mfj',
      w2s: [
        makeW2({
          id: 'w2-tp',
          employerName: 'Taxpayer Corp',
          box1: cents(120000),
          box2: cents(15000),
          box13RetirementPlan: false,
          owner: 'taxpayer',
        }),
        makeW2({
          id: 'w2-sp',
          employerName: 'Spouse Corp',
          box1: cents(121000),
          box2: cents(15000),
          box13RetirementPlan: true,
          owner: 'spouse',
        }),
      ],
    })
    const result = computeIRADeduction(model, cents(241000))!
    expect(result.coveredByEmployerPlan).toBe(false)
    expect(result.spouseCoveredByEmployerPlan).toBe(true)
    expect(result.phaseOutApplies).toBe(true)
    expect(result.phaseOutStart).toBe(cents(236000))
    expect(result.phaseOutEnd).toBe(cents(246000))
    expect(result.deductibleAmount).toBe(cents(3500))
  })

  it('MFJ: taxpayer not covered, spouse covered, MAGI below $236K → full deduction', () => {
    const model = makeIRAReturn({
      traditionalIRA: cents(7000),
      filingStatus: 'mfj',
      w2s: [
        makeW2({
          id: 'w2-tp',
          employerName: 'Taxpayer Corp',
          box1: cents(100000),
          box2: cents(12000),
          box13RetirementPlan: false,
          owner: 'taxpayer',
        }),
        makeW2({
          id: 'w2-sp',
          employerName: 'Spouse Corp',
          box1: cents(100000),
          box2: cents(12000),
          box13RetirementPlan: true,
          owner: 'spouse',
        }),
      ],
    })
    const result = computeIRADeduction(model, cents(200000))!
    expect(result.coveredByEmployerPlan).toBe(false)
    expect(result.spouseCoveredByEmployerPlan).toBe(true)
    expect(result.phaseOutApplies).toBe(true)
    expect(result.deductibleAmount).toBe(cents(7000))
  })

  it('MFJ: taxpayer not covered, spouse covered, MAGI above $246K → $0 deduction', () => {
    const model = makeIRAReturn({
      traditionalIRA: cents(7000),
      filingStatus: 'mfj',
      w2s: [
        makeW2({
          id: 'w2-tp',
          employerName: 'Taxpayer Corp',
          box1: cents(150000),
          box2: cents(20000),
          box13RetirementPlan: false,
          owner: 'taxpayer',
        }),
        makeW2({
          id: 'w2-sp',
          employerName: 'Spouse Corp',
          box1: cents(150000),
          box2: cents(20000),
          box13RetirementPlan: true,
          owner: 'spouse',
        }),
      ],
    })
    const result = computeIRADeduction(model, cents(300000))!
    expect(result.deductibleAmount).toBe(0)
  })

  it('MFJ: both covered → uses taxpayer-covered phase-out ($126K–$146K), not spouse range', () => {
    const model = makeIRAReturn({
      traditionalIRA: cents(7000),
      filingStatus: 'mfj',
      w2s: [
        makeW2({
          id: 'w2-tp',
          employerName: 'Taxpayer Corp',
          box1: cents(70000),
          box2: cents(8000),
          box13RetirementPlan: true,
          owner: 'taxpayer',
        }),
        makeW2({
          id: 'w2-sp',
          employerName: 'Spouse Corp',
          box1: cents(66000),
          box2: cents(8000),
          box13RetirementPlan: true,
          owner: 'spouse',
        }),
      ],
    })
    const result = computeIRADeduction(model, cents(136000))!
    expect(result.coveredByEmployerPlan).toBe(true)
    expect(result.phaseOutStart).toBe(cents(126000))
    expect(result.phaseOutEnd).toBe(cents(146000))
    expect(result.deductibleAmount).toBe(cents(3500))
  })

  it('MFJ: neither covered → no phase-out, full deduction', () => {
    const model = makeIRAReturn({
      traditionalIRA: cents(7000),
      filingStatus: 'mfj',
      w2s: [
        makeW2({
          id: 'w2-tp',
          employerName: 'Taxpayer Corp',
          box1: cents(120000),
          box2: cents(15000),
          box13RetirementPlan: false,
          owner: 'taxpayer',
        }),
        makeW2({
          id: 'w2-sp',
          employerName: 'Spouse Corp',
          box1: cents(120000),
          box2: cents(15000),
          box13RetirementPlan: false,
          owner: 'spouse',
        }),
      ],
    })
    const result = computeIRADeduction(model, cents(240000))!
    expect(result.coveredByEmployerPlan).toBe(false)
    expect(result.spouseCoveredByEmployerPlan).toBe(false)
    expect(result.phaseOutApplies).toBe(false)
    expect(result.deductibleAmount).toBe(cents(7000))
  })

  it('single filer: spouse W-2 owner is ignored', () => {
    // Single filer shouldn't get spouse coverage even if a W-2 is tagged as spouse
    const model = makeIRAReturn({
      traditionalIRA: cents(7000),
      filingStatus: 'single',
      w2s: [
        makeW2({
          id: 'w2-1',
          employerName: 'Acme',
          box1: cents(80000),
          box2: cents(10000),
          box13RetirementPlan: true,
          owner: 'spouse',
        }),
      ],
    })
    const result = computeIRADeduction(model, cents(80000))!
    // Tagged as spouse but single filer → taxpayer is not covered, spouse coverage doesn't apply
    expect(result.coveredByEmployerPlan).toBe(false)
    expect(result.spouseCoveredByEmployerPlan).toBe(false)
    expect(result.phaseOutApplies).toBe(false)
    expect(result.deductibleAmount).toBe(cents(7000))
  })
})

// ── Integration tests ────────────────────────────────────────

describe('IRA deduction integration with Form 1040', () => {
  it('IRA contribution flows to Line 10 and reduces AGI', () => {
    const model = makeIRAReturn({ traditionalIRA: cents(7000) })
    const result = computeForm1040(model)

    // Line 9 = $80K wages
    expect(result.line9.amount).toBe(cents(80000))
    // Line 10 = $7K IRA deduction
    expect(result.line10.amount).toBe(cents(7000))
    // Line 11 (AGI) = $80K - $7K = $73K
    expect(result.line11.amount).toBe(cents(73000))
    // iraDeduction result should be populated
    expect(result.iraDeduction).not.toBeNull()
    expect(result.iraDeduction!.deductibleAmount).toBe(cents(7000))
  })

  it('no IRA contribution → Line 10 is $0, AGI equals total income', () => {
    const model = {
      ...emptyTaxReturn(2025),
      w2s: [
        makeW2({
          id: 'w2-1',
          employerName: 'Acme Corp',
          box1: cents(80000),
          box2: cents(10000),
        }),
      ],
    }
    const result = computeForm1040(model)

    expect(result.line10.amount).toBe(0)
    expect(result.line11.amount).toBe(result.line9.amount)
    expect(result.iraDeduction).toBeNull()
  })

  it('covered by employer plan with phase-out → partial deduction reduces AGI', () => {
    // Single, covered, MAGI (Line 9) = $84K
    // Phase-out: $79K–$89K, excess = $5K
    // Reduction = $7K × $5K / $10K = $3,500
    // Deductible = $3,500
    const model = makeIRAReturn({
      traditionalIRA: cents(7000),
      retirementPlan: true,
      w2s: [
        makeW2({
          id: 'w2-1',
          employerName: 'Acme Corp',
          box1: cents(84000),
          box2: cents(12000),
          box13RetirementPlan: true,
        }),
      ],
    })
    const result = computeForm1040(model)

    expect(result.line9.amount).toBe(cents(84000))
    expect(result.line10.amount).toBe(cents(3500))
    expect(result.line11.amount).toBe(cents(80500))
    expect(result.iraDeduction!.phaseOutApplies).toBe(true)
  })
})
