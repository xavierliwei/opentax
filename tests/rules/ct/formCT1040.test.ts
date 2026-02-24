import { describe, it, expect } from 'vitest'
import { emptyTaxReturn } from '../../../src/model/types'
import { cents } from '../../../src/model/traced'
import { computeForm1040 } from '../../../src/rules/2025/form1040'
import { computeFormCT1040, computePersonalExemption, computeTableCAddBack, computeTableDRecapture } from '../../../src/rules/2025/ct/formCT1040'
import { makeW2 } from '../../fixtures/returns'

describe('CT Form CT-1040', () => {
  it('computes table C/D boundaries', () => {
    expect(computeTableCAddBack(cents(56499), 'single')).toBe(0)
    expect(computeTableCAddBack(cents(105000), 'single')).toBe(cents(200))
    expect(computeTableDRecapture(cents(104999), 'single')).toBe(0)
    expect(computeTableDRecapture(cents(150000), 'single')).toBe(cents(250))
  })

  it('phases out personal exemption', () => {
    const low = computePersonalExemption(cents(25000), 'single')
    expect(low.effectiveExemption).toBe(cents(15000))
    const high = computePersonalExemption(cents(50000), 'single')
    expect(high.effectiveExemption).toBe(0)
  })

  it('computes return with CT withholding and property tax credit', () => {
    const tr = {
      ...emptyTaxReturn(2025),
      w2s: [makeW2({ id: 'w1', employerName: 'Acme', box1: cents(80000), box2: cents(8000), box15State: 'CT', box17StateIncomeTax: cents(3500) })],
      stateReturns: [{ stateCode: 'CT', residencyType: 'full-year', ctPropertyTaxPaid: cents(300) }],
    }
    const fed = computeForm1040(tr)
    const ct = computeFormCT1040(tr, fed, tr.stateReturns[0])
    expect(ct.stateWithholding).toBe(cents(3500))
    expect(ct.propertyTaxCredit).toBeGreaterThan(0)
    expect(ct.ctAGI).toBeGreaterThan(0)
  })
})
