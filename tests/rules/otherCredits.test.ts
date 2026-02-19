/**
 * Other Credits tests — Dependent Care, Saver's Credit, Energy Credit.
 *
 * Tests individual credit modules and integration via computeForm1040 Line 20.
 */

import { describe, it, expect } from 'vitest'
import { cents } from '../../src/model/traced'
import { emptyTaxReturn } from '../../src/model/types'
import type { TaxReturn } from '../../src/model/types'
import { computeDependentCareCredit } from '../../src/rules/2025/dependentCareCredit'
import { computeSaversCredit } from '../../src/rules/2025/saversCredit'
import { computeEnergyCredit } from '../../src/rules/2025/energyCredit'
import { computeForm1040 } from '../../src/rules/2025/form1040'
import { makeW2, makeDependent } from '../fixtures/returns'

// ── Dependent Care Credit ──────────────────────────────────────

describe('computeDependentCareCredit', () => {
  it('1 person, $5K expenses → capped at $3K', () => {
    const result = computeDependentCareCredit(
      { totalExpenses: cents(5000), numQualifyingPersons: 1 },
      [],
      cents(25000),   // AGI
      cents(30000),   // earned income
    )
    expect(result.numQualifyingPersons).toBe(1)
    expect(result.expenseLimit).toBe(cents(3000))
    expect(result.allowableExpenses).toBe(cents(3000))
    // AGI $25K → ($25K - $15K) / $2K = 5 steps → 35% - 5% = 30%
    expect(result.creditRate).toBe(0.30)
    expect(result.creditAmount).toBe(cents(900))
  })

  it('2+ persons, $8K expenses → capped at $6K', () => {
    const result = computeDependentCareCredit(
      { totalExpenses: cents(8000), numQualifyingPersons: 2 },
      [],
      cents(20000),
      cents(20000),
    )
    expect(result.expenseLimit).toBe(cents(6000))
    expect(result.allowableExpenses).toBe(cents(6000))
  })

  it('AGI $15K → 35% rate (no reduction)', () => {
    const result = computeDependentCareCredit(
      { totalExpenses: cents(3000), numQualifyingPersons: 1 },
      [],
      cents(15000),
      cents(20000),
    )
    expect(result.creditRate).toBe(0.35)
    expect(result.creditAmount).toBe(cents(1050))
  })

  it('AGI $43K+ → 20% floor rate', () => {
    const result = computeDependentCareCredit(
      { totalExpenses: cents(3000), numQualifyingPersons: 1 },
      [],
      cents(50000),
      cents(60000),
    )
    // ($50K - $15K) / $2K = 17.5 → floor(17.5) = 17 steps → 35% - 17% = 18%... wait
    // Actually for AGI = $45K: ($45K-$15K)/$2K = 15 steps → 35-15=20% (the floor)
    // For AGI = $50K: ($50K-$15K)/$2K = 17 steps → 35-17=18% → clamped to 20%
    expect(result.creditRate).toBe(0.20)
  })

  it('no expenses → $0 credit', () => {
    const result = computeDependentCareCredit(
      { totalExpenses: 0, numQualifyingPersons: 1 },
      [],
      cents(30000),
      cents(30000),
    )
    expect(result.creditAmount).toBe(0)
  })

  it('earned income < expenses → earned income used as allowable', () => {
    const result = computeDependentCareCredit(
      { totalExpenses: cents(5000), numQualifyingPersons: 1 },
      [],
      cents(2000),
      cents(2000),   // earned income is only $2K
    )
    expect(result.allowableExpenses).toBe(cents(2000))  // limited to earned income
  })

  it('auto-detects qualifying persons from dependents under 13', () => {
    const deps = [
      makeDependent({ firstName: 'Toddler', dateOfBirth: '2020-05-01', relationship: 'son' }),
      makeDependent({ firstName: 'Teen', dateOfBirth: '2010-01-01', relationship: 'daughter' }),
    ]
    const result = computeDependentCareCredit(
      { totalExpenses: cents(5000), numQualifyingPersons: 0 },  // 0 = auto
      deps,
      cents(30000),
      cents(30000),
    )
    // Toddler: 2025 - 2020 = 5 (under 13) ✓
    // Teen: 2025 - 2010 = 15 (NOT under 13)
    expect(result.numQualifyingPersons).toBe(1)
    expect(result.expenseLimit).toBe(cents(3000))
  })
})

// ── Saver's Credit ─────────────────────────────────────────────

describe('computeSaversCredit', () => {
  it('single, AGI $20K, $2K IRA → 50% rate → $1,000', () => {
    const result = computeSaversCredit(
      { traditionalIRA: cents(2000), rothIRA: 0 },
      [],
      'single',
      cents(20000),
    )
    expect(result.creditRate).toBe(0.50)
    expect(result.eligibleContributions).toBe(cents(2000))
    expect(result.creditAmount).toBe(cents(1000))
  })

  it('MFJ, AGI $50K → 20% rate', () => {
    const result = computeSaversCredit(
      { traditionalIRA: cents(3000), rothIRA: 0 },
      [],
      'mfj',
      cents(50000),
    )
    // MFJ thresholds: rate50=$47,500, rate20=$51,000
    // AGI $50K > $47,500, ≤ $51,000 → 20%
    expect(result.creditRate).toBe(0.20)
    // MFJ max eligible = $4,000
    expect(result.eligibleContributions).toBe(cents(3000))
    expect(result.creditAmount).toBe(cents(600))
  })

  it('single, AGI above $39K threshold → 0% rate', () => {
    const result = computeSaversCredit(
      { traditionalIRA: cents(2000), rothIRA: 0 },
      [],
      'single',
      cents(40000),
    )
    expect(result.creditRate).toBe(0)
    expect(result.creditAmount).toBe(0)
  })

  it('W-2 Box 12 code D auto-derived', () => {
    const w2s = [
      makeW2({
        id: 'w2-1',
        employerName: 'Corp',
        box1: cents(30000),
        box2: cents(3000),
        box12: [{ code: 'D', amount: cents(5000) }],
      }),
    ]
    const result = computeSaversCredit(
      { traditionalIRA: 0, rothIRA: 0 },
      w2s,
      'single',
      cents(20000),
    )
    expect(result.electiveDeferrals).toBe(cents(5000))
    expect(result.totalContributions).toBe(cents(5000))
    // Capped at $2,000 single
    expect(result.eligibleContributions).toBe(cents(2000))
    expect(result.creditRate).toBe(0.50)
    expect(result.creditAmount).toBe(cents(1000))
  })

  it('IRA + W-2 combined, capped at $2K single / $4K MFJ', () => {
    const w2s = [
      makeW2({
        id: 'w2-1',
        employerName: 'Corp',
        box1: cents(30000),
        box2: cents(3000),
        box12: [{ code: 'E', amount: cents(3000) }],
      }),
    ]
    const result = computeSaversCredit(
      { traditionalIRA: cents(1000), rothIRA: cents(500) },
      w2s,
      'mfj',
      cents(45000),
    )
    // Total = $3K (W-2) + $1K + $0.5K = $4,500
    // MFJ cap = $4,000
    expect(result.eligibleContributions).toBe(cents(4000))
    expect(result.creditRate).toBe(0.50)
    expect(result.creditAmount).toBe(cents(2000))
  })

  it('no contributions → $0', () => {
    const result = computeSaversCredit(
      { traditionalIRA: 0, rothIRA: 0 },
      [],
      'single',
      cents(20000),
    )
    expect(result.creditAmount).toBe(0)
  })

  it('HOH, AGI $36K → 20% rate', () => {
    const result = computeSaversCredit(
      { traditionalIRA: cents(2000), rothIRA: 0 },
      [],
      'hoh',
      cents(36000),
    )
    // HOH: rate50=$35,625, rate20=$38,250
    // AGI $36K > $35,625, ≤ $38,250 → 20%
    expect(result.creditRate).toBe(0.20)
  })
})

// ── Energy Credit ──────────────────────────────────────────────

describe('computeEnergyCredit', () => {
  it('$20K solar → $6,000 Part I credit', () => {
    const result = computeEnergyCredit({
      solarElectric: cents(20000),
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
    })
    expect(result.partIBasis).toBe(cents(20000))
    expect(result.partICredit).toBe(cents(6000))
    expect(result.totalCredit).toBe(cents(6000))
  })

  it('heat pump capped at $2,000', () => {
    const result = computeEnergyCredit({
      solarElectric: 0,
      solarWaterHeating: 0,
      batteryStorage: 0,
      geothermal: 0,
      insulation: 0,
      windows: 0,
      exteriorDoors: 0,
      centralAC: 0,
      waterHeater: 0,
      heatPump: cents(10000),   // 30% = $3,000, capped at $2,000
      homeEnergyAudit: 0,
      biomassStove: 0,
    })
    expect(result.partIIHeatPumpCredit).toBe(cents(2000))
    expect(result.totalCredit).toBe(cents(2000))
  })

  it('windows exceed $600 sub-cap', () => {
    const result = computeEnergyCredit({
      solarElectric: 0,
      solarWaterHeating: 0,
      batteryStorage: 0,
      geothermal: 0,
      insulation: 0,
      windows: cents(1000),  // capped at $600 before 30%
      exteriorDoors: 0,
      centralAC: 0,
      waterHeater: 0,
      heatPump: 0,
      homeEnergyAudit: 0,
      biomassStove: 0,
    })
    // Windows capped to $600, then 30% = $180
    expect(result.partIIGeneralCredit).toBe(cents(180))
    expect(result.totalCredit).toBe(cents(180))
  })

  it('Part II general items capped at $1,200', () => {
    const result = computeEnergyCredit({
      solarElectric: 0,
      solarWaterHeating: 0,
      batteryStorage: 0,
      geothermal: 0,
      insulation: cents(3000),
      windows: cents(600),
      exteriorDoors: cents(500),
      centralAC: cents(2000),
      waterHeater: 0,
      heatPump: 0,
      homeEnergyAudit: 0,
      biomassStove: 0,
    })
    // General basis = $3,000 + $600 + $500 + $2,000 = $6,100
    // 30% = $1,830, capped at $1,200
    expect(result.partIIGeneralCredit).toBe(cents(1200))
  })

  it('both parts combined', () => {
    const result = computeEnergyCredit({
      solarElectric: cents(15000),
      solarWaterHeating: 0,
      batteryStorage: cents(5000),
      geothermal: 0,
      insulation: cents(2000),
      windows: 0,
      exteriorDoors: 0,
      centralAC: 0,
      waterHeater: 0,
      heatPump: cents(5000),
      homeEnergyAudit: 0,
      biomassStove: 0,
    })
    // Part I: ($15K + $5K) × 30% = $6,000
    expect(result.partICredit).toBe(cents(6000))
    // Heat pump: min($5K × 30%, $2K) = min($1,500, $2,000) = $1,500
    expect(result.partIIHeatPumpCredit).toBe(cents(1500))
    // General: $2K × 30% = $600 (under $1,200 cap)
    expect(result.partIIGeneralCredit).toBe(cents(600))
    // Total: $6,000 + $1,500 + $600 = $8,100
    expect(result.totalCredit).toBe(cents(8100))
  })

  it('all zeros → $0', () => {
    const result = computeEnergyCredit({
      solarElectric: 0, solarWaterHeating: 0, batteryStorage: 0, geothermal: 0,
      insulation: 0, windows: 0, exteriorDoors: 0, centralAC: 0,
      waterHeater: 0, heatPump: 0, homeEnergyAudit: 0, biomassStove: 0,
    })
    expect(result.totalCredit).toBe(0)
  })

  it('doors sub-cap $500', () => {
    const result = computeEnergyCredit({
      solarElectric: 0, solarWaterHeating: 0, batteryStorage: 0, geothermal: 0,
      insulation: 0, windows: 0, exteriorDoors: cents(800), centralAC: 0,
      waterHeater: 0, heatPump: 0, homeEnergyAudit: 0, biomassStove: 0,
    })
    // Doors capped to $500, 30% = $150
    expect(result.partIIGeneralCredit).toBe(cents(150))
  })

  it('audit sub-cap $150', () => {
    const result = computeEnergyCredit({
      solarElectric: 0, solarWaterHeating: 0, batteryStorage: 0, geothermal: 0,
      insulation: 0, windows: 0, exteriorDoors: 0, centralAC: 0,
      waterHeater: 0, heatPump: 0, homeEnergyAudit: cents(300), biomassStove: 0,
    })
    // Audit capped to $150, 30% = $45
    expect(result.partIIGeneralCredit).toBe(cents(45))
  })
})

// ── Integration — computeForm1040 ─────────────────────────────

describe('Form 1040 Line 20 integration', () => {
  function lowIncomeWithCareReturn(): TaxReturn {
    return {
      ...emptyTaxReturn(2025),
      filingStatus: 'single',
      w2s: [
        makeW2({
          id: 'w2-1',
          employerName: 'Main St Shop',
          box1: cents(30000),
          box2: cents(2000),
        }),
      ],
      dependents: [
        makeDependent({ firstName: 'Toddler', dateOfBirth: '2020-05-01', relationship: 'daughter' }),
      ],
      dependentCare: {
        totalExpenses: cents(5000),
        numQualifyingPersons: 1,
      },
    }
  }

  function saversCreditReturn(): TaxReturn {
    return {
      ...emptyTaxReturn(2025),
      filingStatus: 'single',
      w2s: [
        makeW2({
          id: 'w2-1',
          employerName: 'Main St Shop',
          box1: cents(20000),
          box2: cents(1000),
        }),
      ],
      retirementContributions: {
        traditionalIRA: cents(2000),
        rothIRA: 0,
      },
    }
  }

  function energyCreditReturn(): TaxReturn {
    return {
      ...emptyTaxReturn(2025),
      filingStatus: 'single',
      w2s: [
        makeW2({
          id: 'w2-1',
          employerName: 'Acme Corp',
          box1: cents(80000),
          box2: cents(10000),
        }),
      ],
      energyCredits: {
        solarElectric: cents(20000),
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
  }

  it('dependent care populates Line 20', () => {
    const result = computeForm1040(lowIncomeWithCareReturn())
    expect(result.dependentCareCredit).not.toBeNull()
    expect(result.dependentCareCredit!.creditAmount).toBeGreaterThan(0)
    expect(result.line20.amount).toBe(result.dependentCareCredit!.creditAmount)
  })

  it('savers credit populates Line 20', () => {
    const result = computeForm1040(saversCreditReturn())
    expect(result.saversCredit).not.toBeNull()
    expect(result.saversCredit!.creditAmount).toBeGreaterThan(0)
    expect(result.line20.amount).toBe(result.saversCredit!.creditAmount)
  })

  it('energy credit populates Line 20', () => {
    const result = computeForm1040(energyCreditReturn())
    expect(result.energyCredit).not.toBeNull()
    expect(result.energyCredit!.totalCredit).toBe(cents(6000))
    expect(result.line20.amount).toBe(cents(6000))
  })

  it('Line 20 flows through to Line 21 → 22 → 24', () => {
    const result = computeForm1040(energyCreditReturn())
    // Line 21 = Line 19 + Line 20
    expect(result.line21.amount).toBe(result.line19.amount + result.line20.amount)
    // Line 22 = max(0, Line 18 - Line 21)
    expect(result.line22.amount).toBe(Math.max(0, result.line18.amount - result.line21.amount))
    // Line 24 = Line 22 + Line 23
    expect(result.line24.amount).toBe(result.line22.amount + result.line23.amount)
  })

  it('all three credits combined', () => {
    const tr: TaxReturn = {
      ...emptyTaxReturn(2025),
      filingStatus: 'single',
      w2s: [
        makeW2({
          id: 'w2-1',
          employerName: 'Corp',
          box1: cents(25000),
          box2: cents(2000),
        }),
      ],
      dependents: [
        makeDependent({ firstName: 'Kid', dateOfBirth: '2020-01-01', relationship: 'son' }),
      ],
      dependentCare: {
        totalExpenses: cents(3000),
        numQualifyingPersons: 1,
      },
      retirementContributions: {
        traditionalIRA: cents(1000),
        rothIRA: 0,
      },
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
    const result = computeForm1040(tr)
    const expectedLine20 =
      (result.dependentCareCredit?.creditAmount ?? 0) +
      (result.saversCredit?.creditAmount ?? 0) +
      (result.energyCredit?.totalCredit ?? 0)
    expect(result.line20.amount).toBe(expectedLine20)
    expect(result.line20.amount).toBeGreaterThan(0)
  })

  it('no credit inputs → Line 20 = $0', () => {
    const tr = emptyTaxReturn(2025)
    tr.w2s = [makeW2({ id: 'w2-1', employerName: 'Corp', box1: cents(50000), box2: cents(5000) })]
    const result = computeForm1040(tr)
    expect(result.line20.amount).toBe(0)
    expect(result.dependentCareCredit).toBeNull()
    expect(result.saversCredit).toBeNull()
    expect(result.energyCredit).toBeNull()
  })
})
