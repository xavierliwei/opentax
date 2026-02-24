import { describe, expect, it } from 'vitest'
import { getPartYearDateError } from '../../../src/ui/pages/StateReturnsPage'

describe('StateReturnsPage part-year residency validation', () => {
  it('requires at least one move date', () => {
    expect(getPartYearDateError(undefined, undefined)).toBe(
      'Enter at least one date for part-year residency (move-in or move-out).',
    )
  })

  it('rejects inverted date ranges', () => {
    expect(getPartYearDateError('2025-10-01', '2025-03-01')).toBe(
      'Move-in date must be before move-out date.',
    )
  })

  it('accepts one-sided or correctly ordered ranges', () => {
    expect(getPartYearDateError('2025-04-01', undefined)).toBeNull()
    expect(getPartYearDateError(undefined, '2025-09-30')).toBeNull()
    expect(getPartYearDateError('2025-03-01', '2025-09-30')).toBeNull()
  })
})
