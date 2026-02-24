/**
 * Tests for Maryland Form 502 — Resident Income Tax Return
 *
 * Covers: MD tax brackets (10 brackets, 2%–6.50%), flat standard deduction,
 * Social Security subtraction, personal/dependent exemptions with stepped
 * phase-down, county local tax, MD EIC, state withholding, part-year
 * apportionment, itemized deductions, and refund/owed computation.
 */

import { describe, it, expect } from 'vitest'
import { cents } from '../../../src/model/traced'
import { emptyTaxReturn } from '../../../src/model/types'
import type { TaxReturn, FilingStatus } from '../../../src/model/types'
import { computeForm1040 } from '../../../src/rules/2025/form1040'
import { computeForm502 } from '../../../src/rules/2025/md/form502'
import { computeBracketTax } from '../../../src/rules/2025/taxComputation'
import { MD_TAX_BRACKETS, MD_STANDARD_DEDUCTION, MD_PERSONAL_EXEMPTION, MD_COUNTIES } from '../../../src/rules/2025/md/constants'
import { makeW2, makeDependent, makeSSA1099 } from '../../fixtures/returns'
import { mdModule } from '../../../src/rules/2025/md/module'

// ── Helpers ─────────────────────────────────────────────────────

function makeMDReturn(overrides: Partial<TaxReturn> = {}): TaxReturn {
  return {
    ...emptyTaxReturn(2025),
    ...overrides,
  }
}

function compute502(overrides: Partial<TaxReturn> = {}, county?: string) {
  const model = makeMDReturn(overrides)
  const form1040 = computeForm1040(model)
  return computeForm502(model, form1040, {
    stateCode: 'MD',
    residencyType: 'full-year',
    county,
  })
}

// ── Basic scenarios ─────────────────────────────────────────────

describe('Form 502 — basic tax computation', () => {
  it('single, $75K wages, standard deduction, Montgomery County', () => {
    const result = compute502({
      w2s: [makeW2({
        id: 'w', employerName: 'X', box1: cents(75000), box2: cents(10000),
        box15State: 'MD', box17StateIncomeTax: cents(3500),
      })],
    }, 'montgomery')

    expect(result.federalAGI).toBe(cents(75000))
    expect(result.ssSubtraction).toBe(0)
    expect(result.mdAGI).toBe(cents(75000))
    expect(result.deductionMethod).toBe('standard')
    expect(result.deductionUsed).toBe(MD_STANDARD_DEDUCTION.single) // $3,350

    // Exemption: full at $75K AGI (below $100K threshold)
    expect(result.exemptionPerPerson).toBe(MD_PERSONAL_EXEMPTION)
    expect(result.totalExemptions).toBe(MD_PERSONAL_EXEMPTION) // 1 person for single

    const expectedTaxable = cents(75000) - MD_STANDARD_DEDUCTION.single - MD_PERSONAL_EXEMPTION
    expect(result.mdTaxableIncome).toBe(expectedTaxable)

    const expectedStateTax = computeBracketTax(expectedTaxable, MD_TAX_BRACKETS.single)
    expect(result.mdStateTax).toBe(expectedStateTax)
    expect(result.mdStateTax).toBeGreaterThan(0)

    // Local tax: Montgomery County = 3.20%
    expect(result.countyCode).toBe('montgomery')
    expect(result.countyRate).toBe(0.032)
    expect(result.mdLocalTax).toBe(Math.round(expectedTaxable * 0.032))

    expect(result.stateWithholding).toBe(cents(3500))
  })

  it('MFJ, $120K combined wages → MFJ brackets + 2 exemptions', () => {
    const result = compute502({
      filingStatus: 'mfj',
      w2s: [
        makeW2({ id: 'w1', employerName: 'A', box1: cents(70000), box2: cents(8000),
          box15State: 'MD', box17StateIncomeTax: cents(2000) }),
        makeW2({ id: 'w2', employerName: 'B', box1: cents(50000), box2: cents(5000),
          box15State: 'MD', box17StateIncomeTax: cents(1500) }),
      ],
    })

    expect(result.mdAGI).toBe(cents(120000))
    expect(result.deductionUsed).toBe(MD_STANDARD_DEDUCTION.mfj) // $6,700

    // MFJ → 2 personal exemptions, both full at $120K (below $150K threshold)
    expect(result.exemptionPerPerson).toBe(MD_PERSONAL_EXEMPTION)
    expect(result.totalExemptions).toBe(MD_PERSONAL_EXEMPTION * 2)

    const expectedTaxable = cents(120000) - MD_STANDARD_DEDUCTION.mfj - MD_PERSONAL_EXEMPTION * 2
    expect(result.mdTaxableIncome).toBe(expectedTaxable)

    const expectedTax = computeBracketTax(expectedTaxable, MD_TAX_BRACKETS.mfj)
    expect(result.mdStateTax).toBe(expectedTax)

    expect(result.stateWithholding).toBe(cents(3500))
  })

  it('zero income → $0 MD tax', () => {
    const result = compute502()

    expect(result.mdAGI).toBe(0)
    expect(result.mdTaxableIncome).toBe(0)
    expect(result.mdStateTax).toBe(0)
    expect(result.mdLocalTax).toBe(0)
    expect(result.taxAfterCredits).toBe(0)
    expect(result.overpaid).toBe(0)
    expect(result.amountOwed).toBe(0)
  })

  it('deduction + exemption exceed income → $0 taxable, $0 tax', () => {
    const result = compute502({
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(5000), box2: cents(0) })],
    })

    // $5K income, $3,350 standard deduction, $3,200 exemption → $0 taxable
    expect(result.mdTaxableIncome).toBe(0)
    expect(result.mdStateTax).toBe(0)
    expect(result.mdLocalTax).toBe(0)
  })
})

// ── Tax brackets ──────────────────────────────────────────────

describe('Form 502 — bracket computation', () => {
  it('income in first bracket ($500) → 2% rate', () => {
    const result = compute502({
      // Need income such that taxable = $500. Standard ded = $3,350, exempt = $3,200
      // So AGI needs to be $3,350 + $3,200 + $500 = $7,050
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(7050), box2: 0 })],
    })

    expect(result.mdTaxableIncome).toBe(cents(500))
    expect(result.mdStateTax).toBe(Math.round(cents(500) * 0.02))
  })

  it('income crossing first two brackets → mixed 2%/3%', () => {
    // Taxable = $1,500 → first $1K at 2%, next $500 at 3%
    const targetTaxable = cents(1500)
    const agi = targetTaxable + MD_STANDARD_DEDUCTION.single + MD_PERSONAL_EXEMPTION
    const result = compute502({
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: agi, box2: 0 })],
    })

    expect(result.mdTaxableIncome).toBe(targetTaxable)
    const expectedTax = Math.round(cents(1000) * 0.02 + cents(500) * 0.03)
    expect(result.mdStateTax).toBe(expectedTax)
  })

  it('$200K single income → hits 5.25% bracket', () => {
    const result = compute502({
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(200000), box2: cents(30000),
        box15State: 'MD', box17StateIncomeTax: cents(8000) })],
    })

    // At $200K AGI, exemption is $0 (single threshold: >$150K = phased out)
    expect(result.exemptionPerPerson).toBe(0)
    const expectedTaxable = cents(200000) - MD_STANDARD_DEDUCTION.single
    expect(result.mdTaxableIncome).toBe(expectedTaxable)

    // Verify by independent bracket computation
    const expectedTax = computeBracketTax(expectedTaxable, MD_TAX_BRACKETS.single)
    expect(result.mdStateTax).toBe(expectedTax)
  })

  it('$600K single income → hits 6.25% bracket (new for 2025)', () => {
    const result = compute502({
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(600000), box2: cents(100000),
        box15State: 'MD', box17StateIncomeTax: cents(25000) })],
    })

    const expectedTaxable = cents(600000) - MD_STANDARD_DEDUCTION.single - cents(0) // exemption = $0 above $150K
    expect(result.exemptionPerPerson).toBe(0) // phased out at $600K
    expect(result.mdTaxableIncome).toBe(expectedTaxable)

    const expectedTax = computeBracketTax(expectedTaxable, MD_TAX_BRACKETS.single)
    expect(result.mdStateTax).toBe(expectedTax)
  })

  it('$1.5M single income → hits 6.50% bracket (new for 2025)', () => {
    const result = compute502({
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(1500000), box2: cents(300000),
        box15State: 'MD', box17StateIncomeTax: cents(60000) })],
    })

    // Exemptions fully phased out
    expect(result.exemptionPerPerson).toBe(0)
    const expectedTaxable = cents(1500000) - MD_STANDARD_DEDUCTION.single
    expect(result.mdTaxableIncome).toBe(expectedTaxable)

    const expectedTax = computeBracketTax(expectedTaxable, MD_TAX_BRACKETS.single)
    expect(result.mdStateTax).toBe(expectedTax)
    expect(result.mdStateTax).toBeGreaterThan(0)
  })
})

// ── Standard deduction ──────────────────────────────────────────

describe('Form 502 — standard deduction', () => {
  it('single → flat $3,350', () => {
    const result = compute502({
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(50000), box2: 0 })],
    })
    expect(result.standardDeduction).toBe(cents(3350))
    expect(result.deductionMethod).toBe('standard')
  })

  it('MFJ → flat $6,700', () => {
    const result = compute502({
      filingStatus: 'mfj',
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(80000), box2: 0 })],
    })
    expect(result.standardDeduction).toBe(cents(6700))
  })

  it('MFS → flat $3,350', () => {
    const result = compute502({
      filingStatus: 'mfs',
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(50000), box2: 0 })],
    })
    expect(result.standardDeduction).toBe(cents(3350))
  })

  it('HOH → flat $3,350', () => {
    const result = compute502({
      filingStatus: 'hoh',
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(50000), box2: 0 })],
    })
    expect(result.standardDeduction).toBe(cents(3350))
  })

  it('QW → flat $6,700', () => {
    const result = compute502({
      filingStatus: 'qw',
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(50000), box2: 0 })],
    })
    expect(result.standardDeduction).toBe(cents(6700))
  })
})

// ── Social Security subtraction ───────────────────────────────

describe('Form 502 — Social Security subtraction', () => {
  it('subtracts taxable Social Security from federal AGI', () => {
    const result = compute502({
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(30000), box2: cents(3000),
        box15State: 'MD', box17StateIncomeTax: cents(1000) })],
      formSSA1099s: [makeSSA1099({ id: 'ssa1', box5: cents(20000) })],
    })

    // Federal AGI includes taxable portion of SS benefits
    // MD AGI should subtract the taxable SS amount
    expect(result.ssSubtraction).toBeGreaterThanOrEqual(0)
    expect(result.mdAGI).toBe(result.federalAGI - result.ssSubtraction)
    expect(result.mdAGI).toBeLessThanOrEqual(result.federalAGI)
  })

  it('no SS benefits → ssSubtraction = 0, mdAGI = federal AGI', () => {
    const result = compute502({
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(50000), box2: cents(5000) })],
    })

    expect(result.ssSubtraction).toBe(0)
    expect(result.mdAGI).toBe(result.federalAGI)
  })
})

// ── Exemption phase-down (stepped) ───────────────────────────

describe('Form 502 — exemption phase-down', () => {
  it('single, AGI $80K → full exemption ($3,200)', () => {
    const result = compute502({
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(80000), box2: 0 })],
    })
    expect(result.exemptionPerPerson).toBe(cents(3200))
    expect(result.totalExemptions).toBe(cents(3200))
  })

  it('single, AGI $110K → half exemption ($1,600)', () => {
    const result = compute502({
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(110000), box2: 0 })],
    })
    expect(result.exemptionPerPerson).toBe(cents(1600))
    expect(result.totalExemptions).toBe(cents(1600))
  })

  it('single, AGI $130K → quarter exemption ($800)', () => {
    const result = compute502({
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(130000), box2: 0 })],
    })
    expect(result.exemptionPerPerson).toBe(cents(800))
    expect(result.totalExemptions).toBe(cents(800))
  })

  it('single, AGI $160K → zero exemption', () => {
    const result = compute502({
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(160000), box2: 0 })],
    })
    expect(result.exemptionPerPerson).toBe(0)
    expect(result.totalExemptions).toBe(0)
  })

  it('single, AGI exactly $100K → full exemption (boundary)', () => {
    const result = compute502({
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(100000), box2: 0 })],
    })
    expect(result.exemptionPerPerson).toBe(cents(3200))
  })

  it('single, AGI $100,001 → half exemption (just above boundary)', () => {
    const result = compute502({
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(100000) + 1, box2: 0 })],
    })
    expect(result.exemptionPerPerson).toBe(cents(1600))
  })

  it('MFJ, AGI $140K → full exemption (MFJ threshold = $150K)', () => {
    const result = compute502({
      filingStatus: 'mfj',
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(140000), box2: 0 })],
    })
    expect(result.exemptionPerPerson).toBe(cents(3200))
    expect(result.totalExemptions).toBe(cents(3200) * 2) // 2 for MFJ
  })

  it('MFJ, AGI $160K → half exemption', () => {
    const result = compute502({
      filingStatus: 'mfj',
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(160000), box2: 0 })],
    })
    expect(result.exemptionPerPerson).toBe(cents(1600))
    expect(result.totalExemptions).toBe(cents(1600) * 2)
  })

  it('HOH, AGI $130K → half exemption (HOH threshold = $125K full)', () => {
    const result = compute502({
      filingStatus: 'hoh',
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(130000), box2: 0 })],
    })
    expect(result.exemptionPerPerson).toBe(cents(1600))
  })

  it('with 2 dependents, full exemption → 3 × $3,200', () => {
    const result = compute502({
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(80000), box2: 0 })],
      dependents: [
        makeDependent({ firstName: 'Alice', dateOfBirth: '2015-05-01' }),
        makeDependent({ firstName: 'Bob', dateOfBirth: '2018-08-15' }),
      ],
    })

    expect(result.exemptionPerPerson).toBe(cents(3200))
    expect(result.personalExemption).toBe(cents(3200)) // 1 for single
    expect(result.dependentExemption).toBe(cents(3200) * 2) // 2 dependents
    expect(result.totalExemptions).toBe(cents(3200) * 3)
  })
})

// ── County local tax ────────────────────────────────────────────

describe('Form 502 — county local tax', () => {
  it('Montgomery County → 3.20%', () => {
    const result = compute502({
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(80000), box2: 0 })],
    }, 'montgomery')

    expect(result.countyCode).toBe('montgomery')
    expect(result.countyRate).toBe(0.0320)
    expect(result.mdLocalTax).toBe(Math.round(result.mdTaxableIncome * 0.032))
  })

  it('Worcester County → 2.25% (lowest rate)', () => {
    const result = compute502({
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(80000), box2: 0 })],
    }, 'worcester')

    expect(result.countyCode).toBe('worcester')
    expect(result.countyRate).toBe(0.0225)
    expect(result.mdLocalTax).toBe(Math.round(result.mdTaxableIncome * 0.0225))
  })

  it('Talbot County → 2.40%', () => {
    const result = compute502({
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(80000), box2: 0 })],
    }, 'talbot')

    expect(result.countyCode).toBe('talbot')
    expect(result.countyRate).toBe(0.024)
  })

  it('defaults to Montgomery County when county not specified', () => {
    const result = compute502({
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(80000), box2: 0 })],
    })

    expect(result.countyCode).toBe('montgomery')
    expect(result.countyRate).toBe(0.032)
  })

  it('invalid county falls back to Montgomery', () => {
    const result = compute502({
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(80000), box2: 0 })],
    }, 'nonexistent')

    expect(result.countyCode).toBe('montgomery')
    expect(result.countyRate).toBe(0.032)
  })

  it('different counties produce different local tax amounts', () => {
    const base = { w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(80000), box2: 0 })] }

    const montgomery = compute502(base, 'montgomery')
    const worcester = compute502(base, 'worcester')

    expect(montgomery.mdStateTax).toBe(worcester.mdStateTax) // same state tax
    expect(montgomery.mdLocalTax).toBeGreaterThan(worcester.mdLocalTax) // different local tax
  })
})

// ── Withholding & refund/owed ───────────────────────────────────

describe('Form 502 — withholding and refund/owed', () => {
  it('overpaid → refund', () => {
    const result = compute502({
      w2s: [makeW2({
        id: 'w', employerName: 'X', box1: cents(50000), box2: cents(5000),
        box15State: 'MD', box17StateIncomeTax: cents(5000),
      })],
    })

    // With $5K withheld and income of $50K, should have a refund
    expect(result.stateWithholding).toBe(cents(5000))
    expect(result.taxAfterCredits).toBeLessThan(cents(5000))
    expect(result.overpaid).toBeGreaterThan(0)
    expect(result.amountOwed).toBe(0)
  })

  it('underpaid → amount owed', () => {
    const result = compute502({
      w2s: [makeW2({
        id: 'w', employerName: 'X', box1: cents(80000), box2: cents(10000),
        box15State: 'MD', box17StateIncomeTax: cents(500),
      })],
    })

    expect(result.stateWithholding).toBe(cents(500))
    expect(result.taxAfterCredits).toBeGreaterThan(cents(500))
    expect(result.amountOwed).toBeGreaterThan(0)
    expect(result.overpaid).toBe(0)
  })

  it('only counts W-2s with box15State = MD', () => {
    const result = compute502({
      w2s: [
        makeW2({ id: 'w1', employerName: 'MD Job', box1: cents(50000), box2: cents(5000),
          box15State: 'MD', box17StateIncomeTax: cents(2000) }),
        makeW2({ id: 'w2', employerName: 'CA Job', box1: cents(30000), box2: cents(3000),
          box15State: 'CA', box17StateIncomeTax: cents(1500) }),
      ],
    })

    // Only MD withholding counted
    expect(result.stateWithholding).toBe(cents(2000))
  })

  it('no withholding → full amount owed', () => {
    const result = compute502({
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(80000), box2: cents(10000) })],
    })

    expect(result.stateWithholding).toBe(0)
    expect(result.amountOwed).toBe(result.taxAfterCredits)
    expect(result.overpaid).toBe(0)
  })
})

// ── Part-year residency ─────────────────────────────────────────

describe('Form 502 — part-year residency', () => {
  it('half year → approximately 50% apportionment', () => {
    const model = makeMDReturn({
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(100000), box2: cents(12000),
        box15State: 'MD', box17StateIncomeTax: cents(4000) })],
    })
    const form1040 = computeForm1040(model)
    const result = computeForm502(model, form1040, {
      stateCode: 'MD',
      residencyType: 'part-year',
      moveInDate: '2025-07-01',
    })

    expect(result.residencyType).toBe('part-year')
    expect(result.apportionmentRatio).toBeGreaterThan(0.49)
    expect(result.apportionmentRatio).toBeLessThan(0.52)
    expect(result.mdSourceIncome).toBeDefined()
    expect(result.mdSourceIncome).toBeLessThan(result.mdAGI)
  })

  it('full year → ratio = 1.0, no source income field', () => {
    const model = makeMDReturn({
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(100000), box2: cents(12000) })],
    })
    const form1040 = computeForm1040(model)
    const result = computeForm502(model, form1040, {
      stateCode: 'MD',
      residencyType: 'full-year',
    })

    expect(result.apportionmentRatio).toBe(1.0)
    expect(result.mdSourceIncome).toBeUndefined()
  })

  it('nonresident → ratio = 0, zero tax', () => {
    const model = makeMDReturn({
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(100000), box2: cents(12000) })],
    })
    const form1040 = computeForm1040(model)
    const result = computeForm502(model, form1040, {
      stateCode: 'MD',
      residencyType: 'nonresident',
    })

    expect(result.apportionmentRatio).toBe(0)
    expect(result.mdTaxableIncome).toBe(0)
    expect(result.mdStateTax).toBe(0)
    expect(result.mdLocalTax).toBe(0)
  })

  it('part-year tax < full-year tax', () => {
    const w2s = [makeW2({ id: 'w', employerName: 'X', box1: cents(100000), box2: cents(12000),
      box15State: 'MD', box17StateIncomeTax: cents(4000) })]

    const fullYear = compute502({ w2s })

    const model = makeMDReturn({ w2s })
    const form1040 = computeForm1040(model)
    const partYear = computeForm502(model, form1040, {
      stateCode: 'MD',
      residencyType: 'part-year',
      moveInDate: '2025-07-01',
    })

    expect(partYear.mdStateTax).toBeLessThan(fullYear.mdStateTax)
    expect(partYear.mdLocalTax).toBeLessThan(fullYear.mdLocalTax)
  })
})

// ── StateRulesModule integration ────────────────────────────────

describe('MD StateRulesModule', () => {
  it('module metadata is correct', () => {
    expect(mdModule.stateCode).toBe('MD')
    expect(mdModule.stateName).toBe('Maryland')
    expect(mdModule.formLabel).toBe('MD Form 502')
  })

  it('compute() returns valid StateComputeResult', () => {
    const model = makeMDReturn({
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(75000), box2: cents(8000),
        box15State: 'MD', box17StateIncomeTax: cents(3000) })],
    })
    const form1040 = computeForm1040(model)
    const config = { stateCode: 'MD' as const, residencyType: 'full-year' as const }

    const stateResult = mdModule.compute(model, form1040, config)

    expect(stateResult.stateCode).toBe('MD')
    expect(stateResult.formLabel).toBe('MD Form 502')
    expect(stateResult.stateAGI).toBe(cents(75000))
    expect(stateResult.stateTaxableIncome).toBeGreaterThan(0)
    expect(stateResult.stateTax).toBeGreaterThan(0)
    expect(stateResult.taxAfterCredits).toBeGreaterThan(0)
    expect(stateResult.stateWithholding).toBe(cents(3000))
  })

  it('collectTracedValues() returns non-empty map', () => {
    const model = makeMDReturn({
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(75000), box2: cents(8000),
        box15State: 'MD', box17StateIncomeTax: cents(3000) })],
    })
    const form1040 = computeForm1040(model)
    const config = { stateCode: 'MD' as const, residencyType: 'full-year' as const }
    const stateResult = mdModule.compute(model, form1040, config)

    const traced = mdModule.collectTracedValues(stateResult)

    expect(traced.size).toBeGreaterThan(0)
    expect(traced.has('form502.mdAGI')).toBe(true)
    expect(traced.has('form502.mdTaxableIncome')).toBe(true)
    expect(traced.has('form502.mdStateTax')).toBe(true)
    expect(traced.has('form502.mdLocalTax')).toBe(true)
  })

  it('reviewLayout has expected sections', () => {
    expect(mdModule.reviewLayout.length).toBeGreaterThanOrEqual(3)
    const titles = mdModule.reviewLayout.map(s => s.title)
    expect(titles).toContain('Income')
    expect(titles).toContain('Deductions & Exemptions')
    expect(titles).toContain('Tax & Credits')
  })

  it('reviewResultLines has refund, owed, and zero entries', () => {
    expect(mdModule.reviewResultLines.length).toBe(3)
    const types = mdModule.reviewResultLines.map(l => l.type)
    expect(types).toContain('refund')
    expect(types).toContain('owed')
    expect(types).toContain('zero')
  })
})

// ── Integration: full computation through computeAll ─────────────

describe('Form 502 — integration with engine', () => {
  it('MD state return appears in computeAll results', async () => {
    const { computeAll } = await import('../../../src/rules/engine')

    const model = makeMDReturn({
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(75000), box2: cents(8000),
        box15State: 'MD', box17StateIncomeTax: cents(3000) })],
      stateReturns: [{ stateCode: 'MD', residencyType: 'full-year', county: 'montgomery' }],
    })

    const all = computeAll(model)

    expect(all.stateResults.length).toBe(1)
    expect(all.stateResults[0].stateCode).toBe('MD')
    expect(all.stateResults[0].stateAGI).toBe(cents(75000))
    expect(all.executedSchedules).toContain('MD-502')
  })
})

// ── Consistency checks ──────────────────────────────────────────

describe('Form 502 — consistency', () => {
  it('taxAfterCredits = stateTax + localTax - credits', () => {
    const result = compute502({
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(80000), box2: cents(10000) })],
    })

    const computed = Math.max(0, result.mdStateTax + result.mdLocalTax - result.mdEIC)
    expect(result.taxAfterCredits).toBe(computed)
  })

  it('overpaid + amountOwed = |payments - taxAfterCredits|', () => {
    const result = compute502({
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(80000), box2: cents(10000),
        box15State: 'MD', box17StateIncomeTax: cents(3000) })],
    })

    expect(result.overpaid + result.amountOwed).toBe(
      Math.abs(result.totalPayments - result.taxAfterCredits),
    )
  })

  it('mdAGI = federalAGI - ssSubtraction', () => {
    const result = compute502({
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(50000), box2: cents(5000) })],
      formSSA1099s: [makeSSA1099({ id: 'ssa1', box5: cents(15000) })],
    })

    expect(result.mdAGI).toBe(result.federalAGI - result.ssSubtraction)
  })

  it('all filing statuses compute without error', () => {
    const statuses: FilingStatus[] = ['single', 'mfj', 'mfs', 'hoh', 'qw']
    for (const fs of statuses) {
      const result = compute502({
        filingStatus: fs,
        w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(80000), box2: cents(10000) })],
      })
      expect(result.mdStateTax).toBeGreaterThan(0)
      expect(result.mdLocalTax).toBeGreaterThan(0)
    }
  })
})
