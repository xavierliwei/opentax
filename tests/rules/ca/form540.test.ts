/**
 * Tests for California Form 540 — Resident Income Tax Return
 *
 * Covers: CA tax brackets, standard/itemized deduction, mental health
 * surcharge, exemption credits with phase-out, renter's credit,
 * state withholding, and refund/owed computation.
 */

import { describe, it, expect } from 'vitest'
import { cents } from '../../../src/model/traced'
import { emptyTaxReturn } from '../../../src/model/types'
import type { TaxReturn, FilingStatus } from '../../../src/model/types'
import { computeForm1040 } from '../../../src/rules/2025/form1040'
import { computeForm540 } from '../../../src/rules/2025/ca/form540'
import { computeBracketTax } from '../../../src/rules/2025/taxComputation'
import { CA_TAX_BRACKETS } from '../../../src/rules/2025/ca/constants'
import { makeW2 } from '../../fixtures/returns'

// ── Helpers ─────────────────────────────────────────────────────

function makeCAReturn(overrides: Partial<TaxReturn> = {}): TaxReturn {
  return {
    ...emptyTaxReturn(2025),
    caResident: true,
    ...overrides,
  }
}

function compute540(overrides: Partial<TaxReturn> = {}) {
  const model = makeCAReturn(overrides)
  const form1040 = computeForm1040(model)
  return computeForm540(model, form1040)
}

// ── Basic scenarios ─────────────────────────────────────────────

describe('Form 540 — basic tax computation', () => {
  it('single, $75K wages, standard deduction', () => {
    const result = compute540({
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(75000), box2: cents(10000),
        box15State: 'CA', box16StateWages: cents(75000), box17StateIncomeTax: cents(3500) })],
    })

    expect(result.federalAGI).toBe(cents(75000))
    expect(result.caAGI).toBe(cents(75000))
    expect(result.deductionMethod).toBe('standard')
    expect(result.deductionUsed).toBe(cents(5706))
    expect(result.caTaxableIncome).toBe(cents(75000) - cents(5706))

    // Tax from brackets
    const expectedTax = computeBracketTax(result.caTaxableIncome, CA_TAX_BRACKETS.single)
    expect(result.caTax).toBe(expectedTax)
    expect(result.caTax).toBeGreaterThan(0)

    // Exemption credit
    expect(result.personalExemptionCredit).toBe(cents(153))
    expect(result.totalExemptionCredits).toBe(cents(153))

    expect(result.stateWithholding).toBe(cents(3500))
    expect(result.mentalHealthTax).toBe(0)
  })

  it('MFJ, $120K combined wages → MFJ brackets', () => {
    const result = compute540({
      filingStatus: 'mfj',
      w2s: [
        makeW2({ id: 'w1', employerName: 'A', box1: cents(70000), box2: cents(8000),
          box15State: 'CA', box17StateIncomeTax: cents(2000) }),
        makeW2({ id: 'w2', employerName: 'B', box1: cents(50000), box2: cents(5000),
          box15State: 'CA', box17StateIncomeTax: cents(1500) }),
      ],
    })

    expect(result.caAGI).toBe(cents(120000))
    expect(result.deductionUsed).toBe(cents(11412))
    expect(result.caTaxableIncome).toBe(cents(120000) - cents(11412))

    const expectedTax = computeBracketTax(result.caTaxableIncome, CA_TAX_BRACKETS.mfj)
    expect(result.caTax).toBe(expectedTax)

    // MFJ → 2 personal exemption credits
    expect(result.personalExemptionCredit).toBe(cents(153) * 2)
    expect(result.stateWithholding).toBe(cents(3500))
  })

  it('zero income → $0 CA tax', () => {
    const result = compute540()

    expect(result.caAGI).toBe(0)
    expect(result.caTaxableIncome).toBe(0)
    expect(result.caTax).toBe(0)
    expect(result.taxAfterCredits).toBe(0)
    expect(result.overpaid).toBe(0)
    expect(result.amountOwed).toBe(0)
  })

  it('deduction exceeds income → $0 taxable, $0 tax', () => {
    const result = compute540({
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(3000), box2: cents(0) })],
    })

    expect(result.caAGI).toBe(cents(3000))
    expect(result.caTaxableIncome).toBe(0) // $3K < $5,706 standard deduction
    expect(result.caTax).toBe(0)
  })

  it('HOH uses HOH brackets and standard deduction', () => {
    const result = compute540({
      filingStatus: 'hoh',
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(80000), box2: cents(10000) })],
      dependents: [{
        firstName: 'Child', lastName: 'Doe', ssn: '111111111',
        relationship: 'son', monthsLived: 12, dateOfBirth: '2015-01-01',
      }],
    })

    expect(result.deductionUsed).toBe(cents(11412))

    const expectedTax = computeBracketTax(result.caTaxableIncome, CA_TAX_BRACKETS.hoh)
    expect(result.caTax).toBe(expectedTax)

    // 1 personal + 1 dependent
    expect(result.personalExemptionCredit).toBe(cents(153))
    expect(result.dependentExemptionCredit).toBe(cents(475))
  })
})

// ── Bracket boundary tests ──────────────────────────────────────

describe('Form 540 — bracket boundaries', () => {
  it('income in first bracket ($10K) → 1% rate', () => {
    const result = compute540({
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(15706), box2: cents(0) })],
    })

    // Taxable = $15,706 - $5,706 = $10,000 → all in 1% bracket
    expect(result.caTaxableIncome).toBe(cents(10000))
    expect(result.caTax).toBe(cents(100)) // $10K × 1%
  })

  it('income crosses into 2% bracket', () => {
    const result = compute540({
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(20000), box2: cents(0) })],
    })

    // Taxable = $20,000 - $5,706 = $14,294
    // First $11,079 at 1% = $110.79
    // Next $3,215 at 2% = $64.30
    // Total ≈ $175.09 → $175 after rounding
    expect(result.caTaxableIncome).toBe(cents(14294))
    const expected = computeBracketTax(cents(14294), CA_TAX_BRACKETS.single)
    expect(result.caTax).toBe(expected)
  })
})

// ── Mental health surcharge ─────────────────────────────────────

describe('Form 540 — mental health services tax', () => {
  it('income $999,999 → no mental health tax', () => {
    const result = compute540({
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(999999 + 5706), box2: cents(0) })],
    })

    // Taxable = wages - standard deduction = $999,999
    expect(result.caTaxableIncome).toBe(cents(999999))
    expect(result.mentalHealthTax).toBe(0)
  })

  it('income $1,000,001 → $0.01 surcharge', () => {
    const result = compute540({
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(1000001 + 5706), box2: cents(0) })],
    })

    expect(result.caTaxableIncome).toBe(cents(1000001))
    // 1% of $1 = $0.01 = 1 cent
    expect(result.mentalHealthTax).toBe(1)
  })

  it('$1.5M income → mental health tax on $500K', () => {
    const result = compute540({
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(1500000 + 5706), box2: cents(0) })],
    })

    expect(result.caTaxableIncome).toBe(cents(1500000))
    // 1% of ($1.5M - $1M) = 1% of $500K = $5,000
    expect(result.mentalHealthTax).toBe(cents(5000))
  })

  it('mental health threshold same for MFJ (not doubled)', () => {
    const result = compute540({
      filingStatus: 'mfj',
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(1500000 + 11412), box2: cents(0) })],
    })

    expect(result.caTaxableIncome).toBe(cents(1500000))
    expect(result.mentalHealthTax).toBe(cents(5000))
  })
})

// ── Exemption credit tests ──────────────────────────────────────

describe('Form 540 — exemption credits', () => {
  it('single → $153 personal exemption', () => {
    const result = compute540({
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(75000), box2: cents(0) })],
    })

    expect(result.personalExemptionCredit).toBe(cents(153))
    expect(result.dependentExemptionCredit).toBe(0)
    expect(result.exemptionPhaseOutReduction).toBe(0)
    expect(result.totalExemptionCredits).toBe(cents(153))
  })

  it('MFJ → $306 personal exemption (2 × $153)', () => {
    const result = compute540({
      filingStatus: 'mfj',
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(100000), box2: cents(0) })],
    })

    expect(result.personalExemptionCredit).toBe(cents(306))
    expect(result.totalExemptionCredits).toBe(cents(306))
  })

  it('MFS → $306 personal exemption (2 persons)', () => {
    const result = compute540({
      filingStatus: 'mfs',
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(50000), box2: cents(0) })],
    })

    expect(result.personalExemptionCredit).toBe(cents(306))
  })

  it('dependent exemption $475 per dependent', () => {
    const result = compute540({
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(75000), box2: cents(0) })],
      dependents: [
        { firstName: 'A', lastName: 'D', ssn: '111111111', relationship: 'son', monthsLived: 12, dateOfBirth: '2015-01-01' },
        { firstName: 'B', lastName: 'D', ssn: '222222222', relationship: 'daughter', monthsLived: 12, dateOfBirth: '2017-01-01' },
      ],
    })

    expect(result.dependentExemptionCredit).toBe(cents(950)) // 2 × $475
    expect(result.totalExemptionCredits).toBe(cents(153) + cents(950))
  })

  it('exemption phase-out applies above threshold (single $252,203)', () => {
    const result = compute540({
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(260000), box2: cents(0) })],
    })

    // CA AGI $260K > $252,203 threshold
    expect(result.exemptionPhaseOutReduction).toBeGreaterThan(0)
    expect(result.totalExemptionCredits).toBeLessThan(cents(153))
  })

  it('exemption not phased out below threshold', () => {
    const result = compute540({
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(250000), box2: cents(0) })],
    })

    expect(result.exemptionPhaseOutReduction).toBe(0)
    expect(result.totalExemptionCredits).toBe(cents(153))
  })
})

// ── Renter's credit tests ───────────────────────────────────────

describe('Form 540 — renter\'s credit', () => {
  it('single renter under AGI limit → $60 credit', () => {
    const result = compute540({
      rentPaidInCA: true,
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(50000), box2: cents(0) })],
    })

    expect(result.rentersCredit).toBe(cents(60))
  })

  it('single renter over AGI limit → $0', () => {
    const result = compute540({
      rentPaidInCA: true,
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(60000), box2: cents(0) })],
    })

    // AGI $60K > $53,994 limit
    expect(result.rentersCredit).toBe(0)
  })

  it('MFJ renter under AGI limit → $120 credit', () => {
    const result = compute540({
      filingStatus: 'mfj',
      rentPaidInCA: true,
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(100000), box2: cents(0) })],
    })

    // AGI $100K < $107,987 limit
    expect(result.rentersCredit).toBe(cents(120))
  })

  it('MFJ renter over AGI limit → $0', () => {
    const result = compute540({
      filingStatus: 'mfj',
      rentPaidInCA: true,
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(110000), box2: cents(0) })],
    })

    expect(result.rentersCredit).toBe(0)
  })

  it('not a renter → $0', () => {
    const result = compute540({
      rentPaidInCA: false,
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(50000), box2: cents(0) })],
    })

    expect(result.rentersCredit).toBe(0)
  })

  it('renter flag not set → $0', () => {
    const result = compute540({
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(50000), box2: cents(0) })],
    })

    expect(result.rentersCredit).toBe(0)
  })
})

// ── Withholding and refund/owed ─────────────────────────────────

describe('Form 540 — withholding and refund/owed', () => {
  it('state withholding exceeds tax → refund', () => {
    const result = compute540({
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(50000), box2: cents(5000),
        box15State: 'CA', box17StateIncomeTax: cents(5000) })],
    })

    expect(result.stateWithholding).toBe(cents(5000))
    expect(result.overpaid).toBeGreaterThan(0)
    expect(result.amountOwed).toBe(0)
  })

  it('no state withholding → owes full tax', () => {
    const result = compute540({
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(75000), box2: cents(10000) })],
    })

    expect(result.stateWithholding).toBe(0)
    expect(result.overpaid).toBe(0)
    expect(result.amountOwed).toBe(result.taxAfterCredits)
  })

  it('sum of multiple W-2 Box 17 values', () => {
    const result = compute540({
      w2s: [
        makeW2({ id: 'w1', employerName: 'A', box1: cents(60000), box2: cents(7000),
          box15State: 'CA', box17StateIncomeTax: cents(2500) }),
        makeW2({ id: 'w2', employerName: 'B', box1: cents(40000), box2: cents(4000),
          box15State: 'CA', box17StateIncomeTax: cents(1500) }),
      ],
    })

    expect(result.stateWithholding).toBe(cents(4000))
  })

  it('only CA W-2s counted for withholding', () => {
    const result = compute540({
      w2s: [
        makeW2({ id: 'w1', employerName: 'CA Co', box1: cents(60000), box2: cents(7000),
          box15State: 'CA', box17StateIncomeTax: cents(3000) }),
        makeW2({ id: 'w2', employerName: 'NY Co', box1: cents(40000), box2: cents(4000),
          box15State: 'NY', box17StateIncomeTax: cents(2000) }),
      ],
    })

    // Only the CA W-2's withholding counted
    expect(result.stateWithholding).toBe(cents(3000))
  })

  it('refund = payments - tax after credits', () => {
    const result = compute540({
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(50000), box2: cents(5000),
        box15State: 'CA', box17StateIncomeTax: cents(4000) })],
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

// ── CA itemized deduction adjustments ───────────────────────────

describe('Form 540 — CA itemized deductions', () => {
  it('removes state income tax from SALT, keeps property tax (no cap)', () => {
    const result = compute540({
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(200000), box2: cents(30000) })],
      deductions: {
        method: 'itemized',
        itemized: {
          medicalExpenses: 0,
          stateLocalIncomeTaxes: cents(18000),  // removed for CA
          stateLocalSalesTaxes: 0,
          realEstateTaxes: cents(12000),         // kept
          personalPropertyTaxes: cents(1000),    // kept
          mortgageInterest: cents(15000),
          mortgagePrincipal: cents(500000),
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
        taxpayerAge65: false,
        taxpayerBlind: false,
        spouseAge65: false,
        spouseBlind: false,
      },
    })

    // CA itemized = RE tax ($12K) + PP tax ($1K) + mortgage ($15K) + charitable ($5K)
    // = $33,000 > standard $5,706 → should use itemized
    expect(result.deductionMethod).toBe('itemized')
    expect(result.caItemizedDeduction).toBe(cents(33000))
  })

  it('uses CA $1M mortgage limit instead of federal $750K', () => {
    const result = compute540({
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(300000), box2: cents(50000) })],
      deductions: {
        method: 'itemized',
        itemized: {
          medicalExpenses: 0,
          stateLocalIncomeTaxes: 0,
          stateLocalSalesTaxes: 0,
          realEstateTaxes: cents(15000),
          personalPropertyTaxes: 0,
          mortgageInterest: cents(40000),
          mortgagePrincipal: cents(900000),  // over federal $750K but under CA $1M
          mortgagePreTCJA: false,
          investmentInterest: 0,
          priorYearInvestmentInterestCarryforward: 0,
          charitableCash: 0,
          charitableNoncash: 0,
          gamblingLosses: 0,
          casualtyTheftLosses: 0,
          federalEstateTaxIRD: 0,
          otherMiscDeductions: 0,
        },
        taxpayerAge65: false,
        taxpayerBlind: false,
        spouseAge65: false,
        spouseBlind: false,
      },
    })

    // CA allows full $40K mortgage interest ($900K < $1M limit)
    // Federal would limit to $40K × ($750K / $900K) = $33,333
    expect(result.deductionMethod).toBe('itemized')
    // CA itemized includes full mortgage + RE tax
    expect(result.caItemizedDeduction).toBe(cents(15000) + cents(40000))
  })

  it('applies CA $1M mortgage proportional limit when principal > $1M', () => {
    const result = compute540({
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(500000), box2: cents(80000) })],
      deductions: {
        method: 'itemized',
        itemized: {
          medicalExpenses: 0,
          stateLocalIncomeTaxes: 0,
          stateLocalSalesTaxes: 0,
          realEstateTaxes: cents(20000),
          personalPropertyTaxes: 0,
          mortgageInterest: cents(60000),
          mortgagePrincipal: cents(1500000),  // over CA $1M limit
          mortgagePreTCJA: false,
          investmentInterest: 0,
          priorYearInvestmentInterestCarryforward: 0,
          charitableCash: 0,
          charitableNoncash: 0,
          gamblingLosses: 0,
          casualtyTheftLosses: 0,
          federalEstateTaxIRD: 0,
          otherMiscDeductions: 0,
        },
        taxpayerAge65: false,
        taxpayerBlind: false,
        spouseAge65: false,
        spouseBlind: false,
      },
    })

    // CA mortgage = $60K × ($1M / $1.5M) = $40,000
    const expectedMortgage = Math.round(cents(60000) * cents(1000000) / cents(1500000))
    expect(result.caItemizedDeduction).toBe(cents(20000) + expectedMortgage)
  })

  it('medical floor uses CA AGI (higher when HSA add-back applies)', () => {
    const result = compute540({
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(80000), box2: cents(10000) })],
      hsa: {
        coverageType: 'self-only',
        contributions: cents(4000),
        qualifiedExpenses: 0,
        age55OrOlder: false,
        age65OrDisabled: false,
      },
      deductions: {
        method: 'itemized',
        itemized: {
          medicalExpenses: cents(10000),
          stateLocalIncomeTaxes: 0,
          stateLocalSalesTaxes: 0,
          realEstateTaxes: cents(8000),
          personalPropertyTaxes: 0,
          mortgageInterest: cents(12000),
          mortgagePrincipal: cents(400000),
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
        taxpayerAge65: false,
        taxpayerBlind: false,
        spouseAge65: false,
        spouseBlind: false,
      },
    })

    // Federal AGI = $80K - $4K HSA = $76K
    // CA AGI = $76K + $4K add-back = $80K
    expect(result.caAGI).toBe(cents(80000))
    expect(result.federalAGI).toBe(cents(76000))

    // CA medical floor = 7.5% of $80K = $6,000
    // CA medical deduction = $10K - $6K = $4,000
    // vs federal floor = 7.5% of $76K = $5,700 → federal med = $4,300
    // CA itemized = medical ($4K) + RE ($8K) + mortgage ($12K) + charitable ($5K) = $29K
    expect(result.caItemizedDeduction).toBe(cents(29000))
  })

  it('includes home equity interest for CA (not deductible federally)', () => {
    const result = compute540({
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(200000), box2: cents(30000) })],
      deductions: {
        method: 'itemized',
        itemized: {
          medicalExpenses: 0,
          stateLocalIncomeTaxes: 0,
          stateLocalSalesTaxes: 0,
          realEstateTaxes: cents(10000),
          personalPropertyTaxes: 0,
          mortgageInterest: cents(20000),
          mortgagePrincipal: cents(600000),
          mortgagePreTCJA: false,
          homeEquityInterest: cents(5000),
          homeEquityPrincipal: cents(80000),  // under $100K limit
          investmentInterest: 0,
          priorYearInvestmentInterestCarryforward: 0,
          charitableCash: 0,
          charitableNoncash: 0,
          gamblingLosses: 0,
          casualtyTheftLosses: 0,
          federalEstateTaxIRD: 0,
          otherMiscDeductions: 0,
        },
        taxpayerAge65: false,
        taxpayerBlind: false,
        spouseAge65: false,
        spouseBlind: false,
      },
    })

    // CA itemized = RE ($10K) + mortgage ($20K) + home equity ($5K) = $35K
    expect(result.deductionMethod).toBe('itemized')
    expect(result.caItemizedDeduction).toBe(cents(35000))
  })

  it('applies CA home equity $100K proportional limit', () => {
    const result = compute540({
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(200000), box2: cents(30000) })],
      deductions: {
        method: 'itemized',
        itemized: {
          medicalExpenses: 0,
          stateLocalIncomeTaxes: 0,
          stateLocalSalesTaxes: 0,
          realEstateTaxes: cents(10000),
          personalPropertyTaxes: 0,
          mortgageInterest: cents(20000),
          mortgagePrincipal: cents(600000),
          mortgagePreTCJA: false,
          homeEquityInterest: cents(8000),
          homeEquityPrincipal: cents(200000),  // over $100K limit
          investmentInterest: 0,
          priorYearInvestmentInterestCarryforward: 0,
          charitableCash: 0,
          charitableNoncash: 0,
          gamblingLosses: 0,
          casualtyTheftLosses: 0,
          federalEstateTaxIRD: 0,
          otherMiscDeductions: 0,
        },
        taxpayerAge65: false,
        taxpayerBlind: false,
        spouseAge65: false,
        spouseBlind: false,
      },
    })

    // Home equity = $8K × ($100K / $200K) = $4,000
    const expectedHE = Math.round(cents(8000) * cents(100000) / cents(200000))
    expect(result.caItemizedDeduction).toBe(cents(10000) + cents(20000) + expectedHE)
  })

  it('MFS home equity limit is $50K', () => {
    const result = compute540({
      filingStatus: 'mfs',
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(150000), box2: cents(25000) })],
      deductions: {
        method: 'itemized',
        itemized: {
          medicalExpenses: 0,
          stateLocalIncomeTaxes: 0,
          stateLocalSalesTaxes: 0,
          realEstateTaxes: cents(10000),
          personalPropertyTaxes: 0,
          mortgageInterest: cents(15000),
          mortgagePrincipal: cents(400000),
          mortgagePreTCJA: false,
          homeEquityInterest: cents(6000),
          homeEquityPrincipal: cents(100000),  // over MFS $50K limit
          investmentInterest: 0,
          priorYearInvestmentInterestCarryforward: 0,
          charitableCash: 0,
          charitableNoncash: 0,
          gamblingLosses: 0,
          casualtyTheftLosses: 0,
          federalEstateTaxIRD: 0,
          otherMiscDeductions: 0,
        },
        taxpayerAge65: false,
        taxpayerBlind: false,
        spouseAge65: false,
        spouseBlind: false,
      },
    })

    // Home equity = $6K × ($50K / $100K) = $3,000
    const expectedHE = Math.round(cents(6000) * cents(50000) / cents(100000))
    expect(result.caItemizedDeduction).toBe(cents(10000) + cents(15000) + expectedHE)
  })

  it('no home equity fields → same as before (no change)', () => {
    const result = compute540({
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(200000), box2: cents(30000) })],
      deductions: {
        method: 'itemized',
        itemized: {
          medicalExpenses: 0,
          stateLocalIncomeTaxes: 0,
          stateLocalSalesTaxes: 0,
          realEstateTaxes: cents(10000),
          personalPropertyTaxes: 0,
          mortgageInterest: cents(20000),
          mortgagePrincipal: cents(600000),
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
        taxpayerAge65: false,
        taxpayerBlind: false,
        spouseAge65: false,
        spouseBlind: false,
      },
    })

    // No home equity → CA itemized = RE ($10K) + mortgage ($20K) + charity ($5K)
    expect(result.caItemizedDeduction).toBe(cents(35000))
  })

  it('falls back to standard deduction when itemized is lower', () => {
    const result = compute540({
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(50000), box2: cents(5000) })],
      deductions: {
        method: 'itemized',
        itemized: {
          medicalExpenses: 0,
          stateLocalIncomeTaxes: cents(3000),  // removed for CA
          stateLocalSalesTaxes: 0,
          realEstateTaxes: cents(1000),
          personalPropertyTaxes: 0,
          mortgageInterest: 0,
          mortgagePrincipal: 0,
          mortgagePreTCJA: false,
          investmentInterest: 0,
          priorYearInvestmentInterestCarryforward: 0,
          charitableCash: cents(500),
          charitableNoncash: 0,
          gamblingLosses: 0,
          casualtyTheftLosses: 0,
          federalEstateTaxIRD: 0,
          otherMiscDeductions: 0,
        },
        taxpayerAge65: false,
        taxpayerBlind: false,
        spouseAge65: false,
        spouseBlind: false,
      },
    })

    // CA itemized = $1K RE + $500 charity = $1,500 < $5,706 standard
    expect(result.caItemizedDeduction).toBe(cents(1500))
    expect(result.deductionMethod).toBe('standard')
    expect(result.deductionUsed).toBe(cents(5706))
  })
})

// ── Integration tests ───────────────────────────────────────────

describe('Form 540 — integration', () => {
  it('full return: W-2 $150K, withholding $8K → verify refund/owed', () => {
    const result = compute540({
      w2s: [makeW2({ id: 'w', employerName: 'Tech Co', box1: cents(150000), box2: cents(25000),
        box15State: 'CA', box16StateWages: cents(150000), box17StateIncomeTax: cents(8000) })],
    })

    expect(result.caAGI).toBe(cents(150000))
    expect(result.deductionMethod).toBe('standard')
    expect(result.caTaxableIncome).toBe(cents(150000) - cents(5706))
    expect(result.caTax).toBeGreaterThan(0)
    expect(result.mentalHealthTax).toBe(0)
    expect(result.stateWithholding).toBe(cents(8000))

    // Tax should be deterministic
    const tax = result.taxAfterCredits
    if (tax > cents(8000)) {
      expect(result.amountOwed).toBe(tax - cents(8000))
      expect(result.overpaid).toBe(0)
    } else {
      expect(result.overpaid).toBe(cents(8000) - tax)
      expect(result.amountOwed).toBe(0)
    }
  })

  it('tech employee: $200K wages + HSA → CA adds back HSA', () => {
    const result = compute540({
      w2s: [makeW2({ id: 'w', employerName: 'Tech Co', box1: cents(200000), box2: cents(35000),
        box15State: 'CA', box17StateIncomeTax: cents(12000) })],
      hsa: {
        coverageType: 'self-only',
        contributions: cents(4300),
        qualifiedExpenses: 0,
        age55OrOlder: false,
        age65OrDisabled: false,
      },
    })

    // Federal AGI = $200K - $4,300 = $195,700
    // CA AGI = $195,700 + $4,300 = $200,000
    expect(result.federalAGI).toBe(cents(195700))
    expect(result.caAGI).toBe(cents(200000))
    expect(result.caAdjustments.hsaAddBack).toBe(cents(4300))
  })

  it('high earner: $1.5M income → mental health tax applies', () => {
    const result = compute540({
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(1505706), box2: cents(300000),
        box15State: 'CA', box17StateIncomeTax: cents(120000) })],
    })

    // Taxable = $1,505,706 - $5,706 = $1,500,000
    expect(result.caTaxableIncome).toBe(cents(1500000))
    expect(result.mentalHealthTax).toBe(cents(5000))
    expect(result.caTax).toBeGreaterThan(0)
  })

  it('tax after credits cannot be negative', () => {
    // Small income with renter's credit
    const result = compute540({
      rentPaidInCA: true,
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(6000), box2: cents(0) })],
    })

    // Taxable = $6K - $5,706 = $294 → tax ≈ $2.94
    // Exemption credit $153 > tax → exemption credit limited to tax
    // taxAfterCredits should be $0 (not negative)
    expect(result.taxAfterCredits).toBeGreaterThanOrEqual(0)
  })
})
