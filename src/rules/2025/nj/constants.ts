import type { FilingStatus } from '../../../model/types'
import type { TaxBracket } from '../constants'

function c(dollars: number): number {
  return Math.round(dollars * 100)
}

// NJ allows personal/dependent exemptions but no broad standard deduction.
export const NJ_PERSONAL_EXEMPTION = c(1000)
export const NJ_DEPENDENT_EXEMPTION = c(1500)

const SINGLE_BRACKETS: TaxBracket[] = [
  { rate: 0.014, floor: c(0) },
  { rate: 0.0175, floor: c(20000) },
  { rate: 0.035, floor: c(35000) },
  { rate: 0.05525, floor: c(40000) },
  { rate: 0.0637, floor: c(75000) },
  { rate: 0.0897, floor: c(500000) },
  { rate: 0.1075, floor: c(1000000) },
]

const MFJ_BRACKETS: TaxBracket[] = [
  { rate: 0.014, floor: c(0) },
  { rate: 0.0175, floor: c(20000) },
  { rate: 0.0245, floor: c(50000) },
  { rate: 0.035, floor: c(70000) },
  { rate: 0.05525, floor: c(80000) },
  { rate: 0.0637, floor: c(150000) },
  { rate: 0.0897, floor: c(500000) },
  { rate: 0.1075, floor: c(1000000) },
]

const HOH_BRACKETS: TaxBracket[] = [
  { rate: 0.014, floor: c(0) },
  { rate: 0.0175, floor: c(20000) },
  { rate: 0.035, floor: c(50000) },
  { rate: 0.05525, floor: c(70000) },
  { rate: 0.0637, floor: c(80000) },
  { rate: 0.0897, floor: c(500000) },
  { rate: 0.1075, floor: c(1000000) },
]

export const NJ_TAX_BRACKETS: Record<FilingStatus, TaxBracket[]> = {
  single: SINGLE_BRACKETS,
  mfs: SINGLE_BRACKETS,
  mfj: MFJ_BRACKETS,
  qw: MFJ_BRACKETS,
  hoh: HOH_BRACKETS,
}
