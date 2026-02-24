import type { FilingStatus } from '../../../model/types'
import type { TaxBracket } from '../constants'

const c = (dollars: number): number => Math.round(dollars * 100)

export const CT_TAX_BRACKETS: Record<FilingStatus, TaxBracket[]> = {
  single: [
    { rate: 0.02, floor: c(0) },
    { rate: 0.045, floor: c(10000) },
    { rate: 0.055, floor: c(50000) },
    { rate: 0.06, floor: c(100000) },
    { rate: 0.065, floor: c(200000) },
    { rate: 0.069, floor: c(250000) },
    { rate: 0.0699, floor: c(500000) },
  ],
  mfs: [
    { rate: 0.02, floor: c(0) },
    { rate: 0.045, floor: c(10000) },
    { rate: 0.055, floor: c(50000) },
    { rate: 0.06, floor: c(100000) },
    { rate: 0.065, floor: c(200000) },
    { rate: 0.069, floor: c(250000) },
    { rate: 0.0699, floor: c(500000) },
  ],
  hoh: [
    { rate: 0.02, floor: c(0) },
    { rate: 0.045, floor: c(16000) },
    { rate: 0.055, floor: c(80000) },
    { rate: 0.06, floor: c(160000) },
    { rate: 0.065, floor: c(320000) },
    { rate: 0.069, floor: c(400000) },
    { rate: 0.0699, floor: c(800000) },
  ],
  mfj: [
    { rate: 0.02, floor: c(0) },
    { rate: 0.045, floor: c(20000) },
    { rate: 0.055, floor: c(100000) },
    { rate: 0.06, floor: c(200000) },
    { rate: 0.065, floor: c(400000) },
    { rate: 0.069, floor: c(500000) },
    { rate: 0.0699, floor: c(1000000) },
  ],
  qw: [
    { rate: 0.02, floor: c(0) },
    { rate: 0.045, floor: c(20000) },
    { rate: 0.055, floor: c(100000) },
    { rate: 0.06, floor: c(200000) },
    { rate: 0.065, floor: c(400000) },
    { rate: 0.069, floor: c(500000) },
    { rate: 0.0699, floor: c(1000000) },
  ],
}

export const CT_PERSONAL_EXEMPTION: Record<FilingStatus, { maxExemption: number; phaseOutStart: number; phaseOutEnd: number }> = {
  single: { maxExemption: c(15000), phaseOutStart: c(30000), phaseOutEnd: c(44000) },
  mfs: { maxExemption: c(12000), phaseOutStart: c(24000), phaseOutEnd: c(36000) },
  hoh: { maxExemption: c(19000), phaseOutStart: c(38000), phaseOutEnd: c(57000) },
  mfj: { maxExemption: c(24000), phaseOutStart: c(48000), phaseOutEnd: c(72000) },
  qw: { maxExemption: c(24000), phaseOutStart: c(48000), phaseOutEnd: c(72000) },
}

export const CT_TABLE_C: Record<FilingStatus, { phaseOutStart: number; phaseOutEnd: number; maxAddBack: number }> = {
  single: { phaseOutStart: c(56500), phaseOutEnd: c(105000), maxAddBack: c(200) },
  mfs: { phaseOutStart: c(56500), phaseOutEnd: c(105000), maxAddBack: c(200) },
  hoh: { phaseOutStart: c(80500), phaseOutEnd: c(160000), maxAddBack: c(320) },
  mfj: { phaseOutStart: c(100500), phaseOutEnd: c(210000), maxAddBack: c(400) },
  qw: { phaseOutStart: c(100500), phaseOutEnd: c(210000), maxAddBack: c(400) },
}

export const CT_TABLE_D: Record<FilingStatus, { recaptureStart: number; recaptureEnd: number; maxRecapture: number }> = {
  single: { recaptureStart: c(105000), recaptureEnd: c(150000), maxRecapture: c(250) },
  mfs: { recaptureStart: c(105000), recaptureEnd: c(150000), maxRecapture: c(250) },
  hoh: { recaptureStart: c(168000), recaptureEnd: c(240000), maxRecapture: c(400) },
  mfj: { recaptureStart: c(210000), recaptureEnd: c(300000), maxRecapture: c(500) },
  qw: { recaptureStart: c(210000), recaptureEnd: c(300000), maxRecapture: c(500) },
}

export const CT_PROPERTY_TAX_CREDIT = {
  maxCredit: c(300),
  phaseOutRate: 0.15,
  phaseOutStep: c(10000),
  phaseOutStepMFS: c(5000),
  incomeLimit: {
    single: c(46300),
    hoh: c(46300),
    mfs: c(56500),
    mfj: c(56500),
    qw: c(56500),
  } as Record<FilingStatus, number>,
}

export const CT_EITC_RATE = 0.4
export const CT_EITC_CHILD_BONUS = c(250)
