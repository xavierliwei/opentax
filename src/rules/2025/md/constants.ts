import type { FilingStatus } from '../../../model/types'
import type { TaxBracket } from '../constants'

export const MD_STANDARD_DEDUCTION_RATE = 0.15

export const MD_STANDARD_DEDUCTION_MIN: Record<FilingStatus, number> = {
  single: 180000,
  mfj: 360000,
  mfs: 180000,
  hoh: 180000,
  qw: 360000,
}

export const MD_STANDARD_DEDUCTION_MAX: Record<FilingStatus, number> = {
  single: 275000,
  mfj: 550000,
  mfs: 275000,
  hoh: 275000,
  qw: 550000,
}

export const MD_PERSONAL_EXEMPTION: Record<FilingStatus, number> = {
  single: 320000,
  mfj: 640000,
  mfs: 320000,
  hoh: 320000,
  qw: 640000,
}

export const MD_DEPENDENT_EXEMPTION = 320000

export const MD_EXEMPTION_PHASEOUT_START: Record<FilingStatus, number> = {
  single: 10000000,
  mfj: 15000000,
  mfs: 10000000,
  hoh: 12500000,
  qw: 15000000,
}

export const MD_EXEMPTION_PHASEOUT_END: Record<FilingStatus, number> = {
  single: 15000000,
  mfj: 20000000,
  mfs: 15000000,
  hoh: 17500000,
  qw: 20000000,
}

export const MD_LOCAL_TAX_RATE_DEFAULT = 0.032

export const MD_TAX_BRACKETS: Record<FilingStatus, TaxBracket[]> = {
  single: [
    { floor: 0, rate: 0.02 },
    { floor: 100000, rate: 0.03 },
    { floor: 200000, rate: 0.04 },
    { floor: 300000, rate: 0.0475 },
    { floor: 10000000, rate: 0.05 },
    { floor: 15000000, rate: 0.0525 },
    { floor: 25000000, rate: 0.0575 },
  ],
  mfj: [
    { floor: 0, rate: 0.02 },
    { floor: 100000, rate: 0.03 },
    { floor: 300000, rate: 0.04 },
    { floor: 400000, rate: 0.0475 },
    { floor: 15000000, rate: 0.05 },
    { floor: 17500000, rate: 0.0525 },
    { floor: 22500000, rate: 0.0575 },
  ],
  mfs: [
    { floor: 0, rate: 0.02 },
    { floor: 100000, rate: 0.03 },
    { floor: 200000, rate: 0.04 },
    { floor: 300000, rate: 0.0475 },
    { floor: 10000000, rate: 0.05 },
    { floor: 12500000, rate: 0.0525 },
    { floor: 15000000, rate: 0.0575 },
  ],
  hoh: [
    { floor: 0, rate: 0.02 },
    { floor: 100000, rate: 0.03 },
    { floor: 200000, rate: 0.04 },
    { floor: 300000, rate: 0.0475 },
    { floor: 15000000, rate: 0.05 },
    { floor: 17500000, rate: 0.0525 },
    { floor: 22500000, rate: 0.0575 },
  ],
  qw: [
    { floor: 0, rate: 0.02 },
    { floor: 100000, rate: 0.03 },
    { floor: 300000, rate: 0.04 },
    { floor: 400000, rate: 0.0475 },
    { floor: 15000000, rate: 0.05 },
    { floor: 17500000, rate: 0.0525 },
    { floor: 22500000, rate: 0.0575 },
  ],
}
