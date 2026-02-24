/**
 * Tests for New York Form IT-201 computation.
 */

import { describe, it, expect } from 'vitest'
import { computeFormIT201 } from '../../../../src/rules/2025/ny/formIT201'
import { computeAll } from '../../../../src/rules/engine'
import { getStateModule } from '../../../../src/rules/stateRegistry'
import { emptyTaxReturn } from '../../../../src/model/types'
import type { TaxReturn } from '../../../../src/model/types'
import { cents } from '../../../../src/model/traced'
import { makeW2 } from '../../../fixtures/returns'

function makeNYReturn(overrides: Partial<TaxReturn> = {}): TaxReturn {
  return {
    ...emptyTaxReturn(2025),
    taxpayer: {
      firstName: 'Test',
      lastName: 'NewYorker',
      ssn: '123456789',
      dateOfBirth: '1990-01-01',
      address: { street: '350 5th Ave', city: 'New York', state: 'NY', zip: '10118' },
    },
    stateReturns: [{ stateCode: 'NY', residencyType: 'full-year' }],
    w2s: [
      makeW2({
        id: 'w2-1',
        employerName: 'Empire Corp',
        box1: cents(100000),
        box2: cents(15000),
        box15State: 'NY',
        box16StateWages: cents(100000),
        box17StateIncomeTax: cents(5000),
      }),
    ],
    ...overrides,
  }
}

// ── Direct computation tests ────────────────────────────────────

describe('NY Form IT-201 — direct computation', () => {
  it('computes basic W-2 return correctly', () => {
    const tr = makeNYReturn()
    const result = computeAll(tr)
    const form1040 = result.form1040
    const it201 = computeFormIT201(tr, form1040)

    expect(it201.federalAGI).toBe(cents(100000))
    expect(it201.nyAdditions).toBe(0)
    expect(it201.nySubtractions).toBe(0)
    expect(it201.nyAGI).toBe(cents(100000))

    // Standard deduction for single: $8,000
    expect(it201.standardDeduction).toBe(cents(8000))
    expect(it201.deductionMethod).toBe('standard')
    expect(it201.deductionUsed).toBe(cents(8000))

    // Taxable income: $100,000 - $8,000 = $92,000
    expect(it201.nyTaxableIncome).toBe(cents(92000))

    // Tax should be positive and computed from brackets
    expect(it201.nyTax).toBeGreaterThan(0)

    // With $5K withholding, check balance
    expect(it201.stateWithholding).toBe(cents(5000))
    expect(it201.overpaid + it201.amountOwed).toBeGreaterThanOrEqual(0)

    // Exactly one of overpaid or amountOwed should be non-zero (or both zero)
    expect(it201.overpaid >= 0).toBe(true)
    expect(it201.amountOwed >= 0).toBe(true)
    expect(it201.overpaid === 0 || it201.amountOwed === 0).toBe(true)
  })

  it('applies correct bracket computation for single $92K taxable income', () => {
    const tr = makeNYReturn()
    const result = computeAll(tr)
    const it201 = computeFormIT201(tr, result.form1040)

    // $92,000 taxable income (in cents: 9200000) through brackets:
    // 4% on first $8,500    → 850000 * 0.04 = 34000
    // 4.5% on next $3,200   → 320000 * 0.045 = 14400
    // 5.25% on next $2,200  → 220000 * 0.0525 = 11550
    // 5.85% on next $66,750 → 6675000 * 0.0585 = 390487.5 → rounds in cumulative
    // 6.25% on next $11,350 → 1135000 * 0.0625 = 70937.5 → rounds in cumulative
    // Total: computed cumulatively with single final round = 521375
    expect(it201.nyTax).toBe(521375)
  })

  it('handles MFJ filing status with different brackets and deduction', () => {
    const tr = makeNYReturn({
      filingStatus: 'mfj',
      stateReturns: [{ stateCode: 'NY', residencyType: 'full-year' }],
      w2s: [
        makeW2({
          id: 'w2-1',
          employerName: 'Empire Corp',
          box1: cents(100000),
          box2: cents(12000),
          box15State: 'NY',
          box16StateWages: cents(100000),
          box17StateIncomeTax: cents(3000),
        }),
        makeW2({
          id: 'w2-2',
          employerName: 'Brooklyn Inc',
          box1: cents(80000),
          box2: cents(8000),
          box15State: 'NY',
          box16StateWages: cents(80000),
          box17StateIncomeTax: cents(2000),
        }),
      ],
    })

    const result = computeAll(tr)
    const it201 = computeFormIT201(tr, result.form1040)

    // AGI = $180,000
    expect(it201.federalAGI).toBe(cents(180000))
    // MFJ standard deduction: $16,050
    expect(it201.standardDeduction).toBe(cents(16050))
    // Taxable: $180,000 - $16,050 = $163,950
    expect(it201.nyTaxableIncome).toBe(cents(163950))
    expect(it201.nyTax).toBeGreaterThan(0)
    // Withholding: $3,000 + $2,000 = $5,000
    expect(it201.stateWithholding).toBe(cents(5000))
  })

  it('handles dependents with exemption deduction', () => {
    const tr = makeNYReturn({
      dependents: [
        {
          firstName: 'Alice',
          lastName: 'NewYorker',
          ssn: '987654321',
          relationship: 'daughter',
          monthsLived: 12,
          dateOfBirth: '2015-03-15',
        },
        {
          firstName: 'Bob',
          lastName: 'NewYorker',
          ssn: '987654322',
          relationship: 'son',
          monthsLived: 12,
          dateOfBirth: '2018-07-22',
        },
      ],
    })

    const result = computeAll(tr)
    const it201 = computeFormIT201(tr, result.form1040)

    // 2 dependents × $1,000 = $2,000
    expect(it201.dependentExemption).toBe(cents(2000))
    // Taxable: $100,000 - $8,000 - $2,000 = $90,000
    expect(it201.nyTaxableIncome).toBe(cents(90000))
  })
})

// ── Social Security exemption ───────────────────────────────────

describe('NY Form IT-201 — Social Security exemption', () => {
  it('fully exempts Social Security benefits', () => {
    const tr = makeNYReturn({
      formSSA1099s: [{
        id: 'ssa-1',
        recipientName: 'Test NewYorker',
        box3: cents(24000),
        box4: 0,
        box5: cents(24000),
        box6: cents(2400),
      }],
    })

    const result = computeAll(tr)
    const it201 = computeFormIT201(tr, result.form1040)

    // SS subtraction should equal the taxable SS amount from federal
    expect(it201.ssExemption).toBe(result.form1040.line6b.amount)

    // NY AGI should be less than federal AGI by the SS subtraction
    expect(it201.nyAGI).toBe(it201.federalAGI - it201.nySubtractions)
    expect(it201.nySubtractions).toBeGreaterThanOrEqual(it201.ssExemption)
  })
})

// ── US government interest exemption ────────────────────────────

describe('NY Form IT-201 — US government interest', () => {
  it('subtracts US government obligation interest', () => {
    const tr = makeNYReturn({
      form1099INTs: [{
        id: 'int-1',
        payerName: 'Treasury Direct',
        box1: cents(2000),
        box2: 0,
        box3: cents(1500), // US gov interest
        box4: 0,
        box6: 0,
        box8: 0,
      }],
    })

    const result = computeAll(tr)
    const it201 = computeFormIT201(tr, result.form1040)

    expect(it201.usGovInterest).toBe(cents(1500))
    expect(it201.nySubtractions).toBeGreaterThanOrEqual(cents(1500))
    // NY AGI should be reduced by the US gov interest subtraction
    expect(it201.nyAGI).toBeLessThan(it201.federalAGI)
  })
})

// ── Part-year residency ─────────────────────────────────────────

describe('NY Form IT-201 — part-year residency', () => {
  it('applies apportionment ratio for part-year resident', () => {
    const tr = makeNYReturn({
      stateReturns: [{
        stateCode: 'NY',
        residencyType: 'part-year',
        moveInDate: '2025-01-01',
        moveOutDate: '2025-06-30',
      }],
    })

    const result = computeAll(tr)
    const it201 = computeFormIT201(tr, result.form1040, tr.stateReturns[0])

    // ~181 days / 365 ≈ 0.4959
    expect(it201.apportionmentRatio).toBeGreaterThan(0.49)
    expect(it201.apportionmentRatio).toBeLessThan(0.50)

    // Tax should be roughly half of full-year tax
    const fullYearTr = makeNYReturn()
    const fullYearResult = computeAll(fullYearTr)
    const fullYearIt201 = computeFormIT201(fullYearTr, fullYearResult.form1040)

    expect(it201.nyTax).toBeLessThan(fullYearIt201.nyTax)
    expect(it201.nyTax).toBeGreaterThan(fullYearIt201.nyTax * 0.4)
    expect(it201.nyTax).toBeLessThan(fullYearIt201.nyTax * 0.55)
  })

  it('full-year has apportionment ratio of 1', () => {
    const tr = makeNYReturn()
    const result = computeAll(tr)
    const it201 = computeFormIT201(tr, result.form1040, tr.stateReturns[0])

    expect(it201.apportionmentRatio).toBe(1)
    expect(it201.residencyType).toBe('full-year')
  })
})

// ── Engine integration ──────────────────────────────────────────

describe('NY Form IT-201 — engine integration', () => {
  it('NY module is registered', () => {
    const mod = getStateModule('NY')
    expect(mod).toBeDefined()
    expect(mod!.stateCode).toBe('NY')
    expect(mod!.formLabel).toBe('NY Form IT-201')
    expect(mod!.sidebarLabel).toBe('NY Form IT-201')
  })

  it('stateResults contains NY when NY is in stateReturns', () => {
    const tr = makeNYReturn()
    const result = computeAll(tr)

    expect(result.stateResults).toHaveLength(1)
    expect(result.stateResults[0].stateCode).toBe('NY')
    expect(result.stateResults[0].formLabel).toBe('NY Form IT-201')
    expect(result.stateResults[0].stateAGI).toBeGreaterThan(0)
    expect(result.stateResults[0].stateWithholding).toBe(cents(5000))
  })

  it('executedSchedules includes NY-IT201', () => {
    const tr = makeNYReturn()
    const result = computeAll(tr)
    expect(result.executedSchedules).toContain('NY-IT201')
  })

  it('NY traced values appear in values map', () => {
    const tr = makeNYReturn()
    const result = computeAll(tr)

    expect(result.values.has('it201.nyAGI')).toBe(true)
    expect(result.values.has('it201.nyTaxableIncome')).toBe(true)
    expect(result.values.has('it201.nyTax')).toBe(true)
    expect(result.values.has('it201.taxAfterCredits')).toBe(true)
  })

  it('multi-state returns include both CA and NY', () => {
    const tr = makeNYReturn({
      stateReturns: [
        { stateCode: 'NY', residencyType: 'full-year' },
        { stateCode: 'CA', residencyType: 'full-year' },
      ],
    })
    const result = computeAll(tr)

    expect(result.stateResults).toHaveLength(2)
    expect(result.stateResults.find(r => r.stateCode === 'NY')).toBeDefined()
    expect(result.stateResults.find(r => r.stateCode === 'CA')).toBeDefined()
  })
})

// ── Review layout ───────────────────────────────────────────────

describe('NY Form IT-201 — review layout', () => {
  const nyModule = getStateModule('NY')!

  it('has reviewLayout with expected sections', () => {
    expect(nyModule.reviewLayout).toBeDefined()
    const titles = nyModule.reviewLayout.map(s => s.title)
    expect(titles).toContain('Income')
    expect(titles).toContain('Deductions')
    expect(titles).toContain('Tax & Credits')
    expect(titles).toContain('Payments & Result')
  })

  it('has reviewResultLines for refund, owed, and zero', () => {
    expect(nyModule.reviewResultLines).toBeDefined()
    expect(nyModule.reviewResultLines).toHaveLength(3)
    expect(nyModule.reviewResultLines.map(l => l.type)).toEqual(['refund', 'owed', 'zero'])
  })

  it('layout items produce correct values from real compute result', () => {
    const tr = makeNYReturn()
    const result = computeAll(tr)
    const stateResult = result.stateResults[0]

    const incomeSection = nyModule.reviewLayout.find(s => s.title === 'Income')!
    const fedAGI = incomeSection.items.find(i => i.label === 'Federal AGI')!
    expect(fedAGI.getValue(stateResult)).toBe(result.form1040.line11.amount)

    const nyAGI = incomeSection.items.find(i => i.label === 'NY AGI')!
    expect(nyAGI.getValue(stateResult)).toBe(stateResult.stateAGI)
  })

  it('exactly one result line shows at a time', () => {
    const tr = makeNYReturn()
    const result = computeAll(tr)
    const stateResult = result.stateResults[0]

    const showing = nyModule.reviewResultLines.filter(l => l.showWhen(stateResult))
    expect(showing).toHaveLength(1)
  })

  it('each item has a valid nodeId for explainability trace', () => {
    for (const section of nyModule.reviewLayout) {
      for (const item of section.items) {
        expect(item.nodeId).toMatch(/^[a-zA-Z0-9]+\.[a-zA-Z0-9]+$/)
      }
    }
  })

  it('each item has tooltip with explanation, pubName, pubUrl', () => {
    for (const section of nyModule.reviewLayout) {
      for (const item of section.items) {
        expect(item.tooltip.explanation.length).toBeGreaterThan(10)
        expect(item.tooltip.pubName.length).toBeGreaterThan(0)
        expect(item.tooltip.pubUrl).toMatch(/^https:\/\//)
      }
    }
  })
})

// ── Zero income / edge cases ────────────────────────────────────

describe('NY Form IT-201 — edge cases', () => {
  it('zero income produces zero tax', () => {
    const tr = makeNYReturn({
      w2s: [],
    })
    const result = computeAll(tr)
    const it201 = computeFormIT201(tr, result.form1040)

    expect(it201.federalAGI).toBe(0)
    expect(it201.nyAGI).toBe(0)
    expect(it201.nyTaxableIncome).toBe(0)
    expect(it201.nyTax).toBe(0)
    expect(it201.taxAfterCredits).toBe(0)
    expect(it201.overpaid).toBe(0)
    expect(it201.amountOwed).toBe(0)
  })

  it('withholding exceeds tax yields overpaid', () => {
    // Low income but high withholding
    const tr = makeNYReturn({
      w2s: [
        makeW2({
          id: 'w2-1',
          employerName: 'Empire Corp',
          box1: cents(30000),
          box2: cents(3000),
          box15State: 'NY',
          box16StateWages: cents(30000),
          box17StateIncomeTax: cents(3000),
        }),
      ],
    })

    const result = computeAll(tr)
    const stateResult = result.stateResults[0]

    // $30K income - $8K deduction = $22K taxable → tax ≈ $1,000
    // With $3K withholding → overpaid
    expect(stateResult.overpaid).toBeGreaterThan(0)
    expect(stateResult.amountOwed).toBe(0)
  })

  it('tax exceeds withholding yields amount owed', () => {
    // High income but low withholding
    const tr = makeNYReturn({
      w2s: [
        makeW2({
          id: 'w2-1',
          employerName: 'Empire Corp',
          box1: cents(200000),
          box2: cents(30000),
          box15State: 'NY',
          box16StateWages: cents(200000),
          box17StateIncomeTax: cents(2000),
        }),
      ],
    })

    const result = computeAll(tr)
    const stateResult = result.stateResults[0]

    // $200K income with only $2K withholding → amount owed
    expect(stateResult.amountOwed).toBeGreaterThan(0)
    expect(stateResult.overpaid).toBe(0)
  })

  it('non-NY W-2 withholding is not counted', () => {
    const tr = makeNYReturn({
      stateReturns: [{ stateCode: 'NY', residencyType: 'full-year' }],
      w2s: [
        makeW2({
          id: 'w2-1',
          employerName: 'Empire Corp',
          box1: cents(100000),
          box2: cents(15000),
          box15State: 'NJ', // NJ, not NY
          box16StateWages: cents(100000),
          box17StateIncomeTax: cents(5000),
        }),
      ],
    })

    const result = computeAll(tr)
    const stateResult = result.stateResults[0]

    // NJ withholding should NOT count for NY
    expect(stateResult.stateWithholding).toBe(0)
  })
})
