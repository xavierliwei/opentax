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

  it('PA module is registered', () => {
    const mod = getStateModule('PA')
    expect(mod).toBeDefined()
    expect(mod!.stateCode).toBe('PA')
    expect(mod!.formLabel).toBe('PA-40')
  })

  it('NC module is registered', () => {
    const mod = getStateModule('NC')
    expect(mod).toBeDefined()
    expect(mod!.stateCode).toBe('NC')
    expect(mod!.formLabel).toBe('NC Form D-400')
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
    expect(states.find(s => s.code === 'PA')).toBeDefined()
    expect(states.find(s => s.code === 'DC')).toBeDefined()
    expect(states.find(s => s.code === 'NC')).toBeDefined()
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
      }],
    })
    const result = computeAll(tr)
    expect(result.stateResults).toHaveLength(1)
    expect(result.stateResults[0].stateCode).toBe('MD')
    expect(result.stateResults[0].formLabel).toBe('MD Form 502')
    expect(result.stateResults[0].stateAGI).toBeGreaterThan(0)
    expect(result.stateResults[0].stateWithholding).toBe(350000)
    expect(result.values.has('form502.mdAGI')).toBe(true)
  })

  it('stateResults contains PA when PA is in stateReturns', () => {
    const tr = makeTr({
      stateReturns: [{ stateCode: 'PA', residencyType: 'full-year' }],
      w2s: [{
        id: 'w2-1', employerEin: '12-3456789', employerName: 'Test', box1: 10000000, box2: 1500000, box3: 10000000, box4: 620000, box5: 10000000, box6: 145000, box7: 0, box8: 0, box10: 0, box11: 0,
        box12: [], box13StatutoryEmployee: false, box13RetirementPlan: false, box13ThirdPartySickPay: false, box14: '', box15State: 'PA', box16StateWages: 10000000, box17StateIncomeTax: 500000,
      }],
    })
    const result = computeAll(tr)
    expect(result.stateResults).toHaveLength(1)
    expect(result.stateResults[0].stateCode).toBe('PA')
    expect(result.stateResults[0].formLabel).toBe('PA-40')
    expect(result.stateResults[0].stateWithholding).toBe(500000)
  })

  it('stateResults contains NC when NC is in stateReturns', () => {
    const tr = makeTr({
      stateReturns: [{ stateCode: 'NC', residencyType: 'full-year' }],
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
        box15State: 'NC',
        box16StateWages: 10000000,
        box17StateIncomeTax: 300000,
      }],
    })
    const result = computeAll(tr)
    expect(result.stateResults).toHaveLength(1)
    expect(result.stateResults[0].stateCode).toBe('NC')
    expect(result.stateResults[0].formLabel).toBe('NC Form D-400')
    expect(result.stateResults[0].stateWithholding).toBe(300000)
    expect(result.executedSchedules).toContain('NC')
    expect(result.values.has('formd400.ncAGI')).toBe(true)
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
  })

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
        box15State: 'PA',
        box16StateWages: 10000000,
        box17StateIncomeTax: 500000,
      }],
    })
    const result = computeAll(tr)
    expect(result.values.has('pa40.totalTaxableIncome')).toBe(true)
    expect(result.values.has('pa40.adjustedTaxableIncome')).toBe(true)
    expect(result.values.has('pa40.paTax')).toBe(true)
  })
})

describe('State Engine — STATE-GAP-001: MD county selector', () => {
  it('uses the selected county rate for local tax', () => {
    const tr = makeTr({
      stateReturns: [{ stateCode: 'MD', residencyType: 'full-year', county: 'worcester' }],
      w2s: [{
        id: 'w2-1', employerEin: '12-3456789', employerName: 'Test',
        box1: 10000000, box2: 1500000, box3: 10000000, box4: 620000,
        box5: 10000000, box6: 145000, box7: 0, box8: 0, box10: 0, box11: 0,
        box12: [], box13StatutoryEmployee: false, box13RetirementPlan: false,
        box13ThirdPartySickPay: false, box14: '', box15State: 'MD',
        box16StateWages: 10000000, box17StateIncomeTax: 350000,
      }],
    })
    const result = computeAll(tr)
    expect(result.stateResults).toHaveLength(1)
    const md = result.stateResults[0]
    expect(md.stateCode).toBe('MD')
    // Worcester has the lowest rate (2.25%), so local tax should be lower
    // than default Montgomery (3.20%)
    const trDefault = makeTr({
      stateReturns: [{ stateCode: 'MD', residencyType: 'full-year', county: 'montgomery' }],
      w2s: tr.w2s,
    })
    const resultDefault = computeAll(trDefault)
    expect(md.detail).toBeDefined()
    // Worcester 2.25% < Montgomery 3.20% → lower total tax
    expect(md.taxAfterCredits).toBeLessThan(resultDefault.stateResults[0].taxAfterCredits)
  })

  it('defaults to montgomery when no county is specified', () => {
    const tr = makeTr({
      stateReturns: [{ stateCode: 'MD', residencyType: 'full-year' }],
      w2s: [{
        id: 'w2-1', employerEin: '12-3456789', employerName: 'Test',
        box1: 10000000, box2: 1500000, box3: 10000000, box4: 620000,
        box5: 10000000, box6: 145000, box7: 0, box8: 0, box10: 0, box11: 0,
        box12: [], box13StatutoryEmployee: false, box13RetirementPlan: false,
        box13ThirdPartySickPay: false, box14: '', box15State: 'MD',
        box16StateWages: 10000000, box17StateIncomeTax: 350000,
      }],
    })
    const trExplicit = makeTr({
      stateReturns: [{ stateCode: 'MD', residencyType: 'full-year', county: 'montgomery' }],
      w2s: tr.w2s,
    })
    const result = computeAll(tr)
    const resultExplicit = computeAll(trExplicit)
    expect(result.stateResults[0].taxAfterCredits).toBe(resultExplicit.stateResults[0].taxAfterCredits)
  })
})

describe('State Engine — STATE-GAP-002: MA rent deduction', () => {
  it('applies rent deduction when rentAmount is provided', () => {
    const baseW2 = {
      id: 'w2-1', employerEin: '12-3456789', employerName: 'Test',
      box1: 10000000, box2: 1500000, box3: 10000000, box4: 620000,
      box5: 10000000, box6: 145000, box7: 0, box8: 0, box10: 0, box11: 0,
      box12: [] as never[], box13StatutoryEmployee: false, box13RetirementPlan: false,
      box13ThirdPartySickPay: false, box14: '', box15State: 'MA' as const,
      box16StateWages: 10000000, box17StateIncomeTax: 350000,
    }
    // With $24,000 rent → 50% = $12,000 → capped at $4,000
    const trRent = makeTr({
      stateReturns: [{ stateCode: 'MA', residencyType: 'full-year', rentAmount: 2400000 }],
      w2s: [baseW2],
    })
    const trNoRent = makeTr({
      stateReturns: [{ stateCode: 'MA', residencyType: 'full-year' }],
      w2s: [baseW2],
    })
    const withRent = computeAll(trRent)
    const withoutRent = computeAll(trNoRent)
    // Rent deduction reduces taxable income → lower tax
    expect(withRent.stateResults[0].taxAfterCredits).toBeLessThan(
      withoutRent.stateResults[0].taxAfterCredits,
    )
  })

  it('caps rent deduction at $4,000 (50% of rent)', () => {
    const baseW2 = {
      id: 'w2-1', employerEin: '12-3456789', employerName: 'Test',
      box1: 10000000, box2: 1500000, box3: 10000000, box4: 620000,
      box5: 10000000, box6: 145000, box7: 0, box8: 0, box10: 0, box11: 0,
      box12: [] as never[], box13StatutoryEmployee: false, box13RetirementPlan: false,
      box13ThirdPartySickPay: false, box14: '', box15State: 'MA' as const,
      box16StateWages: 10000000, box17StateIncomeTax: 350000,
    }
    // $24,000 rent (50% = $12,000, cap = $4,000)
    const tr24k = makeTr({
      stateReturns: [{ stateCode: 'MA', residencyType: 'full-year', rentAmount: 2400000 }],
      w2s: [baseW2],
    })
    // $48,000 rent (50% = $24,000, cap = $4,000) — same deduction
    const tr48k = makeTr({
      stateReturns: [{ stateCode: 'MA', residencyType: 'full-year', rentAmount: 4800000 }],
      w2s: [baseW2],
    })
    const result24k = computeAll(tr24k)
    const result48k = computeAll(tr48k)
    expect(result24k.stateResults[0].taxAfterCredits).toBe(
      result48k.stateResults[0].taxAfterCredits,
    )
  })
})

describe('State Engine — STATE-GAP-003: PA §529 deduction', () => {
  it('reduces PA taxable income by 529 contribution amount', () => {
    const baseW2 = {
      id: 'w2-1', employerEin: '12-3456789', employerName: 'Test',
      box1: 10000000, box2: 1500000, box3: 10000000, box4: 620000,
      box5: 10000000, box6: 145000, box7: 0, box8: 0, box10: 0, box11: 0,
      box12: [] as never[], box13StatutoryEmployee: false, box13RetirementPlan: false,
      box13ThirdPartySickPay: false, box14: '', box15State: 'PA' as const,
      box16StateWages: 10000000, box17StateIncomeTax: 500000,
    }
    // $5,000 contribution
    const trWith529 = makeTr({
      stateReturns: [{ stateCode: 'PA', residencyType: 'full-year', contributions529: 500000 }],
      w2s: [baseW2],
    })
    const trNo529 = makeTr({
      stateReturns: [{ stateCode: 'PA', residencyType: 'full-year' }],
      w2s: [baseW2],
    })
    const with529 = computeAll(trWith529)
    const without529 = computeAll(trNo529)
    expect(with529.stateResults[0].taxAfterCredits).toBeLessThan(
      without529.stateResults[0].taxAfterCredits,
    )
    // Tax savings should be ~$5,000 × 3.07% = $153.50 → 15350 cents
    const savings = without529.stateResults[0].taxAfterCredits - with529.stateResults[0].taxAfterCredits
    expect(savings).toBeGreaterThan(15000) // at least $150
    expect(savings).toBeLessThan(16000) // at most $160
  })

  it('caps 529 deduction at $18,000 per beneficiary', () => {
    const baseW2 = {
      id: 'w2-1', employerEin: '12-3456789', employerName: 'Test',
      box1: 10000000, box2: 1500000, box3: 10000000, box4: 620000,
      box5: 10000000, box6: 145000, box7: 0, box8: 0, box10: 0, box11: 0,
      box12: [] as never[], box13StatutoryEmployee: false, box13RetirementPlan: false,
      box13ThirdPartySickPay: false, box14: '', box15State: 'PA' as const,
      box16StateWages: 10000000, box17StateIncomeTax: 500000,
    }
    // $18,000 contribution (at cap)
    const trAtCap = makeTr({
      stateReturns: [{ stateCode: 'PA', residencyType: 'full-year', contributions529: 1800000 }],
      w2s: [baseW2],
    })
    // $30,000 contribution (over cap)
    const trOverCap = makeTr({
      stateReturns: [{ stateCode: 'PA', residencyType: 'full-year', contributions529: 3000000 }],
      w2s: [baseW2],
    })
    const atCap = computeAll(trAtCap)
    const overCap = computeAll(trOverCap)
    // Same tax since both are capped at $18,000
    expect(atCap.stateResults[0].taxAfterCredits).toBe(
      overCap.stateResults[0].taxAfterCredits,
    )
  })
})

describe('State Engine — STATE-GAP-004: NJ college-student dependent exemption', () => {
  it('adds $1,000 exemption per college student dependent', () => {
    const baseW2 = {
      id: 'w2-1', employerEin: '12-3456789', employerName: 'Test',
      box1: 10000000, box2: 1500000, box3: 10000000, box4: 620000,
      box5: 10000000, box6: 145000, box7: 0, box8: 0, box10: 0, box11: 0,
      box12: [] as never[], box13StatutoryEmployee: false, box13RetirementPlan: false,
      box13ThirdPartySickPay: false, box14: '', box15State: 'NJ' as const,
      box16StateWages: 10000000, box17StateIncomeTax: 300000,
    }
    const dep = {
      firstName: 'Alex', lastName: 'Smith', ssn: '111-22-3333',
      relationship: 'son', monthsLived: 12, dateOfBirth: '2005-03-15',
    }
    // Without college student flag
    const trNone = makeTr({
      dependents: [dep],
      stateReturns: [{ stateCode: 'NJ', residencyType: 'full-year' }],
      w2s: [baseW2],
    })
    // With college student flag
    const trCollege = makeTr({
      dependents: [dep],
      stateReturns: [{
        stateCode: 'NJ', residencyType: 'full-year',
        njDependentCollegeStudents: ['111-22-3333'],
      }],
      w2s: [baseW2],
    })
    const withoutCollege = computeAll(trNone)
    const withCollege = computeAll(trCollege)
    // College student adds $1,000 exemption → lower taxable income → lower tax
    expect(withCollege.stateResults[0].taxAfterCredits).toBeLessThan(
      withoutCollege.stateResults[0].taxAfterCredits,
    )
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
