/**
 * Social Security Benefits — Lines 6a/6b Tests
 *
 * Tests the IRS Publication 915 worksheet for computing taxable
 * Social Security benefits across all three tiers and filing statuses.
 */

import { describe, it, expect } from 'vitest'
import { cents } from '../../src/model/traced'
import { computeTaxableSocialSecurity, SS_BASE_AMOUNT, SS_ADDITIONAL_AMOUNT } from '../../src/rules/2025/socialSecurityBenefits'
import { computeForm1040 } from '../../src/rules/2025/form1040'
import { emptyTaxReturn } from '../../src/model/types'
import { makeW2, makeSSA1099, make1099INT } from '../fixtures/returns'

// ── Unit tests for the worksheet ─────────────────────────────

describe('computeTaxableSocialSecurity', () => {
  describe('Tier 0 — below base amount', () => {
    it('returns $0 taxable when combined income is below single base amount', () => {
      // $18K SS benefits, $10K other income
      // Combined = $10K + $9K (half of $18K) = $19K < $25K base
      const result = computeTaxableSocialSecurity(
        cents(18000), cents(10000), 0, 'single',
      )
      expect(result.tier).toBe(0)
      expect(result.taxableBenefits).toBe(0)
      expect(result.grossBenefits).toBe(cents(18000))
      expect(result.halfBenefits).toBe(cents(9000))
      expect(result.combinedIncome).toBe(cents(19000))
    })

    it('returns $0 taxable when combined income equals base amount exactly', () => {
      // $20K SS benefits, $15K other income
      // Combined = $15K + $10K = $25K = $25K base
      const result = computeTaxableSocialSecurity(
        cents(20000), cents(15000), 0, 'single',
      )
      expect(result.tier).toBe(0)
      expect(result.taxableBenefits).toBe(0)
    })

    it('returns $0 when gross benefits are zero', () => {
      const result = computeTaxableSocialSecurity(0, cents(100000), 0, 'single')
      expect(result.tier).toBe(0)
      expect(result.taxableBenefits).toBe(0)
    })

    it('uses MFJ base amount ($32,000) for married filing jointly', () => {
      // $24K SS benefits, $15K other income
      // Combined = $15K + $12K = $27K < $32K MFJ base
      const result = computeTaxableSocialSecurity(
        cents(24000), cents(15000), 0, 'mfj',
      )
      expect(result.tier).toBe(0)
      expect(result.taxableBenefits).toBe(0)
      expect(result.baseAmount).toBe(SS_BASE_AMOUNT.mfj)
    })
  })

  describe('Tier 1 — between base and additional amount (up to 50%)', () => {
    it('computes 50% of excess over base when combined is between thresholds', () => {
      // $20K SS, $20K other income
      // Combined = $20K + $10K = $30K
      // Base = $25K, excess = $5K
      // Taxable = min(50% × $5K, 50% × $20K) = min($2,500, $10,000) = $2,500
      const result = computeTaxableSocialSecurity(
        cents(20000), cents(20000), 0, 'single',
      )
      expect(result.tier).toBe(1)
      expect(result.taxableBenefits).toBe(cents(2500))
    })

    it('caps at 50% of gross benefits in Tier 1', () => {
      // $4K SS, $29K other income
      // Combined = $29K + $2K = $31K
      // Excess over base = $6K
      // Taxable = min(50% × $6K, 50% × $4K) = min($3K, $2K) = $2,000
      const result = computeTaxableSocialSecurity(
        cents(4000), cents(29000), 0, 'single',
      )
      expect(result.tier).toBe(1)
      expect(result.taxableBenefits).toBe(cents(2000))
    })

    it('includes tax-exempt interest in combined income', () => {
      // $20K SS, $15K other income, $6K tax-exempt interest
      // Modified AGI = $15K + $6K = $21K
      // Combined = $21K + $10K = $31K
      // Excess over base ($25K) = $6K
      // Taxable = min(50% × $6K, 50% × $20K) = $3,000
      const result = computeTaxableSocialSecurity(
        cents(20000), cents(15000), cents(6000), 'single',
      )
      expect(result.tier).toBe(1)
      expect(result.taxableBenefits).toBe(cents(3000))
    })

    it('works for MFJ in Tier 1 range ($32K–$44K)', () => {
      // $30K SS, $25K other income
      // Combined = $25K + $15K = $40K
      // MFJ base = $32K, excess = $8K
      // Taxable = min(50% × $8K, 50% × $30K) = min($4K, $15K) = $4,000
      const result = computeTaxableSocialSecurity(
        cents(30000), cents(25000), 0, 'mfj',
      )
      expect(result.tier).toBe(1)
      expect(result.taxableBenefits).toBe(cents(4000))
    })
  })

  describe('Tier 2 — above additional amount (up to 85%)', () => {
    it('computes 85% formula when combined income exceeds additional amount', () => {
      // $24K SS, $30K other income
      // Combined = $30K + $12K = $42K
      // Base = $25K, additional = $34K
      // Tier range = $34K - $25K = $9K
      // Tier1Max = min(50% × $9K, 50% × $24K) = min($4,500, $12,000) = $4,500
      // Excess over additional = $42K - $34K = $8K
      // Taxable = min(85% × $8K + $4,500, 85% × $24K)
      //         = min($6,800 + $4,500, $20,400) = min($11,300, $20,400) = $11,300
      const result = computeTaxableSocialSecurity(
        cents(24000), cents(30000), 0, 'single',
      )
      expect(result.tier).toBe(2)
      expect(result.taxableBenefits).toBe(cents(11300))
    })

    it('caps at 85% of gross benefits in Tier 2', () => {
      // $10K SS, $100K other income
      // Combined = $100K + $5K = $105K
      // Tier range = $9K, excess over additional = $71K
      // Tier1Max = min(50% × $9K, 50% × $10K) = $4,500
      // Taxable = min(85% × $71K + $4,500, 85% × $10K)
      //         = min($60,350 + $4,500, $8,500) = $8,500
      const result = computeTaxableSocialSecurity(
        cents(10000), cents(100000), 0, 'single',
      )
      expect(result.tier).toBe(2)
      expect(result.taxableBenefits).toBe(cents(8500))
    })

    it('works for MFJ Tier 2 (above $44K)', () => {
      // $30K SS, $40K other income
      // Combined = $40K + $15K = $55K
      // MFJ base = $32K, additional = $44K, tier range = $12K
      // Tier1Max = min(50% × $12K, 50% × $30K) = $6,000
      // Excess over additional = $55K - $44K = $11K
      // Taxable = min(85% × $11K + $6K, 85% × $30K)
      //         = min($9,350 + $6,000, $25,500) = $15,350
      const result = computeTaxableSocialSecurity(
        cents(30000), cents(40000), 0, 'mfj',
      )
      expect(result.tier).toBe(2)
      expect(result.taxableBenefits).toBe(cents(15350))
    })
  })

  describe('MFS filing status', () => {
    it('uses $0 base amount for MFS (worst case — lived together)', () => {
      // MFS with $0 base → everything above Tier 2
      const result = computeTaxableSocialSecurity(
        cents(20000), cents(30000), 0, 'mfs',
      )
      expect(result.tier).toBe(2)
      expect(result.baseAmount).toBe(0)
      expect(result.additionalAmount).toBe(0)
      // With $0 base and $0 additional:
      // tier range = $0, tier1Max = min(0, $10K) = 0
      // excess over additional = $30K + $10K = $40K
      // Taxable = min(85% × $40K + 0, 85% × $20K) = min($34K, $17K) = $17,000
      expect(result.taxableBenefits).toBe(cents(17000))
    })
  })

  describe('HOH and QW filing statuses', () => {
    it('uses single thresholds for HOH', () => {
      const result = computeTaxableSocialSecurity(
        cents(20000), cents(20000), 0, 'hoh',
      )
      expect(result.baseAmount).toBe(SS_BASE_AMOUNT.single)
      expect(result.additionalAmount).toBe(SS_ADDITIONAL_AMOUNT.single)
    })

    it('uses single thresholds for QW', () => {
      const result = computeTaxableSocialSecurity(
        cents(20000), cents(20000), 0, 'qw',
      )
      expect(result.baseAmount).toBe(SS_BASE_AMOUNT.single)
      expect(result.additionalAmount).toBe(SS_ADDITIONAL_AMOUNT.single)
    })
  })

  describe('federal withholding tracking', () => {
    it('passes through federal withholding from SSA-1099 Box 6', () => {
      const result = computeTaxableSocialSecurity(
        cents(20000), cents(20000), 0, 'single', cents(2000),
      )
      expect(result.federalWithheld).toBe(cents(2000))
    })
  })
})

// ── Integration tests with Form 1040 ──────────────────────────

describe('Social Security — Form 1040 integration', () => {
  it('includes SS benefits in Lines 6a/6b and Line 9 total income', () => {
    const model = {
      ...emptyTaxReturn(2025),
      filingStatus: 'single' as const,
      w2s: [
        makeW2({
          id: 'w2-1',
          employerName: 'Part Time Job',
          box1: cents(30000),
          box2: cents(3000),
        }),
      ],
      formSSA1099s: [
        makeSSA1099({
          id: 'ssa-1',
          recipientName: 'Retiree',
          box5: cents(24000),
          box6: cents(2400),
        }),
      ],
    }

    const result = computeForm1040(model)

    // Line 6a = gross SS benefits = $24,000
    expect(result.line6a.amount).toBe(cents(24000))

    // Line 6b = taxable SS benefits (computed via worksheet)
    expect(result.line6b.amount).toBeGreaterThan(0)
    expect(result.socialSecurityResult).not.toBeNull()
    expect(result.socialSecurityResult!.tier).toBeGreaterThan(0)

    // Line 9 should include Line 6b
    expect(result.line9.amount).toBeGreaterThan(cents(30000))

    // Line 25 should include SSA-1099 Box 6 withholding
    expect(result.line25.amount).toBe(cents(3000) + cents(2400))
  })

  it('does not include SS benefits when no SSA-1099 forms exist', () => {
    const model = {
      ...emptyTaxReturn(2025),
      w2s: [
        makeW2({
          id: 'w2-1',
          employerName: 'Acme',
          box1: cents(75000),
          box2: cents(8000),
        }),
      ],
    }

    const result = computeForm1040(model)
    expect(result.line6a.amount).toBe(0)
    expect(result.line6b.amount).toBe(0)
    expect(result.socialSecurityResult).toBeNull()
  })

  it('handles MFJ couple with separate SSA-1099s', () => {
    const model = {
      ...emptyTaxReturn(2025),
      filingStatus: 'mfj' as const,
      w2s: [
        makeW2({
          id: 'w2-1',
          employerName: 'Corp',
          box1: cents(40000),
          box2: cents(4000),
        }),
      ],
      formSSA1099s: [
        makeSSA1099({
          id: 'ssa-1',
          recipientName: 'Husband',
          owner: 'taxpayer' as const,
          box5: cents(18000),
          box6: cents(1800),
        }),
        makeSSA1099({
          id: 'ssa-2',
          recipientName: 'Wife',
          owner: 'spouse' as const,
          box5: cents(14000),
          box6: cents(1400),
        }),
      ],
    }

    const result = computeForm1040(model)

    // Line 6a = sum of both SSA-1099 Box 5 = $32,000
    expect(result.line6a.amount).toBe(cents(32000))

    // Total withholding includes both SSA-1099 Box 6
    expect(result.line25.amount).toBe(cents(4000) + cents(1800) + cents(1400))
  })
})
