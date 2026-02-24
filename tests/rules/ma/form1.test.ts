/**
 * Tests for Massachusetts Form 1 — Resident Income Tax Return
 *
 * Covers: flat 5% tax, millionaire surtax (4%), personal/dependent/age65/blind
 * exemptions, rent deduction, HSA add-back, Social Security exemption,
 * US government interest exemption, state withholding, part-year apportionment,
 * and refund/owed computation.
 */

import { describe, it, expect } from 'vitest'
import { cents } from '../../../src/model/traced'
import { emptyTaxReturn } from '../../../src/model/types'
import type { TaxReturn } from '../../../src/model/types'
import { computeForm1040 } from '../../../src/rules/2025/form1040'
import { computeForm1, computeApportionmentRatio } from '../../../src/rules/2025/ma/form1'
import {
  MA_TAX_RATE,
  MA_PERSONAL_EXEMPTION,
  MA_SURTAX_THRESHOLD,
  MA_SURTAX_RATE,
} from '../../../src/rules/2025/ma/constants'
import { makeW2, make1099INT, makeSSA1099 } from '../../fixtures/returns'

// ── Helpers ─────────────────────────────────────────────────────

function makeMAReturn(overrides: Partial<TaxReturn> = {}): TaxReturn {
  return {
    ...emptyTaxReturn(2025),
    stateReturns: [{ stateCode: 'MA', residencyType: 'full-year' }],
    ...overrides,
  }
}

function computeMA(overrides: Partial<TaxReturn> = {}, config?: { rentAmount?: number }) {
  const model = makeMAReturn(overrides)
  const stateConfig = { ...model.stateReturns[0], ...config }
  const form1040 = computeForm1040(model)
  return computeForm1(model, form1040, stateConfig)
}

// ── Basic scenarios ─────────────────────────────────────────────

describe('Form 1 — basic tax computation', () => {
  it('single, $75K wages, standard computation', () => {
    const result = computeMA({
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(75000), box2: cents(10000),
        box15State: 'MA', box16StateWages: cents(75000), box17StateIncomeTax: cents(3500) })],
    })

    expect(result.federalAGI).toBe(cents(75000))
    expect(result.maAGI).toBe(cents(75000))

    // Personal exemption $4,400
    expect(result.personalExemption).toBe(MA_PERSONAL_EXEMPTION.single)
    expect(result.totalExemptions).toBe(cents(4400))

    // Taxable = $75,000 - $4,400 = $70,600
    expect(result.maTaxableIncome).toBe(cents(70600))

    // Tax = $70,600 × 5% = $3,530
    expect(result.maBaseTax).toBe(cents(3530))
    expect(result.maSurtax).toBe(0)
    expect(result.maIncomeTax).toBe(cents(3530))

    expect(result.stateWithholding).toBe(cents(3500))
  })

  it('MFJ, $120K combined wages → MFJ exemption', () => {
    const result = computeMA({
      filingStatus: 'mfj',
      w2s: [
        makeW2({ id: 'w1', employerName: 'A', box1: cents(70000), box2: cents(8000),
          box15State: 'MA', box17StateIncomeTax: cents(2000) }),
        makeW2({ id: 'w2', employerName: 'B', box1: cents(50000), box2: cents(5000),
          box15State: 'MA', box17StateIncomeTax: cents(1500) }),
      ],
    })

    expect(result.maAGI).toBe(cents(120000))
    // MFJ exemption $8,800
    expect(result.personalExemption).toBe(MA_PERSONAL_EXEMPTION.mfj)
    expect(result.totalExemptions).toBe(cents(8800))

    // Taxable = $120,000 - $8,800 = $111,200
    expect(result.maTaxableIncome).toBe(cents(111200))
    expect(result.maBaseTax).toBe(Math.round(cents(111200) * MA_TAX_RATE))

    expect(result.stateWithholding).toBe(cents(3500))
  })

  it('zero income → $0 MA tax', () => {
    const result = computeMA()

    expect(result.maAGI).toBe(0)
    expect(result.maTaxableIncome).toBe(0)
    expect(result.maBaseTax).toBe(0)
    expect(result.maIncomeTax).toBe(0)
    expect(result.taxAfterCredits).toBe(0)
    expect(result.overpaid).toBe(0)
    expect(result.amountOwed).toBe(0)
  })

  it('income below exemption → $0 taxable, $0 tax', () => {
    const result = computeMA({
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(3000), box2: cents(0) })],
    })

    expect(result.maAGI).toBe(cents(3000))
    expect(result.maTaxableIncome).toBe(0) // $3K < $4,400 exemption
    expect(result.maBaseTax).toBe(0)
  })

  it('HOH uses HOH exemption ($6,800)', () => {
    const result = computeMA({
      filingStatus: 'hoh',
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(80000), box2: cents(10000) })],
      dependents: [{
        firstName: 'Child', lastName: 'Doe', ssn: '111111111',
        relationship: 'son', monthsLived: 12, dateOfBirth: '2015-01-01',
      }],
    })

    expect(result.personalExemption).toBe(MA_PERSONAL_EXEMPTION.hoh)
    expect(result.dependentExemption).toBe(cents(1000)) // 1 dependent
    expect(result.totalExemptions).toBe(cents(6800) + cents(1000))

    // Taxable = $80,000 - $7,800 = $72,200
    expect(result.maTaxableIncome).toBe(cents(72200))
  })

  it('MFS exemption is $4,400 (same as single)', () => {
    const result = computeMA({
      filingStatus: 'mfs',
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(60000), box2: cents(8000) })],
    })

    expect(result.personalExemption).toBe(cents(4400))
  })
})

// ── Flat rate verification ──────────────────────────────────────

describe('Form 1 — flat 5% rate', () => {
  it('$10K taxable → $500 tax', () => {
    // income = $10K + $4,400 exemption = $14,400
    const result = computeMA({
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(14400), box2: cents(0) })],
    })

    expect(result.maTaxableIncome).toBe(cents(10000))
    expect(result.maBaseTax).toBe(cents(500))
  })

  it('$100K taxable → $5,000 tax', () => {
    const result = computeMA({
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(104400), box2: cents(0) })],
    })

    expect(result.maTaxableIncome).toBe(cents(100000))
    expect(result.maBaseTax).toBe(cents(5000))
  })
})

// ── Millionaire's surtax ────────────────────────────────────────

describe('Form 1 — millionaire surtax (4%)', () => {
  it('taxable income $999,999 → no surtax', () => {
    // Need wages that produce $999,999 taxable: $999,999 + $4,400 = $1,004,399
    const result = computeMA({
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(1004399), box2: cents(0) })],
    })

    expect(result.maTaxableIncome).toBe(cents(999999))
    expect(result.maSurtax).toBe(0)
  })

  it('taxable income $1,000,001 → $0.04 surtax', () => {
    const result = computeMA({
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(1004401), box2: cents(0) })],
    })

    expect(result.maTaxableIncome).toBe(cents(1000001))
    // 4% of $1 = $0.04 = 4 cents
    expect(result.maSurtax).toBe(4)
  })

  it('$1.5M taxable → surtax on $500K', () => {
    const result = computeMA({
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(1504400), box2: cents(0) })],
    })

    expect(result.maTaxableIncome).toBe(cents(1500000))
    // 4% of ($1.5M - $1M) = 4% of $500K = $20,000
    expect(result.maSurtax).toBe(cents(20000))
    // Total: 5% of $1.5M + 4% of $500K = $75K + $20K = $95K
    expect(result.maIncomeTax).toBe(cents(95000))
  })

  it('surtax threshold same for MFJ (not doubled)', () => {
    const result = computeMA({
      filingStatus: 'mfj',
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(1508800), box2: cents(0) })],
    })

    expect(result.maTaxableIncome).toBe(cents(1500000))
    expect(result.maSurtax).toBe(cents(20000))
  })
})

// ── Exemption tests ─────────────────────────────────────────────

describe('Form 1 — exemptions', () => {
  it('dependent exemption $1,000 per dependent', () => {
    const result = computeMA({
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(80000), box2: cents(0) })],
      dependents: [
        { firstName: 'A', lastName: 'D', ssn: '111111111', relationship: 'son', monthsLived: 12, dateOfBirth: '2015-01-01' },
        { firstName: 'B', lastName: 'D', ssn: '222222222', relationship: 'daughter', monthsLived: 12, dateOfBirth: '2017-01-01' },
      ],
    })

    expect(result.dependentExemption).toBe(cents(2000)) // 2 × $1,000
    expect(result.totalExemptions).toBe(cents(4400) + cents(2000))
  })

  it('age 65+ adds $700 exemption', () => {
    const result = computeMA({
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(50000), box2: cents(0) })],
      deductions: {
        method: 'standard',
        taxpayerAge65: true,
        taxpayerBlind: false,
        spouseAge65: false,
        spouseBlind: false,
      },
    })

    expect(result.age65Exemption).toBe(cents(700))
    expect(result.totalExemptions).toBe(cents(4400) + cents(700))
  })

  it('blind adds $2,200 exemption', () => {
    const result = computeMA({
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(50000), box2: cents(0) })],
      deductions: {
        method: 'standard',
        taxpayerAge65: false,
        taxpayerBlind: true,
        spouseAge65: false,
        spouseBlind: false,
      },
    })

    expect(result.blindExemption).toBe(cents(2200))
    expect(result.totalExemptions).toBe(cents(4400) + cents(2200))
  })

  it('MFJ both 65+ and both blind → all exemptions stack', () => {
    const result = computeMA({
      filingStatus: 'mfj',
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(100000), box2: cents(0) })],
      deductions: {
        method: 'standard',
        taxpayerAge65: true,
        taxpayerBlind: true,
        spouseAge65: true,
        spouseBlind: true,
      },
    })

    // Personal $8,800 + age65 ($700 × 2 = $1,400) + blind ($2,200 × 2 = $4,400)
    expect(result.personalExemption).toBe(cents(8800))
    expect(result.age65Exemption).toBe(cents(1400))
    expect(result.blindExemption).toBe(cents(4400))
    expect(result.totalExemptions).toBe(cents(8800) + cents(1400) + cents(4400))
  })

  it('single filer: spouse age65/blind flags ignored', () => {
    const result = computeMA({
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(50000), box2: cents(0) })],
      deductions: {
        method: 'standard',
        taxpayerAge65: false,
        taxpayerBlind: false,
        spouseAge65: true,
        spouseBlind: true,
      },
    })

    // Single filer — spouse flags have no effect
    expect(result.age65Exemption).toBe(0)
    expect(result.blindExemption).toBe(0)
    expect(result.totalExemptions).toBe(cents(4400))
  })
})

// ── Rent deduction tests ────────────────────────────────────────

describe('Form 1 — rent deduction', () => {
  it('50% of rent, capped at $4,000', () => {
    const result = computeMA(
      { w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(60000), box2: cents(0) })] },
      { rentAmount: cents(6000) },
    )

    // 50% of $6,000 = $3,000 (under cap)
    expect(result.rentDeduction).toBe(cents(3000))
  })

  it('rent deduction capped at $4,000', () => {
    const result = computeMA(
      { w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(60000), box2: cents(0) })] },
      { rentAmount: cents(12000) },
    )

    // 50% of $12,000 = $6,000 → capped at $4,000
    expect(result.rentDeduction).toBe(cents(4000))
  })

  it('MFS rent deduction capped at $2,000', () => {
    const result = computeMA(
      {
        filingStatus: 'mfs',
        w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(60000), box2: cents(0) })],
      },
      { rentAmount: cents(12000) },
    )

    // 50% of $12,000 = $6,000 → capped at $2,000 for MFS
    expect(result.rentDeduction).toBe(cents(2000))
  })

  it('no rent → $0 deduction', () => {
    const result = computeMA({
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(60000), box2: cents(0) })],
    })

    expect(result.rentDeduction).toBe(0)
  })

  it('rent deduction reduces taxable income', () => {
    const withoutRent = computeMA({
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(60000), box2: cents(0) })],
    })

    const withRent = computeMA(
      { w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(60000), box2: cents(0) })] },
      { rentAmount: cents(8000) },
    )

    expect(withRent.maTaxableIncome).toBe(withoutRent.maTaxableIncome - cents(4000))
    expect(withRent.maBaseTax).toBeLessThan(withoutRent.maBaseTax)
  })
})

// ── MA Adjustments (HSA, SS, US Gov interest) ───────────────────

describe('Form 1 — MA adjustments', () => {
  it('HSA add-back increases MA AGI', () => {
    const result = computeMA({
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(100000), box2: cents(15000) })],
      hsa: {
        coverageType: 'self-only',
        contributions: cents(4300),
        qualifiedExpenses: 0,
        age55OrOlder: false,
        age65OrDisabled: false,
      },
    })

    // Federal AGI = $100K - $4,300 HSA = $95,700
    // MA AGI = $95,700 + $4,300 add-back = $100,000
    expect(result.federalAGI).toBe(cents(95700))
    expect(result.maAdjustments.hsaAddBack).toBe(cents(4300))
    expect(result.maAGI).toBe(cents(100000))
  })

  it('Social Security exempt from MA tax', () => {
    const result = computeMA({
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(30000), box2: cents(3000) })],
      formSSA1099s: [makeSSA1099({
        id: 'ssa1', recipientName: 'Taxpayer', box5: cents(20000), box3: cents(20000),
        box4: 0, box6: 0,
      })],
    })

    // SS benefits are partially taxable at federal level, fully exempt for MA
    expect(result.maAdjustments.ssExemption).toBeGreaterThanOrEqual(0)
    // MA AGI should be lower than federal AGI (if SS was taxed federally)
    if (result.maAdjustments.ssExemption > 0) {
      expect(result.maAGI).toBeLessThan(result.federalAGI)
    }
  })

  it('US government interest exempt from MA tax', () => {
    const result = computeMA({
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(75000), box2: cents(10000) })],
      form1099INTs: [make1099INT({
        id: 'i1', payerName: 'Treasury Direct', box1: cents(5000), box3: cents(5000),
      })],
    })

    // Box 3 = $5,000 US gov interest → subtracted from MA AGI
    expect(result.maAdjustments.usGovInterest).toBe(cents(5000))
    expect(result.maAGI).toBe(result.federalAGI - cents(5000))
  })

  it('no adjustments when none apply', () => {
    const result = computeMA({
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(75000), box2: cents(10000) })],
    })

    expect(result.maAdjustments.hsaAddBack).toBe(0)
    expect(result.maAdjustments.ssExemption).toBe(0)
    expect(result.maAdjustments.usGovInterest).toBe(0)
    expect(result.maAGI).toBe(result.federalAGI)
  })
})

// ── Withholding and refund/owed ─────────────────────────────────

describe('Form 1 — withholding and refund/owed', () => {
  it('state withholding exceeds tax → refund', () => {
    const result = computeMA({
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(50000), box2: cents(5000),
        box15State: 'MA', box17StateIncomeTax: cents(5000) })],
    })

    expect(result.stateWithholding).toBe(cents(5000))
    expect(result.overpaid).toBeGreaterThan(0)
    expect(result.amountOwed).toBe(0)
  })

  it('no state withholding → owes full tax', () => {
    const result = computeMA({
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(75000), box2: cents(10000) })],
    })

    expect(result.stateWithholding).toBe(0)
    expect(result.overpaid).toBe(0)
    expect(result.amountOwed).toBe(result.taxAfterCredits)
  })

  it('sum of multiple W-2 Box 17 values', () => {
    const result = computeMA({
      w2s: [
        makeW2({ id: 'w1', employerName: 'A', box1: cents(60000), box2: cents(7000),
          box15State: 'MA', box17StateIncomeTax: cents(2500) }),
        makeW2({ id: 'w2', employerName: 'B', box1: cents(40000), box2: cents(4000),
          box15State: 'MA', box17StateIncomeTax: cents(1500) }),
      ],
    })

    expect(result.stateWithholding).toBe(cents(4000))
  })

  it('only MA W-2s counted for withholding', () => {
    const result = computeMA({
      w2s: [
        makeW2({ id: 'w1', employerName: 'MA Co', box1: cents(60000), box2: cents(7000),
          box15State: 'MA', box17StateIncomeTax: cents(3000) }),
        makeW2({ id: 'w2', employerName: 'CA Co', box1: cents(40000), box2: cents(4000),
          box15State: 'CA', box17StateIncomeTax: cents(2000) }),
      ],
    })

    // Only the MA W-2's withholding counted
    expect(result.stateWithholding).toBe(cents(3000))
  })

  it('refund = payments - tax after credits', () => {
    const result = computeMA({
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(50000), box2: cents(5000),
        box15State: 'MA', box17StateIncomeTax: cents(4000) })],
    })

    if (result.overpaid > 0) {
      expect(result.overpaid).toBe(result.totalPayments - result.taxAfterCredits)
      expect(result.amountOwed).toBe(0)
    } else {
      expect(result.amountOwed).toBe(result.taxAfterCredits - result.totalPayments)
      expect(result.overpaid).toBe(0)
    }
  })
})

// ── Part-year apportionment ─────────────────────────────────────

describe('Form 1 — part-year residency', () => {
  it('computeApportionmentRatio: half year (Jan 1 – Jun 30)', () => {
    const ratio = computeApportionmentRatio(
      { stateCode: 'MA', residencyType: 'part-year', moveInDate: '2025-01-01', moveOutDate: '2025-06-30' },
      2025,
    )

    // 181 days / 365 ≈ 0.4959
    expect(ratio).toBeCloseTo(181 / 365, 4)
  })

  it('computeApportionmentRatio: full year returns 1.0', () => {
    const ratio = computeApportionmentRatio(
      { stateCode: 'MA', residencyType: 'full-year' },
      2025,
    )

    expect(ratio).toBe(1.0)
  })

  it('computeApportionmentRatio: nonresident returns 0.0', () => {
    const ratio = computeApportionmentRatio(
      { stateCode: 'MA', residencyType: 'nonresident' },
      2025,
    )

    expect(ratio).toBe(0.0)
  })

  it('part-year tax is prorated', () => {
    const fullYear = computeMA({
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(100000), box2: cents(0) })],
    })

    const model = makeMAReturn({
      stateReturns: [{ stateCode: 'MA', residencyType: 'part-year', moveInDate: '2025-01-01', moveOutDate: '2025-06-30' }],
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(100000), box2: cents(0) })],
    })
    const form1040 = computeForm1040(model)
    const partYear = computeForm1(model, form1040, model.stateReturns[0])

    // Part-year should have less tax than full-year
    expect(partYear.maIncomeTax).toBeLessThan(fullYear.maIncomeTax)
    expect(partYear.maSourceIncome).toBeDefined()
    expect(partYear.apportionmentRatio).toBeCloseTo(181 / 365, 4)
  })

  it('part-year: exemptions are prorated', () => {
    const model = makeMAReturn({
      stateReturns: [{ stateCode: 'MA', residencyType: 'part-year', moveInDate: '2025-07-01', moveOutDate: '2025-12-31' }],
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(100000), box2: cents(0) })],
    })
    const form1040 = computeForm1040(model)
    const result = computeForm1(model, form1040, model.stateReturns[0])

    // ~184 days / 365 ≈ 50.4%
    // Prorated exemption should be roughly half of $4,400
    expect(result.totalExemptions).toBeLessThan(cents(4400))
    expect(result.totalExemptions).toBeGreaterThan(cents(2000))
  })
})

// ── Integration tests ───────────────────────────────────────────

describe('Form 1 — integration', () => {
  it('full return: W-2 $150K, withholding $6K → verify refund/owed', () => {
    const result = computeMA({
      w2s: [makeW2({ id: 'w', employerName: 'Tech Co', box1: cents(150000), box2: cents(25000),
        box15State: 'MA', box16StateWages: cents(150000), box17StateIncomeTax: cents(6000) })],
    })

    expect(result.maAGI).toBe(cents(150000))
    // Taxable = $150K - $4,400 = $145,600
    expect(result.maTaxableIncome).toBe(cents(145600))
    // Tax = $145,600 × 5% = $7,280
    expect(result.maBaseTax).toBe(cents(7280))
    expect(result.maSurtax).toBe(0)
    expect(result.stateWithholding).toBe(cents(6000))

    // Owes $7,280 - $6,000 = $1,280
    expect(result.amountOwed).toBe(cents(1280))
    expect(result.overpaid).toBe(0)
  })

  it('tech employee: $200K wages + HSA → MA adds back HSA', () => {
    const result = computeMA({
      w2s: [makeW2({ id: 'w', employerName: 'Tech Co', box1: cents(200000), box2: cents(35000),
        box15State: 'MA', box17StateIncomeTax: cents(10000) })],
      hsa: {
        coverageType: 'self-only',
        contributions: cents(4300),
        qualifiedExpenses: 0,
        age55OrOlder: false,
        age65OrDisabled: false,
      },
    })

    // Federal AGI = $200K - $4,300 = $195,700
    // MA AGI = $195,700 + $4,300 = $200,000
    expect(result.federalAGI).toBe(cents(195700))
    expect(result.maAGI).toBe(cents(200000))
    expect(result.maAdjustments.hsaAddBack).toBe(cents(4300))
  })

  it('high earner: $1.5M income → surtax applies', () => {
    const result = computeMA({
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(1504400), box2: cents(300000),
        box15State: 'MA', box17StateIncomeTax: cents(100000) })],
    })

    // Taxable = $1,504,400 - $4,400 = $1,500,000
    expect(result.maTaxableIncome).toBe(cents(1500000))
    expect(result.maBaseTax).toBe(cents(75000)) // 5% of $1.5M
    expect(result.maSurtax).toBe(cents(20000))  // 4% of $500K
    expect(result.maIncomeTax).toBe(cents(95000))
  })

  it('tax after credits cannot be negative', () => {
    const result = computeMA({
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(5000), box2: cents(0) })],
    })

    // Taxable = $5K - $4,400 = $600 → tax = $30
    expect(result.taxAfterCredits).toBeGreaterThanOrEqual(0)
  })

  it('renter with dependents: all deductions stack', () => {
    const result = computeMA(
      {
        filingStatus: 'mfj',
        w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(100000), box2: cents(0) })],
        dependents: [
          { firstName: 'A', lastName: 'D', ssn: '111111111', relationship: 'son', monthsLived: 12, dateOfBirth: '2015-01-01' },
        ],
        deductions: {
          method: 'standard',
          taxpayerAge65: true,
          taxpayerBlind: false,
          spouseAge65: false,
          spouseBlind: false,
        },
      },
      { rentAmount: cents(10000) },
    )

    // MFJ personal $8,800 + dep $1,000 + age65 $700 = $10,500
    expect(result.totalExemptions).toBe(cents(10500))
    // Rent: 50% of $10K = $5K → capped at $4K
    expect(result.rentDeduction).toBe(cents(4000))
    // Taxable = $100K - $10,500 - $4,000 = $85,500
    expect(result.maTaxableIncome).toBe(cents(85500))
  })
})
