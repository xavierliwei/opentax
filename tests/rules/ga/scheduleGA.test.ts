import { describe, it, expect } from 'vitest'
import { computeForm1040 } from '../../../src/rules/2025/form1040'
import { computeScheduleGA } from '../../../src/rules/2025/ga/scheduleGA'
import { emptyTaxReturn } from '../../../src/model/types'
import { makeW2 } from '../../fixtures/returns'
import { cents } from '../../../src/model/traced'

describe('computeScheduleGA', () => {
  it('has no adjustments for typical W-2 filer', () => {
    const tr = emptyTaxReturn(2025)
    tr.w2s = [makeW2({ box1: cents(100000), box2: cents(15000), box15State: 'GA', box17StateIncomeTax: cents(4000) })]

    const f1040 = computeForm1040(tr)
    const ga = computeScheduleGA(tr, f1040)

    expect(ga.additions).toBe(0)
    expect(ga.subtractions).toBe(0)
    expect(ga.gaAGI).toBe(f1040.line11.amount)
  })

  it('adds back state income taxes when federal itemized used state income taxes', () => {
    const tr = emptyTaxReturn(2025)
    tr.w2s = [makeW2({ box1: cents(100000), box2: cents(15000) })]
    tr.deductions.method = 'itemized'
    tr.deductions.itemized = {
      medicalExpenses: 0,
      stateLocalIncomeTaxes: cents(10000),
      stateLocalSalesTaxes: 0,
      realEstateTaxes: 0,
      personalPropertyTaxes: 0,
      mortgageInterest: 0,
      mortgagePrincipal: 0,
      mortgagePreTCJA: false,
      investmentInterest: 0,
      priorYearInvestmentInterestCarryforward: 0,
      charitableCash: 0,
      charitableNoncash: 0,
      gamblingLosses: 0,
      casualtyTheftLosses: 0,
      federalEstateTaxIRD: 0,
      otherMiscDeductions: 0,
    }

    const f1040 = computeForm1040(tr)
    const ga = computeScheduleGA(tr, f1040)

    expect(ga.stateIncomeTaxAddBack).toBe(cents(10000))
    expect(ga.additions).toBe(cents(10000))
    expect(ga.gaAGI).toBe(f1040.line11.amount + cents(10000))
  })
})
