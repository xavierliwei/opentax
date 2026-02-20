import { create } from 'zustand'
import { persist, type StorageValue } from 'zustand/middleware'
import { openDB } from 'idb'
import type {
  TaxReturn,
  FilingStatus,
  W2,
  Form1099INT,
  Form1099DIV,
  Form1099MISC,
  Form1099G,
  Form1099R,
  Form1099B,
  CapitalTransaction,
  Taxpayer,
  Dependent,
  RSUVestEvent,
  ISOExercise,
  ScheduleEProperty,
  ItemizedDeductions,
  PriorYearInfo,
  DependentCareExpenses,
  RetirementContributions,
  EnergyCredits,
  EducationExpenses,
  HSAInfo,
} from '../model/types.ts'
import { emptyTaxReturn } from '../model/types.ts'
import { computeAll } from '../rules/engine.ts'
import type { ComputeResult } from '../rules/engine.ts'
import { processRSUAdjustments } from '../rules/2025/rsuAdjustment.ts'
import { putDeductions } from './deductionsApi.ts'

// ── Types ──────────────────────────────────────────────────────

export interface TaxStoreState {
  taxReturn: TaxReturn
  computeResult: ComputeResult
  _lastChangeSource: 'full' | 'deductions'

  // Actions
  setFilingStatus: (status: FilingStatus) => void
  setCanBeClaimedAsDependent: (value: boolean) => void
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
  appendForm1099INTs: (forms: Form1099INT[]) => void
  updateForm1099INT: (id: string, form: Partial<Form1099INT>) => void
  removeForm1099INT: (id: string) => void
  addForm1099DIV: (form: Form1099DIV) => void
  appendForm1099DIVs: (forms: Form1099DIV[]) => void
  updateForm1099DIV: (id: string, form: Partial<Form1099DIV>) => void
  removeForm1099DIV: (id: string) => void
  addForm1099MISC: (form: Form1099MISC) => void
  appendForm1099MISCs: (forms: Form1099MISC[]) => void
  updateForm1099MISC: (id: string, form: Partial<Form1099MISC>) => void
  removeForm1099MISC: (id: string) => void
  addForm1099G: (form: Form1099G) => void
  updateForm1099G: (id: string, form: Partial<Form1099G>) => void
  removeForm1099G: (id: string) => void
  addForm1099R: (form: Form1099R) => void
  appendForm1099Rs: (forms: Form1099R[]) => void
  updateForm1099R: (id: string, form: Partial<Form1099R>) => void
  removeForm1099R: (id: string) => void
  setForm1099Bs: (forms: Form1099B[]) => void
  appendForm1099Bs: (forms: Form1099B[]) => void
  addForm1099B: (form: Form1099B) => void
  updateForm1099B: (id: string, form: Partial<Form1099B>) => void
  removeForm1099B: (id: string) => void
  removeForm1099BsByBroker: (brokerName: string) => void
  addRSUVestEvent: (event: RSUVestEvent) => void
  removeRSUVestEvent: (id: string) => void
  addISOExercise: (exercise: ISOExercise) => void
  removeISOExercise: (id: string) => void
  addScheduleEProperty: (prop: ScheduleEProperty) => void
  updateScheduleEProperty: (id: string, updates: Partial<ScheduleEProperty>) => void
  removeScheduleEProperty: (id: string) => void
  setCapitalTransactions: (txns: CapitalTransaction[]) => void
  setPriorYear: (updates: Partial<PriorYearInfo>) => void
  setDeductionMethod: (method: 'standard' | 'itemized') => void
  setDeductionFlags: (flags: Partial<Pick<TaxReturn['deductions'], 'taxpayerAge65' | 'taxpayerBlind' | 'spouseAge65' | 'spouseBlind'>>) => void
  setItemizedDeductions: (itemized: Partial<ItemizedDeductions>) => void
  setDependentCare: (updates: Partial<DependentCareExpenses>) => void
  setRetirementContributions: (updates: Partial<RetirementContributions>) => void
  setEnergyCredits: (updates: Partial<EnergyCredits>) => void
  setEducationExpenses: (expenses: EducationExpenses) => void
  setStudentLoanInterest: (cents: number) => void
  setEstimatedTaxPayment: (quarter: 'q1' | 'q2' | 'q3' | 'q4', cents: number) => void
  setHSA: (updates: Partial<HSAInfo>) => void
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

/**
 * Re-derive capitalTransactions from form1099Bs + rsuVestEvents.
 * Called any time either collection changes so the rules engine stays in sync.
 */
function withDerivedCapital(taxReturn: TaxReturn): TaxReturn {
  const { transactions } = processRSUAdjustments(
    taxReturn.form1099Bs,
    taxReturn.rsuVestEvents,
  )
  return { ...taxReturn, capitalTransactions: transactions }
}

function recompute(
  taxReturn: TaxReturn,
  source: 'full' | 'deductions' = 'full',
): Pick<TaxStoreState, 'taxReturn' | 'computeResult' | '_lastChangeSource'> {
  return { taxReturn, computeResult: computeAll(taxReturn), _lastChangeSource: source }
}

// ── Store ──────────────────────────────────────────────────────

const initialReturn = emptyTaxReturn(2025)

export const useTaxStore = create<TaxStoreState>()(
  persist(
    (set, get) => ({
      taxReturn: initialReturn,
      computeResult: computeAll(initialReturn),
      _lastChangeSource: 'full' as const,

      setFilingStatus: (status) => {
        const prev = get().taxReturn
        const tr = { ...prev, filingStatus: status }
        // Remove spouse when switching away from MFJ
        if (status !== 'mfj' && prev.filingStatus === 'mfj') {
          delete tr.spouse
        }
        set(recompute(tr))
      },

      setCanBeClaimedAsDependent: (value) => {
        const tr = { ...get().taxReturn, canBeClaimedAsDependent: value }
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

      appendForm1099INTs: (forms) => {
        const tr = {
          ...get().taxReturn,
          form1099INTs: [...get().taxReturn.form1099INTs, ...forms],
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

      appendForm1099DIVs: (forms) => {
        const tr = {
          ...get().taxReturn,
          form1099DIVs: [...get().taxReturn.form1099DIVs, ...forms],
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

      addForm1099MISC: (form) => {
        const tr = {
          ...get().taxReturn,
          form1099MISCs: [...get().taxReturn.form1099MISCs, form],
        }
        set(recompute(tr))
      },

      appendForm1099MISCs: (forms) => {
        const tr = {
          ...get().taxReturn,
          form1099MISCs: [...get().taxReturn.form1099MISCs, ...forms],
        }
        set(recompute(tr))
      },

      updateForm1099MISC: (id, updates) => {
        const tr = {
          ...get().taxReturn,
          form1099MISCs: get().taxReturn.form1099MISCs.map((f) =>
            f.id === id ? { ...f, ...updates } : f,
          ),
        }
        set(recompute(tr))
      },

      removeForm1099MISC: (id) => {
        const tr = {
          ...get().taxReturn,
          form1099MISCs: get().taxReturn.form1099MISCs.filter((f) => f.id !== id),
        }
        set(recompute(tr))
      },

      addForm1099G: (form) => {
        const tr = {
          ...get().taxReturn,
          form1099Gs: [...(get().taxReturn.form1099Gs ?? []), form],
        }
        set(recompute(tr))
      },

      updateForm1099G: (id, updates) => {
        const tr = {
          ...get().taxReturn,
          form1099Gs: (get().taxReturn.form1099Gs ?? []).map((f) =>
            f.id === id ? { ...f, ...updates } : f,
          ),
        }
        set(recompute(tr))
      },

      removeForm1099G: (id) => {
        const tr = {
          ...get().taxReturn,
          form1099Gs: (get().taxReturn.form1099Gs ?? []).filter((f) => f.id !== id),
        }
        set(recompute(tr))
      },

      addForm1099R: (form) => {
        const tr = {
          ...get().taxReturn,
          form1099Rs: [...(get().taxReturn.form1099Rs ?? []), form],
        }
        set(recompute(tr))
      },

      appendForm1099Rs: (forms) => {
        const tr = {
          ...get().taxReturn,
          form1099Rs: [...(get().taxReturn.form1099Rs ?? []), ...forms],
        }
        set(recompute(tr))
      },

      updateForm1099R: (id, updates) => {
        const tr = {
          ...get().taxReturn,
          form1099Rs: (get().taxReturn.form1099Rs ?? []).map((f) =>
            f.id === id ? { ...f, ...updates } : f,
          ),
        }
        set(recompute(tr))
      },

      removeForm1099R: (id) => {
        const tr = {
          ...get().taxReturn,
          form1099Rs: (get().taxReturn.form1099Rs ?? []).filter((f) => f.id !== id),
        }
        set(recompute(tr))
      },

      setForm1099Bs: (forms) => {
        const tr = withDerivedCapital({ ...get().taxReturn, form1099Bs: forms })
        set(recompute(tr))
      },

      appendForm1099Bs: (forms) => {
        const prev = get().taxReturn
        const tr = withDerivedCapital({
          ...prev,
          form1099Bs: [...prev.form1099Bs, ...forms],
        })
        set(recompute(tr))
      },

      addForm1099B: (form) => {
        const prev = get().taxReturn
        const tr = withDerivedCapital({
          ...prev,
          form1099Bs: [...prev.form1099Bs, form],
        })
        set(recompute(tr))
      },

      updateForm1099B: (id, updates) => {
        const prev = get().taxReturn
        const tr = withDerivedCapital({
          ...prev,
          form1099Bs: prev.form1099Bs.map((f) => (f.id === id ? { ...f, ...updates } : f)),
        })
        set(recompute(tr))
      },

      removeForm1099B: (id) => {
        const prev = get().taxReturn
        const tr = withDerivedCapital({
          ...prev,
          form1099Bs: prev.form1099Bs.filter((f) => f.id !== id),
        })
        set(recompute(tr))
      },

      removeForm1099BsByBroker: (brokerName) => {
        const prev = get().taxReturn
        const tr = withDerivedCapital({
          ...prev,
          form1099Bs: prev.form1099Bs.filter((f) => f.brokerName !== brokerName),
        })
        set(recompute(tr))
      },

      addRSUVestEvent: (event) => {
        const prev = get().taxReturn
        const tr = withDerivedCapital({
          ...prev,
          rsuVestEvents: [...prev.rsuVestEvents, event],
        })
        set(recompute(tr))
      },

      removeRSUVestEvent: (id) => {
        const prev = get().taxReturn
        const tr = withDerivedCapital({
          ...prev,
          rsuVestEvents: prev.rsuVestEvents.filter((e) => e.id !== id),
        })
        set(recompute(tr))
      },

      addISOExercise: (exercise) => {
        const prev = get().taxReturn
        const tr = { ...prev, isoExercises: [...prev.isoExercises, exercise] }
        set(recompute(tr))
      },

      removeISOExercise: (id) => {
        const prev = get().taxReturn
        const tr = { ...prev, isoExercises: prev.isoExercises.filter((e) => e.id !== id) }
        set(recompute(tr))
      },

      addScheduleEProperty: (prop) => {
        const prev = get().taxReturn
        const tr = { ...prev, scheduleEProperties: [...prev.scheduleEProperties, prop] }
        set(recompute(tr))
      },

      updateScheduleEProperty: (id, updates) => {
        const prev = get().taxReturn
        const tr = {
          ...prev,
          scheduleEProperties: prev.scheduleEProperties.map((p) =>
            p.id === id ? { ...p, ...updates } : p,
          ),
        }
        set(recompute(tr))
      },

      removeScheduleEProperty: (id) => {
        const prev = get().taxReturn
        const tr = {
          ...prev,
          scheduleEProperties: prev.scheduleEProperties.filter((p) => p.id !== id),
        }
        set(recompute(tr))
      },

      setCapitalTransactions: (txns) => {
        const tr = { ...get().taxReturn, capitalTransactions: txns }
        set(recompute(tr))
      },

      setPriorYear: (updates) => {
        const prev = get().taxReturn
        const defaults: PriorYearInfo = {
          agi: 0,
          capitalLossCarryforwardST: 0,
          capitalLossCarryforwardLT: 0,
          itemizedLastYear: false,
        }
        const existing: PriorYearInfo = { ...defaults, ...prev.priorYear }
        const tr = {
          ...prev,
          priorYear: { ...existing, ...updates },
        }
        set(recompute(tr))
      },

      setDeductionMethod: (method) => {
        const tr = {
          ...get().taxReturn,
          deductions: { ...get().taxReturn.deductions, method },
        }
        set(recompute(tr, 'deductions'))
        putDeductions({ method })
      },

      setDeductionFlags: (flags) => {
        const tr = {
          ...get().taxReturn,
          deductions: { ...get().taxReturn.deductions, ...flags },
        }
        set(recompute(tr, 'deductions'))
      },

      setItemizedDeductions: (itemized) => {
        const prev = get().taxReturn
        const existing = prev.deductions.itemized ?? {
          medicalExpenses: 0,
          stateLocalIncomeTaxes: 0,
          stateLocalSalesTaxes: 0,
          realEstateTaxes: 0,
          personalPropertyTaxes: 0,
          mortgageInterest: 0,
          mortgagePrincipal: 0,
          mortgagePreTCJA: false,
          investmentInterest: 0,
          priorYearInvestmentInterestCarryforward: 0,
          charitableCash: 0,
          charitableNoncash: 0,
          gamblingLosses: 0,
          casualtyTheftLosses: 0,
          federalEstateTaxIRD: 0,
          otherMiscDeductions: 0,
        }
        const tr = {
          ...prev,
          deductions: {
            ...prev.deductions,
            itemized: { ...existing, ...itemized },
          },
        }
        set(recompute(tr, 'deductions'))
        putDeductions({ itemized: { ...existing, ...itemized } })
      },

      setDependentCare: (updates) => {
        const prev = get().taxReturn
        const existing = prev.dependentCare ?? {
          totalExpenses: 0,
          numQualifyingPersons: 0,
        }
        const tr = {
          ...prev,
          dependentCare: { ...existing, ...updates },
        }
        set(recompute(tr))
      },

      setRetirementContributions: (updates) => {
        const prev = get().taxReturn
        const existing = prev.retirementContributions ?? {
          traditionalIRA: 0,
          rothIRA: 0,
        }
        const tr = {
          ...prev,
          retirementContributions: { ...existing, ...updates },
        }
        set(recompute(tr))
      },

      setEnergyCredits: (updates) => {
        const prev = get().taxReturn
        const existing = prev.energyCredits ?? {
          solarElectric: 0,
          solarWaterHeating: 0,
          batteryStorage: 0,
          geothermal: 0,
          insulation: 0,
          windows: 0,
          exteriorDoors: 0,
          centralAC: 0,
          waterHeater: 0,
          heatPump: 0,
          homeEnergyAudit: 0,
          biomassStove: 0,
        }
        const tr = {
          ...prev,
          energyCredits: { ...existing, ...updates },
        }
        set(recompute(tr))
      },

      setEducationExpenses: (expenses) => {
        const tr = { ...get().taxReturn, educationExpenses: expenses }
        set(recompute(tr))
      },

      setStudentLoanInterest: (cents) => {
        const tr = { ...get().taxReturn, studentLoanInterest: cents || undefined }
        set(recompute(tr))
      },

      setEstimatedTaxPayment: (quarter, cents) => {
        const prev = get().taxReturn
        const existing = prev.estimatedTaxPayments ?? { q1: 0, q2: 0, q3: 0, q4: 0 }
        const updated = { ...existing, [quarter]: cents }
        // Clear if all zero
        const allZero = updated.q1 === 0 && updated.q2 === 0 && updated.q3 === 0 && updated.q4 === 0
        const tr = { ...prev, estimatedTaxPayments: allZero ? undefined : updated }
        set(recompute(tr))
      },

      setHSA: (updates) => {
        const prev = get().taxReturn
        const existing = prev.hsa ?? {
          coverageType: 'self-only' as const,
          contributions: 0,
          qualifiedExpenses: 0,
          age55OrOlder: false,
          age65OrDisabled: false,
        }
        const tr = {
          ...prev,
          hsa: { ...existing, ...updates },
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
          // Merge with defaults so fields added after the user's last save
          // (e.g. form1099MISCs) are initialised instead of undefined.
          state.taxReturn = { ...emptyTaxReturn(state.taxReturn.taxYear), ...state.taxReturn }

          // Ensure itemized sub-fields added after the user's last save default to 0
          if (state.taxReturn.deductions.itemized) {
            const defaults: ItemizedDeductions = {
              medicalExpenses: 0,
              stateLocalIncomeTaxes: 0,
              stateLocalSalesTaxes: 0,
              realEstateTaxes: 0,
              personalPropertyTaxes: 0,
              mortgageInterest: 0,
              mortgagePrincipal: 0,
              mortgagePreTCJA: false,
              investmentInterest: 0,
              priorYearInvestmentInterestCarryforward: 0,
              charitableCash: 0,
              charitableNoncash: 0,
              gamblingLosses: 0,
              casualtyTheftLosses: 0,
              federalEstateTaxIRD: 0,
              otherMiscDeductions: 0,
            }
            state.taxReturn.deductions.itemized = { ...defaults, ...state.taxReturn.deductions.itemized }
          }

          // Migrate legacy otherDeductions → otherMiscDeductions
          const it = state.taxReturn.deductions.itemized
          if (it) {
            const raw = it as unknown as Record<string, unknown>
            const legacy = raw.otherDeductions
            if (typeof legacy === 'number' && legacy > 0 &&
                it.gamblingLosses === 0 && it.casualtyTheftLosses === 0 &&
                it.federalEstateTaxIRD === 0 && it.otherMiscDeductions === 0) {
              it.otherMiscDeductions = legacy
            }
            delete raw.otherDeductions
          }

          state.computeResult = computeAll(state.taxReturn)
        }
      },
    },
  ),
)
