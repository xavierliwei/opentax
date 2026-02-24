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

  it('GA module is registered', () => {
    const mod = getStateModule('GA')
    expect(mod).toBeDefined()
    expect(mod!.stateCode).toBe('GA')
    expect(mod!.formLabel).toBe('GA Form 500')
  })

  it('MD module is registered', () => {
    const mod = getStateModule('MD')
    expect(mod).toBeDefined()
    expect(mod!.stateCode).toBe('MD')
    expect(mod!.formLabel).toBe('MD Form 502')
  })

  it('VA module is registered', () => {
    const mod = getStateModule('VA')
    expect(mod).toBeDefined()
    expect(mod!.stateCode).toBe('VA')
    expect(mod!.formLabel).toBe('VA Form 760')
  })

  it('getSupportedStates returns all registered states', () => {
    const states = getSupportedStates()
    expect(states.length).toBeGreaterThanOrEqual(6)
    expect(states.find(s => s.code === 'CA')).toBeDefined()
    expect(states.find(s => s.code === 'GA')).toBeDefined()
    expect(states.find(s => s.code === 'MA')).toBeDefined()
    expect(states.find(s => s.code === 'MD')).toBeDefined()
    expect(states.find(s => s.code === 'NJ')).toBeDefined()
    expect(states.find(s => s.code === 'VA')).toBeDefined()
  it('PA module is registered', () => {
    const mod = getStateModule('PA')
    expect(mod).toBeDefined()
    expect(mod!.stateCode).toBe('PA')
    expect(mod!.formLabel).toBe('PA-40')
  })

  it('getSupportedStates returns CA and PA', () => {
    const states = getSupportedStates()
    expect(states.find(s => s.code === 'CA')).toBeDefined()
    expect(states.find(s => s.code === 'PA')).toBeDefined()
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
        id: 'w2-1', employerEin: '12-3456789', employerName: 'Test', box1: 10000000, box2: 1500000, box3: 10000000, box4: 620000, box5: 10000000, box6: 145000, box7: 0, box8: 0, box10: 0, box11: 0,
        box12: [], box13StatutoryEmployee: false, box13RetirementPlan: false, box13ThirdPartySickPay: false, box14: '', box15State: 'CA', box16StateWages: 10000000, box17StateIncomeTax: 500000,
      }],
    })
    const result = computeAll(tr)
    expect(result.stateResults).toHaveLength(1)
    expect(result.stateResults[0].stateCode).toBe('CA')
    expect(result.stateResults[0].formLabel).toBe('CA Form 540')
    expect(result.stateResults[0].stateAGI).toBeGreaterThan(0)
    expect(result.stateResults[0].stateWithholding).toBe(500000)
  })

  it('stateResults contains MD when MD is in stateReturns', () => {
    const tr = makeTr({
      stateReturns: [{ stateCode: 'MD', residencyType: 'full-year' }],
      w2s: [{
        id: 'w2-1', employerEin: '12-3456789', employerName: 'Test', box1: 9000000, box2: 900000, box3: 9000000, box4: 558000, box5: 9000000, box6: 130500, box7: 0, box8: 0, box10: 0, box11: 0,
        box12: [], box13StatutoryEmployee: false, box13RetirementPlan: false, box13ThirdPartySickPay: false, box14: '', box15State: 'MD', box16StateWages: 9000000, box17StateIncomeTax: 350000,
  it('stateResults contains PA when PA is in stateReturns', () => {
    const tr = makeTr({
      stateReturns: [{ stateCode: 'PA', residencyType: 'full-year' }],
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
        box15State: 'PA',
        box16StateWages: 10000000,
        box17StateIncomeTax: 500000,
      }],
    })
    const result = computeAll(tr)
    expect(result.stateResults).toHaveLength(1)
    expect(result.stateResults[0].stateCode).toBe('MD')
    expect(result.stateResults[0].formLabel).toBe('MD Form 502')
    expect(result.stateResults[0].stateAGI).toBeGreaterThan(0)
    expect(result.stateResults[0].stateWithholding).toBe(350000)
    expect(result.values.has('form502.mdAGI')).toBe(true)
    expect(result.stateResults[0].stateCode).toBe('PA')
    expect(result.stateResults[0].formLabel).toBe('PA-40')
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

  it('stateResults contains NJ when NJ is in stateReturns', () => {
    const tr = makeTr({
      stateReturns: [{ stateCode: 'NJ', residencyType: 'full-year' }],
      w2s: [{
        id: 'w2-nj-1', employerEin: '12-3456789', employerName: 'Test',
        box1: 10000000, box2: 1500000, box3: 10000000, box4: 620000,
        box5: 10000000, box6: 145000, box7: 0, box8: 0, box10: 0, box11: 0,
        box12: [], box13StatutoryEmployee: false, box13RetirementPlan: false,
        box13ThirdPartySickPay: false, box14: '', box15State: 'NJ', box16StateWages: 10000000, box17StateIncomeTax: 300000,
      }],
    })
    const result = computeAll(tr)
    expect(result.stateResults).toHaveLength(1)
    expect(result.stateResults[0].stateCode).toBe('NJ')
    expect(result.stateResults[0].formLabel).toBe('NJ Form NJ-1040')
    expect(result.stateResults[0].stateWithholding).toBe(300000)
  })

  it('executedSchedules includes CA-540 when CA is selected', () => {
    const tr = makeTr({
      stateReturns: [{ stateCode: 'CA', residencyType: 'full-year' }],
    })
    const result = computeAll(tr)
    expect(result.executedSchedules).toContain('CA-540')
  })

  it('executedSchedules includes PA when PA is selected', () => {
    const tr = makeTr({
      stateReturns: [{ stateCode: 'PA', residencyType: 'full-year' }],
    })
    const result = computeAll(tr)
    expect(result.executedSchedules).toContain('PA')
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

  it('stateResults contains MA when MA is in stateReturns', () => {
    const tr = makeTr({
      stateReturns: [{ stateCode: 'MA', residencyType: 'full-year' }],
  it('PA traced values appear in values map', () => {
    const tr = makeTr({
      stateReturns: [{ stateCode: 'PA', residencyType: 'full-year' }],
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
        box15State: 'MA',
        box16StateWages: 10000000,
        box17StateIncomeTax: 350000,
      }],
    })
    const result = computeAll(tr)
    expect(result.stateResults).toHaveLength(1)
    expect(result.stateResults[0].stateCode).toBe('MA')
    expect(result.stateResults[0].formLabel).toBe('MA Form 1')
    expect(result.values.has('form1.maAGI')).toBe(true)
    expect(result.values.has('form1.maIncomeTax')).toBe(true)
  })

  it('stateResults contains VA when VA is in stateReturns', () => {
    const tr = makeTr({
      stateReturns: [{ stateCode: 'VA', residencyType: 'full-year' }],
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
        box15State: 'VA',
        box15State: 'PA',
        box16StateWages: 10000000,
        box17StateIncomeTax: 500000,
      }],
    })
    const result = computeAll(tr)
    expect(result.stateResults).toHaveLength(1)
    expect(result.stateResults[0].stateCode).toBe('VA')
    expect(result.stateResults[0].formLabel).toBe('VA Form 760')
    expect(result.stateResults[0].stateWithholding).toBe(500000)
    expect(result.executedSchedules).toContain('VA-760')
    expect(result.values.has('form760.vaAGI')).toBe(true)
    expect(result.values.has('form760.vaTaxableIncome')).toBe(true)
    expect(result.values.has('form760.vaTax')).toBe(true)
    expect(result.values.has('pa40.totalTaxableIncome')).toBe(true)
    expect(result.values.has('pa40.adjustedTaxableIncome')).toBe(true)
    expect(result.values.has('pa40.paTax')).toBe(true)
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
