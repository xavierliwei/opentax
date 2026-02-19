/**
 * Alternative Minimum Tax (AMT) — Form 6251 tests.
 *
 * Tests computeAMT and computeISOSpread against IRS rules for tax year 2025.
 * All amounts in integer cents unless noted.
 */

import { describe, it, expect } from 'vitest'
import { cents } from '../../src/model/traced'
import { computeAMT, computeISOSpread } from '../../src/rules/2025/amt'
import type { AMTResult } from '../../src/rules/2025/amt'
import type { ISOExercise } from '../../src/model/types'
import { computeOrdinaryTax, computeQDCGTax } from '../../src/rules/2025/taxComputation'
import { AMT_EXEMPTION, AMT_PHASEOUT_THRESHOLD, AMT_28_PERCENT_THRESHOLD } from '../../src/rules/2025/constants'

// ── Helper: compute regular tax for a given scenario ────────────

function regularTax(taxableIncome: number, filingStatus: 'single' | 'mfj' | 'mfs' | 'hoh' | 'qw', qualifiedDivs = 0, netLTCG = 0): number {
  if (qualifiedDivs > 0 || netLTCG > 0) {
    return computeQDCGTax(taxableIncome, qualifiedDivs, netLTCG, filingStatus)
  }
  return computeOrdinaryTax(taxableIncome, filingStatus)
}

// ── computeISOSpread ─────────────────────────────────────────────

describe('computeISOSpread', () => {
  it('computes spread for single ISO exercise', () => {
    const exercises: ISOExercise[] = [{
      id: 'iso-1',
      exerciseDate: '2025-06-15',
      symbol: 'ACME',
      sharesExercised: 1000,
      exercisePrice: cents(10),      // $10/share
      fmvAtExercise: cents(110),     // $110/share
    }]
    // Spread = ($110 - $10) × 1000 = $100,000
    expect(computeISOSpread(exercises)).toBe(cents(100000))
  })

  it('computes spread for multiple exercises', () => {
    const exercises: ISOExercise[] = [
      {
        id: 'iso-1',
        exerciseDate: '2025-03-15',
        symbol: 'ACME',
        sharesExercised: 500,
        exercisePrice: cents(20),
        fmvAtExercise: cents(50),
      },
      {
        id: 'iso-2',
        exerciseDate: '2025-09-01',
        symbol: 'BETA',
        sharesExercised: 200,
        exercisePrice: cents(30),
        fmvAtExercise: cents(100),
      },
    ]
    // ISO-1: ($50 - $20) × 500 = $15,000
    // ISO-2: ($100 - $30) × 200 = $14,000
    expect(computeISOSpread(exercises)).toBe(cents(29000))
  })

  it('ignores exercises where FMV <= exercise price (no spread)', () => {
    const exercises: ISOExercise[] = [{
      id: 'iso-1',
      exerciseDate: '2025-06-15',
      symbol: 'ACME',
      sharesExercised: 1000,
      exercisePrice: cents(50),
      fmvAtExercise: cents(40),  // underwater
    }]
    expect(computeISOSpread(exercises)).toBe(0)
  })

  it('returns 0 for empty array', () => {
    expect(computeISOSpread([])).toBe(0)
  })
})

// ── computeAMT — No AMT scenarios ──────────────────────────────

describe('computeAMT — no AMT', () => {
  it('regular W-2 worker: regular tax exceeds TMT', () => {
    // Single, $75K wages, standard deduction → taxable = $60K
    const taxableIncome = cents(60000)
    const regTax = regularTax(taxableIncome, 'single')
    const result = computeAMT(
      taxableIncome, regTax, 'single',
      0, [], 0, 0, 0,
    )
    expect(result.amt).toBe(0)
    expect(result.line4_amti).toBe(taxableIncome) // no add-backs
    expect(result.line9_reducedExemption).toBe(AMT_EXEMPTION.single) // full exemption
  })

  it('zero taxable income produces zero AMT', () => {
    const result = computeAMT(0, 0, 'single', 0, [], 0, 0, 0)
    expect(result.amt).toBe(0)
    expect(result.line4_amti).toBe(0)
    expect(result.line10_amtiAfterExemption).toBe(0)
    expect(result.tentativeMinimumTax).toBe(0)
  })

  it('MFJ standard filers with moderate income: no AMT', () => {
    const taxableIncome = cents(120000)
    const regTax = regularTax(taxableIncome, 'mfj')
    const result = computeAMT(
      taxableIncome, regTax, 'mfj',
      0, [], 0, 0, 0,
    )
    expect(result.amt).toBe(0)
    expect(result.line9_reducedExemption).toBe(AMT_EXEMPTION.mfj)
  })
})

// ── computeAMT — AMT from ISO exercises ─────────────────────────

describe('computeAMT — ISO exercises', () => {
  it('$100K ISO spread pushes AMTI above exemption', () => {
    // Single tech worker: $200K wages, standard deduction → $185K taxable
    // Plus $100K ISO spread for AMT
    const taxableIncome = cents(185000)
    const regTax = regularTax(taxableIncome, 'single')
    const isoExercises: ISOExercise[] = [{
      id: 'iso-1',
      exerciseDate: '2025-06-15',
      symbol: 'TECH',
      sharesExercised: 1000,
      exercisePrice: cents(10),
      fmvAtExercise: cents(110),
    }]

    const result = computeAMT(
      taxableIncome, regTax, 'single',
      0, isoExercises, 0, 0, 0,
    )

    // AMTI = $185K + $100K = $285K
    expect(result.line2i_isoSpread).toBe(cents(100000))
    expect(result.line4_amti).toBe(cents(285000))
    // Below $626,350 threshold → full exemption
    expect(result.line9_reducedExemption).toBe(AMT_EXEMPTION.single)
    // AMTI after exemption = $285K - $88,100 = $196,900
    expect(result.line10_amtiAfterExemption).toBe(cents(196900))
    // TMT at 26% (below $248,300 threshold)
    expect(result.tentativeMinimumTax).toBe(Math.round(cents(196900) * 0.26))
    // AMT = TMT - regular tax
    expect(result.amt).toBe(Math.max(0, result.tentativeMinimumTax - regTax))
    expect(result.amt).toBeGreaterThan(0)
  })

  it('large ISO spread with exemption phase-out', () => {
    // Single: $200K taxable + $500K ISO spread → AMTI = $700K
    const taxableIncome = cents(200000)
    const regTax = regularTax(taxableIncome, 'single')
    const isoExercises: ISOExercise[] = [{
      id: 'iso-1',
      exerciseDate: '2025-06-15',
      symbol: 'MEGA',
      sharesExercised: 5000,
      exercisePrice: cents(10),
      fmvAtExercise: cents(110),
    }]

    const result = computeAMT(
      taxableIncome, regTax, 'single',
      0, isoExercises, 0, 0, 0,
    )

    expect(result.line4_amti).toBe(cents(700000))
    // Phase-out: ($700K - $626,350) × 25% = $73,650 × 0.25 = $18,412.50
    const phaseOut = Math.round(cents(73650) * 0.25)
    expect(result.line8_phaseOutReduction).toBe(phaseOut)
    // Reduced exemption = $88,100 - $18,412.50
    expect(result.line9_reducedExemption).toBe(AMT_EXEMPTION.single - phaseOut)
    expect(result.amt).toBeGreaterThan(0)
  })
})

// ── computeAMT — AMT from SALT add-back ────────────────────────

describe('computeAMT — SALT add-back', () => {
  it('high SALT add-back triggers AMT for high-income itemizer', () => {
    // Single: $500K wages, itemized with $40K SALT
    // Taxable = $500K - $40K (SALT) - other deductions ≈ $460K
    // But for AMT, SALT is added back
    const taxableIncome = cents(460000)
    const regTax = regularTax(taxableIncome, 'single')
    const saltDeduction = cents(40000)

    const result = computeAMT(
      taxableIncome, regTax, 'single',
      saltDeduction, [], 0, 0, 0,
    )

    expect(result.line2a_saltAddBack).toBe(cents(40000))
    expect(result.line4_amti).toBe(cents(500000))
    // AMTI $500K < $626,350 → full exemption
    expect(result.line9_reducedExemption).toBe(AMT_EXEMPTION.single)
    // AMTI after exemption = $500K - $88,100 = $411,900
    expect(result.line10_amtiAfterExemption).toBe(cents(411900))
    // TMT crosses 28% bracket ($248,300 threshold)
    const amt28threshold = AMT_28_PERCENT_THRESHOLD.single
    const expectedTMT = Math.round(
      amt28threshold * 0.26 + (cents(411900) - amt28threshold) * 0.28
    )
    expect(result.tentativeMinimumTax).toBe(expectedTMT)
  })
})

// ── computeAMT — Exemption phase-out ───────────────────────────

describe('computeAMT — exemption phase-out', () => {
  it('AMTI exactly at phase-out threshold: full exemption', () => {
    const threshold = AMT_PHASEOUT_THRESHOLD.single
    const result = computeAMT(
      threshold, 0, 'single',
      0, [], 0, 0, 0,
    )
    expect(result.line8_phaseOutReduction).toBe(0)
    expect(result.line9_reducedExemption).toBe(AMT_EXEMPTION.single)
  })

  it('AMTI $1 above threshold: tiny reduction', () => {
    const threshold = AMT_PHASEOUT_THRESHOLD.single
    const result = computeAMT(
      threshold + 1, 0, 'single',
      0, [], 0, 0, 0,
    )
    // 25% of 1 cent = 0 (rounded)
    expect(result.line8_phaseOutReduction).toBe(Math.round(1 * 0.25))
  })

  it('exemption fully phased out at very high AMTI', () => {
    // Exemption $88,100 fully phases out when excess × 25% ≥ $88,100
    // Excess needed: $88,100 / 0.25 = $352,400
    // AMTI needed: $626,350 + $352,400 = $978,750
    const amti = cents(978750)
    const result = computeAMT(
      amti, 0, 'single',
      0, [], 0, 0, 0,
    )
    expect(result.line9_reducedExemption).toBe(0)
    expect(result.line10_amtiAfterExemption).toBe(amti)
  })

  it('MFJ: higher exemption and threshold', () => {
    const taxableIncome = cents(1300000)
    const regTax = regularTax(taxableIncome, 'mfj')
    const result = computeAMT(
      taxableIncome, regTax, 'mfj',
      0, [], 0, 0, 0,
    )
    // AMTI $1.3M > $1,252,700 threshold
    const excess = cents(1300000) - AMT_PHASEOUT_THRESHOLD.mfj
    const phaseOut = Math.round(excess * 0.25)
    expect(result.line8_phaseOutReduction).toBe(phaseOut)
    expect(result.line9_reducedExemption).toBe(Math.max(0, AMT_EXEMPTION.mfj - phaseOut))
  })
})

// ── computeAMT — MFS filing status ────────────────────────────

describe('computeAMT — MFS filing status', () => {
  it('uses half-thresholds for MFS', () => {
    const taxableIncome = cents(300000)
    const regTax = regularTax(taxableIncome, 'mfs')
    const result = computeAMT(
      taxableIncome, regTax, 'mfs',
      0, [], 0, 0, 0,
    )
    expect(result.line5_exemption).toBe(AMT_EXEMPTION.mfs)
    // $300K < $626,350 → full exemption
    expect(result.line9_reducedExemption).toBe(AMT_EXEMPTION.mfs)
  })

  it('MFS 28% bracket threshold is halved', () => {
    // MFS 28% threshold = $124,150
    const taxableIncome = cents(400000)
    const regTax = regularTax(taxableIncome, 'mfs')
    const result = computeAMT(
      taxableIncome, regTax, 'mfs',
      0, [], 0, 0, 0,
    )
    // AMTI after exemption should cross into 28% bracket
    const amtiAfterExemption = result.line10_amtiAfterExemption
    const threshold28 = AMT_28_PERCENT_THRESHOLD.mfs
    if (amtiAfterExemption > threshold28) {
      const expectedTMT = Math.round(
        threshold28 * 0.26 + (amtiAfterExemption - threshold28) * 0.28
      )
      expect(result.tentativeMinimumTax).toBe(expectedTMT)
    }
  })
})

// ── computeAMT — with qualified dividends ───────────────────────

describe('computeAMT — with qualified dividends / LTCG', () => {
  it('qualified dividends taxed at preferential rates within AMT', () => {
    // Single: $300K taxable with $50K qualified dividends
    const taxableIncome = cents(300000)
    const qualifiedDivs = cents(50000)
    const regTax = regularTax(taxableIncome, 'single', qualifiedDivs)

    // Add SALT to trigger AMT
    const saltDeduction = cents(40000)
    const result = computeAMT(
      taxableIncome, regTax, 'single',
      saltDeduction, [], 0, qualifiedDivs, 0,
    )

    // The QDCG variant should produce lower TMT than flat 26%/28%
    // because $50K of qualified divs get 0%/15%/20% instead of 26%
    const amtiAfterExemption = result.line10_amtiAfterExemption

    // Compute what flat 26%/28% would produce
    const threshold28 = AMT_28_PERCENT_THRESHOLD.single
    let flatTMT: number
    if (amtiAfterExemption <= threshold28) {
      flatTMT = Math.round(amtiAfterExemption * 0.26)
    } else {
      flatTMT = Math.round(threshold28 * 0.26 + (amtiAfterExemption - threshold28) * 0.28)
    }
    expect(result.tentativeMinimumTax).toBeLessThanOrEqual(flatTMT)
  })

  it('net LTCG taxed at preferential rates within AMT', () => {
    const taxableIncome = cents(350000)
    const netLTCG = cents(80000)
    const regTax = regularTax(taxableIncome, 'single', 0, netLTCG)
    const saltDeduction = cents(35000)

    const result = computeAMT(
      taxableIncome, regTax, 'single',
      saltDeduction, [], 0, 0, netLTCG,
    )

    // QDCG variant should not exceed flat AMT
    const amtiAfterExemption = result.line10_amtiAfterExemption
    const threshold28 = AMT_28_PERCENT_THRESHOLD.single
    let flatTMT: number
    if (amtiAfterExemption <= threshold28) {
      flatTMT = Math.round(amtiAfterExemption * 0.26)
    } else {
      flatTMT = Math.round(threshold28 * 0.26 + (amtiAfterExemption - threshold28) * 0.28)
    }
    expect(result.tentativeMinimumTax).toBeLessThanOrEqual(flatTMT)
  })
})

// ── computeAMT — Combined preference items ─────────────────────

describe('computeAMT — combined preference items', () => {
  it('ISO spread + SALT add-back combined', () => {
    const taxableIncome = cents(200000)
    const regTax = regularTax(taxableIncome, 'single')
    const saltDeduction = cents(30000)
    const isoExercises: ISOExercise[] = [{
      id: 'iso-1',
      exerciseDate: '2025-06-15',
      symbol: 'TECH',
      sharesExercised: 500,
      exercisePrice: cents(20),
      fmvAtExercise: cents(120),
    }]
    // ISO spread = ($120 - $20) × 500 = $50,000

    const result = computeAMT(
      taxableIncome, regTax, 'single',
      saltDeduction, isoExercises, 0, 0, 0,
    )

    expect(result.line2a_saltAddBack).toBe(cents(30000))
    expect(result.line2i_isoSpread).toBe(cents(50000))
    // AMTI = $200K + $30K + $50K = $280K
    expect(result.line4_amti).toBe(cents(280000))
    expect(result.amt).toBeGreaterThan(0)
  })
})

// ── computeAMT — 26%/28% bracket boundary ─────────────────────

describe('computeAMT — bracket boundary', () => {
  it('AMTI after exemption exactly at 28% threshold: all taxed at 26%', () => {
    // Single: 28% threshold = $248,300
    // We need AMTI after exemption = $248,300
    // AMTI after exemption = max(0, AMTI - reducedExemption)
    // If AMTI < phase-out threshold, reducedExemption = $88,100
    // So AMTI = $248,300 + $88,100 = $336,400
    const amti = cents(336400)
    const result = computeAMT(
      amti, 0, 'single',
      0, [], 0, 0, 0,
    )

    expect(result.line10_amtiAfterExemption).toBe(AMT_28_PERCENT_THRESHOLD.single)
    expect(result.tentativeMinimumTax).toBe(Math.round(AMT_28_PERCENT_THRESHOLD.single * 0.26))
  })

  it('AMTI after exemption $1 above 28% threshold', () => {
    const amti = cents(336400) + 1 // 1 cent above
    const result = computeAMT(
      amti, 0, 'single',
      0, [], 0, 0, 0,
    )

    const afterExemption = result.line10_amtiAfterExemption
    const threshold = AMT_28_PERCENT_THRESHOLD.single
    expect(afterExemption).toBe(threshold + 1)
    const expectedTMT = Math.round(threshold * 0.26 + 1 * 0.28)
    expect(result.tentativeMinimumTax).toBe(expectedTMT)
  })
})

// ── Integration: AMT wired through Form 1040 ─────────────────

describe('computeAMT — integration with Form 1040', () => {
  it('regular W-2 filer produces $0 AMT through full pipeline', async () => {
    // Import dynamically to avoid circular issues
    const { computeForm1040 } = await import('../../src/rules/2025/form1040')
    const { emptyTaxReturn } = await import('../../src/model/types')
    const { makeW2 } = await import('../fixtures/returns')

    const model = {
      ...emptyTaxReturn(2025),
      w2s: [makeW2({
        id: 'w2-1',
        employerName: 'Acme Corp',
        box1: cents(75000),
        box2: cents(8000),
      })],
    }

    const result = computeForm1040(model)
    expect(result.line17.amount).toBe(0)
    expect(result.amtResult).not.toBeNull()
    expect(result.amtResult!.amt).toBe(0)
  })

  it('ISO exercise produces nonzero AMT through full pipeline', async () => {
    const { computeForm1040 } = await import('../../src/rules/2025/form1040')
    const { emptyTaxReturn } = await import('../../src/model/types')
    const { makeW2 } = await import('../fixtures/returns')

    const model = {
      ...emptyTaxReturn(2025),
      w2s: [makeW2({
        id: 'w2-1',
        employerName: 'TechCo',
        box1: cents(200000),
        box2: cents(40000),
      })],
      isoExercises: [{
        id: 'iso-1',
        exerciseDate: '2025-06-15',
        symbol: 'TECH',
        sharesExercised: 2000,
        exercisePrice: cents(10),
        fmvAtExercise: cents(110),
      }],
    }

    const result = computeForm1040(model)
    expect(result.line17.amount).toBeGreaterThan(0)
    expect(result.amtResult!.amt).toBeGreaterThan(0)
    expect(result.amtResult!.line2i_isoSpread).toBe(cents(200000))
    // Line 18 should include AMT
    expect(result.line18.amount).toBe(result.line16.amount + result.line17.amount)
  })
})
