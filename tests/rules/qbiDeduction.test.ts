/**
 * QBI Deduction Tests — IRC §199A (Form 8995 Simplified)
 *
 * Tests the qualified business income deduction for:
 * - Below-threshold simplified computation
 * - Above-threshold conservative $0
 * - Multiple QBI sources
 * - Edge cases (loss, zero income, boundary)
 */

import { describe, it, expect } from 'vitest'
import { cents } from '../../src/model/traced'
import { computeQBIDeduction } from '../../src/rules/2025/qbiDeduction'
import { QBI_TAXABLE_INCOME_THRESHOLD } from '../../src/rules/2025/constants'

describe('computeQBIDeduction', () => {
  describe('below-threshold simplified path', () => {
    it('computes 20% of QBI for simple freelancer', () => {
      // Schedule C profit = $80,000
      // Taxable income before QBI = $64,250 (after standard deduction)
      const result = computeQBIDeduction(cents(80000), 0, cents(64250), 'single')

      expect(result.simplifiedPath).toBe(true)
      expect(result.aboveThreshold).toBe(false)
      expect(result.totalQBI).toBe(cents(80000))
      expect(result.qbiComponent).toBe(Math.round(cents(80000) * 0.20))  // $16,000
      expect(result.taxableIncomeComponent).toBe(Math.round(cents(64250) * 0.20))  // $12,850
      // Deduction = min($16,000, $12,850) = $12,850
      expect(result.deductionAmount).toBe(Math.round(cents(64250) * 0.20))
    })

    it('deduction is limited by taxable income', () => {
      // QBI = $100K, taxable income = $30K
      // 20% QBI = $20K, 20% TI = $6K → deduction = $6K
      const result = computeQBIDeduction(cents(100000), 0, cents(30000), 'single')

      expect(result.deductionAmount).toBe(cents(6000))
    })

    it('deduction is limited by QBI when QBI is smaller', () => {
      // QBI = $20K, taxable income = $120K
      // 20% QBI = $4K, 20% TI = $24K → deduction = $4K
      const result = computeQBIDeduction(cents(20000), 0, cents(120000), 'single')

      expect(result.deductionAmount).toBe(cents(4000))
    })

    it('handles MFJ threshold correctly', () => {
      // MFJ threshold = $383,900
      // Taxable income = $350,000 (below)
      const result = computeQBIDeduction(cents(200000), 0, cents(350000), 'mfj')

      expect(result.simplifiedPath).toBe(true)
      expect(result.deductionAmount).toBe(Math.round(cents(200000) * 0.20))  // $40K
    })

    it('computes exactly at the threshold', () => {
      const threshold = QBI_TAXABLE_INCOME_THRESHOLD['single']
      // Taxable income exactly at threshold → still simplified path
      const result = computeQBIDeduction(cents(50000), 0, threshold, 'single')

      expect(result.simplifiedPath).toBe(true)
      expect(result.aboveThreshold).toBe(false)
    })
  })

  describe('above-threshold cases', () => {
    it('returns $0 deduction when above single threshold', () => {
      // Single threshold = $191,950
      const result = computeQBIDeduction(cents(100000), 0, cents(200000), 'single')

      expect(result.aboveThreshold).toBe(true)
      expect(result.simplifiedPath).toBe(false)
      expect(result.deductionAmount).toBe(0)
    })

    it('returns $0 deduction when above MFJ threshold', () => {
      const result = computeQBIDeduction(cents(200000), 0, cents(400000), 'mfj')

      expect(result.aboveThreshold).toBe(true)
      expect(result.deductionAmount).toBe(0)
    })

    it('still reports QBI components even when above threshold', () => {
      const result = computeQBIDeduction(cents(100000), 0, cents(300000), 'single')

      expect(result.totalQBI).toBe(cents(100000))
      expect(result.qbiComponent).toBe(cents(20000))
      expect(result.deductionAmount).toBe(0)
    })
  })

  describe('multiple QBI sources', () => {
    it('combines Schedule C and K-1 QBI', () => {
      // Schedule C: $60K profit, K-1: $40K QBI
      const result = computeQBIDeduction(cents(60000), cents(40000), cents(100000), 'single')

      expect(result.totalQBI).toBe(cents(100000))
      expect(result.deductionAmount).toBe(Math.round(cents(100000) * 0.20))  // $20K
    })

    it('handles negative Schedule C with positive K-1', () => {
      // Schedule C: -$10K loss, K-1: $30K QBI
      // Net QBI = $20K
      const result = computeQBIDeduction(cents(-10000), cents(30000), cents(80000), 'single')

      expect(result.totalQBI).toBe(cents(20000))
      expect(result.deductionAmount).toBe(cents(4000))  // 20% of $20K
    })
  })

  describe('edge cases', () => {
    it('returns $0 when QBI is negative', () => {
      const result = computeQBIDeduction(cents(-20000), 0, cents(50000), 'single')

      expect(result.totalQBI).toBe(cents(-20000))
      expect(result.deductionAmount).toBe(0)
    })

    it('returns $0 when taxable income is zero', () => {
      const result = computeQBIDeduction(cents(50000), 0, 0, 'single')

      expect(result.deductionAmount).toBe(0)
    })

    it('returns $0 when taxable income is negative', () => {
      const result = computeQBIDeduction(cents(50000), 0, cents(-5000), 'single')

      expect(result.deductionAmount).toBe(0)
    })

    it('returns $0 when both QBI and taxable income are zero', () => {
      const result = computeQBIDeduction(0, 0, 0, 'single')

      expect(result.deductionAmount).toBe(0)
    })

    it('returns traced line13 value when deduction is positive', () => {
      const result = computeQBIDeduction(cents(50000), 0, cents(80000), 'single')

      expect(result.line13.amount).toBe(result.deductionAmount)
      expect(result.line13.amount).toBeGreaterThan(0)
    })

    it('returns traced zero line13 when deduction is zero', () => {
      const result = computeQBIDeduction(cents(-5000), 0, cents(80000), 'single')

      expect(result.line13.amount).toBe(0)
    })
  })
})
