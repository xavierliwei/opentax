/**
 * Real-world capital gains scenarios.
 *
 * Each test models a realistic tax situation and verifies
 * Form 8949 grouping + Schedule D computation end-to-end.
 */

import { describe, it, expect } from 'vitest'
import { cents } from '../../src/model/traced'
import { emptyTaxReturn } from '../../src/model/types'
import { computeForm8949, getCategoryTotals } from '../../src/rules/2025/form8949'
import { computeScheduleD } from '../../src/rules/2025/scheduleD'
import {
  allCategoriesReturn,
  rsuSaleReturn,
  activeTraderReturn,
  bearMarketReturn,
  capGainDistOnlyReturn,
  taxLossHarvestReturn,
  makeTransaction,
  make1099DIV,
} from '../fixtures/returns'

// ── Scenario: All 4 Form 8949 categories ───────────────────────

describe('Scenario: all 4 categories (covered + non-covered, ST + LT)', () => {
  const tr = allCategoriesReturn()

  it('has transactions in all 4 categories', () => {
    const f8949 = computeForm8949(tr.capitalTransactions)
    expect(f8949.byCategory['A']).toBeDefined()
    expect(f8949.byCategory['B']).toBeDefined()
    expect(f8949.byCategory['D']).toBeDefined()
    expect(f8949.byCategory['E']).toBeDefined()
  })

  it('category A: 1 trade, net +$3,000', () => {
    const f8949 = computeForm8949(tr.capitalTransactions)
    const catA = getCategoryTotals(f8949, 'A')
    expect(catA.transactions).toHaveLength(1)
    expect(catA.totalGainLoss.amount).toBe(cents(3000))
  })

  it('category B: 1 trade, net -$600', () => {
    const f8949 = computeForm8949(tr.capitalTransactions)
    const catB = getCategoryTotals(f8949, 'B')
    expect(catB.transactions).toHaveLength(1)
    expect(catB.totalGainLoss.amount).toBe(cents(-600))
  })

  it('category D: 2 trades, net +$25,000', () => {
    const f8949 = computeForm8949(tr.capitalTransactions)
    const catD = getCategoryTotals(f8949, 'D')
    expect(catD.transactions).toHaveLength(2)
    expect(catD.totalGainLoss.amount).toBe(cents(10000) + cents(15000))
  })

  it('category E: 1 trade (inherited stock), net +$39,000', () => {
    const f8949 = computeForm8949(tr.capitalTransactions)
    const catE = getCategoryTotals(f8949, 'E')
    expect(catE.transactions).toHaveLength(1)
    expect(catE.totalGainLoss.amount).toBe(cents(39000))
  })

  it('Schedule D: net ST = +$2,400', () => {
    const result = computeScheduleD(tr)
    // Category A: +$3,000, Category B: -$600
    expect(result.line7.amount).toBe(cents(2400))
  })

  it('Schedule D: net LT = +$64,000', () => {
    const result = computeScheduleD(tr)
    // Category D: +$25,000, Category E: +$39,000
    expect(result.line15.amount).toBe(cents(64000))
  })

  it('Schedule D: Line 16 = +$66,400', () => {
    const result = computeScheduleD(tr)
    expect(result.line16.amount).toBe(cents(66400))
  })

  it('Schedule D: Line 21 = Line 16 (gain, no limitation)', () => {
    const result = computeScheduleD(tr)
    expect(result.line21.amount).toBe(result.line16.amount)
  })

  it('category B transaction has adjustment code and amount', () => {
    const catBTx = tr.capitalTransactions.find(t => t.category === 'B')!
    expect(catBTx.adjustmentCode).toBe('B')
    expect(catBTx.adjustmentAmount).toBe(cents(1800))
    expect(catBTx.reportedBasis).toBe(0)
  })
})

// ── Scenario: RSU sale with $0 reported basis ──────────────────

describe('Scenario: RSU sale with basis adjustment', () => {
  const tr = rsuSaleReturn()

  it('has one transaction linked to RSU vest', () => {
    expect(tr.capitalTransactions).toHaveLength(1)
    expect(tr.capitalTransactions[0].linkedRsuVestId).toBe('rsu-vest-1')
  })

  it('reported basis is $0 (broker 1099-B)', () => {
    expect(tr.capitalTransactions[0].reportedBasis).toBe(0)
  })

  it('adjusted basis is $32,500 (FMV at vest × shares)', () => {
    expect(tr.capitalTransactions[0].adjustedBasis).toBe(cents(32500))
  })

  it('adjustment amount = $32,500 (corrected - reported)', () => {
    expect(tr.capitalTransactions[0].adjustmentAmount).toBe(cents(32500))
  })

  it('adjustment code = B', () => {
    expect(tr.capitalTransactions[0].adjustmentCode).toBe('B')
  })

  it('actual gain = $3,250 (not $35,750)', () => {
    expect(tr.capitalTransactions[0].gainLoss).toBe(cents(3250))
  })

  it('categorized as E (long-term, basis not reported)', () => {
    expect(tr.capitalTransactions[0].category).toBe('E')
  })

  it('Schedule D Line 21 = $3,250 (correct gain)', () => {
    const result = computeScheduleD(tr)
    expect(result.line21.amount).toBe(cents(3250))
  })

  it('double-tax savings = $32,500 of avoided phantom income', () => {
    // Without adjustment: gain would be $35,750
    // With adjustment: gain is $3,250
    // Difference: $32,500 of income not double-taxed
    const tx = tr.capitalTransactions[0]
    const phantomGain = tx.proceeds - tx.reportedBasis
    const actualGain = tx.gainLoss
    expect(phantomGain - actualGain).toBe(cents(32500))
  })
})

// ── Scenario: Active trader (20 trades) ────────────────────────

describe('Scenario: active trader with 20 trades', () => {
  const tr = activeTraderReturn()

  it('has 20 transactions total', () => {
    expect(tr.capitalTransactions).toHaveLength(20)
  })

  it('12 short-term (category A) + 8 long-term (category D)', () => {
    const f8949 = computeForm8949(tr.capitalTransactions)
    expect(getCategoryTotals(f8949, 'A').transactions).toHaveLength(12)
    expect(getCategoryTotals(f8949, 'D').transactions).toHaveLength(8)
  })

  it('net short-term gain = +$3,500', () => {
    // +400-400+1700-2000+1200+3000-600+0+1500-300+700-1700 = +$3,500
    const result = computeScheduleD(tr)
    expect(result.line7.amount).toBe(cents(3500))
  })

  it('net long-term gain = +$19,700', () => {
    // +7000+10000+3000-3000-700+4500+400-1500 = +$19,700
    const result = computeScheduleD(tr)
    expect(result.line15.amount).toBe(cents(19700))
  })

  it('Line 16 = +$23,200', () => {
    const result = computeScheduleD(tr)
    expect(result.line16.amount).toBe(cents(23200))
  })

  it('no carryforward (net gain)', () => {
    const result = computeScheduleD(tr)
    expect(result.capitalLossCarryforward).toBe(0)
  })

  it('all proceeds sum correctly', () => {
    const f8949 = computeForm8949(tr.capitalTransactions)
    const catA = getCategoryTotals(f8949, 'A')
    const catD = getCategoryTotals(f8949, 'D')

    // ST proceeds: 5200+3100+8900+2100+6700+12000+1800+4500+7800+3300+2900+1100 = $59,400
    expect(catA.totalProceeds.amount).toBe(cents(59400))
    // LT proceeds: 25000+32000+15000+8000+4500+19000+6200+3000 = $112,700
    expect(catD.totalProceeds.amount).toBe(cents(112700))
  })
})

// ── Scenario: Bear market (all losses) ─────────────────────────

describe('Scenario: bear market — all losses', () => {
  const tr = bearMarketReturn()

  it('net short-term loss = -$8,500', () => {
    const result = computeScheduleD(tr)
    // -$6,000 + (-$2,500) = -$8,500
    expect(result.line7.amount).toBe(cents(-8500))
  })

  it('net long-term loss = -$12,000', () => {
    const result = computeScheduleD(tr)
    // -$7,500 + (-$4,500) = -$12,000
    expect(result.line15.amount).toBe(cents(-12000))
  })

  it('Line 16 (combined) = -$20,500', () => {
    const result = computeScheduleD(tr)
    expect(result.line16.amount).toBe(cents(-20500))
  })

  it('Line 21 = -$3,000 (limited)', () => {
    const result = computeScheduleD(tr)
    expect(result.line21.amount).toBe(cents(-3000))
  })

  it('carryforward = $17,500', () => {
    const result = computeScheduleD(tr)
    expect(result.capitalLossCarryforward).toBe(cents(17500))
  })

  it('MFS filer: Line 21 = -$1,500, carryforward = $19,000', () => {
    const mfsTr = { ...tr, filingStatus: 'mfs' as const }
    const result = computeScheduleD(mfsTr)
    expect(result.line21.amount).toBe(cents(-1500))
    expect(result.capitalLossCarryforward).toBe(cents(19000))
  })
})

// ── Scenario: Capital gain distributions only ──────────────────

describe('Scenario: mutual fund — capital gain distributions only', () => {
  const tr = capGainDistOnlyReturn()

  it('no Form 8949 transactions', () => {
    const result = computeScheduleD(tr)
    expect(result.form8949.categories).toHaveLength(0)
  })

  it('Line 13 = $7,700 (sum of 1099-DIV Box 2a)', () => {
    const result = computeScheduleD(tr)
    expect(result.line13.amount).toBe(cents(7700))
  })

  it('net ST (Line 7) = $0', () => {
    const result = computeScheduleD(tr)
    expect(result.line7.amount).toBe(0)
  })

  it('net LT (Line 15) = $7,700 (from distributions)', () => {
    const result = computeScheduleD(tr)
    expect(result.line15.amount).toBe(cents(7700))
  })

  it('Line 16 = $7,700', () => {
    const result = computeScheduleD(tr)
    expect(result.line16.amount).toBe(cents(7700))
  })

  it('Line 21 = $7,700 (gain, no limitation)', () => {
    const result = computeScheduleD(tr)
    expect(result.line21.amount).toBe(cents(7700))
  })
})

// ── Scenario: Tax-loss harvesting ──────────────────────────────

describe('Scenario: tax-loss harvesting (ST losses offset LT gains)', () => {
  const tr = taxLossHarvestReturn()

  it('net short-term = -$12,500', () => {
    const result = computeScheduleD(tr)
    // -$8,000 + (-$4,500) = -$12,500
    expect(result.line7.amount).toBe(cents(-12500))
  })

  it('net long-term = +$20,000', () => {
    const result = computeScheduleD(tr)
    expect(result.line15.amount).toBe(cents(20000))
  })

  it('Line 16 = +$7,500 (ST loss offsets LT gain)', () => {
    const result = computeScheduleD(tr)
    // -$12,500 + $20,000 = +$7,500
    expect(result.line16.amount).toBe(cents(7500))
  })

  it('Line 21 = +$7,500 (gain, no limitation needed)', () => {
    const result = computeScheduleD(tr)
    expect(result.line21.amount).toBe(result.line16.amount)
  })

  it('no carryforward (net is a gain)', () => {
    const result = computeScheduleD(tr)
    expect(result.capitalLossCarryforward).toBe(0)
  })

  it('the $12,500 ST loss effectively reduced taxable capital gain', () => {
    // Without harvesting: Line 16 would be +$20,000 (just the LT gain)
    // With harvesting: Line 16 is +$7,500
    // Tax savings depends on rate, but the income reduction is clear
    const result = computeScheduleD(tr)
    const ltOnly = result.line15.amount
    const combined = result.line16.amount
    expect(ltOnly - combined).toBe(cents(12500))
  })
})

// ── Scenario: Break-even (gains = losses) ──────────────────────

describe('Scenario: gains exactly equal losses', () => {
  it('Line 16 = $0, no limitation, no carryforward', () => {
    const tr = {
      ...emptyTaxReturn(2025),
      capitalTransactions: [
        makeTransaction({
          id: 'tx-win',
          proceeds: cents(10000),
          adjustedBasis: cents(5000),  // +$5,000
          longTerm: true,
          category: 'D',
        }),
        makeTransaction({
          id: 'tx-loss',
          proceeds: cents(3000),
          adjustedBasis: cents(8000),  // -$5,000
          longTerm: false,
          category: 'A',
        }),
      ],
    }
    const result = computeScheduleD(tr)
    expect(result.line16.amount).toBe(0)
    expect(result.line21.amount).toBe(0)
    expect(result.capitalLossCarryforward).toBe(0)
  })
})

// ── Scenario: Worthless securities ($0 proceeds) ───────────────

describe('Scenario: worthless securities', () => {
  it('$0 proceeds produces full loss equal to basis', () => {
    const tr = {
      ...emptyTaxReturn(2025),
      capitalTransactions: [
        makeTransaction({
          id: 'tx-worthless',
          description: '1000 sh BANKRUPT',
          proceeds: 0,
          adjustedBasis: cents(15000),
          longTerm: true,
          category: 'D',
        }),
      ],
    }
    const result = computeScheduleD(tr)
    expect(result.line16.amount).toBe(cents(-15000))
    expect(result.line21.amount).toBe(cents(-3000))
    expect(result.capitalLossCarryforward).toBe(cents(12000))
  })
})

// ── Scenario: Cap gain distributions + 8949 trades combined ────

describe('Scenario: distributions + trades combined on Schedule D', () => {
  it('Line 15 combines 8949 LT gains with 1099-DIV distributions', () => {
    const tr = {
      ...emptyTaxReturn(2025),
      form1099DIVs: [
        make1099DIV({ id: 'div-1', payerName: 'Vanguard', box1a: cents(1000), box2a: cents(3000) }),
      ],
      capitalTransactions: [
        makeTransaction({
          id: 'tx-1',
          proceeds: cents(12000),
          adjustedBasis: cents(8000),  // +$4,000
          longTerm: true,
          category: 'D',
        }),
        makeTransaction({
          id: 'tx-2',
          proceeds: cents(2000),
          adjustedBasis: cents(5000),  // -$3,000
          longTerm: true,
          category: 'D',
        }),
      ],
    }
    const result = computeScheduleD(tr)
    // 8949 LT net: $4,000 + (-$3,000) = +$1,000
    // Distributions: +$3,000
    // Line 15: $1,000 + $3,000 = $4,000
    expect(result.line15.amount).toBe(cents(4000))
    expect(result.line16.amount).toBe(cents(4000))
  })
})

// ── Cross-checks ───────────────────────────────────────────────

describe('cross-checks across all scenarios', () => {
  const scenarios = [
    { name: 'all categories', fn: allCategoriesReturn },
    { name: 'RSU sale', fn: rsuSaleReturn },
    { name: 'active trader', fn: activeTraderReturn },
    { name: 'bear market', fn: bearMarketReturn },
    { name: 'cap gain dist only', fn: capGainDistOnlyReturn },
    { name: 'tax-loss harvest', fn: taxLossHarvestReturn },
  ]

  for (const { name, fn } of scenarios) {
    describe(name, () => {
      it('Line 16 = Line 7 + Line 15', () => {
        const result = computeScheduleD(fn())
        expect(result.line16.amount).toBe(result.line7.amount + result.line15.amount)
      })

      it('Line 21 ≤ Line 16 when gain, ≥ Line 16 when loss', () => {
        const result = computeScheduleD(fn())
        if (result.line16.amount >= 0) {
          expect(result.line21.amount).toBe(result.line16.amount)
        } else {
          expect(result.line21.amount).toBeGreaterThanOrEqual(result.line16.amount)
          expect(result.line21.amount).toBeLessThanOrEqual(0)
        }
      })

      it('carryforward ≥ 0', () => {
        const result = computeScheduleD(fn())
        expect(result.capitalLossCarryforward).toBeGreaterThanOrEqual(0)
      })

      it('|Line 21| + carryforward = |Line 16| when loss', () => {
        const result = computeScheduleD(fn())
        if (result.line16.amount < 0) {
          expect(Math.abs(result.line21.amount) + result.capitalLossCarryforward)
            .toBe(Math.abs(result.line16.amount))
        }
      })
    })
  }
})
