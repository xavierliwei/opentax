/**
 * Tests for Form 1040 Lines 10–37 and the full computeForm1040 orchestrator.
 *
 * Includes the design doc's test scenarios:
 * 1. Simple W-2 ($75k wages → owes $114)
 * 2. LTCG preferential rate ($50k wages + $20k LTCG)
 * 3. Zero income
 * 4. Boundary cases
 * 5. MFJ test
 * 6. Withholding aggregation
 */

import { describe, it, expect } from 'vitest'
import { cents } from '../../src/model/traced'
import { emptyTaxReturn } from '../../src/model/types'
import type { TaxReturn } from '../../src/model/types'
import {
  computeLine10,
  computeLine11,
  computeLine12,
  computeLine13,
  computeLine14,
  computeLine15,
  computeLine25,
  computeLine34,
  computeLine37,
  computeForm1040,
} from '../../src/rules/2025/form1040'
import { makeW2, make1099INT, make1099DIV, makeTransaction, simpleW2Return } from '../fixtures/returns'
import { STANDARD_DEDUCTION } from '../../src/rules/2025/constants'
import { tracedFromComputation } from '../../src/model/traced'

// ── Individual line tests ────────────────────────────────────────

describe('Line 10 — Adjustments to income', () => {
  it('returns $0 (placeholder for MVP)', () => {
    const model = emptyTaxReturn(2025)
    expect(computeLine10(model).amount).toBe(0)
  })
})

describe('Line 11 — AGI', () => {
  it('equals Line 9 minus Line 10', () => {
    const line9 = tracedFromComputation(cents(75000), 'form1040.line9', [])
    const line10 = tracedFromComputation(0, 'form1040.line10', [])
    const line11 = computeLine11(line9, line10)
    expect(line11.amount).toBe(cents(75000))
  })
})

describe('Line 12 — Deductions', () => {
  it('uses standard deduction for single filer', () => {
    const model = simpleW2Return()
    const { deduction } = computeLine12(model, cents(75000))
    expect(deduction.amount).toBe(STANDARD_DEDUCTION.single)
  })

  it('uses MFJ standard deduction', () => {
    const model = { ...emptyTaxReturn(2025), filingStatus: 'mfj' as const }
    const { deduction } = computeLine12(model, cents(120000))
    expect(deduction.amount).toBe(STANDARD_DEDUCTION.mfj)
  })

  it('uses itemized when higher than standard (with Schedule A rules)', () => {
    const model: TaxReturn = {
      ...emptyTaxReturn(2025),
      deductions: {
        method: 'itemized',
        itemized: {
          medicalExpenses: 0,
          stateLocalTaxes: cents(10000),  // under $40K SALT cap
          mortgageInterest: cents(8000),
          charitableCash: cents(2000),
          charitableNoncash: 0,
          otherDeductions: 0,
        },
      },
    }
    // Schedule A: SALT $10K (under $40K cap), mortgage $8K, charitable $2K → $20,000 > standard $15,000
    const { deduction, scheduleA } = computeLine12(model, cents(100000))
    expect(deduction.amount).toBe(cents(20000))
    expect(scheduleA).not.toBeNull()
    expect(scheduleA!.line17.amount).toBe(cents(20000))
  })

  it('falls back to standard when itemized is lower', () => {
    const model: TaxReturn = {
      ...emptyTaxReturn(2025),
      deductions: {
        method: 'itemized',
        itemized: {
          medicalExpenses: 0,
          stateLocalTaxes: cents(5000),
          mortgageInterest: cents(3000),
          charitableCash: cents(1000),
          charitableNoncash: 0,
          otherDeductions: 0,
        },
      },
    }
    // Schedule A total: $9,000 < standard $15,000
    const { deduction, scheduleA } = computeLine12(model, cents(100000))
    expect(deduction.amount).toBe(STANDARD_DEDUCTION.single)
    // Schedule A still computed (for comparison display)
    expect(scheduleA).not.toBeNull()
  })

  it('returns null scheduleA when using standard deduction method', () => {
    const model = simpleW2Return()
    const { scheduleA } = computeLine12(model, cents(75000))
    expect(scheduleA).toBeNull()
  })
})

describe('Line 13 — QBI deduction', () => {
  it('returns $0 (placeholder for MVP)', () => {
    expect(computeLine13().amount).toBe(0)
  })
})

describe('Line 14 — Total deductions', () => {
  it('equals Line 12 + Line 13', () => {
    const line12 = tracedFromComputation(cents(15000), 'form1040.line12', [])
    const line13 = tracedFromComputation(0, 'form1040.line13', [])
    const result = computeLine14(line12, line13)
    expect(result.amount).toBe(cents(15000))
  })
})

describe('Line 15 — Taxable income', () => {
  it('equals Line 11 minus Line 14', () => {
    const line11 = tracedFromComputation(cents(75000), 'form1040.line11', [])
    const line14 = tracedFromComputation(cents(15000), 'form1040.line14', [])
    const result = computeLine15(line11, line14)
    expect(result.amount).toBe(cents(60000))
  })

  it('floors at $0 when deductions exceed income', () => {
    const line11 = tracedFromComputation(cents(10000), 'form1040.line11', [])
    const line14 = tracedFromComputation(cents(15000), 'form1040.line14', [])
    const result = computeLine15(line11, line14)
    expect(result.amount).toBe(0)
  })
})

describe('Line 25 — Federal tax withheld', () => {
  it('sums W-2 Box 2', () => {
    const model: TaxReturn = {
      ...emptyTaxReturn(2025),
      w2s: [
        makeW2({ id: 'w2-1', employerName: 'A', box1: cents(50000), box2: cents(5000) }),
        makeW2({ id: 'w2-2', employerName: 'B', box1: cents(40000), box2: cents(4000) }),
      ],
    }
    const result = computeLine25(model)
    expect(result.amount).toBe(cents(9000))
  })

  it('includes 1099-INT Box 4 withholding', () => {
    const model: TaxReturn = {
      ...emptyTaxReturn(2025),
      w2s: [makeW2({ id: 'w2-1', employerName: 'A', box1: cents(50000), box2: cents(5000) })],
      form1099INTs: [
        make1099INT({ id: 'int-1', payerName: 'Bank', box1: cents(1000), box4: cents(100) }),
      ],
    }
    const result = computeLine25(model)
    expect(result.amount).toBe(cents(5100))
  })

  it('includes 1099-DIV Box 4 withholding', () => {
    const model: TaxReturn = {
      ...emptyTaxReturn(2025),
      w2s: [makeW2({ id: 'w2-1', employerName: 'A', box1: cents(50000), box2: cents(5000) })],
      form1099DIVs: [
        make1099DIV({ id: 'div-1', payerName: 'Fund', box1a: cents(2000), box4: cents(200) }),
      ],
    }
    const result = computeLine25(model)
    expect(result.amount).toBe(cents(5200))
  })

  it('returns $0 with no documents', () => {
    const model = emptyTaxReturn(2025)
    expect(computeLine25(model).amount).toBe(0)
  })
})

describe('Line 34/37 — Overpayment and amount owed', () => {
  it('shows overpayment when payments > tax', () => {
    const line33 = tracedFromComputation(cents(10000), 'form1040.line33', [])
    const line24 = tracedFromComputation(cents(8000), 'form1040.line24', [])
    const result = computeLine34(line33, line24)
    expect(result.amount).toBe(cents(2000))
  })

  it('shows $0 overpayment when tax > payments', () => {
    const line33 = tracedFromComputation(cents(8000), 'form1040.line33', [])
    const line24 = tracedFromComputation(cents(10000), 'form1040.line24', [])
    expect(computeLine34(line33, line24).amount).toBe(0)
  })

  it('shows amount owed when tax > payments', () => {
    const line24 = tracedFromComputation(cents(10000), 'form1040.line24', [])
    const line33 = tracedFromComputation(cents(8000), 'form1040.line33', [])
    expect(computeLine37(line24, line33).amount).toBe(cents(2000))
  })

  it('shows $0 owed when payments > tax', () => {
    const line24 = tracedFromComputation(cents(8000), 'form1040.line24', [])
    const line33 = tracedFromComputation(cents(10000), 'form1040.line33', [])
    expect(computeLine37(line24, line33).amount).toBe(0)
  })

  it('both are $0 when exactly equal', () => {
    const line24 = tracedFromComputation(cents(8000), 'form1040.line24', [])
    const line33 = tracedFromComputation(cents(8000), 'form1040.line33', [])
    expect(computeLine34(line33, line24).amount).toBe(0)
    expect(computeLine37(line24, line33).amount).toBe(0)
  })
})

// ── Full Form 1040 integration tests (design doc scenarios) ─────

describe('computeForm1040 — Simple W-2 test', () => {
  // Single, $75,000 wages, $8,000 withheld, standard deduction, no investments
  const result = computeForm1040(simpleW2Return())

  it('computes AGI = $75,000', () => {
    expect(result.line11.amount).toBe(cents(75000))
  })

  it('applies standard deduction = $15,000', () => {
    expect(result.line12.amount).toBe(STANDARD_DEDUCTION.single)
    expect(result.line12.amount).toBe(cents(15000))
  })

  it('computes taxable income = $60,000', () => {
    expect(result.line15.amount).toBe(cents(60000))
  })

  it('computes tax = $8,114 (ordinary rates)', () => {
    // 10% of $11,925 + 12% of $36,550 + 22% of $11,525
    expect(result.line16.amount).toBe(cents(8114))
  })

  it('Line 24 (total tax) = Line 16 for MVP', () => {
    expect(result.line24.amount).toBe(result.line16.amount)
  })

  it('withholding = $8,000', () => {
    expect(result.line25.amount).toBe(cents(8000))
  })

  it('owes $114', () => {
    expect(result.line37.amount).toBe(cents(114))
    expect(result.line34.amount).toBe(0) // no refund
  })

  it('does not compute Schedule D (no capital activity)', () => {
    expect(result.scheduleD).toBeNull()
  })
})

describe('computeForm1040 — LTCG preferential rate test', () => {
  // Single, $50,000 wages + $20,000 long-term capital gain
  function ltcgReturn(): TaxReturn {
    return {
      ...emptyTaxReturn(2025),
      w2s: [
        makeW2({ id: 'w2-1', employerName: 'Acme', box1: cents(50000), box2: cents(10000) }),
      ],
      capitalTransactions: [
        makeTransaction({
          id: 'tx-ltcg',
          description: '100 sh VTI',
          dateAcquired: '2023-01-01',
          dateSold: '2025-06-01',
          proceeds: cents(30000),
          adjustedBasis: cents(10000),
          longTerm: true,
          category: 'D',
        }),
      ],
    }
  }

  const result = computeForm1040(ltcgReturn())

  it('computes AGI = $70,000', () => {
    // $50,000 wages + $20,000 capital gain
    expect(result.line11.amount).toBe(cents(70000))
  })

  it('computes taxable income = $55,000', () => {
    expect(result.line15.amount).toBe(cents(55000))
  })

  it('uses QDCG worksheet for lower tax', () => {
    // QDCG: ordinary tax on $35,000 + LTCG at 0%/15%
    // = $3,961.50 + $0 + $997.50 = $4,959
    expect(result.line16.amount).toBe(cents(4959))
  })

  it('tax is less than all-ordinary would be', () => {
    // All-ordinary on $55,000 = $7,014
    expect(result.line16.amount).toBeLessThan(cents(7014))
  })

  it('computes Schedule D', () => {
    expect(result.scheduleD).not.toBeNull()
    expect(result.scheduleD!.line16.amount).toBe(cents(20000))
  })

  it('refund = $10,000 - $4,959 = $5,041', () => {
    expect(result.line34.amount).toBe(cents(5041))
    expect(result.line37.amount).toBe(0)
  })
})

describe('computeForm1040 — Zero income test', () => {
  const result = computeForm1040(emptyTaxReturn(2025))

  it('AGI = $0', () => {
    expect(result.line11.amount).toBe(0)
  })

  it('taxable income = $0 (deduction > income, floored)', () => {
    expect(result.line15.amount).toBe(0)
  })

  it('tax = $0', () => {
    expect(result.line16.amount).toBe(0)
  })

  it('no refund and no amount owed', () => {
    expect(result.line34.amount).toBe(0)
    expect(result.line37.amount).toBe(0)
  })
})

describe('computeForm1040 — Boundary: deduction equals income', () => {
  function boundaryReturn(): TaxReturn {
    return {
      ...emptyTaxReturn(2025),
      w2s: [
        makeW2({ id: 'w2-1', employerName: 'Acme', box1: cents(15000), box2: 0 }),
      ],
    }
  }

  const result = computeForm1040(boundaryReturn())

  it('AGI = $15,000', () => {
    expect(result.line11.amount).toBe(cents(15000))
  })

  it('taxable income = $0', () => {
    // $15,000 - $15,000 standard deduction = $0
    expect(result.line15.amount).toBe(0)
  })

  it('tax = $0', () => {
    expect(result.line16.amount).toBe(0)
  })
})

describe('computeForm1040 — MFJ test', () => {
  function mfjReturn(): TaxReturn {
    return {
      ...emptyTaxReturn(2025),
      filingStatus: 'mfj',
      w2s: [
        makeW2({ id: 'w2-1', employerName: 'Acme', box1: cents(70000), box2: cents(8000) }),
        makeW2({ id: 'w2-2', employerName: 'Beta', box1: cents(50000), box2: cents(7000) }),
      ],
    }
  }

  const result = computeForm1040(mfjReturn())

  it('computes AGI = $120,000', () => {
    expect(result.line11.amount).toBe(cents(120000))
  })

  it('applies MFJ standard deduction = $30,000', () => {
    expect(result.line12.amount).toBe(cents(30000))
  })

  it('computes taxable income = $90,000', () => {
    expect(result.line15.amount).toBe(cents(90000))
  })

  it('computes tax using MFJ brackets = $10,323', () => {
    // 10% of $23,850 = $2,385
    // 12% of $66,150 = $7,938
    // Total = $10,323
    expect(result.line16.amount).toBe(cents(10323))
  })

  it('withholding = $15,000', () => {
    expect(result.line25.amount).toBe(cents(15000))
  })

  it('refund = $4,677', () => {
    expect(result.line34.amount).toBe(cents(4677))
    expect(result.line37.amount).toBe(0)
  })
})

describe('computeForm1040 — Withholding aggregation', () => {
  function withholdingReturn(): TaxReturn {
    return {
      ...emptyTaxReturn(2025),
      w2s: [
        makeW2({ id: 'w2-1', employerName: 'Acme', box1: cents(40000), box2: cents(4000) }),
        makeW2({ id: 'w2-2', employerName: 'Beta', box1: cents(30000), box2: cents(3000) }),
      ],
      form1099INTs: [
        make1099INT({ id: 'int-1', payerName: 'Bank', box1: cents(200), box4: cents(50) }),
      ],
    }
  }

  const result = computeForm1040(withholdingReturn())

  it('AGI = $70,200', () => {
    expect(result.line11.amount).toBe(cents(70200))
  })

  it('total withholding = $7,050', () => {
    // $4,000 + $3,000 + $50
    expect(result.line25.amount).toBe(cents(7050))
  })

  it('includes 1099-INT withholding in trace', () => {
    const source = result.line25.source
    expect(source.kind).toBe('computed')
    if (source.kind === 'computed') {
      expect(source.inputs).toContain('1099int:int-1:box4')
    }
  })
})

describe('computeForm1040 — Qualified dividends test', () => {
  function qdReturn(): TaxReturn {
    return {
      ...emptyTaxReturn(2025),
      w2s: [
        makeW2({ id: 'w2-1', employerName: 'Acme', box1: cents(60000), box2: cents(8000) }),
      ],
      form1099DIVs: [
        make1099DIV({
          id: 'div-1',
          payerName: 'Vanguard',
          box1a: cents(3000),   // ordinary dividends
          box1b: cents(3000),   // all qualified
        }),
      ],
    }
  }

  const result = computeForm1040(qdReturn())

  it('AGI = $63,000 (wages + ordinary dividends)', () => {
    expect(result.line11.amount).toBe(cents(63000))
  })

  it('taxable income = $48,000', () => {
    expect(result.line15.amount).toBe(cents(48000))
  })

  it('uses QDCG worksheet', () => {
    // Ordinary: $45,000, QD: $3,000
    // QD sits at $45,000–$48,000, all below $48,350 → 0%
    // Tax = ordinary tax on $45,000 = $5,161.50
    expect(result.line16.amount).toBe(cents(5161.50))
  })

  it('is less than all-ordinary tax', () => {
    // All-ordinary on $48,000:
    // 10% of $11,925 + 12% of $36,075 = $1,192.50 + $4,329 = $5,521.50
    expect(result.line16.amount).toBeLessThan(cents(5521.50))
  })
})

describe('computeForm1040 — W-2 with investments (existing fixture)', () => {
  // $90,000 wages + $3,300 interest + $3,000 dividends ($1,500 qualified) + $500 cap gain dist
  function investmentsReturn(): TaxReturn {
    return {
      ...emptyTaxReturn(2025),
      w2s: [
        makeW2({ id: 'w2-1', employerName: 'Acme', box1: cents(90000), box2: cents(12000) }),
      ],
      form1099INTs: [
        make1099INT({ id: 'int-1', payerName: 'Chase', box1: cents(2500) }),
        make1099INT({ id: 'int-2', payerName: 'Ally', box1: cents(800) }),
      ],
      form1099DIVs: [
        make1099DIV({
          id: 'div-1',
          payerName: 'Schwab',
          box1a: cents(3000),
          box1b: cents(1500),
          box2a: cents(500),  // cap gain distribution
        }),
      ],
    }
  }

  const result = computeForm1040(investmentsReturn())

  it('AGI = $96,800 (wages + interest + dividends + cap gain dist)', () => {
    // $90,000 + $3,300 + $3,000 + $500
    expect(result.line11.amount).toBe(cents(96800))
  })

  it('has Schedule D for cap gain distribution', () => {
    expect(result.scheduleD).not.toBeNull()
    expect(result.scheduleD!.line13.amount).toBe(cents(500))
  })

  it('taxable income = $81,800', () => {
    expect(result.line15.amount).toBe(cents(81800))
  })

  it('uses QDCG worksheet (has qualified dividends + LTCG)', () => {
    // $1,500 QD + $500 net CG for QDCG = $2,000 preferential
    // Ordinary: $79,800
    // Ordinary tax: 10% of $11,925 + 12% of $36,550 + 22% of $31,325
    //   = $1,192.50 + $4,386 + $6,891.50 = $12,470
    // LTCG stacked $79,800–$81,800 → 15% bracket
    //   15% of $2,000 = $300
    // Total: $12,770
    expect(result.line16.amount).toBe(cents(12770))
  })
})

describe('computeForm1040 — Capital loss reduces income', () => {
  // $80,000 wages + net -$5,000 capital loss → only -$3,000 deductible
  function capitalLossReturn(): TaxReturn {
    return {
      ...emptyTaxReturn(2025),
      w2s: [
        makeW2({ id: 'w2-1', employerName: 'Acme', box1: cents(80000), box2: cents(10000) }),
      ],
      capitalTransactions: [
        makeTransaction({
          id: 'tx-loss',
          description: 'RIVN',
          proceeds: cents(3000),
          adjustedBasis: cents(10000),
          longTerm: true,
          category: 'D',
        }),
        makeTransaction({
          id: 'tx-gain',
          description: 'NVDA',
          proceeds: cents(5000),
          adjustedBasis: cents(3000),
          longTerm: true,
          category: 'D',
        }),
      ],
    }
  }

  const result = computeForm1040(capitalLossReturn())

  it('Line 7 = -$3,000 (capital loss limited)', () => {
    expect(result.line7.amount).toBe(cents(-3000))
  })

  it('AGI = $77,000 (wages - capital loss deduction)', () => {
    expect(result.line11.amount).toBe(cents(77000))
  })

  it('taxable income = $62,000', () => {
    expect(result.line15.amount).toBe(cents(62000))
  })

  it('carryforward = $2,000', () => {
    expect(result.scheduleD!.capitalLossCarryforward).toBe(cents(2000))
  })
})

// ── Trace / IRS citation tests ──────────────────────────────────

describe('IRS citations on new lines', () => {
  const result = computeForm1040(simpleW2Return())

  it('Line 11 cites Form 1040, Line 11', () => {
    expect(result.line11.irsCitation).toBe('Form 1040, Line 11')
  })

  it('Line 12 cites Form 1040, Line 12', () => {
    expect(result.line12.irsCitation).toBe('Form 1040, Line 12')
  })

  it('Line 15 cites Form 1040, Line 15', () => {
    expect(result.line15.irsCitation).toBe('Form 1040, Line 15')
  })

  it('Line 16 cites Form 1040, Line 16', () => {
    expect(result.line16.irsCitation).toBe('Form 1040, Line 16')
  })

  it('Line 25 cites Form 1040, Line 25', () => {
    expect(result.line25.irsCitation).toBe('Form 1040, Line 25')
  })

  it('Line 37 cites Form 1040, Line 37', () => {
    expect(result.line37.irsCitation).toBe('Form 1040, Line 37')
  })
})

// ── Cross-line consistency checks ───────────────────────────────

describe('Cross-line consistency', () => {
  const result = computeForm1040(simpleW2Return())

  it('Line 9 = Line 1a + 2b + 3b + 7 + 8', () => {
    const expected =
      result.line1a.amount +
      result.line2b.amount +
      result.line3b.amount +
      result.line7.amount +
      result.line8.amount
    expect(result.line9.amount).toBe(expected)
  })

  it('Line 11 = Line 9 - Line 10', () => {
    expect(result.line11.amount).toBe(result.line9.amount - result.line10.amount)
  })

  it('Line 14 = Line 12 + Line 13', () => {
    expect(result.line14.amount).toBe(result.line12.amount + result.line13.amount)
  })

  it('Line 15 = max(0, Line 11 - Line 14)', () => {
    expect(result.line15.amount).toBe(Math.max(0, result.line11.amount - result.line14.amount))
  })

  it('Line 24 = Line 16 (MVP: no additional taxes)', () => {
    expect(result.line24.amount).toBe(result.line16.amount)
  })

  it('Line 33 = Line 25 (MVP: no estimated payments)', () => {
    expect(result.line33.amount).toBe(result.line25.amount)
  })

  it('exactly one of Line 34 or Line 37 is non-zero (or both zero)', () => {
    // Can't have both a refund and amount owed
    expect(result.line34.amount * result.line37.amount).toBe(0)
  })

  it('Line 34 - Line 37 = Line 33 - Line 24', () => {
    expect(result.line34.amount - result.line37.amount)
      .toBe(result.line33.amount - result.line24.amount)
  })
})
