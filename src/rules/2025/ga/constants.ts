import type { FilingStatus } from '../../../model/types'

function c(dollars: number): number {
  return Math.round(dollars * 100)
}

export const GA_TAX_RATE = 0.0519

export const GA_STANDARD_DEDUCTION: Record<FilingStatus, number> = {
  single: c(12000),
  mfj: c(24000),
  mfs: c(12000),
  hoh: c(12000),
  qw: c(24000),
}

export const GA_DEPENDENT_EXEMPTION = c(3000)

export const GA_LOW_INCOME_AGI_LIMIT = c(20000)
export const GA_LOW_INCOME_CREDIT: Record<FilingStatus, number> = {
  single: c(26),
  mfj: c(26),
  mfs: c(26),
  hoh: c(26),
  qw: c(26),
}

export const GA_DEPENDENT_CARE_CREDIT_RATE = 0.5
