import { createContext, useContext, useMemo, useState } from 'react'
import type { Dispatch, ReactNode, SetStateAction } from 'react'
import { computeDeterministicSummary, initialModel } from '../data/mock'
import type { OpenTaxModel } from '../types/opentax'

interface OpenTaxContextValue {
  model: OpenTaxModel
  setModel: Dispatch<SetStateAction<OpenTaxModel>>
}

const OpenTaxContext = createContext<OpenTaxContextValue | null>(null)

export function OpenTaxProvider({ children }: { children: ReactNode }) {
  const [model, setModel] = useState<OpenTaxModel>(() => {
    const computed = computeDeterministicSummary(initialModel)
    return {
      ...initialModel,
      computationNodes: computed.nodes,
      mappings: computed.mappings,
    }
  })

  const value = useMemo(() => ({ model, setModel }), [model])
  return <OpenTaxContext.Provider value={value}>{children}</OpenTaxContext.Provider>
}

export function useOpenTax() {
  const ctx = useContext(OpenTaxContext)
  if (!ctx) throw new Error('useOpenTax must be used within OpenTaxProvider')
  return ctx
}
