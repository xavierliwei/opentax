/**
 * Tests for Virginia Form 760 — Resident Income Tax Return
 *
 * Covers: VA tax brackets, standard/itemized deduction, personal exemptions,
 * age 65+/blind extras, age deduction (Schedule ADJ), low-income credit,
 * state withholding, part-year apportionment, and refund/owed computation.
 */

import { describe, it, expect } from 'vitest'
import { cents } from '../../../src/model/traced'
import { emptyTaxReturn } from '../../../src/model/types'
import type { TaxReturn, StateReturnConfig } from '../../../src/model/types'
import { computeForm1040 } from '../../../src/rules/2025/form1040'
import { computeForm760 } from '../../../src/rules/2025/va/form760'
import { computeBracketTax } from '../../../src/rules/2025/taxComputation'
import { VA_TAX_BRACKETS } from '../../../src/rules/2025/va/constants'
import { computeScheduleADJ } from '../../../src/rules/2025/va/scheduleADJ'
import { computeLowIncomeCredit } from '../../../src/rules/2025/va/vaCredits'
import { computeAll } from '../../../src/rules/engine'
import { makeW2, makeDependent } from '../../fixtures/returns'

// ── Helpers ─────────────────────────────────────────────────────

function makeVAReturn(overrides: Partial<TaxReturn> = {}): TaxReturn {
  return {
    ...emptyTaxReturn(2025),
    ...overrides,
  }
}

function compute760(overrides: Partial<TaxReturn> = {}, config?: StateReturnConfig) {
  const model = makeVAReturn(overrides)
  const form1040 = computeForm1040(model)
  return computeForm760(model, form1040, config)
}

const vaFullYear: StateReturnConfig = { stateCode: 'VA', residencyType: 'full-year' }

// ── Basic scenarios ─────────────────────────────────────────────

describe('Form 760 — basic tax computation', () => {
  it('single, $50K wages, standard deduction', () => {
    const result = compute760({
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(50000), box2: cents(5000),
        box15State: 'VA', box17StateIncomeTax: cents(2000) })],
    }, vaFullYear)

    expect(result.federalAGI).toBe(cents(50000))
    expect(result.vaAGI).toBe(cents(50000))
    expect(result.deductionMethod).toBe('standard')
    expect(result.deductionUsed).toBe(cents(8000))
    // Exemptions: 1 person × $930 = $930
    expect(result.totalExemptions).toBe(cents(930))
    // Taxable: $50,000 - $8,000 - $930 = $41,070
    expect(result.vaTaxableIncome).toBe(cents(41070))

    const expectedTax = computeBracketTax(result.vaTaxableIncome, VA_TAX_BRACKETS)
    expect(result.vaTax).toBe(expectedTax)
    expect(result.vaTax).toBeGreaterThan(0)

    expect(result.stateWithholding).toBe(cents(2000))
  })

  it('single, $75K wages', () => {
    const result = compute760({
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(75000), box2: cents(10000),
        box15State: 'VA', box17StateIncomeTax: cents(3500) })],
    }, vaFullYear)

    expect(result.federalAGI).toBe(cents(75000))
    expect(result.vaAGI).toBe(cents(75000))
    // Taxable: $75,000 - $8,000 - $930 = $66,070
    expect(result.vaTaxableIncome).toBe(cents(66070))
    expect(result.stateWithholding).toBe(cents(3500))
  })

  it('MFJ, $120K combined wages', () => {
    const result = compute760({
      filingStatus: 'mfj',
      w2s: [
        makeW2({ id: 'w1', employerName: 'A', box1: cents(70000), box2: cents(8000),
          box15State: 'VA', box17StateIncomeTax: cents(2000) }),
        makeW2({ id: 'w2', employerName: 'B', box1: cents(50000), box2: cents(5000),
          box15State: 'VA', box17StateIncomeTax: cents(1500) }),
      ],
    }, vaFullYear)

    expect(result.vaAGI).toBe(cents(120000))
    expect(result.deductionUsed).toBe(cents(16000))
    // Exemptions: 2 × $930 = $1,860
    expect(result.totalExemptions).toBe(cents(1860))
    // Taxable: $120,000 - $16,000 - $1,860 = $102,140
    expect(result.vaTaxableIncome).toBe(cents(102140))
    expect(result.stateWithholding).toBe(cents(3500))
  })

  it('single, $30K wages', () => {
    const result = compute760({
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(30000), box2: cents(2000) })],
    }, vaFullYear)

    expect(result.vaAGI).toBe(cents(30000))
    expect(result.deductionUsed).toBe(cents(8000))
    expect(result.totalExemptions).toBe(cents(930))
    expect(result.vaTaxableIncome).toBe(cents(21070))
  })

  it('HOH, $90K wages, 2 dependents', () => {
    const result = compute760({
      filingStatus: 'hoh',
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(90000), box2: cents(12000) })],
      dependents: [
        makeDependent({ firstName: 'A', dateOfBirth: '2015-01-01' }),
        makeDependent({ firstName: 'B', dateOfBirth: '2017-06-15', ssn: '987654322' }),
      ],
    }, vaFullYear)

    expect(result.deductionUsed).toBe(cents(16000)) // HOH = $16,000
    // Exemptions: 1 filer + 2 deps = 3 × $930 = $2,790
    expect(result.totalExemptions).toBe(cents(2790))
    // Taxable: $90,000 - $16,000 - $2,790 = $71,210
    expect(result.vaTaxableIncome).toBe(cents(71210))
  })

  it('zero income', () => {
    const result = compute760({}, vaFullYear)
    expect(result.federalAGI).toBe(0)
    expect(result.vaTaxableIncome).toBe(0)
    expect(result.vaTax).toBe(0)
    expect(result.taxAfterCredits).toBe(0)
  })

  it('deduction exceeds income → taxable = 0', () => {
    const result = compute760({
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(5000), box2: cents(200) })],
    }, vaFullYear)

    // $5,000 - $8,000 std deduction = negative → 0
    expect(result.vaTaxableIncome).toBe(0)
    expect(result.vaTax).toBe(0)
  })
})

// ── Bracket boundary tests ──────────────────────────────────────

describe('Form 760 — bracket boundaries', () => {
  // Helper: compute tax for a specific taxable income amount (in cents)
  function taxFor(taxableCents: number) {
    return computeBracketTax(taxableCents, VA_TAX_BRACKETS)
  }

  it('$3,000 exactly → 2% bracket only', () => {
    // $3,000 × 2% = $60
    expect(taxFor(cents(3000))).toBe(cents(60))
  })

  it('$5,000 exactly → fills first two brackets', () => {
    // $3,000 × 2% + $2,000 × 3% = $60 + $60 = $120
    expect(taxFor(cents(5000))).toBe(cents(120))
  })

  it('$17,000 exactly → fills first three brackets', () => {
    // $3,000 × 2% + $2,000 × 3% + $12,000 × 5% = $60 + $60 + $600 = $720
    expect(taxFor(cents(17000))).toBe(cents(720))
  })

  it('$17,001 → just enters top bracket', () => {
    // $720 + $1 × 5.75% = $720 + $0.0575 → rounded
    const tax = taxFor(cents(17001))
    expect(tax).toBe(cents(720) + Math.round(100 * 0.0575))
  })

  it('$500,000 high income', () => {
    // $720 + ($500,000 - $17,000) × 5.75% = $720 + $27,772.50
    const tax = taxFor(cents(500000))
    expect(tax).toBe(cents(720) + Math.round(cents(483000) * 0.0575))
  })

  it('$1 income', () => {
    // $1 × 2% = $0.02 → rounds to 0
    expect(taxFor(cents(1))).toBe(Math.round(100 * 0.02))
  })
})

// ── Exemption tests ─────────────────────────────────────────────

describe('Form 760 — exemptions', () => {
  it('single, no dependents → $930', () => {
    const result = compute760({
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(50000), box2: cents(5000) })],
    }, vaFullYear)
    expect(result.personalExemptions).toBe(cents(930))
    expect(result.dependentExemptions).toBe(0)
    expect(result.totalExemptions).toBe(cents(930))
  })

  it('MFJ, no dependents → $1,860', () => {
    const result = compute760({
      filingStatus: 'mfj',
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(100000), box2: cents(15000) })],
    }, vaFullYear)
    expect(result.personalExemptions).toBe(cents(1860))
    expect(result.totalExemptions).toBe(cents(1860))
  })

  it('MFJ, 2 dependents → $3,720', () => {
    const result = compute760({
      filingStatus: 'mfj',
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(100000), box2: cents(15000) })],
      dependents: [
        makeDependent({ firstName: 'A', dateOfBirth: '2015-01-01' }),
        makeDependent({ firstName: 'B', dateOfBirth: '2017-01-01', ssn: '987654322' }),
      ],
    }, vaFullYear)
    expect(result.personalExemptions).toBe(cents(1860))
    expect(result.dependentExemptions).toBe(cents(1860))
    expect(result.totalExemptions).toBe(cents(3720))
  })

  it('single, age 65+ → $930 + $800 = $1,730', () => {
    const result = compute760({
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(50000), box2: cents(5000) })],
      deductions: { method: 'standard', taxpayerAge65: true },
    }, vaFullYear)
    expect(result.personalExemptions).toBe(cents(930))
    expect(result.age65Exemptions).toBe(cents(800))
    expect(result.totalExemptions).toBe(cents(1730))
  })

  it('MFJ, both age 65+, both blind → $5,060', () => {
    const result = compute760({
      filingStatus: 'mfj',
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(100000), box2: cents(15000) })],
      deductions: { method: 'standard', taxpayerAge65: true, spouseAge65: true, taxpayerBlind: true, spouseBlind: true },
    }, vaFullYear)
    // ($930 + $800 + $800) × 2 = $2,530 × 2 = $5,060
    expect(result.personalExemptions).toBe(cents(1860))
    expect(result.age65Exemptions).toBe(cents(1600))
    expect(result.blindExemptions).toBe(cents(1600))
    expect(result.totalExemptions).toBe(cents(5060))
  })

  it('MFJ, 3 dependents, one spouse 65+ → $5,450', () => {
    const result = compute760({
      filingStatus: 'mfj',
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(100000), box2: cents(15000) })],
      dependents: [
        makeDependent({ firstName: 'A', dateOfBirth: '2015-01-01' }),
        makeDependent({ firstName: 'B', dateOfBirth: '2017-01-01', ssn: '987654322' }),
        makeDependent({ firstName: 'C', dateOfBirth: '2020-01-01', ssn: '987654323' }),
      ],
      deductions: { method: 'standard', spouseAge65: true },
    }, vaFullYear)
    // 2 × $930 + 3 × $930 + $800 = $1,860 + $2,790 + $800 = $5,450
    expect(result.totalExemptions).toBe(cents(5450))
  })
})

// ── Age deduction tests (Schedule ADJ) ──────────────────────────

describe('Schedule ADJ — age deduction', () => {
  it('age 65+, FAGI $50K → full $12,000 deduction', () => {
    const model = makeVAReturn({
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(50000), box2: cents(5000) })],
      deductions: { method: 'standard', taxpayerAge65: true },
    })
    const form1040 = computeForm1040(model)
    const adj = computeScheduleADJ(form1040, model, vaFullYear)
    expect(adj.ageDeduction).toBe(cents(12000))
    expect(adj.vaAGI).toBe(cents(38000))
  })

  it('age 65+, FAGI $75,000 → full deduction (at boundary)', () => {
    const model = makeVAReturn({
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(75000), box2: cents(10000) })],
      deductions: { method: 'standard', taxpayerAge65: true },
    })
    const form1040 = computeForm1040(model)
    const adj = computeScheduleADJ(form1040, model, vaFullYear)
    expect(adj.ageDeduction).toBe(cents(12000))
  })

  it('age 65+, FAGI $80,000 → $7,000 deduction (phased out)', () => {
    const model = makeVAReturn({
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(80000), box2: cents(10000) })],
      deductions: { method: 'standard', taxpayerAge65: true },
    })
    const form1040 = computeForm1040(model)
    const adj = computeScheduleADJ(form1040, model, vaFullYear)
    // $12,000 - ($80,000 - $75,000) = $12,000 - $5,000 = $7,000
    expect(adj.ageDeduction).toBe(cents(7000))
  })

  it('age 65+, FAGI $87,000 → $0 (fully phased out)', () => {
    const model = makeVAReturn({
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(87000), box2: cents(12000) })],
      deductions: { method: 'standard', taxpayerAge65: true },
    })
    const form1040 = computeForm1040(model)
    const adj = computeScheduleADJ(form1040, model, vaFullYear)
    expect(adj.ageDeduction).toBe(0)
  })

  it('under 65 → $0 age deduction', () => {
    const model = makeVAReturn({
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(50000), box2: cents(5000) })],
    })
    const form1040 = computeForm1040(model)
    const adj = computeScheduleADJ(form1040, model, vaFullYear)
    expect(adj.ageDeduction).toBe(0)
    expect(adj.vaAGI).toBe(adj.federalAGI)
  })

  it('MFJ both 65+, FAGI $50K → $24,000 total deduction', () => {
    const model = makeVAReturn({
      filingStatus: 'mfj',
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(50000), box2: cents(5000) })],
      deductions: { method: 'standard', taxpayerAge65: true, spouseAge65: true },
    })
    const form1040 = computeForm1040(model)
    const adj = computeScheduleADJ(form1040, model, vaFullYear)
    // Each spouse: $12,000 (FAGI $50K ≤ $75K)
    expect(adj.ageDeduction).toBe(cents(24000))
  })
})

// ── Low-income credit tests ─────────────────────────────────────

describe('VA low-income credit', () => {
  it('income below poverty level → partial credit', () => {
    // Single, family size 1, poverty = $15,650
    // Taxable = $10,000, tax = bracket calc
    const tax = computeBracketTax(cents(10000), VA_TAX_BRACKETS)
    const credit = computeLowIncomeCredit(cents(10000), tax, 1)
    // credit = tax × ($15,650 - $10,000) / $15,650
    const expected = Math.round(tax * (cents(15650) - cents(10000)) / cents(15650))
    expect(credit).toBe(expected)
    expect(credit).toBeGreaterThan(0)
    expect(credit).toBeLessThanOrEqual(tax)
  })

  it('income at poverty level → $0 credit', () => {
    const tax = computeBracketTax(cents(15650), VA_TAX_BRACKETS)
    const credit = computeLowIncomeCredit(cents(15650), tax, 1)
    expect(credit).toBe(0)
  })

  it('income above poverty level → $0 credit', () => {
    const tax = computeBracketTax(cents(50000), VA_TAX_BRACKETS)
    const credit = computeLowIncomeCredit(cents(50000), tax, 1)
    expect(credit).toBe(0)
  })

  it('family of 4 → higher threshold', () => {
    // Family size 4, poverty = $32,150
    const tax = computeBracketTax(cents(25000), VA_TAX_BRACKETS)
    const credit = computeLowIncomeCredit(cents(25000), tax, 4)
    // $25,000 < $32,150 → credit applies
    expect(credit).toBeGreaterThan(0)
  })

  it('zero tax → $0 credit', () => {
    const credit = computeLowIncomeCredit(cents(5000), 0, 1)
    expect(credit).toBe(0)
  })
})

// ── Part-year resident tests ────────────────────────────────────

describe('Form 760 — part-year residents', () => {
  it('moved to VA on July 1 → ~50% apportionment', () => {
    const config: StateReturnConfig = {
      stateCode: 'VA',
      residencyType: 'part-year',
      moveInDate: '2025-07-01',
    }
    const result = compute760({
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(100000), box2: cents(15000),
        box15State: 'VA', box17StateIncomeTax: cents(3000) })],
    }, config)

    // July 1 – Dec 31 = 184 days / 365 ≈ 0.5041
    expect(result.apportionmentRatio).toBeGreaterThan(0.49)
    expect(result.apportionmentRatio).toBeLessThan(0.52)
    expect(result.residencyType).toBe('part-year')
    expect(result.vaSourceIncome).toBeDefined()
  })

  it('full-year resident → ratio = 1.0', () => {
    const result = compute760({
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(100000), box2: cents(15000) })],
    }, vaFullYear)

    expect(result.apportionmentRatio).toBe(1.0)
    expect(result.vaSourceIncome).toBeUndefined()
  })

  it('part-year tax is prorated', () => {
    const fullYear = compute760({
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(100000), box2: cents(15000) })],
    }, vaFullYear)

    const partYear = compute760({
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(100000), box2: cents(15000) })],
    }, {
      stateCode: 'VA',
      residencyType: 'part-year',
      moveInDate: '2025-07-01',
    })

    // Part-year tax should be roughly half of full-year tax
    expect(partYear.vaTax).toBeLessThan(fullYear.vaTax)
    expect(partYear.vaTax).toBeGreaterThan(fullYear.vaTax * 0.4)
  })
})

// ── Withholding tests ───────────────────────────────────────────

describe('Form 760 — withholding & payments', () => {
  it('multiple W-2s with VA withholding → sum Box 17', () => {
    const result = compute760({
      w2s: [
        makeW2({ id: 'w1', employerName: 'A', box1: cents(80000), box2: cents(10000),
          box15State: 'VA', box17StateIncomeTax: cents(3000) }),
        makeW2({ id: 'w2', employerName: 'B', box1: cents(40000), box2: cents(4000),
          box15State: 'VA', box17StateIncomeTax: cents(1500) }),
      ],
    }, vaFullYear)
    expect(result.stateWithholding).toBe(cents(4500))
  })

  it('no VA withholding → $0', () => {
    const result = compute760({
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(100000), box2: cents(15000),
        box15State: 'CA', box17StateIncomeTax: cents(5000) })],
    }, vaFullYear)
    expect(result.stateWithholding).toBe(0)
    expect(result.amountOwed).toBeGreaterThan(0)
  })

  it('withholding exceeds tax → refund', () => {
    const result = compute760({
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(30000), box2: cents(2000),
        box15State: 'VA', box17StateIncomeTax: cents(5000) })],
    }, vaFullYear)
    expect(result.overpaid).toBeGreaterThan(0)
    expect(result.amountOwed).toBe(0)
  })
})

// ── Integration tests (through computeAll) ──────────────────────

describe('Form 760 — engine integration', () => {
  it('computes VA via computeAll', () => {
    const tr: TaxReturn = {
      ...emptyTaxReturn(2025),
      stateReturns: [{ stateCode: 'VA', residencyType: 'full-year' }],
      w2s: [makeW2({
        id: 'w2-1',
        employerName: 'Test Corp',
        box1: cents(100000),
        box2: cents(15000),
        box15State: 'VA',
        box16StateWages: cents(100000),
        box17StateIncomeTax: cents(5000),
      })],
    }

    const result = computeAll(tr)
    const va = result.stateResults[0]
    expect(va.stateCode).toBe('VA')
    expect(va.formLabel).toBe('VA Form 760')
    expect(va.stateAGI).toBe(cents(100000))
    expect(va.stateTaxableIncome).toBeGreaterThan(0)
    expect(va.stateWithholding).toBe(cents(5000))
  })

  it('tech employee $150K + VA withholding → refund/owed', () => {
    const tr: TaxReturn = {
      ...emptyTaxReturn(2025),
      stateReturns: [{ stateCode: 'VA', residencyType: 'full-year' }],
      w2s: [makeW2({
        id: 'w2-1',
        employerName: 'BigTech',
        box1: cents(150000),
        box2: cents(25000),
        box15State: 'VA',
        box16StateWages: cents(150000),
        box17StateIncomeTax: cents(6000),
      })],
    }

    const result = computeAll(tr)
    const va = result.stateResults[0]
    expect(va.stateAGI).toBe(cents(150000))
    // Tax on ~$141,070 taxable income at 5.75% top rate
    expect(va.stateTax).toBeGreaterThan(cents(5000))
  })

  it('part-year uses correct form label', () => {
    const tr: TaxReturn = {
      ...emptyTaxReturn(2025),
      stateReturns: [{
        stateCode: 'VA',
        residencyType: 'part-year',
        moveInDate: '2025-01-01',
        moveOutDate: '2025-06-30',
      }],
      w2s: [makeW2({
        id: 'w2-1',
        employerName: 'Test Corp',
        box1: cents(100000),
        box2: cents(15000),
        box15State: 'VA',
        box17StateIncomeTax: cents(3000),
      })],
    }

    const result = computeAll(tr)
    const va = result.stateResults[0]
    expect(va.formLabel).toBe('VA Form 760PY')
    expect(va.apportionmentRatio).toBeGreaterThan(0)
    expect(va.apportionmentRatio).toBeLessThan(1)
  })
})

// ── Itemized deduction tests ────────────────────────────────────

describe('Form 760 — itemized deductions', () => {
  it('federal itemized with state tax removed → uses larger of std/itemized', () => {
    const result = compute760({
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(150000), box2: cents(25000) })],
      deductions: {
        method: 'itemized',
        itemized: {
          medicalExpenses: 0,
          stateLocalIncomeTaxes: cents(10000),
          stateLocalSalesTaxes: 0,
          realEstateTaxes: cents(5000),
          personalPropertyTaxes: cents(1000),
          mortgageInterest: cents(12000),
          mortgagePrincipal: 0,
          mortgagePreTCJA: false,
          investmentInterest: 0,
          priorYearInvestmentInterestCarryforward: 0,
          charitableCash: cents(5000),
          charitableNoncash: 0,
          gamblingLosses: 0,
          casualtyTheftLosses: 0,
          federalEstateTaxIRD: 0,
          otherMiscDeductions: 0,
        },
      },
    }, vaFullYear)

    // VA itemized: remove state income tax ($10K), keep RE ($5K) + PP ($1K)
    // SALT portion = $5,000 + $1,000 = $6,000
    // Mortgage: $12,000, Charitable: $5,000
    // Total VA itemized: $6,000 + $12,000 + $5,000 = $23,000
    // Standard: $8,000 → itemized wins
    expect(result.deductionMethod).toBe('itemized')
    expect(result.vaItemizedDeduction).toBe(cents(23000))
    expect(result.deductionUsed).toBe(cents(23000))
  })

  it('standard deduction used when itemized is lower', () => {
    const result = compute760({
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(50000), box2: cents(5000) })],
      deductions: {
        method: 'itemized',
        itemized: {
          medicalExpenses: 0,
          stateLocalIncomeTaxes: cents(5000),  // removed for VA
          stateLocalSalesTaxes: 0,
          realEstateTaxes: cents(2000),
          personalPropertyTaxes: 0,
          mortgageInterest: cents(3000),
          mortgagePrincipal: 0,
          mortgagePreTCJA: false,
          investmentInterest: 0,
          priorYearInvestmentInterestCarryforward: 0,
          charitableCash: cents(1000),
          charitableNoncash: 0,
          gamblingLosses: 0,
          casualtyTheftLosses: 0,
          federalEstateTaxIRD: 0,
          otherMiscDeductions: 0,
        },
      },
    }, vaFullYear)

    // VA itemized: $2,000 RE + $3,000 mortgage + $1,000 charitable = $6,000
    // Standard: $8,000 → standard wins
    expect(result.deductionMethod).toBe('standard')
    expect(result.deductionUsed).toBe(cents(8000))
  })
})
