import { describe, it, expect } from 'vitest'
import { cents } from '../../../src/model/traced'
import { computeBracketTax } from '../../../src/rules/2025/taxComputation'
import { computePersonalExemption } from '../../../src/rules/2025/ct/formCT1040'
import { computePropertyTaxCredit } from '../../../src/rules/2025/ct/ctCredits'
import { CT_TAX_BRACKETS, CT_PERSONAL_EXEMPTION, CT_PROPERTY_TAX_CREDIT } from '../../../src/rules/2025/ct/constants'

describe('CT tax brackets cover all 7 rate tiers', () => {
  it('single filer has expected marginal tax at each bracket floor', () => {
    const floors = CT_TAX_BRACKETS.single.map((b) => b.floor)
    const rates = CT_TAX_BRACKETS.single.map((b) => b.rate)

    expect(floors.length).toBe(7)

    for (let i = 0; i < floors.length; i += 1) {
      const floor = floors[i]
      const amount = floor + cents(100)
      const delta = computeBracketTax(amount, CT_TAX_BRACKETS.single) - computeBracketTax(floor, CT_TAX_BRACKETS.single)
      expect(delta).toBe(Math.round(cents(100) * rates[i]))
    }
  })
})

describe('CT personal exemption phase-out', () => {
  it('single starts at full exemption and phases to zero at end', () => {
    const p = CT_PERSONAL_EXEMPTION.single
    expect(computePersonalExemption(p.phaseOutStart - 1, 'single').effectiveExemption).toBe(p.maxExemption)
    expect(computePersonalExemption(p.phaseOutEnd, 'single').effectiveExemption).toBe(0)
  })

  it('QW/MFS/HOH filing statuses follow their configured phase-out bounds', () => {
    for (const status of ['qw', 'mfs', 'hoh'] as const) {
      const p = CT_PERSONAL_EXEMPTION[status]
      expect(computePersonalExemption(p.phaseOutStart - 1, status).effectiveExemption).toBe(p.maxExemption)
      expect(computePersonalExemption(p.phaseOutEnd, status).effectiveExemption).toBe(0)
    }
  })
})

describe('CT property tax credit phase-out behavior', () => {
  it('uses $5k step for MFS and $10k step for non-MFS', () => {
    const mfsBase = CT_PROPERTY_TAX_CREDIT.incomeLimit.mfs
    const singleBase = CT_PROPERTY_TAX_CREDIT.incomeLimit.single

    const mfs = computePropertyTaxCredit(mfsBase + cents(5000), 'mfs', cents(300))
    const single = computePropertyTaxCredit(singleBase + cents(10000), 'single', cents(300))

    expect(mfs).toBe(single)
  })

  it('QW/MFJ/HOH statuses are accepted and produce bounded credits', () => {
    for (const status of ['qw', 'mfj', 'hoh'] as const) {
      const credit = computePropertyTaxCredit(CT_PROPERTY_TAX_CREDIT.incomeLimit[status], status, cents(1000))
      expect(credit).toBeGreaterThanOrEqual(0)
      expect(credit).toBeLessThanOrEqual(cents(300))
    }
  })
})