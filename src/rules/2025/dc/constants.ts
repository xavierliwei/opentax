import type { FilingStatus } from '../../../model/types'
import type { TaxBracket } from '../constants'

function c(dollars: number): number { return Math.round(dollars * 100) }

export const DC_STANDARD_DEDUCTION: Record<FilingStatus, number> = {
  single: c(14600),
  mfj: c(29200),
  mfs: c(14600),
  hoh: c(21900),
  qw: c(29200),
}

const DC_BRACKETS: TaxBracket[] = [
  { rate: 0.04, floor: c(0) },
  { rate: 0.06, floor: c(10_000) },
  { rate: 0.065, floor: c(40_000) },
  { rate: 0.085, floor: c(60_000) },
  { rate: 0.0875, floor: c(250_000) },
  { rate: 0.0885, floor: c(500_000) },
  { rate: 0.0895, floor: c(1_000_000) },
]

export const DC_TAX_BRACKETS: Record<FilingStatus, TaxBracket[]> = {
  single: DC_BRACKETS,
  mfj: DC_BRACKETS,
  mfs: DC_BRACKETS,
  hoh: DC_BRACKETS,
  qw: DC_BRACKETS,
}

export const DC_COMMUTER_EXEMPT_STATES = new Set(['MD', 'VA'])
