/**
 * Federal Validation Tests
 *
 * Tests the validation module that identifies unsupported scenarios
 * and data quality issues.
 */

import { describe, it, expect } from 'vitest'
import { cents } from '../../src/model/traced'
import { validateFederalReturn } from '../../src/rules/2025/federalValidation'
import { emptyTaxReturn } from '../../src/model/types'
import { makeW2, makeSSA1099 } from '../fixtures/returns'

describe('validateFederalReturn', () => {
  it('returns phase 3 limitations info for any return', () => {
    const model = {
      ...emptyTaxReturn(2025),
      w2s: [
        makeW2({
          id: 'w2-1',
          employerName: 'Acme',
          box1: cents(75000),
          box2: cents(8000),
        }),
      ],
    }
    const result = validateFederalReturn(model)
    const phaseItem = result.items.find(i => i.code === 'PHASE4_LIMITATIONS')
    expect(phaseItem).toBeDefined()
    expect(phaseItem!.severity).toBe('info')
  })

  it('warns about MFS + SS benefits', () => {
    const model = {
      ...emptyTaxReturn(2025),
      filingStatus: 'mfs' as const,
      formSSA1099s: [
        makeSSA1099({
          id: 'ssa-1',
          recipientName: 'Taxpayer',
          box5: cents(20000),
        }),
      ],
    }
    const result = validateFederalReturn(model)
    const mfsItem = result.items.find(i => i.code === 'MFS_SS_BENEFITS')
    expect(mfsItem).toBeDefined()
    expect(mfsItem!.severity).toBe('warning')
    expect(result.hasWarnings).toBe(true)
  })

  it('warns about negative net SS benefits', () => {
    const model = {
      ...emptyTaxReturn(2025),
      formSSA1099s: [
        makeSSA1099({
          id: 'ssa-1',
          recipientName: 'Taxpayer',
          box3: cents(5000),
          box4: cents(8000),
          box5: cents(-3000),  // repaid more than received
        }),
      ],
    }
    const result = validateFederalReturn(model)
    const negItem = result.items.find(i => i.code === 'SSA_NEGATIVE_NET_BENEFITS')
    expect(negItem).toBeDefined()
    expect(negItem!.severity).toBe('warning')
  })

  it('warns about SSA-1099 Box 5 mismatch', () => {
    const model = {
      ...emptyTaxReturn(2025),
      formSSA1099s: [
        makeSSA1099({
          id: 'ssa-1',
          recipientName: 'Taxpayer',
          box3: cents(20000),
          box4: cents(2000),
          box5: cents(19000),  // should be $18,000 (box3 - box4)
        }),
      ],
    }
    const result = validateFederalReturn(model)
    const mismatchItem = result.items.find(i => i.code === 'SSA_BOX5_MISMATCH')
    expect(mismatchItem).toBeDefined()
    expect(mismatchItem!.severity).toBe('warning')
  })

  it('shows OBBBA senior deduction info when age 65+ flags set', () => {
    const model = {
      ...emptyTaxReturn(2025),
      deductions: {
        method: 'standard' as const,
        taxpayerAge65: true,
        taxpayerBlind: false,
        spouseAge65: false,
        spouseBlind: false,
      },
    }
    const result = validateFederalReturn(model)
    const seniorItem = result.items.find(i => i.code === 'OBBBA_SENIOR_DEDUCTION')
    expect(seniorItem).toBeDefined()
    expect(seniorItem!.severity).toBe('info')
  })

  it('shows dependent filer limitations info', () => {
    const model = {
      ...emptyTaxReturn(2025),
      canBeClaimedAsDependent: true,
    }
    const result = validateFederalReturn(model)
    const depItem = result.items.find(i => i.code === 'DEPENDENT_FILER_LIMITATIONS')
    expect(depItem).toBeDefined()
  })

  it('warns about possible SE income from large 1099-MISC Box 3', () => {
    const model = {
      ...emptyTaxReturn(2025),
      form1099MISCs: [
        {
          id: 'misc-1',
          payerName: 'Client Corp',
          box1: 0,
          box2: 0,
          box3: cents(50000),  // $50,000 in "other income"
          box4: 0,
        },
      ],
    }
    const result = validateFederalReturn(model)
    const seItem = result.items.find(i => i.code === 'POSSIBLE_SE_INCOME')
    expect(seItem).toBeDefined()
    expect(seItem!.severity).toBe('warning')
  })

  it('has no errors for a clean simple return', () => {
    const model = {
      ...emptyTaxReturn(2025),
      w2s: [
        makeW2({
          id: 'w2-1',
          employerName: 'Acme',
          box1: cents(75000),
          box2: cents(8000),
        }),
      ],
    }
    const result = validateFederalReturn(model)
    expect(result.hasErrors).toBe(false)
  })
})
