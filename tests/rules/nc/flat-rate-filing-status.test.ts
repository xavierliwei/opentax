import { describe, it, expect } from 'vitest'
import { emptyTaxReturn } from '../../../src/model/types'
import type { FilingStatus } from '../../../src/model/types'
import { cents } from '../../../src/model/traced'
import { computeForm1040 } from '../../../src/rules/2025/form1040'
import { computeFormD400 } from '../../../src/rules/2025/nc/formd400'
import { NC_FLAT_TAX_RATE, NC_STANDARD_DEDUCTION } from '../../../src/rules/2025/nc/constants'
import { makeW2 } from '../../fixtures/returns'

function compute(status: FilingStatus = 'single', wages = cents(100000)) {
  const tr = {
    ...emptyTaxReturn(2025),
    filingStatus: status,
    w2s: [makeW2({ id: 'w1', employerName: 'NC Co', box1: wages, box2: cents(9000), box15State: 'NC', box16StateWages: wages, box17StateIncomeTax: cents(3500) })],
  }
  const fed = computeForm1040(tr)
  return computeFormD400(tr, fed, { stateCode: 'NC', residencyType: 'full-year' })
}

describe('NC flat tax verification', () => {
  it('tax equals taxable income × flat rate at multiple income points', () => {
    for (const wages of [cents(25000), cents(100000), cents(450000)]) {
      const result = compute('single', wages)
      expect(result.ncTax).toBe(Math.round(result.ncTaxableIncome * NC_FLAT_TAX_RATE))
    }
  })
})

describe('NC standard deduction by filing status includes QW/MFS/HOH', () => {
  it('constants maintain expected relationships', () => {
    expect(NC_STANDARD_DEDUCTION.qw).toBe(NC_STANDARD_DEDUCTION.mfj)
    expect(NC_STANDARD_DEDUCTION.mfs).toBe(NC_STANDARD_DEDUCTION.single)
    expect(NC_STANDARD_DEDUCTION.hoh).toBeGreaterThan(NC_STANDARD_DEDUCTION.single)
    expect(NC_STANDARD_DEDUCTION.hoh).toBeLessThan(NC_STANDARD_DEDUCTION.mfj)
  })

  it('computed returns follow those deduction relationships', () => {
    const single = compute('single')
    const mfs = compute('mfs')
    const hoh = compute('hoh')
    const mfj = compute('mfj')
    const qw = compute('qw')

    expect(mfs.standardDeduction).toBe(single.standardDeduction)
    expect(mfs.ncTax).toBe(single.ncTax)

    expect(qw.standardDeduction).toBe(mfj.standardDeduction)
    expect(qw.ncTax).toBe(mfj.ncTax)

    expect(hoh.standardDeduction).toBeGreaterThan(single.standardDeduction)
    expect(hoh.standardDeduction).toBeLessThan(mfj.standardDeduction)
    expect(hoh.ncTax).toBeLessThan(single.ncTax)
    expect(hoh.ncTax).toBeGreaterThan(mfj.ncTax)
  })
})