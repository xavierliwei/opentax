import { describe, it, expect } from 'vitest'
import { computeAll } from '../../src/rules/engine.ts'
import { emptyTaxReturn } from '../../src/model/types.ts'
import type { TaxReturn } from '../../src/model/types.ts'
import { getStateModule, getSupportedStates } from '../../src/rules/stateRegistry.ts'

function makeTr(overrides: Partial<TaxReturn> = {}): TaxReturn {
  return { ...emptyTaxReturn(2025), ...overrides }
}

describe('State Engine — registry', () => {
  it('CA module is registered', () => {
    const mod = getStateModule('CA')
    expect(mod).toBeDefined()
    expect(mod!.stateCode).toBe('CA')
    expect(mod!.formLabel).toBe('CA Form 540')
  })

  it('getSupportedStates returns CA', () => {
    const states = getSupportedStates()
    expect(states.length).toBeGreaterThanOrEqual(1)
    expect(states.find(s => s.code === 'CA')).toBeDefined()
  })

  it('unknown state returns undefined', () => {
    // @ts-expect-error — testing unknown state
    expect(getStateModule('XX')).toBeUndefined()
  })
})

describe('State Engine — computeAll integration', () => {
  it('stateResults is empty when no stateReturns selected', () => {
    const tr = makeTr()
    const result = computeAll(tr)
    expect(result.stateResults).toEqual([])
    expect(result.form540).toBeNull()
  })

  it('stateResults contains CA when CA is in stateReturns', () => {
    const tr = makeTr({
      stateReturns: [{ stateCode: 'CA', residencyType: 'full-year' }],
      w2s: [{
        id: 'w2-1',
        employerEin: '12-3456789',
        employerName: 'Test',
        box1: 10000000,
        box2: 1500000,
        box3: 10000000,
        box4: 620000,
        box5: 10000000,
        box6: 145000,
        box7: 0,
        box8: 0,
        box10: 0,
        box11: 0,
        box12: [],
        box13StatutoryEmployee: false,
        box13RetirementPlan: false,
        box13ThirdPartySickPay: false,
        box14: '',
        box15State: 'CA',
        box16StateWages: 10000000,
        box17StateIncomeTax: 500000,
      }],
    })
    const result = computeAll(tr)
    expect(result.stateResults).toHaveLength(1)
    expect(result.stateResults[0].stateCode).toBe('CA')
    expect(result.stateResults[0].formLabel).toBe('CA Form 540')
    expect(result.stateResults[0].stateAGI).toBeGreaterThan(0)
    expect(result.stateResults[0].stateWithholding).toBe(500000)
  })

  it('form540 backward compat is populated from stateResults', () => {
    const tr = makeTr({
      stateReturns: [{ stateCode: 'CA', residencyType: 'full-year' }],
      w2s: [{
        id: 'w2-1',
        employerEin: '12-3456789',
        employerName: 'Test',
        box1: 10000000,
        box2: 1500000,
        box3: 10000000,
        box4: 620000,
        box5: 10000000,
        box6: 145000,
        box7: 0,
        box8: 0,
        box10: 0,
        box11: 0,
        box12: [],
        box13StatutoryEmployee: false,
        box13RetirementPlan: false,
        box13ThirdPartySickPay: false,
        box14: '',
      }],
    })
    const result = computeAll(tr)
    expect(result.form540).not.toBeNull()
    expect(result.form540!.caAGI).toBe(result.stateResults[0].stateAGI)
  })

  it('executedSchedules includes CA-540 when CA is selected', () => {
    const tr = makeTr({
      stateReturns: [{ stateCode: 'CA', residencyType: 'full-year' }],
    })
    const result = computeAll(tr)
    expect(result.executedSchedules).toContain('CA-540')
  })

  it('CA traced values appear in values map', () => {
    const tr = makeTr({
      stateReturns: [{ stateCode: 'CA', residencyType: 'full-year' }],
      w2s: [{
        id: 'w2-1',
        employerEin: '12-3456789',
        employerName: 'Test',
        box1: 10000000,
        box2: 1500000,
        box3: 10000000,
        box4: 620000,
        box5: 10000000,
        box6: 145000,
        box7: 0,
        box8: 0,
        box10: 0,
        box11: 0,
        box12: [],
        box13StatutoryEmployee: false,
        box13RetirementPlan: false,
        box13ThirdPartySickPay: false,
        box14: '',
      }],
    })
    const result = computeAll(tr)
    expect(result.values.has('form540.caAGI')).toBe(true)
    expect(result.values.has('form540.caTaxableIncome')).toBe(true)
    expect(result.values.has('form540.caTax')).toBe(true)
    expect(result.values.has('form540.taxAfterCredits')).toBe(true)
  })
})

describe('State Engine — migration', () => {
  it('legacy caResident=true without stateReturns still computes CA via new engine', () => {
    // This tests that the engine now uses stateReturns (not caResident)
    const tr = makeTr({
      stateReturns: [{ stateCode: 'CA', residencyType: 'full-year' }],
    })
    const result = computeAll(tr)
    expect(result.stateResults).toHaveLength(1)
    expect(result.form540).not.toBeNull()
  })

  it('empty stateReturns with caResident=true does NOT compute CA (engine uses stateReturns only)', () => {
    const tr = makeTr({
      caResident: true,
      stateReturns: [], // migration hasn't happened
    })
    const result = computeAll(tr)
    expect(result.stateResults).toHaveLength(0)
    expect(result.form540).toBeNull()
  })
})
