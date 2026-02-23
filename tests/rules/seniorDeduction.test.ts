/**
 * OBBBA Senior Standard Deduction Tests (§70104)
 *
 * Tests the doubled additional standard deduction for seniors (age 65+)
 * under the One Big Beautiful Bill Act, and its interactions with
 * the blind additional, dependent filer limitations, and itemized deductions.
 */

import { describe, it, expect } from 'vitest'
import { cents } from '../../src/model/traced'
import { computeSeniorDeduction, OBBBA_SENIOR_ADDITIONAL } from '../../src/rules/2025/seniorDeduction'
import { ADDITIONAL_STANDARD_DEDUCTION, STANDARD_DEDUCTION } from '../../src/rules/2025/constants'
import { computeForm1040 } from '../../src/rules/2025/form1040'
import { emptyTaxReturn } from '../../src/model/types'
import { makeW2, seniorStandardDeductionReturn, seniorCoupleMFJReturn } from '../fixtures/returns'

describe('computeSeniorDeduction', () => {
  describe('single filer', () => {
    it('computes OBBBA-enhanced amount for single 65+', () => {
      const result = computeSeniorDeduction('single', true, false, false, false)
      expect(result.seniorCount).toBe(1)
      expect(result.blindCount).toBe(0)
      expect(result.seniorPerPerson).toBe(OBBBA_SENIOR_ADDITIONAL.single)
      expect(result.totalSeniorAmount).toBe(400_000) // $4,000
      expect(result.totalBlindAmount).toBe(0)
      expect(result.totalAdditional).toBe(400_000) // $4,000
    })

    it('adds blind additional at pre-OBBBA rate', () => {
      const result = computeSeniorDeduction('single', true, true, false, false)
      expect(result.seniorCount).toBe(1)
      expect(result.blindCount).toBe(1)
      expect(result.totalSeniorAmount).toBe(400_000) // $4,000
      expect(result.totalBlindAmount).toBe(ADDITIONAL_STANDARD_DEDUCTION.single) // $2,000
      expect(result.totalAdditional).toBe(600_000) // $6,000
    })

    it('returns zero additional for non-senior non-blind', () => {
      const result = computeSeniorDeduction('single', false, false, false, false)
      expect(result.totalAdditional).toBe(0)
    })

    it('ignores spouse flags for single filer', () => {
      const result = computeSeniorDeduction('single', false, false, true, true)
      expect(result.seniorCount).toBe(0)
      expect(result.blindCount).toBe(0)
      expect(result.totalAdditional).toBe(0)
    })
  })

  describe('MFJ filer', () => {
    it('computes OBBBA-enhanced amount for both spouses 65+', () => {
      const result = computeSeniorDeduction('mfj', true, false, true, false)
      expect(result.seniorCount).toBe(2)
      expect(result.seniorPerPerson).toBe(OBBBA_SENIOR_ADDITIONAL.mfj) // $3,200
      expect(result.totalSeniorAmount).toBe(640_000) // $6,400
      expect(result.totalAdditional).toBe(640_000)
    })

    it('handles MFJ with one senior, one blind', () => {
      const result = computeSeniorDeduction('mfj', true, false, false, true)
      expect(result.seniorCount).toBe(1) // taxpayer only
      expect(result.blindCount).toBe(1) // spouse only
      expect(result.totalSeniorAmount).toBe(320_000) // $3,200
      expect(result.totalBlindAmount).toBe(160_000) // $1,600
      expect(result.totalAdditional).toBe(480_000) // $4,800
    })

    it('handles MFJ with both 65+ and one blind', () => {
      const result = computeSeniorDeduction('mfj', true, false, true, true)
      expect(result.seniorCount).toBe(2)
      expect(result.blindCount).toBe(1)
      expect(result.totalSeniorAmount).toBe(640_000) // $6,400
      expect(result.totalBlindAmount).toBe(160_000) // $1,600
      expect(result.totalAdditional).toBe(800_000) // $8,000
    })

    it('handles MFJ with all four conditions', () => {
      const result = computeSeniorDeduction('mfj', true, true, true, true)
      expect(result.seniorCount).toBe(2)
      expect(result.blindCount).toBe(2)
      expect(result.totalSeniorAmount).toBe(640_000) // $6,400
      expect(result.totalBlindAmount).toBe(320_000) // $3,200
      expect(result.totalAdditional).toBe(960_000) // $9,600
    })
  })

  describe('HOH filer', () => {
    it('uses single rates for HOH', () => {
      const result = computeSeniorDeduction('hoh', true, false, false, false)
      expect(result.seniorPerPerson).toBe(OBBBA_SENIOR_ADDITIONAL.hoh) // $4,000
      expect(result.totalAdditional).toBe(400_000)
    })
  })

  describe('MFS filer', () => {
    it('includes spouse counts for MFS', () => {
      const result = computeSeniorDeduction('mfs', true, false, true, false)
      expect(result.seniorCount).toBe(2)
      expect(result.seniorPerPerson).toBe(OBBBA_SENIOR_ADDITIONAL.mfs) // $3,200
      expect(result.totalAdditional).toBe(640_000)
    })
  })
})

describe('OBBBA Senior Deduction — Form 1040 integration', () => {
  it('applies OBBBA-enhanced deduction for single 65+ filer', () => {
    const model = seniorStandardDeductionReturn()
    const result = computeForm1040(model)

    // Standard: $15,750 + $4,000 (OBBBA senior) = $19,750
    expect(result.line12.amount).toBe(cents(19750))
    expect(result.seniorDeduction).not.toBeNull()
    expect(result.seniorDeduction!.totalSeniorAmount).toBe(cents(4000))
  })

  it('applies OBBBA-enhanced deduction for MFJ couple both 65+, one blind', () => {
    const model = seniorCoupleMFJReturn()
    const result = computeForm1040(model)

    // Standard: $31,500 + $3,200×2 (senior) + $1,600×1 (blind) = $39,500
    expect(result.line12.amount).toBe(cents(39500))
    expect(result.seniorDeduction!.seniorCount).toBe(2)
    expect(result.seniorDeduction!.blindCount).toBe(1)
  })

  it('doubles the old additional for single 65+ (was $2K, now $4K)', () => {
    // Verify the OBBBA enhancement is exactly double the pre-OBBBA amount
    expect(OBBBA_SENIOR_ADDITIONAL.single).toBe(ADDITIONAL_STANDARD_DEDUCTION.single * 2)
    expect(OBBBA_SENIOR_ADDITIONAL.mfj).toBe(ADDITIONAL_STANDARD_DEDUCTION.mfj * 2)
  })

  it('does not affect non-senior filers', () => {
    const model = {
      ...emptyTaxReturn(2025),
      w2s: [
        makeW2({
          id: 'w2-1',
          employerName: 'Corp',
          box1: cents(75000),
          box2: cents(8000),
        }),
      ],
    }
    const result = computeForm1040(model)

    // Standard deduction = $15,750 (no additional)
    expect(result.line12.amount).toBe(STANDARD_DEDUCTION.single)
    expect(result.seniorDeduction!.totalAdditional).toBe(0)
  })

  it('applies dependent filer limitation correctly with senior deduction', () => {
    const model = {
      ...emptyTaxReturn(2025),
      canBeClaimedAsDependent: true,
      w2s: [
        makeW2({
          id: 'w2-1',
          employerName: 'Corp',
          box1: cents(5000),
          box2: cents(200),
        }),
      ],
      deductions: {
        method: 'standard' as const,
        taxpayerAge65: true,
        taxpayerBlind: false,
        spouseAge65: false,
        spouseBlind: false,
      },
    }
    const result = computeForm1040(model)

    // Dependent filer base: max($1,350, $5,000 + $450) = $5,450
    // Capped at standard deduction ($15,750) → $5,450
    // Plus OBBBA senior additional: $4,000
    // Total: $5,450 + $4,000 = $9,450
    expect(result.line12.amount).toBe(cents(9450))
  })
})
