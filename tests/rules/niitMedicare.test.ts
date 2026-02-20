/**
 * Tests for Net Investment Income Tax (Form 8960) and
 * Additional Medicare Tax (Form 8959).
 */

import { describe, it, expect } from 'vitest'
import { cents } from '../../src/model/traced'
import { emptyTaxReturn } from '../../src/model/types'
import type { TaxReturn } from '../../src/model/types'
import {
  computeNIIT,
  computeAdditionalMedicareTax,
  computeForm1040,
} from '../../src/rules/2025/form1040'
import {
  NIIT_RATE,
  NIIT_THRESHOLD,
  ADDITIONAL_MEDICARE_RATE,
  ADDITIONAL_MEDICARE_THRESHOLD,
  MEDICARE_TAX_RATE,
} from '../../src/rules/2025/constants'
import { makeW2, make1099INT, make1099DIV } from '../fixtures/returns'

// ── NIIT Tests ────────────────────────────────────────────────────

describe('Net Investment Income Tax (Form 8960)', () => {
  it('returns $0 when AGI is below threshold', () => {
    const model: TaxReturn = {
      ...emptyTaxReturn(2025),
      form1099INTs: [make1099INT({ id: 'i1', payerName: 'Bank', box1: cents(5000) })],
    }
    // AGI $100K, single threshold $200K → no NIIT
    const result = computeNIIT(model, cents(100000), 0, 0)
    expect(result.niitAmount).toBe(0)
    expect(result.magiExcess).toBe(0)
  })

  it('computes NIIT on interest income when AGI exceeds threshold', () => {
    const model: TaxReturn = {
      ...emptyTaxReturn(2025),
      form1099INTs: [make1099INT({ id: 'i1', payerName: 'Bank', box1: cents(30000) })],
    }
    // AGI $220K, single threshold $200K
    // MAGI excess = $20K, NII = $30K interest
    // NIIT = 3.8% * min($30K, $20K) = 3.8% * $20K = $760
    const result = computeNIIT(model, cents(220000), 0, 0)
    expect(result.nii).toBe(cents(30000))
    expect(result.magiExcess).toBe(cents(20000))
    expect(result.niitAmount).toBe(Math.round(cents(20000) * NIIT_RATE))
  })

  it('uses NII when it is less than MAGI excess', () => {
    const model: TaxReturn = {
      ...emptyTaxReturn(2025),
      form1099INTs: [make1099INT({ id: 'i1', payerName: 'Bank', box1: cents(10000) })],
    }
    // AGI $300K, single threshold $200K
    // MAGI excess = $100K, NII = $10K
    // NIIT = 3.8% * min($10K, $100K) = 3.8% * $10K = $380
    const result = computeNIIT(model, cents(300000), 0, 0)
    expect(result.niitAmount).toBe(Math.round(cents(10000) * NIIT_RATE))
  })

  it('includes dividends and capital gains in NII', () => {
    const model: TaxReturn = {
      ...emptyTaxReturn(2025),
      form1099INTs: [make1099INT({ id: 'i1', payerName: 'Bank', box1: cents(5000) })],
      form1099DIVs: [make1099DIV({ id: 'd1', payerName: 'Vanguard', box1a: cents(8000) })],
    }
    // NII = $5K interest + $8K dividends + $20K cap gain = $33K
    // AGI $250K, MAGI excess = $50K
    // NIIT = 3.8% * min($33K, $50K) = 3.8% * $33K
    const result = computeNIIT(model, cents(250000), cents(20000), 0)
    expect(result.nii).toBe(cents(33000))
    expect(result.niitAmount).toBe(Math.round(cents(33000) * NIIT_RATE))
  })

  it('includes rental income from Schedule E', () => {
    const model: TaxReturn = {
      ...emptyTaxReturn(2025),
      form1099INTs: [make1099INT({ id: 'i1', payerName: 'Bank', box1: cents(5000) })],
    }
    // NII = $5K interest + $15K rental = $20K
    const result = computeNIIT(model, cents(230000), 0, cents(15000))
    expect(result.nii).toBe(cents(20000))
    expect(result.niitAmount).toBe(Math.round(cents(20000) * NIIT_RATE))
  })

  it('uses MFJ threshold ($250K)', () => {
    const model: TaxReturn = {
      ...emptyTaxReturn(2025),
      filingStatus: 'mfj',
      form1099INTs: [make1099INT({ id: 'i1', payerName: 'Bank', box1: cents(50000) })],
    }
    // AGI $260K, MFJ threshold $250K → excess $10K
    // NII = $50K, NIIT = 3.8% * min($50K, $10K) = 3.8% * $10K
    const result = computeNIIT(model, cents(260000), 0, 0)
    expect(result.magiExcess).toBe(cents(10000))
    expect(result.niitAmount).toBe(Math.round(cents(10000) * NIIT_RATE))
  })

  it('uses MFS threshold ($125K)', () => {
    const model: TaxReturn = {
      ...emptyTaxReturn(2025),
      filingStatus: 'mfs',
      form1099INTs: [make1099INT({ id: 'i1', payerName: 'Bank', box1: cents(20000) })],
    }
    // AGI $150K, MFS threshold $125K → excess $25K
    // NII = $20K, NIIT = 3.8% * min($20K, $25K) = 3.8% * $20K
    const result = computeNIIT(model, cents(150000), 0, 0)
    expect(result.magiExcess).toBe(cents(25000))
    expect(result.niitAmount).toBe(Math.round(cents(20000) * NIIT_RATE))
  })

  it('ignores negative rental income (losses)', () => {
    const model: TaxReturn = {
      ...emptyTaxReturn(2025),
      form1099INTs: [make1099INT({ id: 'i1', payerName: 'Bank', box1: cents(10000) })],
    }
    // Rental loss of -$5K is floored to 0 for NII purposes
    const result = computeNIIT(model, cents(220000), 0, cents(-5000))
    expect(result.nii).toBe(cents(10000))
  })

  it('ignores negative capital gains (losses)', () => {
    const model: TaxReturn = {
      ...emptyTaxReturn(2025),
      form1099INTs: [make1099INT({ id: 'i1', payerName: 'Bank', box1: cents(10000) })],
    }
    const result = computeNIIT(model, cents(220000), cents(-3000), 0)
    expect(result.nii).toBe(cents(10000))
  })
})

// ── Additional Medicare Tax Tests ─────────────────────────────────

describe('Additional Medicare Tax (Form 8959)', () => {
  it('returns $0 when wages are below threshold', () => {
    const model: TaxReturn = {
      ...emptyTaxReturn(2025),
      w2s: [makeW2({ id: 'w1', employerName: 'Acme', box1: cents(150000), box2: cents(20000) })],
    }
    const result = computeAdditionalMedicareTax(model)
    expect(result.additionalTax).toBe(0)
    expect(result.excessWages).toBe(0)
  })

  it('computes 0.9% on single filer wages above $200K', () => {
    const model: TaxReturn = {
      ...emptyTaxReturn(2025),
      w2s: [makeW2({
        id: 'w1', employerName: 'BigCo', box1: cents(250000), box2: cents(40000),
        box5: cents(250000), box6: Math.round(cents(250000) * MEDICARE_TAX_RATE),
      })],
    }
    // Single threshold $200K, excess = $50K
    // Tax = 0.9% * $50K = $450
    const result = computeAdditionalMedicareTax(model)
    expect(result.medicareWages).toBe(cents(250000))
    expect(result.excessWages).toBe(cents(50000))
    expect(result.additionalTax).toBe(Math.round(cents(50000) * ADDITIONAL_MEDICARE_RATE))
  })

  it('aggregates Medicare wages across multiple W-2s', () => {
    const model: TaxReturn = {
      ...emptyTaxReturn(2025),
      w2s: [
        makeW2({
          id: 'w1', employerName: 'Co A', box1: cents(120000), box2: cents(15000),
          box5: cents(120000), box6: Math.round(cents(120000) * MEDICARE_TAX_RATE),
        }),
        makeW2({
          id: 'w2', employerName: 'Co B', box1: cents(100000), box2: cents(12000),
          box5: cents(100000), box6: Math.round(cents(100000) * MEDICARE_TAX_RATE),
        }),
      ],
    }
    // Total Medicare wages = $220K, single threshold $200K, excess = $20K
    const result = computeAdditionalMedicareTax(model)
    expect(result.medicareWages).toBe(cents(220000))
    expect(result.excessWages).toBe(cents(20000))
    expect(result.additionalTax).toBe(Math.round(cents(20000) * ADDITIONAL_MEDICARE_RATE))
  })

  it('uses MFJ threshold ($250K)', () => {
    const model: TaxReturn = {
      ...emptyTaxReturn(2025),
      filingStatus: 'mfj',
      w2s: [makeW2({
        id: 'w1', employerName: 'BigCo', box1: cents(300000), box2: cents(50000),
        box5: cents(300000), box6: Math.round(cents(300000) * MEDICARE_TAX_RATE),
      })],
    }
    // MFJ threshold $250K, excess = $50K
    const result = computeAdditionalMedicareTax(model)
    expect(result.excessWages).toBe(cents(50000))
    expect(result.additionalTax).toBe(Math.round(cents(50000) * ADDITIONAL_MEDICARE_RATE))
  })

  it('uses MFS threshold ($125K)', () => {
    const model: TaxReturn = {
      ...emptyTaxReturn(2025),
      filingStatus: 'mfs',
      w2s: [makeW2({
        id: 'w1', employerName: 'BigCo', box1: cents(175000), box2: cents(25000),
        box5: cents(175000), box6: Math.round(cents(175000) * MEDICARE_TAX_RATE),
      })],
    }
    // MFS threshold $125K, excess = $50K
    const result = computeAdditionalMedicareTax(model)
    expect(result.excessWages).toBe(cents(50000))
    expect(result.additionalTax).toBe(Math.round(cents(50000) * ADDITIONAL_MEDICARE_RATE))
  })

  it('computes withholding credit when employer overwithholds', () => {
    // Employer withholds at 1.45% + 0.9% on wages over $200K
    // Wages = $250K, regular Medicare = 1.45% * $250K = $3,625
    // Employer withheld: 1.45% * $200K + 2.35% * $50K = $2,900 + $1,175 = $4,075
    const regularMedicare = Math.round(cents(250000) * MEDICARE_TAX_RATE)
    const overWithheld = regularMedicare + Math.round(cents(50000) * ADDITIONAL_MEDICARE_RATE)
    const model: TaxReturn = {
      ...emptyTaxReturn(2025),
      w2s: [makeW2({
        id: 'w1', employerName: 'BigCo', box1: cents(250000), box2: cents(40000),
        box5: cents(250000), box6: overWithheld,
      })],
    }
    const result = computeAdditionalMedicareTax(model)
    expect(result.withholdingCredit).toBe(overWithheld - regularMedicare)
  })

  it('no withholding credit when employer withholds exactly regular rate', () => {
    const regularMedicare = Math.round(cents(250000) * MEDICARE_TAX_RATE)
    const model: TaxReturn = {
      ...emptyTaxReturn(2025),
      w2s: [makeW2({
        id: 'w1', employerName: 'BigCo', box1: cents(250000), box2: cents(40000),
        box5: cents(250000), box6: regularMedicare,
      })],
    }
    const result = computeAdditionalMedicareTax(model)
    expect(result.withholdingCredit).toBe(0)
  })
})

// ── Integration: NIIT and Medicare Tax flow into Line 23 ──────────

describe('Line 23 integration with NIIT and Additional Medicare Tax', () => {
  it('high-income single filer gets both NIIT and Additional Medicare Tax', () => {
    const model: TaxReturn = {
      ...emptyTaxReturn(2025),
      w2s: [makeW2({
        id: 'w1', employerName: 'BigCo',
        box1: cents(300000), box2: cents(60000),
        box5: cents(300000), box6: Math.round(cents(300000) * MEDICARE_TAX_RATE),
      })],
      form1099INTs: [make1099INT({ id: 'i1', payerName: 'Bank', box1: cents(20000) })],
      form1099DIVs: [make1099DIV({ id: 'd1', payerName: 'Vanguard', box1a: cents(15000) })],
    }

    const result = computeForm1040(model)

    // NIIT: AGI ≈ $335K (wages + interest + dividends), threshold $200K
    // NII = $20K interest + $15K dividends = $35K
    // MAGI excess = $335K - $200K = $135K
    // NIIT = 3.8% * min($35K, $135K) = 3.8% * $35K
    expect(result.niitResult!.niitAmount).toBe(Math.round(cents(35000) * NIIT_RATE))

    // Additional Medicare Tax: $300K wages, threshold $200K, excess $100K
    // Tax = 0.9% * $100K = $900
    expect(result.additionalMedicareTaxResult!.additionalTax).toBe(
      Math.round(cents(100000) * ADDITIONAL_MEDICARE_RATE),
    )

    // Line 23 should include both taxes
    expect(result.line23.amount).toBeGreaterThan(0)
    expect(result.line23.amount).toBeGreaterThanOrEqual(
      result.niitResult!.niitAmount + result.additionalMedicareTaxResult!.additionalTax,
    )
  })

  it('moderate-income filer gets neither NIIT nor Additional Medicare Tax', () => {
    const model: TaxReturn = {
      ...emptyTaxReturn(2025),
      w2s: [makeW2({
        id: 'w1', employerName: 'Acme',
        box1: cents(75000), box2: cents(8000),
      })],
    }

    const result = computeForm1040(model)
    expect(result.niitResult!.niitAmount).toBe(0)
    expect(result.additionalMedicareTaxResult!.additionalTax).toBe(0)
  })
})
