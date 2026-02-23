/**
 * Schedule SE Tests — Self-Employment Tax
 *
 * Tests the SE tax computation including:
 * - Net earnings calculation (92.35% factor)
 * - Social Security tax with wage base coordination
 * - Medicare tax (uncapped)
 * - Deductible half computation
 */

import { describe, it, expect } from 'vitest'
import { cents } from '../../src/model/traced'
import { computeScheduleSE } from '../../src/rules/2025/scheduleSE'
import { SS_WAGE_BASE } from '../../src/rules/2025/constants'

describe('computeScheduleSE', () => {
  it('computes SE tax for typical freelancer with no W-2 wages', () => {
    // $100,000 Schedule C net profit, no W-2 wages
    const result = computeScheduleSE(cents(100000), 0, 'single')

    // Net SE earnings = $100,000 × 92.35% = $92,350
    expect(result.line3.amount).toBe(cents(92350))

    // SS taxable = min($92,350, $176,100) = $92,350
    expect(result.line4a.amount).toBe(cents(92350))

    // SS tax = $92,350 × 12.4% = $11,451.40 → $11,451
    expect(result.line4b.amount).toBe(Math.round(cents(92350) * 0.124))

    // Medicare tax = $92,350 × 2.9% = $2,678.15 → $2,678
    expect(result.line5.amount).toBe(Math.round(cents(92350) * 0.029))

    // Total SE tax
    const expectedTotal = Math.round(cents(92350) * 0.124) + Math.round(cents(92350) * 0.029)
    expect(result.totalSETax).toBe(expectedTotal)

    // Deductible half
    expect(result.deductibleHalfCents).toBe(Math.round(expectedTotal * 0.50))
  })

  it('returns zero SE tax when net profit is zero', () => {
    const result = computeScheduleSE(0, 0, 'single')

    expect(result.totalSETax).toBe(0)
    expect(result.deductibleHalfCents).toBe(0)
    expect(result.netSEEarnings).toBe(0)
  })

  it('returns zero SE tax when net profit is negative', () => {
    const result = computeScheduleSE(cents(-5000), 0, 'single')

    expect(result.totalSETax).toBe(0)
    expect(result.deductibleHalfCents).toBe(0)
    expect(result.netSEEarnings).toBe(0)
  })

  it('coordinates SS tax with W-2 wages at the wage base', () => {
    // W-2 wages = $150,000 (below $176,100 wage base)
    // SE income = $50,000
    // Net SE = $50,000 × 92.35% = $46,175
    // SS room = $176,100 - $150,000 = $26,100
    // SS taxable = min($46,175, $26,100) = $26,100
    const result = computeScheduleSE(cents(50000), cents(150000), 'single')

    expect(result.line3.amount).toBe(cents(46175))
    expect(result.line4a.amount).toBe(cents(26100))

    // SS tax on $26,100 (not the full $46,175)
    const ssTax = Math.round(cents(26100) * 0.124)
    expect(result.line4b.amount).toBe(ssTax)

    // Medicare on full $46,175 (no cap)
    const medicareTax = Math.round(cents(46175) * 0.029)
    expect(result.line5.amount).toBe(medicareTax)
  })

  it('computes zero SS tax when W-2 wages exceed wage base', () => {
    // W-2 wages = $200,000 (above $176,100 wage base)
    // All SS room is used up by W-2 wages
    const result = computeScheduleSE(cents(50000), cents(200000), 'single')

    expect(result.line4a.amount).toBe(0)  // no SS room
    expect(result.line4b.amount).toBe(0)  // no SS tax

    // Medicare still applies
    const netSE = Math.round(cents(50000) * 0.9235)
    expect(result.line5.amount).toBe(Math.round(netSE * 0.029))
    expect(result.totalSETax).toBe(Math.round(netSE * 0.029))
  })

  it('caps SS at the wage base for large SE income', () => {
    // SE income = $250,000, no W-2 wages
    // Net SE = $250,000 × 92.35% = $230,875
    // SS taxable = min($230,875, $176,100) = $176,100
    const result = computeScheduleSE(cents(250000), 0, 'single')

    expect(result.line4a.amount).toBe(SS_WAGE_BASE)

    // SS tax on $176,100
    const ssTax = Math.round(SS_WAGE_BASE * 0.124)
    expect(result.line4b.amount).toBe(ssTax)

    // Medicare on full $230,875
    const netSE = Math.round(cents(250000) * 0.9235)
    const medicareTax = Math.round(netSE * 0.029)
    expect(result.line5.amount).toBe(medicareTax)
  })

  it('computes deductible half correctly', () => {
    const result = computeScheduleSE(cents(60000), 0, 'single')

    // Total SE tax = SS + Medicare
    const netSE = Math.round(cents(60000) * 0.9235)
    const ss = Math.round(netSE * 0.124)
    const med = Math.round(netSE * 0.029)
    const total = ss + med
    const half = Math.round(total * 0.50)

    expect(result.totalSETax).toBe(total)
    expect(result.deductibleHalfCents).toBe(half)
    expect(result.deductibleHalf.amount).toBe(half)
  })

  it('provides net SE earnings for Additional Medicare Tax', () => {
    const result = computeScheduleSE(cents(80000), 0, 'single')
    const expectedNetSE = Math.round(cents(80000) * 0.9235)
    expect(result.netSEEarnings).toBe(expectedNetSE)
  })

  it('handles small SE income (under filing threshold)', () => {
    // $400 net profit — below the $400 SE filing threshold in practice,
    // but we still compute (the threshold check is a validation concern, not computation)
    const result = computeScheduleSE(cents(400), 0, 'single')

    const netSE = Math.round(cents(400) * 0.9235)
    expect(result.line3.amount).toBe(netSE)
    expect(result.totalSETax).toBeGreaterThan(0)
  })
})
