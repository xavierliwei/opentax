/**
 * Tests for PA-40 — Pennsylvania Personal Income Tax Return
 */

import { describe, it, expect } from 'vitest'
import { cents } from '../../../src/model/traced'
import { emptyTaxReturn } from '../../../src/model/types'
import type { TaxReturn, StateReturnConfig } from '../../../src/model/types'
import { computeForm1040 } from '../../../src/rules/2025/form1040'
import { computePA40, computeApportionmentRatio } from '../../../src/rules/2025/pa/pa40'
import { PA_TAX_RATE } from '../../../src/rules/2025/pa/constants'
import { makeW2, make1099INT, make1099DIV, makeDependent } from '../../fixtures/returns'

// ── Helpers ─────────────────────────────────────────────────────

function paConfig(overrides: Partial<StateReturnConfig> = {}): StateReturnConfig {
  return { stateCode: 'PA', residencyType: 'full-year', ...overrides } as StateReturnConfig
}

function computePA(model: TaxReturn, config?: StateReturnConfig) {
  const federal = computeForm1040(model)
  return computePA40(model, federal, config ?? paConfig())
}

// ── Basic scenarios ─────────────────────────────────────────────

describe('PA-40 — basic tax computation', () => {
  it('single, $75K wages → flat 3.07% tax', () => {
    const model: TaxReturn = {
      ...emptyTaxReturn(2025),
      w2s: [makeW2({
        id: 'w2-1', employerName: 'PA Corp',
        box1: cents(75000), box2: cents(10000),
        box15State: 'PA', box16StateWages: cents(75000), box17StateIncomeTax: cents(2300),
      })],
    }
    const result = computePA(model)

    expect(result.incomeClasses.netCompensation).toBe(cents(75000))
    expect(result.totalPATaxableIncome).toBe(cents(75000))
    expect(result.adjustedTaxableIncome).toBe(cents(75000))
    expect(result.paTax).toBe(Math.round(cents(75000) * PA_TAX_RATE))
    expect(result.stateWithholding).toBe(cents(2300))
  })

  it('MFJ, $120K combined wages', () => {
    const model: TaxReturn = {
      ...emptyTaxReturn(2025),
      filingStatus: 'mfj',
      w2s: [
        makeW2({ id: 'w2-1', employerName: 'A', box1: cents(70000), box2: cents(7000), box15State: 'PA', box16StateWages: cents(70000), box17StateIncomeTax: cents(2100) }),
        makeW2({ id: 'w2-2', employerName: 'B', box1: cents(50000), box2: cents(5000), box15State: 'PA', box16StateWages: cents(50000), box17StateIncomeTax: cents(1500) }),
      ],
    }
    const result = computePA(model)

    expect(result.totalPATaxableIncome).toBe(cents(120000))
    expect(result.paTax).toBe(Math.round(cents(120000) * PA_TAX_RATE))
    expect(result.stateWithholding).toBe(cents(3600))
  })

  it('HOH, $75K wages → same flat rate', () => {
    const model: TaxReturn = {
      ...emptyTaxReturn(2025),
      filingStatus: 'hoh',
      w2s: [makeW2({
        id: 'w2-1', employerName: 'PA Corp',
        box1: cents(75000), box2: cents(10000),
        box15State: 'PA', box16StateWages: cents(75000), box17StateIncomeTax: cents(2300),
      })],
      dependents: [makeDependent({ firstName: 'Kid', dateOfBirth: '2015-01-01' })],
    }
    const result = computePA(model)

    expect(result.totalPATaxableIncome).toBe(cents(75000))
    expect(result.paTax).toBe(Math.round(cents(75000) * PA_TAX_RATE))
  })

  it('MFS, $60K wages → same flat rate as single', () => {
    const model: TaxReturn = {
      ...emptyTaxReturn(2025),
      filingStatus: 'mfs',
      w2s: [makeW2({
        id: 'w2-1', employerName: 'PA Corp',
        box1: cents(60000), box2: cents(8000),
        box15State: 'PA', box16StateWages: cents(60000), box17StateIncomeTax: cents(1800),
      })],
    }
    const result = computePA(model)

    expect(result.totalPATaxableIncome).toBe(cents(60000))
    expect(result.paTax).toBe(Math.round(cents(60000) * PA_TAX_RATE))
  })

  it('QW, $90K wages → same flat rate', () => {
    const model: TaxReturn = {
      ...emptyTaxReturn(2025),
      filingStatus: 'qw',
      w2s: [makeW2({
        id: 'w2-1', employerName: 'PA Corp',
        box1: cents(90000), box2: cents(12000),
        box15State: 'PA', box16StateWages: cents(90000), box17StateIncomeTax: cents(2700),
      })],
    }
    const result = computePA(model)

    expect(result.totalPATaxableIncome).toBe(cents(90000))
    expect(result.paTax).toBe(Math.round(cents(90000) * PA_TAX_RATE))
  })

  it('all filing statuses produce same tax on same income (flat rate)', () => {
    const statuses: ('single' | 'mfj' | 'mfs' | 'hoh' | 'qw')[] = ['single', 'mfj', 'mfs', 'hoh', 'qw']
    const expectedTax = Math.round(cents(75000) * PA_TAX_RATE)
    for (const status of statuses) {
      const model: TaxReturn = {
        ...emptyTaxReturn(2025),
        filingStatus: status,
        w2s: [makeW2({ id: 'w2-1', employerName: 'X', box1: cents(75000), box2: cents(10000) })],
      }
      const result = computePA(model)
      expect(result.paTax).toBe(expectedTax)
    }
  })

  it('zero income → $0 tax', () => {
    const model = emptyTaxReturn(2025)
    const result = computePA(model)

    expect(result.totalPATaxableIncome).toBe(0)
    expect(result.paTax).toBe(0)
    expect(result.taxAfterCredits).toBe(0)
  })

  it('mixed income: wages + interest + dividends', () => {
    const model: TaxReturn = {
      ...emptyTaxReturn(2025),
      w2s: [makeW2({ id: 'w2-1', employerName: 'X', box1: cents(50000), box2: cents(5000), box15State: 'PA', box17StateIncomeTax: cents(1500) })],
      form1099INTs: [make1099INT({ id: 'i-1', payerName: 'Bank', box1: cents(5000) })],
      form1099DIVs: [make1099DIV({ id: 'd-1', payerName: 'Broker', box1a: cents(2000) })],
    }
    const result = computePA(model)

    expect(result.totalPATaxableIncome).toBe(cents(57000))
    expect(result.paTax).toBe(Math.round(cents(57000) * PA_TAX_RATE))
  })
})

// ── Withholding / Refund / Owed ─────────────────────────────────

describe('PA-40 — withholding and result', () => {
  it('withholding > tax → refund', () => {
    const model: TaxReturn = {
      ...emptyTaxReturn(2025),
      w2s: [makeW2({
        id: 'w2-1', employerName: 'X', box1: cents(50000), box2: cents(5000),
        box15State: 'PA', box16StateWages: cents(50000), box17StateIncomeTax: cents(2000),
      })],
    }
    const result = computePA(model)
    const expectedTax = Math.round(cents(50000) * PA_TAX_RATE)

    expect(result.paTax).toBe(expectedTax)
    expect(result.stateWithholding).toBe(cents(2000))
    expect(result.overpaid).toBe(cents(2000) - expectedTax)
    expect(result.amountOwed).toBe(0)
  })

  it('withholding < tax → amount owed', () => {
    const model: TaxReturn = {
      ...emptyTaxReturn(2025),
      w2s: [makeW2({
        id: 'w2-1', employerName: 'X', box1: cents(100000), box2: cents(15000),
        box15State: 'PA', box16StateWages: cents(100000), box17StateIncomeTax: cents(1000),
      })],
    }
    const result = computePA(model)
    const expectedTax = Math.round(cents(100000) * PA_TAX_RATE)

    expect(result.paTax).toBe(expectedTax)
    expect(result.amountOwed).toBe(expectedTax - cents(1000))
    expect(result.overpaid).toBe(0)
  })

  it('no withholding → owes full tax', () => {
    const model: TaxReturn = {
      ...emptyTaxReturn(2025),
      w2s: [makeW2({ id: 'w2-1', employerName: 'X', box1: cents(60000), box2: cents(8000) })],
    }
    const result = computePA(model)
    const expectedTax = Math.round(cents(60000) * PA_TAX_RATE)

    expect(result.stateWithholding).toBe(0)
    expect(result.amountOwed).toBe(expectedTax)
  })

  it('only sums PA withholding (not other states)', () => {
    const model: TaxReturn = {
      ...emptyTaxReturn(2025),
      w2s: [
        makeW2({ id: 'w2-1', employerName: 'PA', box1: cents(50000), box2: cents(5000), box15State: 'PA', box17StateIncomeTax: cents(1500) }),
        makeW2({ id: 'w2-2', employerName: 'NY', box1: cents(30000), box2: cents(3000), box15State: 'NY', box17StateIncomeTax: cents(1200) }),
      ],
    }
    const result = computePA(model)
    expect(result.stateWithholding).toBe(cents(1500))
  })
})

// ── Part-year apportionment ─────────────────────────────────────

describe('computeApportionmentRatio', () => {
  it('full-year → 1.0', () => {
    expect(computeApportionmentRatio(paConfig(), 2025)).toBe(1.0)
  })

  it('nonresident → 0.0', () => {
    expect(computeApportionmentRatio(paConfig({ residencyType: 'nonresident' }), 2025)).toBe(0.0)
  })

  it('move in July 1 → ~50.4%', () => {
    const config = paConfig({ residencyType: 'part-year', moveInDate: '2025-07-01' })
    const ratio = computeApportionmentRatio(config, 2025)
    // July 1 to Dec 31 = 184 days, 184/365 ≈ 0.5041
    expect(ratio).toBeCloseTo(184 / 365, 3)
  })

  it('move out March 15 → ~20.5%', () => {
    const config = paConfig({ residencyType: 'part-year', moveOutDate: '2025-03-15' })
    const ratio = computeApportionmentRatio(config, 2025)
    // Jan 1 to Mar 15 = 74 days, 74/365 ≈ 0.2027
    expect(ratio).toBeCloseTo(74 / 365, 3)
  })

  it('leap year affects denominator', () => {
    const config = paConfig({ residencyType: 'part-year', moveInDate: '2024-07-01' })
    const ratio = computeApportionmentRatio(config, 2024)
    // July 1 to Dec 31 = 184 days, 184/366
    expect(ratio).toBeCloseTo(184 / 366, 3)
  })
})

describe('PA-40 — part-year computation', () => {
  it('part-year tax is apportioned', () => {
    const model: TaxReturn = {
      ...emptyTaxReturn(2025),
      w2s: [makeW2({
        id: 'w2-1', employerName: 'X', box1: cents(75000), box2: cents(10000),
        box15State: 'PA', box16StateWages: cents(75000), box17StateIncomeTax: cents(1200),
      })],
    }
    const config = paConfig({ residencyType: 'part-year', moveInDate: '2025-07-01' })
    const result = computePA(model, config)

    const fullYearTax = Math.round(cents(75000) * PA_TAX_RATE)
    const ratio = 184 / 365
    const apportionedTax = Math.round(fullYearTax * ratio)

    expect(result.paTax).toBe(apportionedTax)
    expect(result.apportionmentRatio).toBeCloseTo(ratio, 3)
  })
})

// ── §529 deduction ──────────────────────────────────────────────

describe('PA-40 — §529 deduction', () => {
  it('$10K contribution → reduces taxable by $10K', () => {
    const model: TaxReturn = {
      ...emptyTaxReturn(2025),
      w2s: [makeW2({ id: 'w2-1', employerName: 'X', box1: cents(75000), box2: cents(10000), box15State: 'PA', box17StateIncomeTax: cents(2300) })],
    }
    const config = paConfig({ contributions529: cents(10000) })
    const result = computePA(model, config)

    expect(result.deductions529).toBe(cents(10000))
    expect(result.adjustedTaxableIncome).toBe(cents(75000) - cents(10000))
    expect(result.paTax).toBe(Math.round(cents(65000) * PA_TAX_RATE))
  })

  it('$20K contribution → capped at $18K', () => {
    const model: TaxReturn = {
      ...emptyTaxReturn(2025),
      w2s: [makeW2({ id: 'w2-1', employerName: 'X', box1: cents(75000), box2: cents(10000) })],
    }
    const config = paConfig({ contributions529: cents(20000) })
    const result = computePA(model, config)

    expect(result.deductions529).toBe(cents(18000))
    expect(result.adjustedTaxableIncome).toBe(cents(75000) - cents(18000))
  })

  it('no contribution → deductions529 = 0', () => {
    const model: TaxReturn = {
      ...emptyTaxReturn(2025),
      w2s: [makeW2({ id: 'w2-1', employerName: 'X', box1: cents(50000), box2: cents(5000) })],
    }
    const result = computePA(model)
    expect(result.deductions529).toBe(0)
  })

  it('MFJ $30K contribution → capped at $36K (MFJ per-beneficiary limit)', () => {
    const model: TaxReturn = {
      ...emptyTaxReturn(2025),
      filingStatus: 'mfj',
      w2s: [makeW2({ id: 'w2-1', employerName: 'X', box1: cents(100000), box2: cents(10000) })],
    }
    const config = paConfig({ contributions529: cents(30000) })
    const result = computePA(model, config)

    // MFJ allows up to $36K per beneficiary; $30K is under the cap
    expect(result.deductions529).toBe(cents(30000))
  })

  it('MFJ $40K contribution → capped at $36K', () => {
    const model: TaxReturn = {
      ...emptyTaxReturn(2025),
      filingStatus: 'mfj',
      w2s: [makeW2({ id: 'w2-1', employerName: 'X', box1: cents(100000), box2: cents(10000) })],
    }
    const config = paConfig({ contributions529: cents(40000) })
    const result = computePA(model, config)

    expect(result.deductions529).toBe(cents(36000))
  })

  it('per-beneficiary: two beneficiaries capped individually', () => {
    const model: TaxReturn = {
      ...emptyTaxReturn(2025),
      w2s: [makeW2({ id: 'w2-1', employerName: 'X', box1: cents(100000), box2: cents(10000) })],
    }
    const config = paConfig({
      contributions529PerBeneficiary: [
        { name: 'Child A', amount: cents(20000) },  // capped at $18K
        { name: 'Child B', amount: cents(10000) },   // under cap
      ],
    })
    const result = computePA(model, config)

    // $18K (capped) + $10K = $28K
    expect(result.deductions529).toBe(cents(28000))
  })

  it('per-beneficiary MFJ: each capped at $36K', () => {
    const model: TaxReturn = {
      ...emptyTaxReturn(2025),
      filingStatus: 'mfj',
      w2s: [makeW2({ id: 'w2-1', employerName: 'X', box1: cents(200000), box2: cents(20000) })],
    }
    const config = paConfig({
      contributions529PerBeneficiary: [
        { name: 'Child A', amount: cents(36000) },   // at MFJ cap
        { name: 'Child B', amount: cents(40000) },   // capped at $36K
      ],
    })
    const result = computePA(model, config)

    // $36K + $36K = $72K
    expect(result.deductions529).toBe(cents(72000))
  })
})

// ── Tax forgiveness integration ─────────────────────────────────

describe('PA-40 — tax forgiveness integration', () => {
  it('low income → forgiveness applies', () => {
    const model: TaxReturn = {
      ...emptyTaxReturn(2025),
      w2s: [makeW2({
        id: 'w2-1', employerName: 'X', box1: cents(5000), box2: 0,
        box15State: 'PA', box17StateIncomeTax: 0,
      })],
    }
    const result = computePA(model)

    expect(result.taxForgiveness.qualifies).toBe(true)
    expect(result.taxForgiveness.forgivenessPercentage).toBe(100)
    expect(result.taxForgiveness.forgivenessCredit).toBe(result.paTax)
    expect(result.taxAfterCredits).toBe(0)
  })

  it('high income → no forgiveness', () => {
    const model: TaxReturn = {
      ...emptyTaxReturn(2025),
      w2s: [makeW2({ id: 'w2-1', employerName: 'X', box1: cents(100000), box2: cents(15000) })],
    }
    const result = computePA(model)

    expect(result.taxForgiveness.qualifies).toBe(false)
    expect(result.taxForgiveness.forgivenessCredit).toBe(0)
    expect(result.taxAfterCredits).toBe(result.paTax)
  })
})

// ── Combined scenarios ──────────────────────────────────────────

describe('PA-40 — combined scenarios', () => {
  it('tech employee: $200K wages with PA withholding', () => {
    const model: TaxReturn = {
      ...emptyTaxReturn(2025),
      w2s: [makeW2({
        id: 'w2-1', employerName: 'TechCo',
        box1: cents(200000), box2: cents(40000),
        box15State: 'PA', box16StateWages: cents(200000), box17StateIncomeTax: cents(6140),
      })],
    }
    const result = computePA(model)

    expect(result.totalPATaxableIncome).toBe(cents(200000))
    expect(result.paTax).toBe(Math.round(cents(200000) * PA_TAX_RATE))
    expect(result.stateWithholding).toBe(cents(6140))
  })

  it('capital losses do not reduce wage tax', () => {
    const model: TaxReturn = {
      ...emptyTaxReturn(2025),
      w2s: [makeW2({ id: 'w2-1', employerName: 'X', box1: cents(80000), box2: cents(10000) })],
      form1099Bs: [{
        id: 'b-1', brokerName: 'Broker', description: 'RIVN',
        dateAcquired: '2024-01-01', dateSold: '2025-06-01',
        proceeds: cents(3000), costBasis: cents(10000),
        washSaleLossDisallowed: 0, gainLoss: cents(-7000),
        basisReportedToIrs: true, longTerm: true, noncoveredSecurity: false,
        federalTaxWithheld: 0,
      }],
    }
    const result = computePA(model)

    // Capital loss floors at 0; only wages are taxed
    expect(result.incomeClasses.netGains).toBe(0)
    expect(result.totalPATaxableIncome).toBe(cents(80000))
    expect(result.paTax).toBe(Math.round(cents(80000) * PA_TAX_RATE))
  })
})
