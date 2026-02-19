import { create } from 'zustand'
import { persist, type StorageValue } from 'zustand/middleware'
import { openDB } from 'idb'
import type {
  TaxReturn,
  FilingStatus,
  W2,
  Form1099INT,
  Form1099DIV,
  CapitalTransaction,
  Taxpayer,
  Dependent,
  RSUVestEvent,
  ItemizedDeductions,
} from '../model/types.ts'
import { emptyTaxReturn } from '../model/types.ts'
import { computeAll } from '../rules/engine.ts'
import type { ComputeResult } from '../rules/engine.ts'

// ── Types ──────────────────────────────────────────────────────

export interface TaxStoreState {
  taxReturn: TaxReturn
  computeResult: ComputeResult

  // Actions
  setFilingStatus: (status: FilingStatus) => void
  setTaxpayer: (taxpayer: Partial<Taxpayer>) => void
  setSpouse: (spouse: Partial<Taxpayer>) => void
  removeSpouse: () => void
  addDependent: (dep: Dependent) => void
  updateDependent: (index: number, dep: Partial<Dependent>) => void
  removeDependent: (index: number) => void
  addW2: (w2: W2) => void
  updateW2: (id: string, w2: Partial<W2>) => void
  removeW2: (id: string) => void
  addForm1099INT: (form: Form1099INT) => void
  updateForm1099INT: (id: string, form: Partial<Form1099INT>) => void
  removeForm1099INT: (id: string) => void
  addForm1099DIV: (form: Form1099DIV) => void
  updateForm1099DIV: (id: string, form: Partial<Form1099DIV>) => void
  removeForm1099DIV: (id: string) => void
  addRSUVestEvent: (event: RSUVestEvent) => void
  removeRSUVestEvent: (id: string) => void
  setCapitalTransactions: (txns: CapitalTransaction[]) => void
  setDeductionMethod: (method: 'standard' | 'itemized') => void
  setItemizedDeductions: (itemized: Partial<ItemizedDeductions>) => void
  importReturn: (taxReturn: TaxReturn) => void
  resetReturn: () => void
}

// ── IndexedDB storage adapter ──────────────────────────────────

const DB_NAME = 'opentax'
const STORE_NAME = 'state'
const KEY = 'taxReturn'

const idbStorage = {
  async getItem(name: string): Promise<StorageValue<Pick<TaxStoreState, 'taxReturn'>> | null> {
    const db = await openDB(DB_NAME, 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME)
        }
      },
    })
    const val = await db.get(STORE_NAME, `${name}:${KEY}`)
    return val ?? null
  },
  async setItem(name: string, value: StorageValue<Pick<TaxStoreState, 'taxReturn'>>) {
    const db = await openDB(DB_NAME, 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME)
        }
      },
    })
    await db.put(STORE_NAME, value, `${name}:${KEY}`)
  },
  async removeItem(name: string) {
    const db = await openDB(DB_NAME, 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME)
        }
      },
    })
    await db.delete(STORE_NAME, `${name}:${KEY}`)
  },
}

// ── Helpers ────────────────────────────────────────────────────

function recompute(taxReturn: TaxReturn): Pick<TaxStoreState, 'taxReturn' | 'computeResult'> {
  return { taxReturn, computeResult: computeAll(taxReturn) }
}

// ── Store ──────────────────────────────────────────────────────

const initialReturn = emptyTaxReturn(2025)

export const useTaxStore = create<TaxStoreState>()(
  persist(
    (set, get) => ({
      taxReturn: initialReturn,
      computeResult: computeAll(initialReturn),

      setFilingStatus: (status) => {
        const prev = get().taxReturn
        const tr = { ...prev, filingStatus: status }
        // Remove spouse when switching away from MFJ
        if (status !== 'mfj' && prev.filingStatus === 'mfj') {
          delete tr.spouse
        }
        set(recompute(tr))
      },

      setTaxpayer: (updates) => {
        const prev = get().taxReturn
        const tr = {
          ...prev,
          taxpayer: {
            ...prev.taxpayer,
            ...updates,
            address: { ...prev.taxpayer.address, ...(updates.address ?? {}) },
          },
        }
        set(recompute(tr))
      },

      setSpouse: (updates) => {
        const prev = get().taxReturn
        const existing = prev.spouse ?? {
          firstName: '',
          lastName: '',
          ssn: '',
          address: { street: '', city: '', state: '', zip: '' },
        }
        const tr = {
          ...prev,
          spouse: {
            ...existing,
            ...updates,
            address: { ...existing.address, ...(updates.address ?? {}) },
          },
        }
        set(recompute(tr))
      },

      removeSpouse: () => {
        const { spouse: _, ...rest } = get().taxReturn
        set(recompute(rest as TaxReturn))
      },

      addDependent: (dep) => {
        const tr = {
          ...get().taxReturn,
          dependents: [...get().taxReturn.dependents, dep],
        }
        set(recompute(tr))
      },

      updateDependent: (index, updates) => {
        const tr = {
          ...get().taxReturn,
          dependents: get().taxReturn.dependents.map((d, i) =>
            i === index ? { ...d, ...updates } : d,
          ),
        }
        set(recompute(tr))
      },

      removeDependent: (index) => {
        const tr = {
          ...get().taxReturn,
          dependents: get().taxReturn.dependents.filter((_, i) => i !== index),
        }
        set(recompute(tr))
      },

      addW2: (w2) => {
        const tr = { ...get().taxReturn, w2s: [...get().taxReturn.w2s, w2] }
        set(recompute(tr))
      },

      updateW2: (id, updates) => {
        const tr = {
          ...get().taxReturn,
          w2s: get().taxReturn.w2s.map((w) => (w.id === id ? { ...w, ...updates } : w)),
        }
        set(recompute(tr))
      },

      removeW2: (id) => {
        const tr = {
          ...get().taxReturn,
          w2s: get().taxReturn.w2s.filter((w) => w.id !== id),
        }
        set(recompute(tr))
      },

      addForm1099INT: (form) => {
        const tr = {
          ...get().taxReturn,
          form1099INTs: [...get().taxReturn.form1099INTs, form],
        }
        set(recompute(tr))
      },

      updateForm1099INT: (id, updates) => {
        const tr = {
          ...get().taxReturn,
          form1099INTs: get().taxReturn.form1099INTs.map((f) =>
            f.id === id ? { ...f, ...updates } : f,
          ),
        }
        set(recompute(tr))
      },

      removeForm1099INT: (id) => {
        const tr = {
          ...get().taxReturn,
          form1099INTs: get().taxReturn.form1099INTs.filter((f) => f.id !== id),
        }
        set(recompute(tr))
      },

      addForm1099DIV: (form) => {
        const tr = {
          ...get().taxReturn,
          form1099DIVs: [...get().taxReturn.form1099DIVs, form],
        }
        set(recompute(tr))
      },

      updateForm1099DIV: (id, updates) => {
        const tr = {
          ...get().taxReturn,
          form1099DIVs: get().taxReturn.form1099DIVs.map((f) =>
            f.id === id ? { ...f, ...updates } : f,
          ),
        }
        set(recompute(tr))
      },

      removeForm1099DIV: (id) => {
        const tr = {
          ...get().taxReturn,
          form1099DIVs: get().taxReturn.form1099DIVs.filter((f) => f.id !== id),
        }
        set(recompute(tr))
      },

      addRSUVestEvent: (event) => {
        const tr = {
          ...get().taxReturn,
          rsuVestEvents: [...get().taxReturn.rsuVestEvents, event],
        }
        set(recompute(tr))
      },

      removeRSUVestEvent: (id) => {
        const tr = {
          ...get().taxReturn,
          rsuVestEvents: get().taxReturn.rsuVestEvents.filter((e) => e.id !== id),
        }
        set(recompute(tr))
      },

      setCapitalTransactions: (txns) => {
        const tr = { ...get().taxReturn, capitalTransactions: txns }
        set(recompute(tr))
      },

      setDeductionMethod: (method) => {
        const tr = {
          ...get().taxReturn,
          deductions: { ...get().taxReturn.deductions, method },
        }
        set(recompute(tr))
      },

      setItemizedDeductions: (itemized) => {
        const prev = get().taxReturn
        const existing = prev.deductions.itemized ?? {
          medicalExpenses: 0,
          stateLocalTaxes: 0,
          mortgageInterest: 0,
          charitableCash: 0,
          charitableNoncash: 0,
          otherDeductions: 0,
        }
        const tr = {
          ...prev,
          deductions: {
            ...prev.deductions,
            itemized: { ...existing, ...itemized },
          },
        }
        set(recompute(tr))
      },

      importReturn: (taxReturn) => {
        set(recompute(taxReturn))
      },

      resetReturn: () => {
        set(recompute(emptyTaxReturn(2025)))
      },
    }),
    {
      name: 'opentax-store',
      storage: idbStorage,
      partialize: (state) => ({ taxReturn: state.taxReturn }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.computeResult = computeAll(state.taxReturn)
        }
      },
    },
  ),
)
