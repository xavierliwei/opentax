/**
 * Gap analysis engine — determines what's still needed to file a tax return.
 *
 * Returns completion percentage, missing items, warnings, and a natural
 * language suggestion for the agent to relay to the user.
 *
 * Shared between client (dashboard) and server (OpenClaw plugin).
 */

import type { TaxReturn } from '../model/types.ts'
import type { ComputeResult } from './engine.ts'
import { dollars } from '../model/traced.ts'

export type GapPriority = 'required' | 'recommended' | 'optional'
export type GapCategory = 'personal' | 'filing-status' | 'spouse' | 'income' | 'deductions' | 'withholding'

export interface GapItem {
  category: GapCategory
  field: string
  label: string
  priority: GapPriority
}

export interface GapAnalysisResult {
  items: GapItem[]
  completionPercent: number
  readyToFile: boolean
  nextSuggestedAction: string
  warnings: string[]
}

export function analyzeGaps(taxReturn: TaxReturn, computeResult: ComputeResult): GapAnalysisResult {
  const items: GapItem[] = []
  const warnings: string[] = []

  // ── Personal info ────────────────────────────────────────────
  const tp = taxReturn.taxpayer

  if (!tp.firstName || !tp.lastName) {
    items.push({ category: 'personal', field: 'name', label: 'Taxpayer name', priority: 'required' })
  }

  if (!tp.ssn || tp.ssn.length !== 9) {
    items.push({ category: 'personal', field: 'ssn', label: 'Taxpayer SSN', priority: 'required' })
  }

  if (!tp.address.street) {
    items.push({ category: 'personal', field: 'address.street', label: 'Street address', priority: 'required' })
  }

  if (!tp.address.city) {
    items.push({ category: 'personal', field: 'address.city', label: 'City', priority: 'required' })
  }

  if (!tp.address.state) {
    items.push({ category: 'personal', field: 'address.state', label: 'State', priority: 'required' })
  }

  if (!tp.address.zip) {
    items.push({ category: 'personal', field: 'address.zip', label: 'ZIP code', priority: 'required' })
  }

  // ── Filing status ────────────────────────────────────────────
  if (!tp.firstName && !tp.lastName) {
    items.push({
      category: 'filing-status',
      field: 'filingStatus',
      label: 'Confirm filing status',
      priority: 'required',
    })
  }

  // ── Spouse (if MFJ) ──────────────────────────────────────────
  if (taxReturn.filingStatus === 'mfj') {
    const sp = taxReturn.spouse
    if (!sp) {
      items.push({ category: 'spouse', field: 'spouse', label: 'Spouse information', priority: 'required' })
    } else {
      if (!sp.firstName || !sp.lastName) {
        items.push({ category: 'spouse', field: 'spouse.name', label: 'Spouse name', priority: 'required' })
      }
      if (!sp.ssn || sp.ssn.length !== 9) {
        items.push({ category: 'spouse', field: 'spouse.ssn', label: 'Spouse SSN', priority: 'required' })
      }
    }
  }

  // ── Income documents ─────────────────────────────────────────
  const hasAnyIncome =
    taxReturn.w2s.length > 0 ||
    taxReturn.form1099INTs.length > 0 ||
    taxReturn.form1099DIVs.length > 0 ||
    taxReturn.form1099Bs.length > 0 ||
    taxReturn.capitalTransactions.length > 0

  if (!hasAnyIncome) {
    items.push({
      category: 'income',
      field: 'income',
      label: 'Income documents (W-2, 1099, etc.)',
      priority: 'required',
    })
  }

  // ── Withholding ──────────────────────────────────────────────
  const totalWithholding = computeResult.form1040.line25.amount
  const totalTax = computeResult.form1040.line24.amount

  if (hasAnyIncome && totalWithholding === 0 && totalTax > 0) {
    warnings.push(
      `You have $${dollars(totalTax).toLocaleString('en-US', { minimumFractionDigits: 2 })} in estimated tax but no federal withholding recorded. ` +
      `Make sure your W-2 Box 2 and 1099 Box 4 amounts are entered.`
    )
    items.push({
      category: 'withholding',
      field: 'withholding',
      label: 'Federal tax withholding',
      priority: 'recommended',
    })
  }

  // ── Deductions ───────────────────────────────────────────────
  if (taxReturn.deductions.method === 'itemized') {
    const itemized = taxReturn.deductions.itemized
    if (!itemized) {
      items.push({
        category: 'deductions',
        field: 'itemized',
        label: 'Itemized deduction amounts',
        priority: 'recommended',
      })
    } else {
      const total =
        itemized.medicalExpenses +
        itemized.stateLocalIncomeTaxes +
        itemized.stateLocalSalesTaxes +
        itemized.realEstateTaxes +
        itemized.personalPropertyTaxes +
        itemized.mortgageInterest +
        itemized.investmentInterest +
        itemized.charitableCash +
        itemized.charitableNoncash +
        itemized.otherDeductions
      if (total === 0) {
        warnings.push(
          'Itemized deductions selected but all amounts are $0. Consider entering deduction amounts or switching to standard deduction.'
        )
        items.push({
          category: 'deductions',
          field: 'itemized',
          label: 'Itemized deduction amounts',
          priority: 'recommended',
        })
      }
      // Mortgage interest entered without principal balance — the interest cap
      // calculation needs the loan balance to apply the $750K/$1M limit correctly
      if (itemized.mortgageInterest > 0 && !itemized.mortgagePrincipal) {
        warnings.push(
          'Mortgage interest entered without a loan balance. Enter your outstanding mortgage principal (Form 1098, Box 2) so the $750K/$1M interest deduction limit can be applied correctly.'
        )
        items.push({
          category: 'deductions',
          field: 'mortgagePrincipal',
          label: 'Mortgage principal balance',
          priority: 'recommended',
        })
      }
    }
  }

  // ── Completion percentage ────────────────────────────────────
  const requiredTotal = items.filter((i) => i.priority === 'required').length
  const recommendedTotal = items.filter((i) => i.priority === 'recommended').length

  // Base: personal info (6 fields) + filing status (1) + income (1) = 8 required items
  // For MFJ add 3 more (spouse, spouse.name, spouse.ssn)
  const maxRequired = taxReturn.filingStatus === 'mfj' ? 11 : 8
  const maxRecommended = 2 // withholding + deductions

  const requiredComplete = Math.max(0, maxRequired - requiredTotal)
  const recommendedComplete = Math.max(0, maxRecommended - recommendedTotal)

  const totalWeight = maxRequired * 10 + maxRecommended * 3
  const completedWeight = requiredComplete * 10 + recommendedComplete * 3
  const completionPercent = totalWeight > 0 ? Math.round((completedWeight / totalWeight) * 100) : 100

  // ── Ready to file ────────────────────────────────────────────
  const readyToFile = requiredTotal === 0

  // ── Next suggested action ────────────────────────────────────
  let nextSuggestedAction: string

  if (readyToFile && warnings.length === 0) {
    nextSuggestedAction = 'All sections complete — offer to review and export.'
  } else if (readyToFile && warnings.length > 0) {
    nextSuggestedAction = 'All required info is present but there are warnings to review.'
  } else {
    const firstRequired = items.find((i) => i.priority === 'required')
    if (firstRequired) {
      switch (firstRequired.category) {
        case 'personal':
          nextSuggestedAction = "Ask the user for their personal information (name, SSN, address)."
          break
        case 'filing-status':
          nextSuggestedAction = "Ask the user to confirm their filing status."
          break
        case 'spouse':
          nextSuggestedAction = "Ask the user for their spouse's information (name, SSN)."
          break
        case 'income':
          nextSuggestedAction = "Ask the user for their W-2 or other income documents."
          break
        default:
          nextSuggestedAction = `Collect missing information: ${firstRequired.label}.`
      }
    } else {
      const firstRecommended = items.find((i) => i.priority === 'recommended')
      nextSuggestedAction = firstRecommended
        ? `Review recommended item: ${firstRecommended.label}.`
        : 'All sections complete — offer to review and export.'
    }
  }

  return {
    items,
    completionPercent,
    readyToFile,
    nextSuggestedAction,
    warnings,
  }
}
