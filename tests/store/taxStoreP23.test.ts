import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock idb — IndexedDB is not available in the node test environment
vi.mock('idb', () => ({
  openDB: vi.fn(() =>
    Promise.resolve({
      get: vi.fn(() => Promise.resolve(undefined)),
      put: vi.fn(() => Promise.resolve()),
      delete: vi.fn(() => Promise.resolve()),
    }),
  ),
}))

// Import store after mock is in place
const { useTaxStore } = await import('../../src/store/taxStore.ts')
import { emptyTaxReturn } from '../../src/model/types.ts'
import type { Dependent } from '../../src/model/types.ts'

beforeEach(() => {
  useTaxStore.getState().resetReturn()
})

function getState() {
  return useTaxStore.getState()
}

describe('taxStore — P2.3 actions', () => {
  it('setTaxpayer merges taxpayer fields', () => {
    getState().setTaxpayer({ firstName: 'Alice', lastName: 'Smith' })
    const tp = getState().taxReturn.taxpayer
    expect(tp.firstName).toBe('Alice')
    expect(tp.lastName).toBe('Smith')
    // SSN should remain empty (not overwritten)
    expect(tp.ssn).toBe('')
  })

  it('setTaxpayer merges address fields without overwriting unset ones', () => {
    getState().setTaxpayer({ address: { street: '123 Main St', city: '', state: '', zip: '' } })
    getState().setTaxpayer({ address: { street: '123 Main St', city: 'Springfield', state: 'IL', zip: '62701' } })
    const addr = getState().taxReturn.taxpayer.address
    expect(addr.street).toBe('123 Main St')
    expect(addr.city).toBe('Springfield')
    expect(addr.state).toBe('IL')
  })

  it('setSpouse creates spouse when none exists', () => {
    expect(getState().taxReturn.spouse).toBeUndefined()
    getState().setSpouse({ firstName: 'Bob' })
    const sp = getState().taxReturn.spouse!
    expect(sp.firstName).toBe('Bob')
    expect(sp.lastName).toBe('')
  })

  it('removeSpouse deletes spouse', () => {
    getState().setSpouse({ firstName: 'Bob', lastName: 'Jones' })
    expect(getState().taxReturn.spouse).toBeDefined()
    getState().removeSpouse()
    expect(getState().taxReturn.spouse).toBeUndefined()
  })

  it('setFilingStatus away from mfj removes spouse', () => {
    getState().setFilingStatus('mfj')
    getState().setSpouse({ firstName: 'Bob' })
    expect(getState().taxReturn.spouse).toBeDefined()
    getState().setFilingStatus('single')
    expect(getState().taxReturn.spouse).toBeUndefined()
  })

  it('addDependent adds a dependent', () => {
    const dep: Dependent = {
      firstName: 'Charlie',
      lastName: 'Smith',
      ssn: '987654321',
      relationship: 'son',
      monthsLived: 12,
    }
    getState().addDependent(dep)
    expect(getState().taxReturn.dependents).toHaveLength(1)
    expect(getState().taxReturn.dependents[0].firstName).toBe('Charlie')
  })

  it('updateDependent modifies a dependent by index', () => {
    const dep: Dependent = {
      firstName: 'Charlie',
      lastName: 'Smith',
      ssn: '987654321',
      relationship: 'son',
      monthsLived: 12,
    }
    getState().addDependent(dep)
    getState().updateDependent(0, { firstName: 'Charlotte', relationship: 'daughter' })
    const updated = getState().taxReturn.dependents[0]
    expect(updated.firstName).toBe('Charlotte')
    expect(updated.relationship).toBe('daughter')
    expect(updated.lastName).toBe('Smith') // unchanged
  })

  it('removeDependent removes a dependent by index', () => {
    const dep1: Dependent = {
      firstName: 'A', lastName: 'X', ssn: '111111111', relationship: 'son', monthsLived: 12,
    }
    const dep2: Dependent = {
      firstName: 'B', lastName: 'Y', ssn: '222222222', relationship: 'daughter', monthsLived: 6,
    }
    getState().addDependent(dep1)
    getState().addDependent(dep2)
    expect(getState().taxReturn.dependents).toHaveLength(2)
    getState().removeDependent(0)
    expect(getState().taxReturn.dependents).toHaveLength(1)
    expect(getState().taxReturn.dependents[0].firstName).toBe('B')
  })
})
