/**
 * Tests for HSA Deduction (Form 8889)
 *
 * Covers:
 * - No HSA data → null
 * - Self-only full contribution
 * - Family full contribution
 * - Employer via W-2 code W + taxpayer top-up
 * - Employer contributes full limit → $0 deduction
 * - Employer over-contributes → excess penalty, $0 deduction
 * - Age 55+ catch-up
 * - Excess contributions → 6% penalty
 * - Qualified distributions → no tax, no penalty
 * - Non-qualified distributions → taxable + 20% penalty
 * - Age 65+ distributions → taxable but no 20% penalty
 * - Contributions capped at limit
 * - Multiple W-2s with code W entries
 * - Integration through computeForm1040
 */

import { describe, it, expect } from 'vitest'
import { cents } from '../../src/model/traced'
import { emptyTaxReturn } from '../../src/model/types'
import type { TaxReturn, HSAInfo, Form1099SA } from '../../src/model/types'
import { computeHSADeduction } from '../../src/rules/2025/hsaDeduction'
import type { HSAResult } from '../../src/rules/2025/hsaDeduction'
import { computeForm1040 } from '../../src/rules/2025/form1040'
import { makeW2 } from '../fixtures/returns'
import {
  HSA_LIMIT_SELF_ONLY,
  HSA_LIMIT_FAMILY,
  HSA_CATCHUP_AMOUNT,
} from '../../src/rules/2025/constants'

// ── Helpers ──────────────────────────────────────────────────────

function hsaReturn(overrides: {
  hsa: HSAInfo
  w2Box12W?: number | number[]  // single amount or array of amounts for multiple W-2s
  form1099SAs?: Form1099SA[]
}): TaxReturn {
  const w2Amounts = overrides.w2Box12W !== undefined
    ? (Array.isArray(overrides.w2Box12W) ? overrides.w2Box12W : [overrides.w2Box12W])
    : []

  const w2s = w2Amounts.length > 0
    ? w2Amounts.map((amount, i) => makeW2({
        id: `w2-${i + 1}`,
        employerName: `Employer ${i + 1}`,
        box1: cents(75000),
        box2: cents(8000),
        box12: [{ code: 'W', amount }],
      }))
    : [makeW2({
        id: 'w2-1',
        employerName: 'Acme Corp',
        box1: cents(75000),
        box2: cents(8000),
      })]

  return {
    ...emptyTaxReturn(2025),
    w2s,
    hsa: overrides.hsa,
    form1099SAs: overrides.form1099SAs,
  }
}

// ── Tests ────────────────────────────────────────────────────────

describe('computeHSADeduction', () => {
  it('returns null when no HSA data', () => {
    const model = emptyTaxReturn(2025)
    expect(computeHSADeduction(model)).toBeNull()
  })

  // ── Self-only coverage ────────────────────────────────────────

  it('self-only: full $4,300 taxpayer contribution → full deduction', () => {
    const result = computeHSADeduction(hsaReturn({
      hsa: {
        coverageType: 'self-only',
        contributions: cents(4300),
        qualifiedExpenses: 0,
        age55OrOlder: false,
        age65OrDisabled: false,
      },
    }))!

    expect(result).not.toBeNull()
    expect(result.coverageType).toBe('self-only')
    expect(result.annualLimit).toBe(HSA_LIMIT_SELF_ONLY)
    expect(result.catchUpAmount).toBe(0)
    expect(result.totalLimit).toBe(HSA_LIMIT_SELF_ONLY)
    expect(result.employerContributions).toBe(0)
    expect(result.taxpayerContributions).toBe(cents(4300))
    expect(result.deductibleAmount).toBe(cents(4300))
    expect(result.excessContributions).toBe(0)
    expect(result.excessPenalty).toBe(0)
  })

  // ── Family coverage ───────────────────────────────────────────

  it('family: full $8,550 taxpayer contribution → full deduction', () => {
    const result = computeHSADeduction(hsaReturn({
      hsa: {
        coverageType: 'family',
        contributions: cents(8550),
        qualifiedExpenses: 0,
        age55OrOlder: false,
        age65OrDisabled: false,
      },
    }))!

    expect(result.annualLimit).toBe(HSA_LIMIT_FAMILY)
    expect(result.totalLimit).toBe(HSA_LIMIT_FAMILY)
    expect(result.deductibleAmount).toBe(cents(8550))
    expect(result.excessContributions).toBe(0)
  })

  // ── Employer contributions via W-2 code W ─────────────────────

  it('employer contributes part via W-2 code W, taxpayer tops up', () => {
    const result = computeHSADeduction(hsaReturn({
      hsa: {
        coverageType: 'self-only',
        contributions: cents(2300),  // taxpayer contributes $2,300
        qualifiedExpenses: 0,
        age55OrOlder: false,
        age65OrDisabled: false,
      },
      w2Box12W: cents(2000),  // employer contributes $2,000
    }))!

    expect(result.employerContributions).toBe(cents(2000))
    expect(result.taxpayerContributions).toBe(cents(2300))
    expect(result.totalContributions).toBe(cents(4300))
    // Room after employer = $4,300 - $2,000 = $2,300
    expect(result.deductibleAmount).toBe(cents(2300))
    expect(result.excessContributions).toBe(0)
  })

  it('employer contributes full limit → $0 taxpayer deduction', () => {
    const result = computeHSADeduction(hsaReturn({
      hsa: {
        coverageType: 'self-only',
        contributions: cents(500),  // taxpayer tries to contribute $500
        qualifiedExpenses: 0,
        age55OrOlder: false,
        age65OrDisabled: false,
      },
      w2Box12W: cents(4300),  // employer contributes full $4,300
    }))!

    expect(result.employerContributions).toBe(cents(4300))
    // Room after employer = $4,300 - $4,300 = $0
    expect(result.deductibleAmount).toBe(0)
    // Total = $4,800, limit = $4,300 → excess = $500
    expect(result.excessContributions).toBe(cents(500))
    expect(result.excessPenalty).toBe(Math.round(cents(500) * 0.06))
  })

  it('employer over-contributes → excess penalty, $0 deduction', () => {
    const result = computeHSADeduction(hsaReturn({
      hsa: {
        coverageType: 'self-only',
        contributions: 0,
        qualifiedExpenses: 0,
        age55OrOlder: false,
        age65OrDisabled: false,
      },
      w2Box12W: cents(5000),  // employer over-contributes by $700
    }))!

    expect(result.employerContributions).toBe(cents(5000))
    expect(result.deductibleAmount).toBe(0)
    expect(result.excessContributions).toBe(cents(700))
    expect(result.excessPenalty).toBe(Math.round(cents(700) * 0.06))
  })

  // ── Age 55+ catch-up ──────────────────────────────────────────

  it('age 55+ gets $1,000 extra limit (self-only → $5,300)', () => {
    const result = computeHSADeduction(hsaReturn({
      hsa: {
        coverageType: 'self-only',
        contributions: cents(5300),
        qualifiedExpenses: 0,
        age55OrOlder: true,
        age65OrDisabled: false,
      },
    }))!

    expect(result.catchUpAmount).toBe(HSA_CATCHUP_AMOUNT)
    expect(result.totalLimit).toBe(HSA_LIMIT_SELF_ONLY + HSA_CATCHUP_AMOUNT)
    expect(result.deductibleAmount).toBe(cents(5300))
    expect(result.excessContributions).toBe(0)
  })

  it('age 55+ family gets $1,000 extra limit (family → $9,550)', () => {
    const result = computeHSADeduction(hsaReturn({
      hsa: {
        coverageType: 'family',
        contributions: cents(9550),
        qualifiedExpenses: 0,
        age55OrOlder: true,
        age65OrDisabled: false,
      },
    }))!

    expect(result.totalLimit).toBe(HSA_LIMIT_FAMILY + HSA_CATCHUP_AMOUNT)
    expect(result.deductibleAmount).toBe(cents(9550))
    expect(result.excessContributions).toBe(0)
  })

  // ── Excess contributions ──────────────────────────────────────

  it('excess contributions → 6% penalty', () => {
    const result = computeHSADeduction(hsaReturn({
      hsa: {
        coverageType: 'self-only',
        contributions: cents(5000),  // $700 over $4,300 limit
        qualifiedExpenses: 0,
        age55OrOlder: false,
        age65OrDisabled: false,
      },
    }))!

    expect(result.excessContributions).toBe(cents(700))
    expect(result.excessPenalty).toBe(Math.round(cents(700) * 0.06))
    // Deductible is capped at limit
    expect(result.deductibleAmount).toBe(cents(4300))
  })

  // ── Distributions ─────────────────────────────────────────────

  it('qualified distributions → no tax, no penalty', () => {
    const result = computeHSADeduction(hsaReturn({
      hsa: {
        coverageType: 'self-only',
        contributions: cents(2000),
        qualifiedExpenses: cents(3000),  // qualified expenses ≥ distributions
        age55OrOlder: false,
        age65OrDisabled: false,
      },
      form1099SAs: [
        { id: 'sa-1', payerName: 'HSA Bank', box1: cents(3000), box2: 0 },
      ],
    }))!

    expect(result.totalDistributions).toBe(cents(3000))
    expect(result.qualifiedMedicalExpenses).toBe(cents(3000))
    expect(result.taxableDistributions).toBe(0)
    expect(result.distributionPenalty).toBe(0)
  })

  it('non-qualified distributions → taxable + 20% penalty', () => {
    const result = computeHSADeduction(hsaReturn({
      hsa: {
        coverageType: 'self-only',
        contributions: cents(2000),
        qualifiedExpenses: cents(1000),
        age55OrOlder: false,
        age65OrDisabled: false,
      },
      form1099SAs: [
        { id: 'sa-1', payerName: 'HSA Bank', box1: cents(4000), box2: 0 },
      ],
    }))!

    expect(result.totalDistributions).toBe(cents(4000))
    // Taxable = $4,000 - $1,000 = $3,000
    expect(result.taxableDistributions).toBe(cents(3000))
    // 20% penalty on $3,000
    expect(result.distributionPenalty).toBe(Math.round(cents(3000) * 0.20))
  })

  it('age 65+ distributions → taxable but no 20% penalty', () => {
    const result = computeHSADeduction(hsaReturn({
      hsa: {
        coverageType: 'self-only',
        contributions: cents(2000),
        qualifiedExpenses: cents(1000),
        age55OrOlder: true,
        age65OrDisabled: true,
      },
      form1099SAs: [
        { id: 'sa-1', payerName: 'HSA Bank', box1: cents(4000), box2: 0 },
      ],
    }))!

    expect(result.taxableDistributions).toBe(cents(3000))
    expect(result.distributionPenalty).toBe(0)  // exempt — age 65+
  })

  it('no distributions, no 1099-SA → zero distribution fields', () => {
    const result = computeHSADeduction(hsaReturn({
      hsa: {
        coverageType: 'self-only',
        contributions: cents(3000),
        qualifiedExpenses: 0,
        age55OrOlder: false,
        age65OrDisabled: false,
      },
    }))!

    expect(result.totalDistributions).toBe(0)
    expect(result.taxableDistributions).toBe(0)
    expect(result.distributionPenalty).toBe(0)
  })

  // ── Contribution capped at limit ──────────────────────────────

  it('taxpayer contributes more than limit → deduction capped', () => {
    const result = computeHSADeduction(hsaReturn({
      hsa: {
        coverageType: 'self-only',
        contributions: cents(6000),  // way over $4,300
        qualifiedExpenses: 0,
        age55OrOlder: false,
        age65OrDisabled: false,
      },
    }))!

    // Deductible = min($6,000, $4,300 - $0) = $4,300
    expect(result.deductibleAmount).toBe(cents(4300))
    expect(result.excessContributions).toBe(cents(1700))
  })

  // ── Multiple W-2s with code W ─────────────────────────────────

  it('sums code W from multiple W-2s', () => {
    const result = computeHSADeduction(hsaReturn({
      hsa: {
        coverageType: 'self-only',
        contributions: cents(1300),
        qualifiedExpenses: 0,
        age55OrOlder: false,
        age65OrDisabled: false,
      },
      w2Box12W: [cents(1500), cents(1500)],  // two employers, $1,500 each
    }))!

    expect(result.employerContributions).toBe(cents(3000))
    expect(result.totalContributions).toBe(cents(4300))
    // Room = $4,300 - $3,000 = $1,300
    expect(result.deductibleAmount).toBe(cents(1300))
    expect(result.excessContributions).toBe(0)
  })

  // ── Multiple 1099-SAs ─────────────────────────────────────────

  it('sums distributions from multiple 1099-SAs', () => {
    const result = computeHSADeduction(hsaReturn({
      hsa: {
        coverageType: 'self-only',
        contributions: cents(2000),
        qualifiedExpenses: cents(2000),
        age55OrOlder: false,
        age65OrDisabled: false,
      },
      form1099SAs: [
        { id: 'sa-1', payerName: 'HSA Bank A', box1: cents(1500), box2: 0 },
        { id: 'sa-2', payerName: 'HSA Bank B', box1: cents(2500), box2: 0 },
      ],
    }))!

    expect(result.totalDistributions).toBe(cents(4000))
    // Taxable = $4,000 - $2,000 = $2,000
    expect(result.taxableDistributions).toBe(cents(2000))
  })

  // ── Combined scenario ─────────────────────────────────────────

  it('combined: employer W, taxpayer top-up, excess, distributions', () => {
    const result = computeHSADeduction(hsaReturn({
      hsa: {
        coverageType: 'family',
        contributions: cents(5000),
        qualifiedExpenses: cents(2000),
        age55OrOlder: false,
        age65OrDisabled: false,
      },
      w2Box12W: cents(4000),
      form1099SAs: [
        { id: 'sa-1', payerName: 'HSA Bank', box1: cents(5000), box2: 0 },
      ],
    }))!

    // Family limit = $8,550
    expect(result.totalLimit).toBe(cents(8550))
    expect(result.employerContributions).toBe(cents(4000))
    expect(result.totalContributions).toBe(cents(9000))
    // Excess = $9,000 - $8,550 = $450
    expect(result.excessContributions).toBe(cents(450))
    expect(result.excessPenalty).toBe(Math.round(cents(450) * 0.06))
    // Deductible = min($5,000, $8,550 - $4,000) = min($5,000, $4,550) = $4,550
    expect(result.deductibleAmount).toBe(cents(4550))
    // Distributions: $5,000 - $2,000 qualified = $3,000 taxable
    expect(result.taxableDistributions).toBe(cents(3000))
    expect(result.distributionPenalty).toBe(Math.round(cents(3000) * 0.20))
  })

  // ── Zero contributions but has HSA info ───────────────────────

  it('zero contributions with distributions only', () => {
    const result = computeHSADeduction(hsaReturn({
      hsa: {
        coverageType: 'self-only',
        contributions: 0,
        qualifiedExpenses: cents(1000),
        age55OrOlder: false,
        age65OrDisabled: false,
      },
      form1099SAs: [
        { id: 'sa-1', payerName: 'HSA Bank', box1: cents(1000), box2: 0 },
      ],
    }))!

    expect(result.deductibleAmount).toBe(0)
    expect(result.totalDistributions).toBe(cents(1000))
    expect(result.taxableDistributions).toBe(0)  // fully qualified
    expect(result.distributionPenalty).toBe(0)
  })
})

// ── Integration tests through computeForm1040 ───────────────────

describe('HSA integration with Form 1040', () => {
  it('HSA deduction flows into Line 10 (adjustments)', () => {
    const model: TaxReturn = {
      ...emptyTaxReturn(2025),
      w2s: [makeW2({
        id: 'w2-1',
        employerName: 'Acme Corp',
        box1: cents(75000),
        box2: cents(8000),
      })],
      hsa: {
        coverageType: 'self-only',
        contributions: cents(4300),
        qualifiedExpenses: 0,
        age55OrOlder: false,
        age65OrDisabled: false,
      },
    }

    const result = computeForm1040(model)
    expect(result.hsaResult).not.toBeNull()
    expect(result.hsaResult!.deductibleAmount).toBe(cents(4300))
    // Line 10 should include the HSA deduction
    expect(result.line10.amount).toBe(cents(4300))
    // AGI = $75,000 - $4,300 = $70,700
    expect(result.line11.amount).toBe(cents(70700))
  })

  it('taxable HSA distributions flow into Line 8 (other income)', () => {
    const model: TaxReturn = {
      ...emptyTaxReturn(2025),
      w2s: [makeW2({
        id: 'w2-1',
        employerName: 'Acme Corp',
        box1: cents(75000),
        box2: cents(8000),
      })],
      hsa: {
        coverageType: 'self-only',
        contributions: 0,
        qualifiedExpenses: cents(1000),
        age55OrOlder: false,
        age65OrDisabled: false,
      },
      form1099SAs: [
        { id: 'sa-1', payerName: 'HSA Bank', box1: cents(5000), box2: 0 },
      ],
    }

    const result = computeForm1040(model)
    // Taxable distributions = $5,000 - $1,000 = $4,000
    expect(result.line8.amount).toBe(cents(4000))
    // Total income = $75,000 + $4,000 = $79,000
    expect(result.line9.amount).toBe(cents(79000))
  })

  it('HSA penalties flow into Line 23 (other taxes)', () => {
    const model: TaxReturn = {
      ...emptyTaxReturn(2025),
      w2s: [makeW2({
        id: 'w2-1',
        employerName: 'Acme Corp',
        box1: cents(75000),
        box2: cents(8000),
      })],
      hsa: {
        coverageType: 'self-only',
        contributions: cents(5000),  // $700 excess
        qualifiedExpenses: cents(1000),
        age55OrOlder: false,
        age65OrDisabled: false,
      },
      form1099SAs: [
        { id: 'sa-1', payerName: 'HSA Bank', box1: cents(3000), box2: 0 },
      ],
    }

    const result = computeForm1040(model)
    // Excess = $5,000 - $4,300 = $700 → 6% = $42
    const excessPenalty = Math.round(cents(700) * 0.06)
    // Taxable distributions = $3,000 - $1,000 = $2,000 → 20% = $400
    const distPenalty = Math.round(cents(2000) * 0.20)
    expect(result.line23.amount).toBe(excessPenalty + distPenalty)
  })

  it('HSA + IRA both flow into Line 10', () => {
    const model: TaxReturn = {
      ...emptyTaxReturn(2025),
      w2s: [makeW2({
        id: 'w2-1',
        employerName: 'Acme Corp',
        box1: cents(75000),
        box2: cents(8000),
      })],
      hsa: {
        coverageType: 'self-only',
        contributions: cents(4300),
        qualifiedExpenses: 0,
        age55OrOlder: false,
        age65OrDisabled: false,
      },
      retirementContributions: {
        traditionalIRA: cents(7000),
        rothIRA: 0,
      },
    }

    const result = computeForm1040(model)
    // Line 10 = IRA deduction ($7,000) + HSA deduction ($4,300) = $11,300
    expect(result.line10.amount).toBe(cents(7000) + cents(4300))
  })

  it('no HSA → hsaResult is null, no impact on lines', () => {
    const model: TaxReturn = {
      ...emptyTaxReturn(2025),
      w2s: [makeW2({
        id: 'w2-1',
        employerName: 'Acme Corp',
        box1: cents(75000),
        box2: cents(8000),
      })],
    }

    const result = computeForm1040(model)
    expect(result.hsaResult).toBeNull()
    expect(result.line10.amount).toBe(0)
    expect(result.line23.amount).toBe(0)
  })
})
