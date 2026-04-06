import { describe, it, expect } from 'vitest'
import { redactPII, detectSensitiveFields } from '../../src/export/redactPII.ts'
import type { TaxReturn } from '../../src/model/types.ts'

function makeTaxReturn(overrides: Partial<TaxReturn> = {}): TaxReturn {
  return {
    taxYear: 2025,
    filingStatus: 'single',
    canBeClaimedAsDependent: false,
    taxpayer: {
      firstName: 'John',
      lastName: 'Doe',
      ssn: '123456789',
      address: { street: '123 Main St', city: 'Anytown', state: 'CA', zip: '90210' },
    },
    dependents: [],
    incomeSources: ['w2'],
    w2s: [],
    form1099Bs: [],
    form1099INTs: [],
    form1099DIVs: [],
    form1099MISCs: [],
    form1099NECs: [],
    form1099Gs: [],
    form1099Rs: [],
    formSSA1099s: [],
    form1095As: [],
    rsuVestEvents: [],
    isoExercises: [],
    form8829s: [],
    scheduleCBusinesses: [],
    scheduleK1s: [],
    scheduleEProperties: [],
    capitalTransactions: [],
    adjustments: [],
    deductions: {
      method: 'standard',
      taxpayerAge65: false,
      taxpayerBlind: false,
      spouseAge65: false,
      spouseBlind: false,
    },
    credits: [],
    ...overrides,
  } as TaxReturn
}

describe('redactPII', () => {
  it('masks taxpayer SSN', () => {
    const result = redactPII(makeTaxReturn())
    expect(result.taxpayer.ssn).toBe('***-**-6789')
  })

  it('masks spouse SSN', () => {
    const tr = makeTaxReturn({
      spouse: {
        firstName: 'Jane',
        lastName: 'Doe',
        ssn: '987654321',
        address: { street: '123 Main', city: 'Test', state: 'CA', zip: '90210' },
      },
    })
    const result = redactPII(tr)
    expect(result.spouse!.ssn).toBe('***-**-4321')
  })

  it('masks dependent SSNs', () => {
    const tr = makeTaxReturn({
      dependents: [
        {
          firstName: 'Kid',
          lastName: 'Doe',
          ssn: '111223333',
          relationship: 'son',
          monthsLived: 12,
          dateOfBirth: '2015-01-01',
        },
      ],
    })
    const result = redactPII(tr)
    expect(result.dependents[0].ssn).toBe('***-**-3333')
  })

  it('masks W-2 employer EINs', () => {
    const tr = makeTaxReturn({
      w2s: [
        {
          id: 'w2-1',
          employerEin: '12-3456789',
          employerName: 'Acme Corp',
          box1: 10000000,
          box2: 2000000,
          box3: 10000000,
          box4: 0,
          box5: 10000000,
          box6: 0,
          box7: 0,
          box8: 0,
          box10: 0,
          box11: 0,
          box12: [],
          box13StatutoryEmployee: false,
          box13RetirementPlan: false,
          box13ThirdPartySickPay: false,
          box14: '',
        },
      ],
    })
    const result = redactPII(tr)
    expect(result.w2s[0].employerEin).toBe('**-***6789')
  })

  it('masks alimonyPayerSSN', () => {
    const tr = makeTaxReturn({ alimonyPayerSSN: '555667777' })
    const result = redactPII(tr)
    expect(result.alimonyPayerSSN).toBe('***-**-7777')
  })

  it('does not mutate the original tax return', () => {
    const original = makeTaxReturn()
    redactPII(original)
    expect(original.taxpayer.ssn).toBe('123456789')
  })

  it('handles empty SSN gracefully', () => {
    const tr = makeTaxReturn()
    tr.taxpayer.ssn = ''
    const result = redactPII(tr)
    expect(result.taxpayer.ssn).toBe('')
  })

  it('masks 1099-INT payer TINs', () => {
    const tr = makeTaxReturn({
      form1099INTs: [
        {
          id: '1099int-1',
          payerName: 'Bank',
          payerTin: '98-7654321',
          box1: 50000,
          box2: 0,
          box3: 0,
          box4: 0,
          box8: 0,
          box9: false,
          box10: 0,
          box11: 0,
          box12: 0,
          box13: 0,
        } as any,
      ],
    })
    const result = redactPII(tr)
    expect(result.form1099INTs[0].payerTin).toBe('**-***4321')
  })

  it('masks Schedule C business EINs', () => {
    const tr = makeTaxReturn({
      scheduleCBusinesses: [
        {
          id: 'sc-1',
          businessName: 'My Biz',
          businessEin: '11-2223333',
          principalBusinessCode: '541511',
          accountingMethod: 'cash',
          grossReceipts: 0,
          returnsAndAllowances: 0,
          costOfGoodsSold: 0,
          advertising: 0,
          carAndTruck: 0,
          commissions: 0,
          contractLabor: 0,
          depletion: 0,
          depreciation: 0,
          insurance: 0,
          mortgageInterest: 0,
          legalAndProfessional: 0,
          officeExpenses: 0,
          pensionAndProfitSharing: 0,
          rentLease: 0,
          repairsAndMaintenance: 0,
          supplies: 0,
          taxesAndLicenses: 0,
          travel: 0,
          mealsPartial: 0,
          utilities: 0,
          wages: 0,
          otherExpenses: 0,
        } as any,
      ],
    })
    const result = redactPII(tr)
    expect(result.scheduleCBusinesses[0].businessEin).toBe('**-***3333')
  })
})

describe('detectSensitiveFields', () => {
  it('detects taxpayer SSN', () => {
    const fields = detectSensitiveFields(makeTaxReturn())
    expect(fields).toContain('Taxpayer SSN')
  })

  it('detects taxpayer address', () => {
    const fields = detectSensitiveFields(makeTaxReturn())
    expect(fields).toContain('Taxpayer address')
  })

  it('detects employer EINs', () => {
    const tr = makeTaxReturn({
      w2s: [
        {
          id: 'w2-1',
          employerEin: '12-3456789',
          employerName: 'Acme Corp',
          box1: 0, box2: 0, box3: 0, box4: 0, box5: 0, box6: 0, box7: 0,
          box8: 0, box10: 0, box11: 0, box12: [],
          box13StatutoryEmployee: false, box13RetirementPlan: false,
          box13ThirdPartySickPay: false, box14: '',
        },
      ],
    })
    const fields = detectSensitiveFields(tr)
    expect(fields).toContain('Employer EIN(s)')
  })

  it('returns empty array when no PII present', () => {
    const tr = makeTaxReturn()
    tr.taxpayer.ssn = ''
    tr.taxpayer.address = { street: '', city: '', state: '', zip: '' }
    const fields = detectSensitiveFields(tr)
    expect(fields).toEqual([])
  })

  it('detects spouse and dependent SSNs', () => {
    const tr = makeTaxReturn({
      spouse: {
        firstName: 'Jane',
        lastName: 'Doe',
        ssn: '987654321',
        address: { street: '', city: '', state: '', zip: '' },
      },
      dependents: [
        { firstName: 'Kid', lastName: 'Doe', ssn: '111223333', relationship: 'son', monthsLived: 12, dateOfBirth: '' },
      ],
    })
    const fields = detectSensitiveFields(tr)
    expect(fields).toContain('Spouse SSN')
    expect(fields).toContain('Dependent SSN(s)')
  })
})
