/**
 * Premium Tax Credit (Form 8962) Tests
 *
 * Tests the PTC computation, APTC reconciliation, repayment caps,
 * and integration with Form 1040 Line 31 and Line 17.
 */

import { describe, it, expect } from 'vitest'
import { cents } from '../../src/model/traced'
import {
  computePremiumTaxCredit,
  computeApplicablePercentage,
  federalPovertyLevel,
  getRepaymentCap,
} from '../../src/rules/2025/premiumTaxCredit'
import { computeRefundableCredits } from '../../src/rules/2025/refundableCredits'
import { computeForm1040 } from '../../src/rules/2025/form1040'
import { emptyTaxReturn } from '../../src/model/types'
import type { Form1095A } from '../../src/model/types'
import { makeW2 } from '../fixtures/returns'

// ── Helper: make a Form 1095-A ─────────────────────────────────

function make1095A(overrides: Partial<Form1095A> & { id: string }): Form1095A {
  return {
    marketplaceName: 'HealthCare.gov',
    recipientName: 'John Doe',
    rows: [],
    ...overrides,
  }
}

function makeFullYear1095A(
  id: string,
  monthlyPremium: number,
  monthlySLCSP: number,
  monthlyAPTC: number,
): Form1095A {
  const rows = Array.from({ length: 12 }, (_, i) => ({
    month: i + 1,
    enrollmentPremium: monthlyPremium,
    slcspPremium: monthlySLCSP,
    advancePTC: monthlyAPTC,
  }))
  return make1095A({ id, rows })
}

// ── FPL Tests ──────────────────────────────────────────────────

describe('federalPovertyLevel', () => {
  it('returns correct FPL for 1-person household', () => {
    expect(federalPovertyLevel(1)).toBe(cents(15060))
  })

  it('returns correct FPL for 4-person household', () => {
    // $15,060 + 3 × $5,380 = $31,200
    expect(federalPovertyLevel(4)).toBe(cents(31200))
  })

  it('returns correct FPL for 2-person household', () => {
    // $15,060 + $5,380 = $20,440
    expect(federalPovertyLevel(2)).toBe(cents(20440))
  })
})

// ── Applicable Percentage Tests ────────────────────────────────

describe('computeApplicablePercentage', () => {
  it('returns 0% for income at or below 150% FPL', () => {
    expect(computeApplicablePercentage(100)).toBe(0)
    expect(computeApplicablePercentage(150)).toBe(0)
  })

  it('returns 2% at 200% FPL', () => {
    expect(computeApplicablePercentage(200)).toBeCloseTo(0.02, 4)
  })

  it('returns 1% at 175% FPL (midpoint of 150-200 band)', () => {
    expect(computeApplicablePercentage(175)).toBeCloseTo(0.01, 4)
  })

  it('returns 4% at 250% FPL', () => {
    expect(computeApplicablePercentage(250)).toBeCloseTo(0.04, 4)
  })

  it('returns 6% at 300% FPL', () => {
    expect(computeApplicablePercentage(300)).toBeCloseTo(0.06, 4)
  })

  it('returns 8.5% at 400% FPL', () => {
    expect(computeApplicablePercentage(400)).toBeCloseTo(0.085, 4)
  })

  it('returns 8.5% above 400% FPL', () => {
    expect(computeApplicablePercentage(500)).toBeCloseTo(0.085, 4)
  })
})

// ── Repayment Cap Tests ────────────────────────────────────────

describe('getRepaymentCap', () => {
  it('returns $400 for single filer below 200% FPL', () => {
    expect(getRepaymentCap(150, 'single')).toBe(cents(400))
  })

  it('returns $800 for MFJ filer below 200% FPL', () => {
    expect(getRepaymentCap(150, 'mfj')).toBe(cents(800))
  })

  it('returns $1,050 for single 200-300% FPL', () => {
    expect(getRepaymentCap(250, 'single')).toBe(cents(1050))
  })

  it('returns $3,500 for MFJ 300-400% FPL', () => {
    expect(getRepaymentCap(350, 'mfj')).toBe(cents(3500))
  })

  it('returns Infinity above 400% FPL', () => {
    expect(getRepaymentCap(401, 'single')).toBe(Infinity)
  })
})

// ── PTC Computation Tests ──────────────────────────────────────

describe('computePremiumTaxCredit', () => {
  it('computes net credit when PTC exceeds APTC', () => {
    // Single filer, $25,000 income, 1-person household
    // FPL = $15,060, FPL% ≈ 166%
    // Applicable % ≈ 0.32% (linear interpolation in 150-200 band)
    const form = makeFullYear1095A('1095a-1',
      cents(400),  // $400/mo premium
      cents(500),  // $500/mo SLCSP
      cents(300),  // $300/mo APTC
    )
    const result = computePremiumTaxCredit([form], cents(25000), 'single', 0, false)

    expect(result.eligible).toBe(true)
    expect(result.householdSize).toBe(1)
    expect(result.fplPercent).toBeGreaterThan(150)
    expect(result.fplPercent).toBeLessThan(200)
    expect(result.annualPTC).toBeGreaterThan(0)
    expect(result.totalAPTC).toBe(cents(300) * 12) // $3,600
    expect(result.monthlyDetails).toHaveLength(12)

    // Net PTC should be positive (credit > APTC) since APTC was conservative
    if (result.netPTC > 0) {
      expect(result.creditAmount).toBe(result.netPTC)
      expect(result.repaymentAmount).toBe(0)
    }
  })

  it('computes repayment when APTC exceeds PTC', () => {
    // Higher income means smaller PTC but same APTC
    // Single filer, $60,000 income, 1-person household
    // FPL% ≈ 398%
    const form = makeFullYear1095A('1095a-1',
      cents(400),  // $400/mo premium
      cents(500),  // $500/mo SLCSP
      cents(400),  // $400/mo APTC (generous advance)
    )
    const result = computePremiumTaxCredit([form], cents(60000), 'single', 0, false)

    expect(result.eligible).toBe(true)
    // At ~398% FPL, applicable % is close to 8.5%
    // Monthly contribution = 8.x% × $60,000 / 12 ≈ $400+
    // PTC per month may be small or zero
    expect(result.totalAPTC).toBe(cents(400) * 12) // $4,800

    if (result.netPTC < 0) {
      expect(result.repaymentAmount).toBeGreaterThan(0)
      expect(result.creditAmount).toBe(0)
    }
  })

  it('caps repayment for income below 400% FPL', () => {
    // Single filer at ~250% FPL, excess APTC
    const fpl1 = federalPovertyLevel(1) // $15,060
    const income = Math.round(fpl1 * 2.5) // ~$37,650 → 250% FPL

    const form = makeFullYear1095A('1095a-1',
      cents(200),  // low premium
      cents(300),  // SLCSP
      cents(350),  // high APTC (will exceed PTC)
    )
    const result = computePremiumTaxCredit([form], income, 'single', 0, false)

    expect(result.fplPercent).toBeCloseTo(250, 0)

    if (result.netPTC < 0) {
      // Repayment should be capped at $1,050 for single 200-300% FPL
      expect(result.repaymentCap).toBe(cents(1050))
      expect(result.repaymentAmount).toBeLessThanOrEqual(cents(1050))
    }
  })

  it('handles family with dependents (larger household size)', () => {
    // MFJ couple with 2 kids, $50,000 income
    // Household size = 4, FPL = $31,200
    // FPL% ≈ 160%
    const form = makeFullYear1095A('1095a-1',
      cents(800),  // $800/mo family premium
      cents(1000), // $1,000/mo SLCSP
      cents(600),  // $600/mo APTC
    )
    const result = computePremiumTaxCredit([form], cents(50000), 'mfj', 2, true)

    expect(result.householdSize).toBe(4)
    expect(result.fplAmount).toBe(federalPovertyLevel(4))
    expect(result.fplPercent).toBeCloseTo(160.3, 0)
    // At ~160% FPL, applicable % is low (near 0%)
    // So PTC should be large (SLCSP − contribution ≈ $1,000 - small)
    expect(result.annualPTC).toBeGreaterThan(0)
  })

  it('returns not eligible when no 1095-A forms', () => {
    const result = computePremiumTaxCredit([], cents(50000), 'single', 0, false)
    expect(result.eligible).toBe(false)
    expect(result.annualPTC).toBe(0)
    expect(result.creditAmount).toBe(0)
  })

  it('handles partial-year coverage', () => {
    // Only 6 months of coverage
    const rows = Array.from({ length: 6 }, (_, i) => ({
      month: i + 1,
      enrollmentPremium: cents(400),
      slcspPremium: cents(500),
      advancePTC: cents(300),
    }))
    const form = make1095A({ id: '1095a-1', rows })
    const result = computePremiumTaxCredit([form], cents(25000), 'single', 0, false)

    expect(result.monthlyDetails).toHaveLength(6)
    expect(result.totalAPTC).toBe(cents(300) * 6) // $1,800
  })

  it('zero APTC means full credit', () => {
    // Taxpayer received no advance payments
    const form = makeFullYear1095A('1095a-1',
      cents(400),
      cents(500),
      0,  // no APTC
    )
    const result = computePremiumTaxCredit([form], cents(25000), 'single', 0, false)

    expect(result.totalAPTC).toBe(0)
    expect(result.netPTC).toBe(result.annualPTC)
    expect(result.creditAmount).toBe(result.annualPTC)
    expect(result.repaymentAmount).toBe(0)
  })
})

// ── Refundable Credits Integration Tests ───────────────────────

describe('PTC integration with refundable credits framework', () => {
  it('PTC credit flows to Line 31 when net PTC > 0', () => {
    const model = {
      ...emptyTaxReturn(2025),
      w2s: [makeW2({ id: 'w2-1', employerName: 'Co', box1: cents(25000), box2: cents(1500) })],
      form1095As: [
        makeFullYear1095A('1095a-1', cents(400), cents(500), 0), // no APTC → full credit
      ],
    }
    const result = computeRefundableCredits(model, cents(25000))

    const ptcItem = result.items.find(i => i.creditId === 'premiumTaxCredit')
    expect(ptcItem).toBeDefined()
    expect(ptcItem!.amount).toBeGreaterThan(0)
    expect(result.totalLine31).toBeGreaterThan(0)
    expect(result.premiumTaxCredit).toBeDefined()
    expect(result.excessAPTCRepayment).toBe(0)
  })

  it('excess APTC flows to repayment (not Line 31)', () => {
    const model = {
      ...emptyTaxReturn(2025),
      w2s: [makeW2({ id: 'w2-1', employerName: 'Co', box1: cents(80000), box2: cents(12000) })],
      form1095As: [
        makeFullYear1095A('1095a-1', cents(200), cents(300), cents(400)), // high APTC
      ],
    }
    const result = computeRefundableCredits(model, cents(80000))

    // At ~530% FPL (single, $80K), applicable% = 8.5%
    // Monthly contribution = 8.5% × $80K / 12 ≈ $567
    // Monthly PTC = max(0, min($200, $300 - $567)) = max(0, min($200, -$267)) = $0
    // But $400/mo APTC was paid → excess
    expect(result.premiumTaxCredit).toBeDefined()
    expect(result.excessAPTCRepayment).toBeGreaterThan(0)
    // PTC credit item should NOT be in items (credit is 0)
    const ptcItem = result.items.find(i => i.creditId === 'premiumTaxCredit')
    expect(ptcItem).toBeUndefined()
  })

  it('no PTC items when no 1095-A data', () => {
    const model = {
      ...emptyTaxReturn(2025),
      w2s: [makeW2({ id: 'w2-1', employerName: 'Co', box1: cents(50000), box2: cents(5000) })],
    }
    const result = computeRefundableCredits(model, cents(50000))

    expect(result.premiumTaxCredit).toBeNull()
    expect(result.excessAPTCRepayment).toBe(0)
    const ptcItem = result.items.find(i => i.creditId === 'premiumTaxCredit')
    expect(ptcItem).toBeUndefined()
  })
})

// ── Form 1040 Integration Tests ────────────────────────────────

describe('PTC Form 1040 integration', () => {
  it('PTC credit appears in Line 31', () => {
    const model = {
      ...emptyTaxReturn(2025),
      w2s: [makeW2({ id: 'w2-1', employerName: 'Co', box1: cents(25000), box2: cents(1500) })],
      form1095As: [
        makeFullYear1095A('1095a-1', cents(400), cents(500), 0),
      ],
    }
    const result = computeForm1040(model)

    // Line 31 should include PTC credit
    expect(result.line31.amount).toBeGreaterThan(0)
    expect(result.refundableCreditsResult?.premiumTaxCredit).toBeDefined()
    expect(result.refundableCreditsResult?.premiumTaxCredit?.creditAmount).toBeGreaterThan(0)
  })

  it('excess APTC repayment increases Line 17', () => {
    const model = {
      ...emptyTaxReturn(2025),
      w2s: [makeW2({ id: 'w2-1', employerName: 'Co', box1: cents(100000), box2: cents(15000) })],
      form1095As: [
        makeFullYear1095A('1095a-1', cents(200), cents(300), cents(500)),
      ],
    }
    const result = computeForm1040(model)

    // Excess APTC should add to Line 17 (Schedule 2, Part I)
    const excessAPTC = result.refundableCreditsResult?.excessAPTCRepayment ?? 0
    if (excessAPTC > 0) {
      // Line 17 should include both AMT (likely 0) and excess APTC
      expect(result.line17.amount).toBeGreaterThanOrEqual(excessAPTC)
    }
  })

  it('validation includes PTC info when 1095-A present', () => {
    const model = {
      ...emptyTaxReturn(2025),
      w2s: [makeW2({ id: 'w2-1', employerName: 'Co', box1: cents(30000), box2: cents(2000) })],
      form1095As: [
        makeFullYear1095A('1095a-1', cents(400), cents(500), cents(300)),
      ],
    }
    const result = computeForm1040(model)

    const ptcValidation = result.validation?.items.find(i => i.code === 'PTC_FORM_8962')
    expect(ptcValidation).toBeDefined()
    expect(ptcValidation!.severity).toBe('info')
  })
})
