/**
 * Audit High-Risk Area Tests — February 2026
 *
 * Focused test suite for the top 5 high-risk federal rule areas
 * identified in the federal-rule-engine-audit-2026-02.md audit.
 *
 * These tests pin current constant values and computation logic
 * to make regressions immediately visible. When the constant defects
 * are fixed, the "current value" assertions should be updated to
 * match the corrected values.
 *
 * High-risk areas:
 *   1. Standard Deduction (OBBBA §70102 update)
 *   2. Child Tax Credit (OBBBA §70101 update)
 *   3. AMT 28% Threshold (Rev. Proc. 2024-40)
 *   4. Saver's Credit Thresholds (Rev. Proc. 2024-40 §3.10)
 *   5. SALT Cap Phase-Out (OBBBA §70120 — verify correct)
 */

import { describe, it, expect } from 'vitest'
import { cents } from '../../src/model/traced'
import { emptyTaxReturn } from '../../src/model/types'
import type { TaxReturn, FilingStatus, Dependent } from '../../src/model/types'
import {
  STANDARD_DEDUCTION,
  ADDITIONAL_STANDARD_DEDUCTION,
  CTC_PER_QUALIFYING_CHILD,
  CTC_PER_OTHER_DEPENDENT,
  CTC_PHASEOUT_THRESHOLD,
  AMT_28_PERCENT_THRESHOLD,
  AMT_EXEMPTION,
  SAVERS_CREDIT_THRESHOLDS,
  SALT_BASE_CAP,
  SALT_PHASEOUT_THRESHOLD,
  SALT_PHASEOUT_RATE,
  SALT_FLOOR,
} from '../../src/rules/2025/constants'
import { computeAMT } from '../../src/rules/2025/amt'
import { computeOrdinaryTax } from '../../src/rules/2025/taxComputation'
import { isQualifyingChild, computeChildTaxCredit } from '../../src/rules/2025/childTaxCredit'
import { computeSaversCredit } from '../../src/rules/2025/saversCredit'
import { makeW2, makeDependent } from '../fixtures/returns'

const ALL_STATUSES: FilingStatus[] = ['single', 'mfj', 'mfs', 'hoh', 'qw']

// ── Area 1: Standard Deduction ─────────────────────────────────────

describe('AUDIT: Standard Deduction (OBBBA §70102)', () => {
  // These tests document the CORRECT values per OBBBA §70102.
  // When constants are fixed, these tests will pass.

  it('single = $15,750 per OBBBA §70102', () => {
    expect(STANDARD_DEDUCTION.single).toBe(cents(15750))
  })

  it('mfj = $31,500 per OBBBA §70102', () => {
    expect(STANDARD_DEDUCTION.mfj).toBe(cents(31500))
  })

  it('mfs = $15,750 per OBBBA §70102', () => {
    expect(STANDARD_DEDUCTION.mfs).toBe(cents(15750))
  })

  it('hoh = $23,625 per OBBBA §70102', () => {
    expect(STANDARD_DEDUCTION.hoh).toBe(cents(23625))
  })

  it('qw = $31,500 per OBBBA §70102', () => {
    expect(STANDARD_DEDUCTION.qw).toBe(cents(31500))
  })

  it('additional deduction unchanged: single/hoh = $2,000', () => {
    expect(ADDITIONAL_STANDARD_DEDUCTION.single).toBe(cents(2000))
    expect(ADDITIONAL_STANDARD_DEDUCTION.hoh).toBe(cents(2000))
  })

  it('additional deduction unchanged: mfj/mfs/qw = $1,600', () => {
    expect(ADDITIONAL_STANDARD_DEDUCTION.mfj).toBe(cents(1600))
    expect(ADDITIONAL_STANDARD_DEDUCTION.mfs).toBe(cents(1600))
    expect(ADDITIONAL_STANDARD_DEDUCTION.qw).toBe(cents(1600))
  })

  it('every filing status has a positive standard deduction', () => {
    for (const status of ALL_STATUSES) {
      expect(STANDARD_DEDUCTION[status]).toBeGreaterThan(0)
    }
  })

  it('MFJ deduction is double single deduction', () => {
    // True for both pre-OBBBA ($15K/$30K) and post-OBBBA ($15,750/$31,500)
    expect(STANDARD_DEDUCTION.mfj).toBe(STANDARD_DEDUCTION.single * 2)
  })

  it('QW deduction equals MFJ deduction', () => {
    expect(STANDARD_DEDUCTION.qw).toBe(STANDARD_DEDUCTION.mfj)
  })

  it('MFS deduction equals single deduction', () => {
    expect(STANDARD_DEDUCTION.mfs).toBe(STANDARD_DEDUCTION.single)
  })
})

// ── Area 2: Child Tax Credit ───────────────────────────────────────

describe('AUDIT: Child Tax Credit (OBBBA §70101)', () => {
  // CTC per qualifying child should be $2,200 per OBBBA

  it('CTC per qualifying child = $2,200 per OBBBA §70101', () => {
    expect(CTC_PER_QUALIFYING_CHILD).toBe(cents(2200))
  })

  it('CTC per other dependent = $500 (unchanged)', () => {
    expect(CTC_PER_OTHER_DEPENDENT).toBe(cents(500))
  })

  it('phase-out thresholds unchanged: single $200K, MFJ $400K', () => {
    expect(CTC_PHASEOUT_THRESHOLD.single).toBe(cents(200000))
    expect(CTC_PHASEOUT_THRESHOLD.mfj).toBe(cents(400000))
  })

  describe('computeChildTaxCredit — basic scenarios', () => {
    it('single filer, 1 qualifying child under 17 → $2,200 initial credit', () => {
      const deps: Dependent[] = [
        makeDependent({
          firstName: 'Alice',
          dateOfBirth: '2015-06-15',
          relationship: 'daughter',
          ssn: '123456789',
          monthsLived: 12,
        }),
      ]

      const result = computeChildTaxCredit(
        deps,
        'single',
        cents(75000),  // AGI
        cents(75000),  // earned income
        cents(8000),   // tax liability
      )

      // With $2,200 per child (OBBBA), initial credit = $2,200
      expect(result.initialCredit).toBe(cents(2200))
      expect(result.numQualifyingChildren).toBe(1)
    })

    it('MFJ, 2 qualifying children → $4,400 initial credit', () => {
      const deps: Dependent[] = [
        makeDependent({
          firstName: 'Alice',
          dateOfBirth: '2015-06-15',
          relationship: 'daughter',
          ssn: '111111111',
          monthsLived: 12,
        }),
        makeDependent({
          firstName: 'Bob',
          dateOfBirth: '2018-03-01',
          relationship: 'son',
          ssn: '222222222',
          monthsLived: 12,
        }),
      ]

      const result = computeChildTaxCredit(
        deps,
        'mfj',
        cents(120000),
        cents(120000),
        cents(15000),
      )

      expect(result.numQualifyingChildren).toBe(2)
      expect(result.initialCredit).toBe(cents(4400))
    })

    it('AGI above phase-out reduces credit by $50 per $1K', () => {
      const deps: Dependent[] = [
        makeDependent({
          firstName: 'Alice',
          dateOfBirth: '2015-06-15',
          relationship: 'daughter',
          ssn: '123456789',
          monthsLived: 12,
        }),
      ]

      // Single, AGI $210,000 → $10K over threshold → $500 reduction
      const result = computeChildTaxCredit(
        deps,
        'single',
        cents(210000),
        cents(210000),
        cents(50000),
      )

      expect(result.phaseOutReduction).toBe(cents(500))
      expect(result.creditAfterPhaseOut).toBe(cents(2200) - cents(500))
    })
  })
})

// ── Area 3: AMT 28% Threshold ──────────────────────────────────────

describe('AUDIT: AMT 28% Threshold (Form 6251)', () => {
  // Per 2025 Form 6251 Instructions, the 26% rate applies to
  // the first $239,100 ($119,550 MFS) of AMTI above exemption.

  it('single/mfj/hoh/qw 28% threshold = $239,100', () => {
    expect(AMT_28_PERCENT_THRESHOLD.single).toBe(cents(239100))
    expect(AMT_28_PERCENT_THRESHOLD.mfj).toBe(cents(239100))
    expect(AMT_28_PERCENT_THRESHOLD.hoh).toBe(cents(239100))
    expect(AMT_28_PERCENT_THRESHOLD.qw).toBe(cents(239100))
  })

  it('MFS 28% threshold = $119,550 (half of $239,100)', () => {
    expect(AMT_28_PERCENT_THRESHOLD.mfs).toBe(cents(119550))
  })

  it('AMT exemptions are correct (unchanged)', () => {
    expect(AMT_EXEMPTION.single).toBe(cents(88100))
    expect(AMT_EXEMPTION.mfj).toBe(cents(137000))
    expect(AMT_EXEMPTION.mfs).toBe(cents(68500))
  })

  describe('AMT computation at 28% boundary', () => {
    it('AMTI just below threshold → all at 26%', () => {
      // Single, taxable income high enough for significant AMTI,
      // AMTI after exemption = $200,000 (below $239,100 threshold)
      const taxableIncome = cents(288100) // 288,100 - 88,100 exemption = 200,000 AMTI after exemption
      const regularTax = computeOrdinaryTax(taxableIncome, 'single')

      const result = computeAMT(
        taxableIncome,
        regularTax,
        'single',
        0,    // no SALT
        [],   // no ISO
        0,    // no PAB
        0,    // no qualified dividends
        0,    // no LTCG
      )

      // AMTI after exemption = $200,000, all at 26%
      const expectedTMT = Math.round(cents(200000) * 0.26)
      expect(result.line10_amtiAfterExemption).toBe(cents(200000))
      expect(result.tentativeMinimumTax).toBe(expectedTMT)
    })

    it('AMTI above threshold → split 26%/28%', () => {
      // Single, AMTI after exemption = $300,000 (above $239,100)
      const taxableIncome = cents(388100) // 388,100 - 88,100 = 300,000 AMTI after exemption
      const regularTax = computeOrdinaryTax(taxableIncome, 'single')

      const result = computeAMT(
        taxableIncome,
        regularTax,
        'single',
        0, [], 0, 0, 0,
      )

      expect(result.line10_amtiAfterExemption).toBe(cents(300000))

      // Expected TMT: 26% of $239,100 + 28% of ($300K - $239,100)
      const threshold = AMT_28_PERCENT_THRESHOLD.single
      const expectedTMT = Math.round(
        threshold * 0.26 + (cents(300000) - threshold) * 0.28
      )
      expect(result.tentativeMinimumTax).toBe(expectedTMT)
    })

    it('MFS uses half threshold ($119,550)', () => {
      // MFS, AMTI after exemption = $150,000 (above MFS threshold of $119,550)
      const taxableIncome = cents(218500) // 218,500 - 68,500 = 150,000 AMTI after exemption
      const regularTax = computeOrdinaryTax(taxableIncome, 'mfs')

      const result = computeAMT(
        taxableIncome,
        regularTax,
        'mfs',
        0, [], 0, 0, 0,
      )

      expect(result.line10_amtiAfterExemption).toBe(cents(150000))

      const threshold = AMT_28_PERCENT_THRESHOLD.mfs
      const expectedTMT = Math.round(
        threshold * 0.26 + (cents(150000) - threshold) * 0.28
      )
      expect(result.tentativeMinimumTax).toBe(expectedTMT)
    })
  })
})

// ── Area 4: Saver's Credit Thresholds ──────────────────────────────

describe('AUDIT: Saver\'s Credit Thresholds (Rev. Proc. 2024-40 §3.10)', () => {
  // The 50% and 20% thresholds are correct; the 10% thresholds need updating.

  it('single: rate50 = $23,750, rate20 = $25,500, rate10 = $39,500', () => {
    const t = SAVERS_CREDIT_THRESHOLDS.single
    expect(t.rate50).toBe(cents(23750))
    expect(t.rate20).toBe(cents(25500))
    expect(t.rate10).toBe(cents(39500))
  })

  it('mfs: rate10 = $39,500 (same as single)', () => {
    expect(SAVERS_CREDIT_THRESHOLDS.mfs.rate10).toBe(cents(39500))
  })

  it('hoh: rate50 = $35,625, rate20 = $38,250, rate10 = $59,250', () => {
    const t = SAVERS_CREDIT_THRESHOLDS.hoh
    expect(t.rate50).toBe(cents(35625))
    expect(t.rate20).toBe(cents(38250))
    expect(t.rate10).toBe(cents(59250))
  })

  it('mfj: rate50 = $47,500, rate20 = $51,000, rate10 = $79,000', () => {
    const t = SAVERS_CREDIT_THRESHOLDS.mfj
    expect(t.rate50).toBe(cents(47500))
    expect(t.rate20).toBe(cents(51000))
    expect(t.rate10).toBe(cents(79000))
  })

  it('qw thresholds match mfj', () => {
    expect(SAVERS_CREDIT_THRESHOLDS.qw).toEqual(SAVERS_CREDIT_THRESHOLDS.mfj)
  })

  describe('computeSaversCredit — rate boundary tests', () => {
    const baseContribs = { traditionalIRA: cents(2000), rothIRA: 0 }

    it('AGI at rate10 boundary: just under → 10%, just over → 0%', () => {
      const threshold = SAVERS_CREDIT_THRESHOLDS.single.rate10

      // Just under → 10%
      const below = computeSaversCredit(baseContribs, [], 'single', threshold)
      expect(below.creditRate).toBe(0.10)

      // Just over → 0%
      const above = computeSaversCredit(baseContribs, [], 'single', threshold + 1)
      expect(above.creditRate).toBe(0)
    })

    it('AGI at rate20 boundary: just under → 20%, at threshold → 20%', () => {
      const threshold = SAVERS_CREDIT_THRESHOLDS.single.rate20

      const at = computeSaversCredit(baseContribs, [], 'single', threshold)
      expect(at.creditRate).toBe(0.20)

      const above = computeSaversCredit(baseContribs, [], 'single', threshold + 1)
      expect(above.creditRate).toBe(0.10)
    })

    it('AGI at rate50 boundary: just under → 50%, at threshold → 50%', () => {
      const threshold = SAVERS_CREDIT_THRESHOLDS.single.rate50

      const at = computeSaversCredit(baseContribs, [], 'single', threshold)
      expect(at.creditRate).toBe(0.50)

      const above = computeSaversCredit(baseContribs, [], 'single', threshold + 1)
      expect(above.creditRate).toBe(0.20)
    })

    it('HOH AGI $59,250 → 10% rate; $59,251 → 0% rate', () => {
      const threshold = SAVERS_CREDIT_THRESHOLDS.hoh.rate10

      const at = computeSaversCredit(baseContribs, [], 'hoh', threshold)
      expect(at.creditRate).toBe(0.10)

      const above = computeSaversCredit(baseContribs, [], 'hoh', threshold + 1)
      expect(above.creditRate).toBe(0)
    })

    it('MFJ AGI $79,000 → 10% rate; $79,001 → 0% rate', () => {
      const threshold = SAVERS_CREDIT_THRESHOLDS.mfj.rate10

      const at = computeSaversCredit(baseContribs, [], 'mfj', threshold)
      expect(at.creditRate).toBe(0.10)

      const above = computeSaversCredit(baseContribs, [], 'mfj', threshold + 1)
      expect(above.creditRate).toBe(0)
    })
  })
})

// ── Area 5: SALT Cap Phase-Out (OBBBA §70120) ─────────────────────

describe('AUDIT: SALT Cap & Phase-Out (OBBBA §70120)', () => {
  // These values are verified correct. Tests pin them to prevent regression.

  it('base cap: single/mfj/hoh/qw = $40,000, mfs = $20,000', () => {
    expect(SALT_BASE_CAP.single).toBe(cents(40000))
    expect(SALT_BASE_CAP.mfj).toBe(cents(40000))
    expect(SALT_BASE_CAP.hoh).toBe(cents(40000))
    expect(SALT_BASE_CAP.qw).toBe(cents(40000))
    expect(SALT_BASE_CAP.mfs).toBe(cents(20000))
  })

  it('phase-out threshold: single/mfj/hoh/qw = $500K, mfs = $250K', () => {
    expect(SALT_PHASEOUT_THRESHOLD.single).toBe(cents(500000))
    expect(SALT_PHASEOUT_THRESHOLD.mfj).toBe(cents(500000))
    expect(SALT_PHASEOUT_THRESHOLD.mfs).toBe(cents(250000))
  })

  it('phase-out rate = 30%', () => {
    expect(SALT_PHASEOUT_RATE).toBe(0.30)
  })

  it('floor: single/mfj/hoh/qw = $10,000, mfs = $5,000', () => {
    expect(SALT_FLOOR.single).toBe(cents(10000))
    expect(SALT_FLOOR.mfj).toBe(cents(10000))
    expect(SALT_FLOOR.mfs).toBe(cents(5000))
  })

  it('MFS values are exactly half of joint values', () => {
    expect(SALT_BASE_CAP.mfs).toBe(SALT_BASE_CAP.mfj / 2)
    expect(SALT_PHASEOUT_THRESHOLD.mfs).toBe(SALT_PHASEOUT_THRESHOLD.mfj / 2)
    expect(SALT_FLOOR.mfs).toBe(SALT_FLOOR.mfj / 2)
  })

  describe('SALT phase-out math verification', () => {
    it('MAGI $500K → full $40K cap (no phase-out)', () => {
      const magi = cents(500000)
      const excess = Math.max(0, magi - SALT_PHASEOUT_THRESHOLD.single)
      const reduction = Math.round(excess * SALT_PHASEOUT_RATE)
      const cap = Math.max(SALT_FLOOR.single, SALT_BASE_CAP.single - reduction)
      expect(cap).toBe(cents(40000))
    })

    it('MAGI $600K → cap reduced by $30K (30% of $100K excess) → $10K (floor)', () => {
      const magi = cents(600000)
      const excess = Math.max(0, magi - SALT_PHASEOUT_THRESHOLD.single)
      expect(excess).toBe(cents(100000))
      const reduction = Math.round(excess * SALT_PHASEOUT_RATE)
      expect(reduction).toBe(cents(30000))
      const cap = Math.max(SALT_FLOOR.single, SALT_BASE_CAP.single - reduction)
      expect(cap).toBe(cents(10000)) // $40K - $30K = $10K = floor
    })

    it('MAGI $550K → cap reduced by $15K → $25K', () => {
      const magi = cents(550000)
      const excess = Math.max(0, magi - SALT_PHASEOUT_THRESHOLD.single)
      expect(excess).toBe(cents(50000))
      const reduction = Math.round(excess * SALT_PHASEOUT_RATE)
      expect(reduction).toBe(cents(15000))
      const cap = Math.max(SALT_FLOOR.single, SALT_BASE_CAP.single - reduction)
      expect(cap).toBe(cents(25000))
    })

    it('MAGI $700K → reduction exceeds cap, floor applies ($10K)', () => {
      const magi = cents(700000)
      const excess = Math.max(0, magi - SALT_PHASEOUT_THRESHOLD.single)
      const reduction = Math.round(excess * SALT_PHASEOUT_RATE)
      expect(reduction).toBe(cents(60000)) // 30% of $200K
      const cap = Math.max(SALT_FLOOR.single, SALT_BASE_CAP.single - reduction)
      expect(cap).toBe(SALT_FLOOR.single) // floor at $10K
    })

    it('MFS: MAGI $300K → $50K excess → $15K reduction → $5K (floor)', () => {
      const magi = cents(300000)
      const excess = Math.max(0, magi - SALT_PHASEOUT_THRESHOLD.mfs)
      expect(excess).toBe(cents(50000))
      const reduction = Math.round(excess * SALT_PHASEOUT_RATE)
      expect(reduction).toBe(cents(15000))
      const cap = Math.max(SALT_FLOOR.mfs, SALT_BASE_CAP.mfs - reduction)
      expect(cap).toBe(SALT_FLOOR.mfs) // $20K - $15K = $5K = floor
    })
  })
})
