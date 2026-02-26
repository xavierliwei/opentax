import { describe, it, expect } from 'vitest'
import { emptyTaxReturn } from '../../../src/model/types'
import type { FilingStatus } from '../../../src/model/types'
import { cents } from '../../../src/model/traced'
import { computeForm1040 } from '../../../src/rules/2025/form1040'
import { computeFormD40 } from '../../../src/rules/2025/dc/formd40'
import { computeBracketTax } from '../../../src/rules/2025/taxComputation'
import { DC_TAX_BRACKETS, DC_STANDARD_DEDUCTION } from '../../../src/rules/2025/dc/constants'
import { makeW2 } from '../../fixtures/returns'

function compute(status: FilingStatus = 'single') {
  const tr = {
    ...emptyTaxReturn(2025),
    filingStatus: status,
    w2s: [makeW2({ id: 'w1', employerName: 'DC Co', box1: cents(120000), box2: cents(10000), box15State: 'DC', box17StateIncomeTax: cents(3500) })],
  }
  const fed = computeForm1040(tr)
  return computeFormD40(tr, fed, { stateCode: 'DC', residencyType: 'full-year' })
}

describe('DC brackets — all 7 boundaries', () => {
  it('single filer marginal rate changes at each floor', () => {
    const floors = DC_TAX_BRACKETS.single.map((b) => b.floor)
    const rates = DC_TAX_BRACKETS.single.map((b) => b.rate)

    expect(floors.length).toBe(7)

    for (let i = 0; i < floors.length; i += 1) {
      const floor = floors[i]
      const amount = floor + cents(100)
      const delta = computeBracketTax(amount, DC_TAX_BRACKETS.single) - computeBracketTax(floor, DC_TAX_BRACKETS.single)
      expect(delta).toBe(Math.round(cents(100) * rates[i]))
    }
  })
})

describe('DC standard vs itemized deduction behavior', () => {
  it('prefers itemized only when larger than standard', () => {
    const tr = {
      ...emptyTaxReturn(2025),
      w2s: [makeW2({ id: 'w1', employerName: 'DC Co', box1: cents(120000), box2: cents(10000), box15State: 'DC', box17StateIncomeTax: cents(3500) })],
      deductions: {
        method: 'itemized' as const,
        itemized: {
          medicalExpenses: 0,
          stateLocalIncomeTaxes: cents(6000),
          stateLocalSalesTaxes: 0,
          realEstateTaxes: cents(5000),
          personalPropertyTaxes: 0,
          mortgageInterest: cents(12000),
          mortgagePrincipal: 0,
          mortgagePreTCJA: false,
          investmentInterest: 0,
          priorYearInvestmentInterestCarryforward: 0,
          charitableCash: cents(3000),
          charitableNoncash: 0,
          gamblingLosses: 0,
          casualtyTheftLosses: 0,
          federalEstateTaxIRD: 0,
          otherMiscDeductions: 0,
        },
      },
    }
    const fed = computeForm1040(tr)
    const dc = computeFormD40(tr, fed, { stateCode: 'DC', residencyType: 'full-year' })
    expect(dc.deductionMethod).toBe('itemized')
    expect(dc.deductionUsed).toBeGreaterThan(DC_STANDARD_DEDUCTION.single)
  })
})

describe('DC filing statuses include QW/MFS/HOH', () => {
  it('QW equals MFJ and MFS equals single for deduction/tax with same wages', () => {
    const mfj = compute('mfj')
    const qw = compute('qw')
    const single = compute('single')
    const mfs = compute('mfs')
    expect(qw.dcStandardDeduction).toBe(mfj.dcStandardDeduction)
    expect(qw.dcTax).toBe(mfj.dcTax)
    expect(mfs.dcStandardDeduction).toBe(single.dcStandardDeduction)
    expect(mfs.dcTax).toBe(single.dcTax)
  })

  it('HOH falls between single and MFJ on standard deduction and tax', () => {
    const single = compute('single')
    const hoh = compute('hoh')
    const mfj = compute('mfj')
    expect(hoh.dcStandardDeduction).toBeGreaterThan(single.dcStandardDeduction)
    expect(hoh.dcStandardDeduction).toBeLessThan(mfj.dcStandardDeduction)
    expect(hoh.dcTax).toBeLessThan(single.dcTax)
    expect(hoh.dcTax).toBeGreaterThan(mfj.dcTax)
  })
})