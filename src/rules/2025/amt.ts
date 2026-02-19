/**
 * Alternative Minimum Tax (AMT) — Form 6251
 *
 * Computes AMT using:
 * - Part I:  Alternative Minimum Taxable Income (AMTI)
 * - Part II: AMT Exemption with 25% phase-out
 * - Part III: Tentative Minimum Tax (26%/28% or QDCG variant)
 *
 * AMT = max(0, tentative minimum tax − regular tax)
 *
 * Source: 2025 Form 6251 instructions
 * All amounts in integer cents.
 */

import type { FilingStatus, ISOExercise } from '../../model/types'
import {
  AMT_EXEMPTION,
  AMT_PHASEOUT_THRESHOLD,
  AMT_PHASEOUT_RATE,
  AMT_28_PERCENT_THRESHOLD,
  LTCG_BRACKETS,
} from './constants'
import type { TaxBracket } from './constants'

// ── Result type ──────────────────────────────────────────────────

export interface AMTResult {
  // Part I — Alternative Minimum Taxable Income
  line1_taxableIncome: number
  line2a_saltAddBack: number
  line2g_privateActivityBondInterest: number
  line2i_isoSpread: number
  line4_amti: number

  // Part II — Exemption
  line5_exemption: number
  line8_phaseOutReduction: number
  line9_reducedExemption: number
  line10_amtiAfterExemption: number

  // Part III — Tentative Minimum Tax
  tentativeMinimumTax: number
  regularTax: number
  amt: number
}

// ── ISO spread computation ──────────────────────────────────────

export function computeISOSpread(isoExercises: ISOExercise[]): number {
  let total = 0
  for (const iso of isoExercises) {
    const spreadPerShare = iso.fmvAtExercise - iso.exercisePrice
    if (spreadPerShare > 0) {
      total += spreadPerShare * iso.sharesExercised
    }
  }
  return total
}

// ── AMT 26%/28% bracket computation ────────────────────────────

function computeAMTBracketTax(amtiAfterExemption: number, filingStatus: FilingStatus): number {
  if (amtiAfterExemption <= 0) return 0

  const threshold = AMT_28_PERCENT_THRESHOLD[filingStatus]

  if (amtiAfterExemption <= threshold) {
    return Math.round(amtiAfterExemption * 0.26)
  }

  // 26% on amount up to threshold, 28% on the rest
  return Math.round(threshold * 0.26 + (amtiAfterExemption - threshold) * 0.28)
}

// ── AMT QDCG worksheet ──────────────────────────────────────────
// When the taxpayer has qualified dividends or net LTCG, those amounts
// should be taxed at the preferential 0%/15%/20% rates even within AMT,
// rather than at the flat 26%/28%. This mirrors the regular tax QDCG
// worksheet but stacks against AMTI-after-exemption.

function computeAMTWithQDCG(
  amtiAfterExemption: number,
  qualifiedDividends: number,
  netLTCG: number,
  filingStatus: FilingStatus,
): number {
  if (amtiAfterExemption <= 0) return 0

  // Preferential income within AMTI
  const preferentialIncome = Math.min(qualifiedDividends + netLTCG, amtiAfterExemption)

  if (preferentialIncome <= 0) {
    return computeAMTBracketTax(amtiAfterExemption, filingStatus)
  }

  // Ordinary AMTI portion (taxed at 26%/28%)
  const ordinaryAMTI = amtiAfterExemption - preferentialIncome
  const ordinaryTax = computeAMTBracketTax(ordinaryAMTI, filingStatus)

  // Preferential portion taxed at LTCG rates, stacked above ordinary AMTI
  const ltcgBrackets: TaxBracket[] = LTCG_BRACKETS[filingStatus]
  let prefTax = 0

  for (let i = 0; i < ltcgBrackets.length; i++) {
    const bracketFloor = ltcgBrackets[i].floor
    const bracketCeiling = i + 1 < ltcgBrackets.length
      ? ltcgBrackets[i + 1].floor
      : Infinity
    const rate = ltcgBrackets[i].rate

    // Intersect [bracketFloor, bracketCeiling) with [ordinaryAMTI, amtiAfterExemption]
    const segmentBottom = Math.max(bracketFloor, ordinaryAMTI)
    const segmentTop = Math.min(bracketCeiling, amtiAfterExemption)

    if (segmentTop > segmentBottom) {
      prefTax += (segmentTop - segmentBottom) * rate
    }
  }

  prefTax = Math.round(prefTax)
  const qdcgTax = ordinaryTax + prefTax

  // Safety: never exceed what the flat 26%/28% would produce
  const flatTax = computeAMTBracketTax(amtiAfterExemption, filingStatus)
  return Math.min(qdcgTax, flatTax)
}

// ── Main AMT computation ────────────────────────────────────────

export function computeAMT(
  taxableIncome: number,
  regularTax: number,
  filingStatus: FilingStatus,
  saltDeduction: number,
  isoExercises: ISOExercise[],
  privateActivityBondInterest: number,
  qualifiedDividends: number,
  netLTCG: number,
): AMTResult {
  // Part I — AMTI
  const line1 = taxableIncome
  const line2a = saltDeduction  // SALT deduction added back
  const line2g = privateActivityBondInterest
  const line2i = computeISOSpread(isoExercises)
  const line4 = line1 + line2a + line2g + line2i

  // Part II — Exemption
  const line5 = AMT_EXEMPTION[filingStatus]
  const threshold = AMT_PHASEOUT_THRESHOLD[filingStatus]
  const excessOverThreshold = Math.max(0, line4 - threshold)
  const line8 = Math.round(excessOverThreshold * AMT_PHASEOUT_RATE)
  const line9 = Math.max(0, line5 - line8)
  const line10 = Math.max(0, line4 - line9)

  // Part III — Tentative Minimum Tax
  const hasPreferential = qualifiedDividends > 0 || netLTCG > 0
  const tmt = hasPreferential
    ? computeAMTWithQDCG(line10, qualifiedDividends, netLTCG, filingStatus)
    : computeAMTBracketTax(line10, filingStatus)

  // AMT = max(0, TMT - regular tax)
  const amt = Math.max(0, tmt - regularTax)

  return {
    line1_taxableIncome: line1,
    line2a_saltAddBack: line2a,
    line2g_privateActivityBondInterest: line2g,
    line2i_isoSpread: line2i,
    line4_amti: line4,
    line5_exemption: line5,
    line8_phaseOutReduction: line8,
    line9_reducedExemption: line9,
    line10_amtiAfterExemption: line10,
    tentativeMinimumTax: tmt,
    regularTax,
    amt,
  }
}
