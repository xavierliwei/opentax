/**
 * Tests for PDF form filling helpers.
 */

import { describe, it, expect } from 'vitest'
import {
  formatDollars,
  formatDollarsAndCents,
  formatSSN,
  formatDate,
  formatDateShort,
  filingStatusLabel,
} from '../../src/forms/helpers'
import { cents } from '../../src/model/traced'

describe('formatDollars', () => {
  it('formats positive whole dollars', () => {
    expect(formatDollars(cents(75000))).toBe('75,000')
  })

  it('formats zero', () => {
    expect(formatDollars(0)).toBe('0')
  })

  it('formats negative with parentheses', () => {
    expect(formatDollars(cents(-3000))).toBe('(3,000)')
  })

  it('formats small amounts', () => {
    expect(formatDollars(cents(1))).toBe('1')
  })

  it('truncates cents', () => {
    expect(formatDollars(7599)).toBe('75')
  })

  it('formats millions with commas', () => {
    expect(formatDollars(cents(1500000))).toBe('1,500,000')
  })
})

describe('formatDollarsAndCents', () => {
  it('formats positive amount with cents', () => {
    expect(formatDollarsAndCents(7500050)).toBe('75,000.50')
  })

  it('formats zero', () => {
    expect(formatDollarsAndCents(0)).toBe('0.00')
  })

  it('formats negative with parentheses', () => {
    expect(formatDollarsAndCents(-300025)).toBe('(3,000.25)')
  })

  it('pads single-digit cents', () => {
    expect(formatDollarsAndCents(101)).toBe('1.01')
  })

  it('formats exact dollars', () => {
    expect(formatDollarsAndCents(cents(5000))).toBe('5,000.00')
  })
})

describe('formatSSN', () => {
  it('formats 9-digit SSN with dashes', () => {
    expect(formatSSN('123456789')).toBe('123-45-6789')
  })

  it('strips existing dashes', () => {
    expect(formatSSN('123-45-6789')).toBe('123-45-6789')
  })
})

describe('formatDate', () => {
  it('formats ISO date as MM/DD/YYYY', () => {
    expect(formatDate('2025-06-15')).toBe('06/15/2025')
  })

  it('formats January date', () => {
    expect(formatDate('2025-01-01')).toBe('01/01/2025')
  })
})

describe('formatDateShort', () => {
  it('formats ISO date as MM/DD/YY', () => {
    expect(formatDateShort('2025-06-15')).toBe('06/15/25')
  })

  it('returns Various for null', () => {
    expect(formatDateShort(null)).toBe('Various')
  })
})

describe('filingStatusLabel', () => {
  it('returns full label for each status', () => {
    expect(filingStatusLabel('single')).toBe('Single')
    expect(filingStatusLabel('mfj')).toBe('Married Filing Jointly')
    expect(filingStatusLabel('mfs')).toBe('Married Filing Separately')
    expect(filingStatusLabel('hoh')).toBe('Head of Household')
    expect(filingStatusLabel('qw')).toBe('Qualifying Surviving Spouse')
  })

  it('returns unknown status as-is', () => {
    expect(filingStatusLabel('unknown')).toBe('unknown')
  })
})
