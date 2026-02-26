import { describe, it, expect } from 'vitest'
import { emptyTaxReturn } from '../../../src/model/types'
import type { FilingStatus } from '../../../src/model/types'
import { cents } from '../../../src/model/traced'
import { computeForm1040 } from '../../../src/rules/2025/form1040'
import { computeForm500 } from '../../../src/rules/2025/ga/form500'
import { computeScheduleGA } from '../../../src/rules/2025/ga/scheduleGA'
import { GA_STANDARD_DEDUCTION, GA_TAX_RATE } from '../../../src/rules/2025/ga/constants'
import { makeW2 } from '../../fixtures/returns'

function build(status: FilingStatus = 'single', wages = cents(100000)) {
  const tr = {
    ...emptyTaxReturn(2025),
    filingStatus: status,
    stateReturns: [{ stateCode: 'GA' as const, residencyType: 'full-year' as const }],
    w2s: [makeW2({ id: 'w1', employerName: 'GA Co', box1: wages, box2: cents(12000), box15State: 'GA', box17StateIncomeTax: cents(3500) })],
  }
  const fed = computeForm1040(tr)
  return { tr, fed, ga: computeForm500(tr, fed, tr.stateReturns[0]) }
}

describe('GA retirement exclusion behavior', () => {
  it('currently computes retirement exclusion as zero by default', () => {
    const { tr, fed } = build('single')
    const schedule = computeScheduleGA(tr, fed)
    expect(schedule.retirementExclusion).toBe(0)
  })

  it('retirement exclusion remains zero even when 1099-R is present', () => {
    const tr = {
      ...emptyTaxReturn(2025),
      stateReturns: [{ stateCode: 'GA' as const, residencyType: 'full-year' as const }],
      w2s: [makeW2({ id: 'w1', employerName: 'GA Co', box1: cents(30000), box2: cents(3000), box15State: 'GA', box17StateIncomeTax: cents(1500) })],
      form1099Rs: [{
        id: 'r1',
        payerName: 'Pension Plan',
        box1: cents(30000),
        box2a: cents(30000),
        box2bTaxableNotDetermined: false,
        box2bTotalDistribution: true,
        box3: 0,
        box4: 0,
        box5: 0,
        box7: '7',
        iraOrSep: false,
      }],
    }
    const fed = computeForm1040(tr)
    const schedule = computeScheduleGA(tr, fed)
    expect(schedule.retirementExclusion).toBe(0)
  })
})

describe('GA flat-rate tax (no progressive brackets)', () => {
  it('tax is always taxable income × GA_TAX_RATE', () => {
    for (const wages of [cents(30000), cents(100000), cents(300000)]) {
      const { ga } = build('single', wages)
      expect(ga.gaTax).toBe(Math.round(ga.gaTaxableIncome * GA_TAX_RATE))
    }
  })
})

describe('GA filing statuses include QW/MFS/HOH', () => {
  it('QW matches MFJ and MFS/HOH match single deduction behavior', () => {
    const single = build('single').ga
    const mfs = build('mfs').ga
    const hoh = build('hoh').ga
    const mfj = build('mfj').ga
    const qw = build('qw').ga

    expect(GA_STANDARD_DEDUCTION.qw).toBe(GA_STANDARD_DEDUCTION.mfj)
    expect(GA_STANDARD_DEDUCTION.mfs).toBe(GA_STANDARD_DEDUCTION.single)
    expect(GA_STANDARD_DEDUCTION.hoh).toBe(GA_STANDARD_DEDUCTION.single)

    expect(qw.gaStandardDeduction).toBe(mfj.gaStandardDeduction)
    expect(qw.gaTax).toBe(mfj.gaTax)

    expect(mfs.gaStandardDeduction).toBe(single.gaStandardDeduction)
    expect(mfs.gaTax).toBe(single.gaTax)

    expect(hoh.gaStandardDeduction).toBe(single.gaStandardDeduction)
    expect(hoh.gaTax).toBe(single.gaTax)
  })
})