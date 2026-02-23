/**
 * Social Security Benefits — Edge Case Tests
 *
 * Tests MFS lived-apart threshold exception (IRC §86(c)(1)(C)(ii)),
 * benefits-repaid scenarios, negative net benefits, and validation items.
 */

import { describe, it, expect } from 'vitest'
import { cents } from '../../src/model/traced'
import {
  computeTaxableSocialSecurity,
  SS_BASE_AMOUNT,
  SS_ADDITIONAL_AMOUNT,
  SS_MFS_LIVED_APART_BASE,
  SS_MFS_LIVED_APART_ADDITIONAL,
} from '../../src/rules/2025/socialSecurityBenefits'
import { validateFederalReturn } from '../../src/rules/2025/federalValidation'
import { computeForm1040 } from '../../src/rules/2025/form1040'
import { emptyTaxReturn } from '../../src/model/types'
import { makeW2, makeSSA1099 } from '../fixtures/returns'

// ── MFS Lived-Apart Threshold Tests ─────────────────────────────

describe('MFS lived-apart threshold exception', () => {
  it('MFS default uses $0 base/$0 additional (fully taxable)', () => {
    expect(SS_BASE_AMOUNT.mfs).toBe(0)
    expect(SS_ADDITIONAL_AMOUNT.mfs).toBe(0)
  })

  it('MFS lived-apart constants match single filer thresholds', () => {
    expect(SS_MFS_LIVED_APART_BASE).toBe(SS_BASE_AMOUNT.single)
    expect(SS_MFS_LIVED_APART_ADDITIONAL).toBe(SS_ADDITIONAL_AMOUNT.single)
  })

  it('MFS lived-with-spouse: all benefits taxable at 85% (Tier 2) with low income', () => {
    // MFS, did NOT live apart → $0 base, $0 additional → Tier 2 immediately
    const result = computeTaxableSocialSecurity(
      cents(20000),      // $20,000 gross benefits
      cents(10000),      // $10,000 other income
      0,                 // no tax-exempt interest
      'mfs',
      0,                 // no withholding
      false,             // did NOT live apart
    )

    expect(result.tier).toBe(2)
    expect(result.baseAmount).toBe(0)
    expect(result.additionalAmount).toBe(0)
    // 85% × $20,000 = $17,000
    expect(result.taxableBenefits).toBe(cents(17000))
    expect(result.mfsLivedApart).toBe(false)
  })

  it('MFS lived-apart: uses single-like thresholds (Tier 0 with low income)', () => {
    // MFS, lived apart → $25,000 base → Tier 0 if combined income ≤ $25K
    const result = computeTaxableSocialSecurity(
      cents(12000),      // $12,000 gross benefits
      cents(10000),      // $10,000 other income
      0,
      'mfs',
      0,
      true,              // lived apart all year
    )

    // Combined: $10,000 + $6,000 (half benefits) = $16,000
    // Base amount: $25,000 (lived-apart)
    // $16,000 ≤ $25,000 → Tier 0
    expect(result.tier).toBe(0)
    expect(result.baseAmount).toBe(cents(25000))
    expect(result.taxableBenefits).toBe(0)
    expect(result.mfsLivedApart).toBe(true)
  })

  it('MFS lived-apart: Tier 1 (50% max) in middle range', () => {
    // Combined income between $25K and $34K → Tier 1
    const result = computeTaxableSocialSecurity(
      cents(20000),      // $20,000 gross benefits
      cents(22000),      // $22,000 other income
      0,
      'mfs',
      0,
      true,
    )

    // Combined: $22,000 + $10,000 (half) = $32,000
    // Base: $25,000, Additional: $34,000
    // $25,000 < $32,000 ≤ $34,000 → Tier 1
    expect(result.tier).toBe(1)
    expect(result.mfsLivedApart).toBe(true)
    // Taxable = min(50% × ($32K-$25K), 50% × $20K) = min($3,500, $10,000) = $3,500
    expect(result.taxableBenefits).toBe(cents(3500))
  })

  it('MFS lived-apart: Tier 2 (85% max) with high income', () => {
    const result = computeTaxableSocialSecurity(
      cents(24000),      // $24,000 gross benefits
      cents(40000),      // $40,000 other income
      0,
      'mfs',
      0,
      true,
    )

    // Combined: $40,000 + $12,000 (half) = $52,000
    // Additional: $34,000, combined > additional → Tier 2
    expect(result.tier).toBe(2)
    expect(result.mfsLivedApart).toBe(true)
    // tier1Max = min(50% × $9K, 50% × $24K) = min($4,500, $12,000) = $4,500
    // Taxable = min(85% × ($52K-$34K) + $4,500, 85% × $24K)
    //         = min(85% × $18,000 + $4,500, $20,400)
    //         = min($15,300 + $4,500, $20,400)
    //         = min($19,800, $20,400) = $19,800
    expect(result.taxableBenefits).toBe(cents(19800))
  })

  it('same income: MFS lived-with results in much higher taxable amount', () => {
    const income = cents(20000)
    const benefits = cents(18000)

    const livedWith = computeTaxableSocialSecurity(benefits, income, 0, 'mfs', 0, false)
    const livedApart = computeTaxableSocialSecurity(benefits, income, 0, 'mfs', 0, true)

    // Lived-with: base=$0 → Tier 2 → up to 85% taxable
    expect(livedWith.tier).toBe(2)
    // Lived-apart: combined=$20K+$9K=$29K, base=$25K → Tier 1
    expect(livedApart.tier).toBe(1)
    // Lived-with should have a higher taxable amount
    expect(livedWith.taxableBenefits).toBeGreaterThan(livedApart.taxableBenefits)
  })
})

// ── Benefits Repaid / Negative Benefits Tests ───────────────────

describe('benefits repaid and negative net benefits', () => {
  it('zero gross benefits returns zero taxable', () => {
    const result = computeTaxableSocialSecurity(0, cents(50000), 0, 'single', 0)
    expect(result.grossBenefits).toBe(0)
    expect(result.taxableBenefits).toBe(0)
    expect(result.tier).toBe(0)
  })

  it('negative gross benefits (repaid > received) returns zero taxable', () => {
    // Box 5 = Box 3 - Box 4 = $10,000 - $15,000 = -$5,000
    const result = computeTaxableSocialSecurity(cents(-5000), cents(50000), 0, 'single', 0)
    expect(result.grossBenefits).toBe(0)
    expect(result.taxableBenefits).toBe(0)
    expect(result.tier).toBe(0)
  })

  it('withholding passes through even with zero benefits', () => {
    const result = computeTaxableSocialSecurity(0, cents(30000), 0, 'single', cents(500))
    expect(result.federalWithheld).toBe(cents(500))
    expect(result.taxableBenefits).toBe(0)
  })
})

// ── Tax-Exempt Interest Affecting SS Taxability ─────────────────

describe('tax-exempt interest impacts SS combined income', () => {
  it('tax-exempt interest pushes combined income into Tier 1', () => {
    // Without tax-exempt interest: combined = $15K + $8K = $23K (Tier 0)
    // With $5K tax-exempt: combined = $15K + $5K + $8K = $28K (Tier 1)
    const withoutExempt = computeTaxableSocialSecurity(
      cents(16000), cents(15000), 0, 'single', 0,
    )
    const withExempt = computeTaxableSocialSecurity(
      cents(16000), cents(15000), cents(5000), 'single', 0,
    )

    expect(withoutExempt.tier).toBe(0)
    expect(withExempt.tier).toBe(1)
    expect(withExempt.taxableBenefits).toBeGreaterThan(0)
  })
})

// ── Validation Tests ────────────────────────────────────────────

describe('SSA-1099 validation items', () => {
  it('emits SSA_NEGATIVE_NET_BENEFITS warning for negative Box 5', () => {
    const model = {
      ...emptyTaxReturn(2025),
      formSSA1099s: [
        makeSSA1099({
          id: 'ssa-1',
          recipientName: 'John Doe',
          box3: cents(10000),
          box4: cents(15000),
          box5: cents(-5000),
        }),
      ],
    }
    const result = validateFederalReturn(model)
    const item = result.items.find(i => i.code === 'SSA_NEGATIVE_NET_BENEFITS')
    expect(item).toBeDefined()
    expect(item!.severity).toBe('warning')
    expect(item!.message).toContain('IRC §1341')
  })

  it('emits SSA_BENEFITS_REPAID info when Box 4 > 0 and Box 5 >= 0', () => {
    const model = {
      ...emptyTaxReturn(2025),
      formSSA1099s: [
        makeSSA1099({
          id: 'ssa-1',
          recipientName: 'Jane Doe',
          box3: cents(20000),
          box4: cents(3000),
          box5: cents(17000),
        }),
      ],
    }
    const result = validateFederalReturn(model)
    const item = result.items.find(i => i.code === 'SSA_BENEFITS_REPAID')
    expect(item).toBeDefined()
    expect(item!.severity).toBe('info')
    expect(item!.message).toContain('$3,000')
  })

  it('emits SSA_BOX5_MISMATCH when Box 5 != Box 3 - Box 4', () => {
    const model = {
      ...emptyTaxReturn(2025),
      formSSA1099s: [
        makeSSA1099({
          id: 'ssa-1',
          recipientName: 'Bob Smith',
          box3: cents(20000),
          box4: cents(2000),
          box5: cents(19000), // should be $18,000
        }),
      ],
    }
    const result = validateFederalReturn(model)
    const item = result.items.find(i => i.code === 'SSA_BOX5_MISMATCH')
    expect(item).toBeDefined()
    expect(item!.severity).toBe('warning')
  })

  it('emits MFS_SS_BENEFITS warning when MFS with SS', () => {
    const model = {
      ...emptyTaxReturn(2025),
      filingStatus: 'mfs' as const,
      formSSA1099s: [
        makeSSA1099({ id: 'ssa-1', box5: cents(18000) }),
      ],
    }
    const result = validateFederalReturn(model)
    const item = result.items.find(i => i.code === 'MFS_SS_BENEFITS')
    expect(item).toBeDefined()
    expect(item!.severity).toBe('warning')
    expect(item!.message).toContain('lived with your spouse')
  })

  it('emits MFS_SS_BENEFITS_LIVED_APART info when MFS lived-apart with SS', () => {
    const model = {
      ...emptyTaxReturn(2025),
      filingStatus: 'mfs' as const,
      formSSA1099s: [
        makeSSA1099({ id: 'ssa-1', box5: cents(18000) }),
      ],
      deductions: {
        ...emptyTaxReturn(2025).deductions,
        mfsLivedApartAllYear: true,
      },
    }
    const result = validateFederalReturn(model)
    const livedApartItem = result.items.find(i => i.code === 'MFS_SS_BENEFITS_LIVED_APART')
    expect(livedApartItem).toBeDefined()
    expect(livedApartItem!.severity).toBe('info')
    // Should NOT have the generic MFS_SS_BENEFITS warning
    const genericItem = result.items.find(i => i.code === 'MFS_SS_BENEFITS')
    expect(genericItem).toBeUndefined()
  })
})

// ── Form 1040 Integration: MFS Lived-Apart ──────────────────────

describe('Form 1040 MFS lived-apart integration', () => {
  it('MFS lived-apart flag flows through to SS computation', () => {
    const model = {
      ...emptyTaxReturn(2025),
      filingStatus: 'mfs' as const,
      w2s: [makeW2({ id: 'w2-1', employerName: 'Co', box1: cents(15000), box2: cents(1000) })],
      formSSA1099s: [
        makeSSA1099({ id: 'ssa-1', box5: cents(16000) }),
      ],
      deductions: {
        ...emptyTaxReturn(2025).deductions,
        mfsLivedApartAllYear: true,
      },
    }
    const result = computeForm1040(model)

    // With lived-apart and low income:
    // Combined = $15,000 + $8,000 = $23,000
    // Base (lived-apart) = $25,000
    // $23K ≤ $25K → Tier 0, $0 taxable
    expect(result.line6a.amount).toBe(cents(16000))
    expect(result.line6b.amount).toBe(0)
    expect(result.socialSecurityResult?.mfsLivedApart).toBe(true)
    expect(result.socialSecurityResult?.tier).toBe(0)
  })

  it('MFS without lived-apart: same income triggers full 85% taxability', () => {
    const model = {
      ...emptyTaxReturn(2025),
      filingStatus: 'mfs' as const,
      w2s: [makeW2({ id: 'w2-1', employerName: 'Co', box1: cents(15000), box2: cents(1000) })],
      formSSA1099s: [
        makeSSA1099({ id: 'ssa-1', box5: cents(16000) }),
      ],
    }
    const result = computeForm1040(model)

    // Without lived-apart: base=$0 → Tier 2 → up to 85% taxable
    expect(result.line6a.amount).toBe(cents(16000))
    expect(result.line6b.amount).toBe(cents(13600)) // 85% × $16,000
    expect(result.socialSecurityResult?.tier).toBe(2)
  })
})
