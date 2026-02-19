import { describe, it, expect } from 'vitest'
import { cents } from '../../src/model/traced'
import { emptyTaxReturn } from '../../src/model/types'
import type { TaxReturn, Form1099MISC } from '../../src/model/types'
import { computeSchedule1 } from '../../src/rules/2025/schedule1'
import { computeForm1040 } from '../../src/rules/2025/form1040'
import { computeAll } from '../../src/rules/engine'

// ── Helper ─────────────────────────────────────────────────────

function make1099MISC(overrides: Partial<Form1099MISC> & { id: string; payerName: string }): Form1099MISC {
  return {
    box1: 0,
    box2: 0,
    box3: 0,
    box4: 0,
    ...overrides,
  }
}

function withMISC(forms: Form1099MISC[]): TaxReturn {
  return { ...emptyTaxReturn(2025), form1099MISCs: forms }
}

// ── Schedule 1 computation ─────────────────────────────────────

describe('computeSchedule1', () => {
  it('returns zeros when no 1099-MISC forms', () => {
    const result = computeSchedule1(emptyTaxReturn(2025))
    expect(result.line5.amount).toBe(0)
    expect(result.line8z.amount).toBe(0)
    expect(result.line10.amount).toBe(0)
  })

  it('sums rents into line5', () => {
    const model = withMISC([
      make1099MISC({ id: 'm1', payerName: 'Landlord Co', box1: cents(12000) }),
    ])
    const result = computeSchedule1(model)
    expect(result.line5.amount).toBe(cents(12000))
    expect(result.line8z.amount).toBe(0)
    expect(result.line10.amount).toBe(cents(12000))
  })

  it('sums royalties into line5', () => {
    const model = withMISC([
      make1099MISC({ id: 'm1', payerName: 'Publisher', box2: cents(5000) }),
    ])
    const result = computeSchedule1(model)
    expect(result.line5.amount).toBe(cents(5000))
    expect(result.line10.amount).toBe(cents(5000))
  })

  it('combines rents and royalties in line5', () => {
    const model = withMISC([
      make1099MISC({ id: 'm1', payerName: 'Mixed', box1: cents(10000), box2: cents(3000) }),
    ])
    const result = computeSchedule1(model)
    expect(result.line5.amount).toBe(cents(13000))
    expect(result.line10.amount).toBe(cents(13000))
  })

  it('puts other income (box3) in line8z', () => {
    const model = withMISC([
      make1099MISC({ id: 'm1', payerName: 'Prize Co', box3: cents(2500) }),
    ])
    const result = computeSchedule1(model)
    expect(result.line5.amount).toBe(0)
    expect(result.line8z.amount).toBe(cents(2500))
    expect(result.line10.amount).toBe(cents(2500))
  })

  it('sums mixed income across multiple forms', () => {
    const model = withMISC([
      make1099MISC({ id: 'm1', payerName: 'Landlord', box1: cents(15000) }),
      make1099MISC({ id: 'm2', payerName: 'Publisher', box2: cents(4000) }),
      make1099MISC({ id: 'm3', payerName: 'Lottery', box3: cents(1000) }),
    ])
    const result = computeSchedule1(model)
    expect(result.line5.amount).toBe(cents(15000) + cents(4000))
    expect(result.line8z.amount).toBe(cents(1000))
    expect(result.line10.amount).toBe(cents(15000) + cents(4000) + cents(1000))
  })

  it('traces rents to 1099misc:{id}:box1', () => {
    const model = withMISC([
      make1099MISC({ id: 'abc', payerName: 'Landlord', box1: cents(8000) }),
    ])
    const result = computeSchedule1(model)
    expect(result.line5.source).toMatchObject({
      kind: 'computed',
      inputs: ['1099misc:abc:box1'],
    })
  })

  it('traces other income to 1099misc:{id}:box3', () => {
    const model = withMISC([
      make1099MISC({ id: 'xyz', payerName: 'Prize', box3: cents(500) }),
    ])
    const result = computeSchedule1(model)
    expect(result.line8z.source).toMatchObject({
      kind: 'computed',
      inputs: ['1099misc:xyz:box3'],
    })
  })
})

// ── Integration: Schedule 1 → Form 1040 Line 8 ────────────────

describe('Form 1040 Line 8 with 1099-MISC', () => {
  it('line8 = 0 when no 1099-MISC', () => {
    const result = computeForm1040(emptyTaxReturn(2025))
    expect(result.line8.amount).toBe(0)
  })

  it('line8 = schedule1.line10 with rent income', () => {
    const model = withMISC([
      make1099MISC({ id: 'm1', payerName: 'Landlord', box1: cents(20000) }),
    ])
    const result = computeForm1040(model)
    expect(result.line8.amount).toBe(cents(20000))
    expect(result.schedule1).not.toBeNull()
    expect(result.schedule1!.line10.amount).toBe(cents(20000))
  })

  it('schedule1.line10 = form1040.line8 cross-check', () => {
    const model = withMISC([
      make1099MISC({ id: 'm1', payerName: 'A', box1: cents(5000), box3: cents(1000) }),
    ])
    const result = computeForm1040(model)
    expect(result.schedule1!.line10.amount).toBe(result.line8.amount)
  })
})

// ── Integration: AGI includes 1099-MISC ────────────────────────

describe('AGI includes 1099-MISC income', () => {
  it('AGI increases with rental income', () => {
    const base = computeForm1040(emptyTaxReturn(2025))

    const model = withMISC([
      make1099MISC({ id: 'm1', payerName: 'Landlord', box1: cents(30000) }),
    ])
    const withRent = computeForm1040(model)

    expect(withRent.line11.amount).toBe(base.line11.amount + cents(30000))
  })
})

// ── Integration: Line 25 withholding ───────────────────────────

describe('Line 25 includes 1099-MISC Box 4', () => {
  it('adds 1099-MISC Box 4 to federal withholding', () => {
    const model = withMISC([
      make1099MISC({ id: 'm1', payerName: 'Payer', box1: cents(10000), box4: cents(2000) }),
    ])
    const result = computeForm1040(model)
    expect(result.line25.amount).toBe(cents(2000))
  })

  it('Box 4 traces to 1099misc:{id}:box4', () => {
    const model = withMISC([
      make1099MISC({ id: 'w1', payerName: 'Payer', box4: cents(500) }),
    ])
    const result = computeForm1040(model)
    if (result.line25.source.kind === 'computed') {
      expect(result.line25.source.inputs).toContain('1099misc:w1:box4')
    }
  })
})

// ── Engine: executedSchedules includes '1' ─────────────────────

describe('computeAll with 1099-MISC', () => {
  it('includes Schedule 1 in executedSchedules', () => {
    const model = withMISC([
      make1099MISC({ id: 'm1', payerName: 'Landlord', box1: cents(5000) }),
    ])
    const result = computeAll(model)
    expect(result.executedSchedules).toContain('1')
  })

  it('does not include Schedule 1 when no 1099-MISC income', () => {
    const result = computeAll(emptyTaxReturn(2025))
    expect(result.executedSchedules).not.toContain('1')
  })

  it('includes 1099-MISC document leaf nodes in values map', () => {
    const model = withMISC([
      make1099MISC({ id: 'm1', payerName: 'Test', box1: cents(1000), box3: cents(500) }),
    ])
    const result = computeAll(model)
    expect(result.values.has('1099misc:m1:box1')).toBe(true)
    expect(result.values.has('1099misc:m1:box3')).toBe(true)
    expect(result.values.get('1099misc:m1:box1')!.amount).toBe(cents(1000))
  })
})
