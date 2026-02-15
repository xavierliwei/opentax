/**
 * Tests for taxComputation.ts — bracket math and QDCG worksheet
 */

import { describe, it, expect } from 'vitest'
import { cents } from '../../src/model/traced'
import {
  computeBracketTax,
  computeOrdinaryTax,
  computeQDCGTax,
  netCapGainForQDCG,
} from '../../src/rules/2025/taxComputation'
import { INCOME_TAX_BRACKETS } from '../../src/rules/2025/constants'
import type { FilingStatus } from '../../src/model/types'

// ── computeBracketTax ────────────────────────────────────────────

describe('computeBracketTax', () => {
  const singleBrackets = INCOME_TAX_BRACKETS.single

  it('returns 0 for $0 income', () => {
    expect(computeBracketTax(0, singleBrackets)).toBe(0)
  })

  it('returns 0 for negative income', () => {
    expect(computeBracketTax(-100, singleBrackets)).toBe(0)
  })

  it('computes 10% bracket only — $10,000 single', () => {
    // $10,000 all in 10% bracket
    const tax = computeBracketTax(cents(10000), singleBrackets)
    expect(tax).toBe(cents(1000)) // $10,000 × 10% = $1,000
  })

  it('computes across two brackets — $30,000 single', () => {
    // 10% on $11,925 = $1,192.50
    // 12% on ($30,000 - $11,925) = 12% of $18,075 = $2,169
    // Total = $3,361.50
    const tax = computeBracketTax(cents(30000), singleBrackets)
    expect(tax).toBe(cents(3361.50))
  })

  it('computes the design doc test case — $60,000 single', () => {
    // 10% of $11,925 = $1,192.50
    // 12% of $36,550 = $4,386.00
    // 22% of $11,525 = $2,535.50
    // Total = $8,114.00
    const tax = computeBracketTax(cents(60000), singleBrackets)
    expect(tax).toBe(cents(8114))
  })

  it('handles income exactly at a bracket boundary — $11,925 single', () => {
    const tax = computeBracketTax(cents(11925), singleBrackets)
    expect(tax).toBe(cents(1192.50)) // all in 10% bracket
  })

  it('computes high income hitting 37% bracket — $700,000 single', () => {
    // 10% of $11,925 = $1,192.50
    // 12% of $36,550 = $4,386.00
    // 22% of $54,875 = $12,072.50
    // 24% of $93,950 = $22,548.00
    // 32% of $53,225 = $17,032.00
    // 35% of $375,825 = $131,538.75
    // 37% of ($700,000 - $626,350) = 37% of $73,650 = $27,250.50
    // Total = $216,020.25
    const tax = computeBracketTax(cents(700000), singleBrackets)
    expect(tax).toBe(cents(216020.25))
  })
})

// ── computeOrdinaryTax ──────────────────────────────────────────

describe('computeOrdinaryTax', () => {
  it('uses single brackets for single filers', () => {
    const tax = computeOrdinaryTax(cents(60000), 'single')
    expect(tax).toBe(cents(8114))
  })

  it('uses MFJ brackets for married filing jointly', () => {
    // $90,000 MFJ: 10% of $23,850 + 12% of $66,150
    // = $2,385 + $7,938 = $10,323
    const tax = computeOrdinaryTax(cents(90000), 'mfj')
    expect(tax).toBe(cents(10323))
  })

  it('uses MFS brackets', () => {
    // MFS brackets are the same as single for the first few brackets
    const tax = computeOrdinaryTax(cents(30000), 'mfs')
    const taxSingle = computeOrdinaryTax(cents(30000), 'single')
    expect(tax).toBe(taxSingle)
  })

  it('uses HoH brackets', () => {
    // $40,000 HoH: 10% of $17,000 + 12% of $23,000
    // = $1,700 + $2,760 = $4,460
    const tax = computeOrdinaryTax(cents(40000), 'hoh')
    expect(tax).toBe(cents(4460))
  })

  it('uses QW brackets (same as MFJ)', () => {
    const taxQW = computeOrdinaryTax(cents(90000), 'qw')
    const taxMFJ = computeOrdinaryTax(cents(90000), 'mfj')
    expect(taxQW).toBe(taxMFJ)
  })
})

// ── netCapGainForQDCG ───────────────────────────────────────────

describe('netCapGainForQDCG', () => {
  it('returns min of line15 and line16 when both positive', () => {
    expect(netCapGainForQDCG(cents(20000), cents(15000))).toBe(cents(15000))
    expect(netCapGainForQDCG(cents(10000), cents(25000))).toBe(cents(10000))
  })

  it('returns 0 when line15 is zero or negative', () => {
    expect(netCapGainForQDCG(0, cents(5000))).toBe(0)
    expect(netCapGainForQDCG(cents(-3000), cents(5000))).toBe(0)
  })

  it('returns 0 when line16 is zero or negative', () => {
    expect(netCapGainForQDCG(cents(10000), 0)).toBe(0)
    expect(netCapGainForQDCG(cents(10000), cents(-2000))).toBe(0)
  })

  it('returns 0 when both are negative', () => {
    expect(netCapGainForQDCG(cents(-5000), cents(-3000))).toBe(0)
  })
})

// ── computeQDCGTax ──────────────────────────────────────────────

describe('computeQDCGTax', () => {
  it('returns 0 for $0 taxable income', () => {
    expect(computeQDCGTax(0, cents(1000), cents(5000), 'single')).toBe(0)
  })

  it('falls back to ordinary tax when no preferential income', () => {
    const qdcgTax = computeQDCGTax(cents(60000), 0, 0, 'single')
    const ordinaryTax = computeOrdinaryTax(cents(60000), 'single')
    expect(qdcgTax).toBe(ordinaryTax)
  })

  it('computes LTCG at 0% when income is low enough — single', () => {
    // $40,000 taxable, $10,000 of that is LTCG
    // Ordinary: $30,000, LTCG: $10,000
    // LTCG sits at $30,000–$40,000, all below $48,350 → 0% rate
    // Ordinary tax: 10% of $11,925 + 12% of $18,075 = $1,192.50 + $2,169 = $3,361.50
    // LTCG tax: 0%
    // Total: $3,361.50
    const tax = computeQDCGTax(cents(40000), 0, cents(10000), 'single')
    expect(tax).toBe(cents(3361.50))
  })

  it('computes the design doc LTCG test case — single, $55k taxable, $20k LTCG', () => {
    // Ordinary: $35,000, LTCG: $20,000
    // Ordinary tax: 10% of $11,925 + 12% of $23,075 = $1,192.50 + $2,769 = $3,961.50
    // LTCG stacked $35,000–$55,000:
    //   0% bracket to $48,350 → $48,350 - $35,000 = $13,350 at 0% = $0
    //   15% bracket $48,350–$55,000 → $6,650 at 15% = $997.50
    // Total: $3,961.50 + $997.50 = $4,959
    const tax = computeQDCGTax(cents(55000), 0, cents(20000), 'single')
    expect(tax).toBe(cents(4959))
  })

  it('is less than all-ordinary tax', () => {
    const qdcgTax = computeQDCGTax(cents(55000), 0, cents(20000), 'single')
    const ordinaryTax = computeOrdinaryTax(cents(55000), 'single')
    expect(qdcgTax).toBeLessThan(ordinaryTax)
  })

  it('handles qualified dividends only (no LTCG)', () => {
    // $48,000 taxable, $3,000 qualified dividends, no cap gain
    // Ordinary: $45,000, QD: $3,000
    // Ordinary tax: 10% of $11,925 + 12% of $33,075 = $1,192.50 + $3,969 = $5,161.50
    // QD stacked $45,000–$48,000 → all below $48,350 → 0%
    // Total: $5,161.50
    const tax = computeQDCGTax(cents(48000), cents(3000), 0, 'single')
    expect(tax).toBe(cents(5161.50))
  })

  it('handles qualified dividends + LTCG combined', () => {
    // $47,000 taxable, $2,000 QD + $10,000 LTCG = $12,000 preferential
    // Ordinary: $35,000
    // Ordinary tax: 10% of $11,925 + 12% of $23,075 = $1,192.50 + $2,769 = $3,961.50
    // Preferential stacked $35,000–$47,000 → all below $48,350 → 0%
    // Total: $3,961.50
    const tax = computeQDCGTax(cents(47000), cents(2000), cents(10000), 'single')
    expect(tax).toBe(cents(3961.50))
  })

  it('computes 15% LTCG rate for higher income — single', () => {
    // $200,000 taxable, $50,000 LTCG
    // Ordinary: $150,000
    // Ordinary tax: 10% of $11,925 + 12% of $36,550 + 22% of $54,875 + 24% of $46,650
    //   = $1,192.50 + $4,386 + $12,072.50 + $11,196 = $28,847
    // LTCG stacked $150,000–$200,000: all between $48,350 and $533,400 → 15%
    //   15% of $50,000 = $7,500
    // Total: $28,847 + $7,500 = $36,347
    const tax = computeQDCGTax(cents(200000), 0, cents(50000), 'single')
    expect(tax).toBe(cents(36347))
  })

  it('computes 20% LTCG rate for very high income — single', () => {
    // $600,000 taxable, $100,000 LTCG
    // Ordinary: $500,000
    // LTCG stacked $500,000–$600,000:
    //   15% from $500,000 to $533,400 = $33,400 at 15% = $5,010
    //   20% from $533,400 to $600,000 = $66,600 at 20% = $13,320
    // LTCG tax: $18,330
    const ordinaryTax = computeOrdinaryTax(cents(500000), 'single')
    const totalTax = computeQDCGTax(cents(600000), 0, cents(100000), 'single')
    const ltcgPortion = totalTax - ordinaryTax
    expect(ltcgPortion).toBe(cents(18330))
  })

  it('caps preferential income at taxable income', () => {
    // $10,000 taxable, $20,000 LTCG (preferential > taxable)
    // Preferential capped to $10,000, ordinary = $0
    // LTCG stacked $0–$10,000 → 0% bracket → $0 tax
    const tax = computeQDCGTax(cents(10000), 0, cents(20000), 'single')
    expect(tax).toBe(0)
  })

  it('all preferential income — retiree with only QD', () => {
    // $30,000 taxable, all from qualified dividends
    // Ordinary: $0, QD: $30,000
    // QD stacked $0–$30,000 → 0% bracket → $0 tax
    const tax = computeQDCGTax(cents(30000), cents(30000), 0, 'single')
    expect(tax).toBe(0)
  })

  it('uses MFJ LTCG brackets', () => {
    // $90,000 taxable MFJ, $20,000 LTCG
    // Ordinary: $70,000
    // MFJ 0% LTCG bracket goes to $96,700
    // LTCG stacked $70,000–$90,000 → all below $96,700 → 0%
    // So only pay ordinary tax on $70,000
    const ordinaryTax = computeOrdinaryTax(cents(70000), 'mfj')
    const totalTax = computeQDCGTax(cents(90000), 0, cents(20000), 'mfj')
    expect(totalTax).toBe(ordinaryTax)
  })

  it('never exceeds all-ordinary tax (safety check)', () => {
    // Test various filing statuses and income levels
    const cases: { income: number; qd: number; cg: number; status: FilingStatus }[] = [
      { income: cents(50000), qd: cents(5000), cg: cents(10000), status: 'single' },
      { income: cents(100000), qd: cents(10000), cg: cents(30000), status: 'mfj' },
      { income: cents(80000), qd: 0, cg: cents(15000), status: 'hoh' },
      { income: cents(200000), qd: cents(20000), cg: cents(50000), status: 'mfs' },
    ]

    for (const c of cases) {
      const qdcgTax = computeQDCGTax(c.income, c.qd, c.cg, c.status)
      const ordinaryTax = computeOrdinaryTax(c.income, c.status)
      expect(qdcgTax).toBeLessThanOrEqual(ordinaryTax)
    }
  })
})
