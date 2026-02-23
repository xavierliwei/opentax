/**
 * Foreign Tax Credit (Form 1116) — Comprehensive Tests
 *
 * Tests the passive-category FTC computation for common portfolio-income
 * scenarios: mutual fund dividends, international brokerage interest,
 * limitation formula, direct credit election, and integration with
 * Form 1040 Lines 20/22.
 */

import { describe, it, expect } from 'vitest'
import { cents } from '../../src/model/traced'
import { emptyTaxReturn } from '../../src/model/types'
import type { TaxReturn } from '../../src/model/types'
import {
  computeForeignTaxCredit,
  getDirectCreditThreshold,
} from '../../src/rules/2025/foreignTaxCredit'
import type { ForeignTaxCreditResult } from '../../src/rules/2025/foreignTaxCredit'
import { computeForm1040 } from '../../src/rules/2025/form1040'
import { makeW2, make1099DIV, make1099INT } from '../fixtures/returns'

// ── Helpers ──────────────────────────────────────────────────────

/** Build a simple return with W-2 + foreign dividends */
function makeForeignDividendReturn(opts: {
  wages: number
  divOrdinary: number
  divQualified?: number
  foreignTaxPaid: number
  foreignCountry?: string
  filingStatus?: TaxReturn['filingStatus']
}): TaxReturn {
  return {
    ...emptyTaxReturn(2025),
    filingStatus: opts.filingStatus ?? 'single',
    w2s: [
      makeW2({
        id: 'w2-1',
        employerName: 'Acme Corp',
        box1: cents(opts.wages),
        box2: cents(opts.wages * 0.15),
      }),
    ],
    form1099DIVs: [
      make1099DIV({
        id: 'div-1',
        payerName: 'Vanguard Intl Fund',
        box1a: cents(opts.divOrdinary),
        box1b: cents(opts.divQualified ?? 0),
        box7: cents(opts.foreignTaxPaid),
        box8: opts.foreignCountry,
      }),
    ],
  }
}

/** Build a return with W-2 + foreign interest */
function makeForeignInterestReturn(opts: {
  wages: number
  interest: number
  foreignTaxPaid: number
  foreignCountry?: string
}): TaxReturn {
  return {
    ...emptyTaxReturn(2025),
    w2s: [
      makeW2({
        id: 'w2-1',
        employerName: 'Acme Corp',
        box1: cents(opts.wages),
        box2: cents(opts.wages * 0.15),
      }),
    ],
    form1099INTs: [
      make1099INT({
        id: 'int-1',
        payerName: 'Foreign Bank',
        box1: cents(opts.interest),
        box6: cents(opts.foreignTaxPaid),
        box7: opts.foreignCountry,
      }),
    ],
  }
}

// ── Unit Tests: computeForeignTaxCredit ──────────────────────────

describe('computeForeignTaxCredit', () => {
  describe('basic computation', () => {
    it('returns not applicable when no foreign taxes paid', () => {
      const model = {
        ...emptyTaxReturn(2025),
        form1099DIVs: [
          make1099DIV({ id: 'div-1', payerName: 'US Fund', box1a: cents(5000), box7: 0 }),
        ],
      }
      const result = computeForeignTaxCredit(model, cents(50000), cents(8000))
      expect(result.applicable).toBe(false)
      expect(result.creditAmount).toBe(0)
      expect(result.totalForeignTaxPaid).toBe(0)
    })

    it('computes credit for simple foreign dividend case', () => {
      const model = makeForeignDividendReturn({
        wages: 75000,
        divOrdinary: 5000,
        foreignTaxPaid: 200,
        foreignCountry: 'Various',
      })

      // taxable income = $75,000 + $5,000 - $15,000 (std ded) = $65,000
      // US tax ≈ ~$9,000 (approximate)
      // foreign source income = $5,000
      // limitation = $9,000 × ($5,000 / $65,000) = ~$692
      // credit = min($200, $692) = $200
      const result = computeForeignTaxCredit(model, cents(65000), cents(9000))

      expect(result.applicable).toBe(true)
      expect(result.totalForeignTaxPaid).toBe(cents(200))
      expect(result.foreignTaxDIV).toBe(cents(200))
      expect(result.foreignTaxINT).toBe(0)
      expect(result.foreignSourceIncome).toBe(cents(5000))
      expect(result.creditAmount).toBe(cents(200)) // taxes paid < limitation
      expect(result.excessForeignTax).toBe(0)
      expect(result.directCreditElection).toBe(true) // $200 ≤ $300
    })

    it('computes credit for foreign interest case', () => {
      const model = makeForeignInterestReturn({
        wages: 80000,
        interest: 3000,
        foreignTaxPaid: 150,
        foreignCountry: 'Canada',
      })

      const result = computeForeignTaxCredit(model, cents(68000), cents(10000))

      expect(result.applicable).toBe(true)
      expect(result.foreignTaxINT).toBe(cents(150))
      expect(result.foreignTaxDIV).toBe(0)
      expect(result.foreignSourceIncome).toBe(cents(3000))
      expect(result.creditAmount).toBe(cents(150))
      expect(result.countries).toContain('Canada')
    })

    it('handles combined dividend and interest foreign taxes', () => {
      const model: TaxReturn = {
        ...emptyTaxReturn(2025),
        w2s: [makeW2({ id: 'w2-1', employerName: 'Acme', box1: cents(80000), box2: cents(12000) })],
        form1099DIVs: [
          make1099DIV({ id: 'div-1', payerName: 'Intl Fund', box1a: cents(4000), box7: cents(180), box8: 'Various' }),
        ],
        form1099INTs: [
          make1099INT({ id: 'int-1', payerName: 'Foreign Bank', box1: cents(2000), box6: cents(90), box7: 'UK' }),
        ],
      }

      const result = computeForeignTaxCredit(model, cents(71000), cents(10500))

      expect(result.totalForeignTaxPaid).toBe(cents(270))
      expect(result.foreignTaxDIV).toBe(cents(180))
      expect(result.foreignTaxINT).toBe(cents(90))
      expect(result.foreignSourceIncome).toBe(cents(6000))
      expect(result.creditAmount).toBe(cents(270)) // well under limitation
      expect(result.countries).toContain('Various')
      expect(result.countries).toContain('UK')
      expect(result.directCreditElection).toBe(true) // $270 ≤ $300
    })
  })

  describe('limitation formula', () => {
    it('limits credit when taxes paid exceed limitation', () => {
      // High foreign tax rate scenario: 30% foreign tax on $10,000 income
      // with relatively low US tax rate
      const model = makeForeignDividendReturn({
        wages: 20000,
        divOrdinary: 10000,
        foreignTaxPaid: 3000,
      })

      // taxable income = $15,000 (low after std ded)
      // US tax ≈ $1,583
      // foreign source = $10,000
      // limitation = $1,583 × ($10,000 / $15,000) = $1,055
      // credit = min($3,000, $1,055) = $1,055
      const result = computeForeignTaxCredit(model, cents(15000), cents(1583))

      expect(result.totalForeignTaxPaid).toBe(cents(3000))
      expect(result.limitation).toBeLessThan(cents(3000))
      expect(result.creditAmount).toBe(result.limitation) // limited
      expect(result.excessForeignTax).toBe(cents(3000) - result.limitation)
      expect(result.excessForeignTax).toBeGreaterThan(0)
    })

    it('caps foreign source income at worldwide taxable income', () => {
      // Edge case: foreign source income exceeds taxable income
      // (e.g., large deductions reduce taxable income below foreign income)
      const model = makeForeignDividendReturn({
        wages: 5000,
        divOrdinary: 20000,
        foreignTaxPaid: 500,
      })

      // taxable income = $10,000 (less than foreign source of $20,000)
      // US tax = $1,000
      // limitation = $1,000 × min($20,000, $10,000) / $10,000 = $1,000
      const result = computeForeignTaxCredit(model, cents(10000), cents(1000))

      expect(result.limitation).toBe(cents(1000)) // capped at full US tax
      expect(result.creditAmount).toBe(cents(500)) // taxes paid < limitation
    })

    it('returns zero credit when taxable income is zero', () => {
      const model = makeForeignDividendReturn({
        wages: 5000,
        divOrdinary: 2000,
        foreignTaxPaid: 100,
      })

      const result = computeForeignTaxCredit(model, 0, 0)

      expect(result.applicable).toBe(true)
      expect(result.totalForeignTaxPaid).toBe(cents(100))
      expect(result.limitation).toBe(0)
      expect(result.creditAmount).toBe(0)
      expect(result.excessForeignTax).toBe(cents(100))
    })

    it('returns zero credit when US tax is zero', () => {
      const model = makeForeignDividendReturn({
        wages: 5000,
        divOrdinary: 3000,
        foreignTaxPaid: 150,
      })

      const result = computeForeignTaxCredit(model, cents(8000), 0)

      expect(result.applicable).toBe(true)
      expect(result.limitation).toBe(0)
      expect(result.creditAmount).toBe(0)
    })

    it('computes correct limitation ratio', () => {
      const model = makeForeignDividendReturn({
        wages: 90000,
        divOrdinary: 10000,
        foreignTaxPaid: 500,
      })

      // taxable = $85,000; tax = $13,000; foreign source = $10,000
      // limitation = $13,000 × ($10,000 / $85,000) = $1,529.41 → $1,529
      const result = computeForeignTaxCredit(model, cents(85000), cents(13000))

      const expectedLimitation = Math.round(cents(13000) * cents(10000) / cents(85000))
      expect(result.limitation).toBe(expectedLimitation)
      expect(result.creditAmount).toBe(cents(500)) // taxes paid < limitation
    })
  })

  describe('direct credit election', () => {
    it('qualifies for direct election when single filer ≤ $300', () => {
      const model = makeForeignDividendReturn({
        wages: 80000,
        divOrdinary: 5000,
        foreignTaxPaid: 250,
      })

      const result = computeForeignTaxCredit(model, cents(70000), cents(10000))
      expect(result.directCreditElection).toBe(true)
    })

    it('does not qualify when single filer > $300', () => {
      const model = makeForeignDividendReturn({
        wages: 80000,
        divOrdinary: 5000,
        foreignTaxPaid: 350,
      })

      const result = computeForeignTaxCredit(model, cents(70000), cents(10000))
      expect(result.directCreditElection).toBe(false)
    })

    it('qualifies for MFJ up to $600', () => {
      const model = makeForeignDividendReturn({
        wages: 120000,
        divOrdinary: 10000,
        foreignTaxPaid: 550,
        filingStatus: 'mfj',
      })

      const result = computeForeignTaxCredit(model, cents(115000), cents(15000))
      expect(result.directCreditElection).toBe(true)
    })

    it('does not qualify for MFJ > $600', () => {
      const model = makeForeignDividendReturn({
        wages: 120000,
        divOrdinary: 10000,
        foreignTaxPaid: 650,
        filingStatus: 'mfj',
      })

      const result = computeForeignTaxCredit(model, cents(115000), cents(15000))
      expect(result.directCreditElection).toBe(false)
    })
  })

  describe('getDirectCreditThreshold', () => {
    it('returns $300 for single', () => {
      expect(getDirectCreditThreshold('single')).toBe(30_000)
    })

    it('returns $600 for MFJ', () => {
      expect(getDirectCreditThreshold('mfj')).toBe(60_000)
    })

    it('returns $300 for MFS', () => {
      expect(getDirectCreditThreshold('mfs')).toBe(30_000)
    })

    it('returns $300 for HOH', () => {
      expect(getDirectCreditThreshold('hoh')).toBe(30_000)
    })
  })

  describe('multiple 1099 forms', () => {
    it('aggregates foreign taxes across multiple 1099-DIVs', () => {
      const model: TaxReturn = {
        ...emptyTaxReturn(2025),
        w2s: [makeW2({ id: 'w2-1', employerName: 'Acme', box1: cents(80000), box2: cents(12000) })],
        form1099DIVs: [
          make1099DIV({ id: 'div-1', payerName: 'Vanguard Intl', box1a: cents(3000), box7: cents(120), box8: 'Various' }),
          make1099DIV({ id: 'div-2', payerName: 'Fidelity Intl', box1a: cents(2000), box7: cents(80), box8: 'Various' }),
          make1099DIV({ id: 'div-3', payerName: 'US Fund', box1a: cents(4000), box7: 0 }), // no foreign tax
        ],
      }

      const result = computeForeignTaxCredit(model, cents(74000), cents(11000))

      expect(result.foreignTaxDIV).toBe(cents(200)) // 120 + 80
      expect(result.foreignSourceIncome).toBe(cents(5000)) // 3000 + 2000 (not the US fund)
      expect(result.creditAmount).toBe(cents(200))
    })

    it('aggregates across DIV and INT forms', () => {
      const model: TaxReturn = {
        ...emptyTaxReturn(2025),
        w2s: [makeW2({ id: 'w2-1', employerName: 'Acme', box1: cents(70000), box2: cents(10000) })],
        form1099DIVs: [
          make1099DIV({ id: 'div-1', payerName: 'Intl Fund', box1a: cents(4000), box7: cents(160) }),
        ],
        form1099INTs: [
          make1099INT({ id: 'int-1', payerName: 'Foreign Bank A', box1: cents(1500), box6: cents(60) }),
          make1099INT({ id: 'int-2', payerName: 'Foreign Bank B', box1: cents(1000), box6: cents(40) }),
          make1099INT({ id: 'int-3', payerName: 'US Bank', box1: cents(2000), box6: 0 }), // no foreign tax
        ],
      }

      const result = computeForeignTaxCredit(model, cents(63500), cents(9000))

      expect(result.foreignTaxDIV).toBe(cents(160))
      expect(result.foreignTaxINT).toBe(cents(100)) // 60 + 40
      expect(result.totalForeignTaxPaid).toBe(cents(260))
      expect(result.foreignSourceIncome).toBe(cents(6500)) // 4000 + 1500 + 1000
    })
  })

  describe('country tracking', () => {
    it('collects unique countries from DIV and INT forms', () => {
      const model: TaxReturn = {
        ...emptyTaxReturn(2025),
        form1099DIVs: [
          make1099DIV({ id: 'div-1', payerName: 'Fund A', box1a: cents(3000), box7: cents(100), box8: 'Japan' }),
          make1099DIV({ id: 'div-2', payerName: 'Fund B', box1a: cents(2000), box7: cents(80), box8: 'UK' }),
        ],
        form1099INTs: [
          make1099INT({ id: 'int-1', payerName: 'Bank', box1: cents(1000), box6: cents(50), box7: 'Japan' }),
        ],
      }

      const result = computeForeignTaxCredit(model, cents(50000), cents(8000))

      expect(result.countries).toHaveLength(2)
      expect(result.countries).toContain('Japan')
      expect(result.countries).toContain('UK')
    })
  })
})

// ── Integration Tests: Full Form 1040 ────────────────────────────

describe('FTC integration with Form 1040', () => {
  it('includes FTC in Line 20 (nonrefundable credits)', () => {
    const model = makeForeignDividendReturn({
      wages: 75000,
      divOrdinary: 5000,
      foreignTaxPaid: 200,
    })

    const result = computeForm1040(model)

    expect(result.foreignTaxCreditResult).not.toBeNull()
    expect(result.foreignTaxCreditResult!.creditAmount).toBe(cents(200))
    // Line 20 should include the FTC
    expect(result.line20.amount).toBeGreaterThanOrEqual(cents(200))
    // Source should reference FTC
    const source = result.line20.source
    expect(source.kind).toBe('computed')
    if (source.kind === 'computed') {
      expect(source.inputs).toContain('credits.foreignTaxCredit')
    }
  })

  it('reduces tax liability by FTC amount', () => {
    // Compare returns with and without foreign tax
    const baseModel: TaxReturn = {
      ...emptyTaxReturn(2025),
      w2s: [makeW2({ id: 'w2-1', employerName: 'Acme', box1: cents(80000), box2: cents(12000) })],
      form1099DIVs: [
        make1099DIV({ id: 'div-1', payerName: 'Intl Fund', box1a: cents(5000), box1b: cents(3000) }),
      ],
    }

    const ftcModel: TaxReturn = {
      ...baseModel,
      form1099DIVs: [
        make1099DIV({
          id: 'div-1',
          payerName: 'Intl Fund',
          box1a: cents(5000),
          box1b: cents(3000),
          box7: cents(250),
          box8: 'Various',
        }),
      ],
    }

    const baseResult = computeForm1040(baseModel)
    const ftcResult = computeForm1040(ftcModel)

    // Line 20 should be higher with FTC
    expect(ftcResult.line20.amount).toBe(baseResult.line20.amount + cents(250))
    // Tax after credits (Line 22) should be lower
    expect(ftcResult.line22.amount).toBeLessThan(baseResult.line22.amount)
  })

  it('does not produce FTC result when no foreign taxes', () => {
    const model: TaxReturn = {
      ...emptyTaxReturn(2025),
      w2s: [makeW2({ id: 'w2-1', employerName: 'Acme', box1: cents(80000), box2: cents(12000) })],
      form1099DIVs: [
        make1099DIV({ id: 'div-1', payerName: 'US Fund', box1a: cents(3000) }),
      ],
    }

    const result = computeForm1040(model)
    expect(result.foreignTaxCreditResult).toBeNull()
  })

  it('FTC is non-refundable — cannot exceed tax liability', () => {
    // Low income with high foreign tax — credit limited by tax
    const model: TaxReturn = {
      ...emptyTaxReturn(2025),
      w2s: [makeW2({ id: 'w2-1', employerName: 'Part Time', box1: cents(18000), box2: cents(500) })],
      form1099DIVs: [
        make1099DIV({
          id: 'div-1',
          payerName: 'Intl Fund',
          box1a: cents(5000),
          box7: cents(2000), // very high foreign tax
        }),
      ],
    }

    const result = computeForm1040(model)

    // Line 22 (tax after credits) should be >= 0
    expect(result.line22.amount).toBeGreaterThanOrEqual(0)
    // Total credits (Line 21) cannot exceed Line 18
    expect(result.line21.amount).toBeLessThanOrEqual(result.line18.amount)
  })

  it('FTC works alongside other nonrefundable credits', () => {
    const model: TaxReturn = {
      ...emptyTaxReturn(2025),
      filingStatus: 'mfj',
      w2s: [
        makeW2({ id: 'w2-1', employerName: 'Acme', box1: cents(100000), box2: cents(15000) }),
        makeW2({ id: 'w2-2', employerName: 'Beta', box1: cents(40000), box2: cents(5000) }),
      ],
      dependents: [
        { firstName: 'Child', lastName: 'Doe', ssn: '987654321', relationship: 'son', monthsLived: 12, dateOfBirth: '2018-01-15' },
      ],
      form1099DIVs: [
        make1099DIV({
          id: 'div-1',
          payerName: 'Vanguard Intl',
          box1a: cents(8000),
          box1b: cents(6000),
          box7: cents(400),
          box8: 'Various',
        }),
      ],
      energyCredits: {
        solarElectric: cents(10000),
        solarWaterHeating: 0,
        batteryStorage: 0,
        geothermal: 0,
        insulation: 0,
        windows: 0,
        exteriorDoors: 0,
        centralAC: 0,
        waterHeater: 0,
        heatPump: 0,
        homeEnergyAudit: 0,
        biomassStove: 0,
      },
    }

    const result = computeForm1040(model)

    // Should have FTC + CTC + energy credit all in effect
    expect(result.foreignTaxCreditResult).not.toBeNull()
    expect(result.foreignTaxCreditResult!.creditAmount).toBeGreaterThan(0)
    expect(result.childTaxCredit).not.toBeNull()
    expect(result.energyCredit).not.toBeNull()

    // Line 20 should include FTC + energy
    expect(result.line20.amount).toBeGreaterThanOrEqual(
      result.foreignTaxCreditResult!.creditAmount + (result.energyCredit?.totalCredit ?? 0),
    )
  })
})

// ── Validation Tests ─────────────────────────────────────────────

describe('FTC validation', () => {
  it('emits FTC_COMPUTED info when foreign taxes are present', () => {
    const model = makeForeignDividendReturn({
      wages: 75000,
      divOrdinary: 5000,
      foreignTaxPaid: 200,
    })

    const result = computeForm1040(model)
    const ftcInfo = result.validation?.items.find(i => i.code === 'FTC_COMPUTED')

    expect(ftcInfo).toBeDefined()
    expect(ftcInfo!.severity).toBe('info')
    expect(ftcInfo!.message).toContain('$200.00')
  })

  it('emits FTC_PASSIVE_ONLY warning', () => {
    const model = makeForeignDividendReturn({
      wages: 75000,
      divOrdinary: 5000,
      foreignTaxPaid: 200,
    })

    const result = computeForm1040(model)
    const passiveWarning = result.validation?.items.find(i => i.code === 'FTC_PASSIVE_ONLY')

    expect(passiveWarning).toBeDefined()
    expect(passiveWarning!.severity).toBe('warning')
  })

  it('emits FTC_NO_CARRYOVER warning', () => {
    const model = makeForeignDividendReturn({
      wages: 75000,
      divOrdinary: 5000,
      foreignTaxPaid: 200,
    })

    const result = computeForm1040(model)
    const carryoverWarning = result.validation?.items.find(i => i.code === 'FTC_NO_CARRYOVER')

    expect(carryoverWarning).toBeDefined()
    expect(carryoverWarning!.severity).toBe('warning')
  })

  it('does not emit FTC validations when no foreign taxes', () => {
    const model: TaxReturn = {
      ...emptyTaxReturn(2025),
      w2s: [makeW2({ id: 'w2-1', employerName: 'Acme', box1: cents(75000), box2: cents(10000) })],
    }

    const result = computeForm1040(model)
    const ftcItems = result.validation?.items.filter(i => i.code.startsWith('FTC_')) ?? []

    expect(ftcItems).toHaveLength(0)
  })

  it('updated SUPPORTED_SCOPE message mentions FTC support', () => {
    const model: TaxReturn = {
      ...emptyTaxReturn(2025),
      w2s: [makeW2({ id: 'w2-1', employerName: 'Acme', box1: cents(50000), box2: cents(5000) })],
    }

    const result = computeForm1040(model)
    const scopeItem = result.validation?.items.find(i => i.code === 'SUPPORTED_SCOPE')

    expect(scopeItem).toBeDefined()
    expect(scopeItem!.message).toContain('Foreign Tax Credit (Form 1116')
  })
})

// ── Edge Cases ───────────────────────────────────────────────────

describe('FTC edge cases', () => {
  it('handles zero-dollar dividends with foreign tax (data anomaly)', () => {
    const model: TaxReturn = {
      ...emptyTaxReturn(2025),
      form1099DIVs: [
        make1099DIV({ id: 'div-1', payerName: 'Strange Fund', box1a: 0, box7: cents(50) }),
      ],
    }

    const result = computeForeignTaxCredit(model, cents(50000), cents(8000))

    expect(result.applicable).toBe(true)
    expect(result.totalForeignTaxPaid).toBe(cents(50))
    expect(result.foreignSourceIncome).toBe(0)
    // With $0 foreign source income, limitation is $0
    expect(result.limitation).toBe(0)
    expect(result.creditAmount).toBe(0)
    expect(result.excessForeignTax).toBe(cents(50))
  })

  it('handles very large foreign tax amounts correctly', () => {
    const model = makeForeignDividendReturn({
      wages: 500000,
      divOrdinary: 100000,
      foreignTaxPaid: 25000, // 25% foreign rate
    })

    const taxableIncome = cents(585000)
    const usTax = cents(150000)
    const result = computeForeignTaxCredit(model, taxableIncome, usTax)

    expect(result.applicable).toBe(true)
    expect(result.totalForeignTaxPaid).toBe(cents(25000))

    // Limitation = $150,000 × ($100,000 / $585,000) ≈ $25,641
    const expectedLimitation = Math.round(usTax * cents(100000) / taxableIncome)
    expect(result.limitation).toBe(expectedLimitation)
    expect(result.creditAmount).toBe(cents(25000)) // taxes paid < limitation
  })

  it('handles rounding correctly in limitation computation', () => {
    // Use numbers that would produce fractional cents
    const model = makeForeignDividendReturn({
      wages: 77777,
      divOrdinary: 3333,
      foreignTaxPaid: 111,
    })

    const result = computeForeignTaxCredit(model, cents(66110), cents(9876))

    // Verify limitation is a whole cent amount
    expect(Number.isInteger(result.limitation)).toBe(true)
    expect(Number.isInteger(result.creditAmount)).toBe(true)
  })

  it('handles MFS filing status for direct credit threshold', () => {
    const model = makeForeignDividendReturn({
      wages: 60000,
      divOrdinary: 3000,
      foreignTaxPaid: 280,
      filingStatus: 'mfs',
    })

    const result = computeForeignTaxCredit(model, cents(48000), cents(7000))
    expect(result.directCreditElection).toBe(true) // $280 ≤ $300 (single threshold for MFS)
  })

  it('produces correct result with qualifying widower status', () => {
    const model = makeForeignDividendReturn({
      wages: 75000,
      divOrdinary: 4000,
      foreignTaxPaid: 200,
      filingStatus: 'qw',
    })

    const result = computeForeignTaxCredit(model, cents(64000), cents(9000))
    expect(result.applicable).toBe(true)
    expect(result.directCreditElection).toBe(true) // $200 ≤ $300
  })
})
