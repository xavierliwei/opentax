/**
 * Federal Return Validation
 *
 * Identifies unsupported scenarios, data integrity issues, and
 * conditions that require user attention. Returns structured
 * warnings that can be displayed in the UI or included in reports.
 *
 * Validation is non-blocking — the return is still computed,
 * but warnings inform the user of limitations or potential errors.
 */

import type { TaxReturn } from '../../model/types'
import type { Form1040Result } from './form1040'

// ── Types ──────────────────────────────────────────────────────

export type ValidationSeverity = 'info' | 'warning' | 'error'

export interface FederalValidationItem {
  code: string                // machine-readable code (e.g., 'UNSUPPORTED_SE_TAX')
  severity: ValidationSeverity
  message: string             // user-facing message
  irsCitation?: string        // relevant IRS form/line
  category: 'unsupported' | 'data-quality' | 'accuracy' | 'compliance'
}

export interface FederalValidationResult {
  items: FederalValidationItem[]
  hasErrors: boolean
  hasWarnings: boolean
}

// ── Validation functions ───────────────────────────────────────

function validateSelfEmployment(model: TaxReturn): FederalValidationItem[] {
  // Check for indicators of self-employment income (1099-NEC, Schedule C)
  // Not in data model yet, but if 1099-MISC Box 3 > $600, might indicate SE
  const miscPrizes = (model.form1099MISCs ?? []).reduce((s, f) => s + f.box3, 0)
  if (miscPrizes > 60_000) { // $600 threshold
    return [{
      code: 'POSSIBLE_SE_INCOME',
      severity: 'info',
      message: 'Large amounts in 1099-MISC Box 3 (Other income) detected. If this represents self-employment income, Schedule C and self-employment tax (Schedule SE) are not yet supported. Consult a tax professional.',
      irsCitation: 'Schedule C / Schedule SE',
      category: 'unsupported',
    }]
  }
  return []
}

function validateFormSSA1099(model: TaxReturn): FederalValidationItem[] {
  const items: FederalValidationItem[] = []
  const ssaForms = model.formSSA1099s ?? []

  for (const ssa of ssaForms) {
    // Negative net benefits (repaid more than received)
    if (ssa.box5 < 0) {
      items.push({
        code: 'SSA_NEGATIVE_NET_BENEFITS',
        severity: 'warning',
        message: `SSA-1099 for ${ssa.recipientName}: Net benefits (Box 5) is negative ($${(ssa.box5 / 100).toFixed(2)}). This may indicate a lump-sum repayment situation requiring special treatment per IRS Pub 915.`,
        irsCitation: 'Publication 915',
        category: 'accuracy',
      })
    }

    // Box 5 should equal Box 3 - Box 4
    if (ssa.box5 !== ssa.box3 - ssa.box4) {
      items.push({
        code: 'SSA_BOX5_MISMATCH',
        severity: 'warning',
        message: `SSA-1099 for ${ssa.recipientName}: Box 5 ($${(ssa.box5 / 100).toFixed(2)}) does not equal Box 3 ($${(ssa.box3 / 100).toFixed(2)}) minus Box 4 ($${(ssa.box4 / 100).toFixed(2)}). Please verify the amounts.`,
        irsCitation: 'Form SSA-1099',
        category: 'data-quality',
      })
    }
  }

  return items
}

function validatePremiumTaxCredit(_model: TaxReturn): FederalValidationItem[] {
  // Phase 1: Form 8962 (Premium Tax Credit) is not implemented.
  // When Form 1095-A data is added to the model, emit a warning here.
  return []
}

function validateMFSSocialSecurity(model: TaxReturn): FederalValidationItem[] {
  if (model.filingStatus !== 'mfs') return []
  const ssaForms = model.formSSA1099s ?? []
  if (ssaForms.length === 0) return []

  return [{
    code: 'MFS_SS_BENEFITS',
    severity: 'warning',
    message: 'Filing as Married Filing Separately with Social Security benefits: if you lived with your spouse at any time during the year, up to 85% of benefits may be taxable regardless of income level. This tool assumes you lived together (worst case). If you lived apart all year, consult IRS Publication 915 for different thresholds.',
    irsCitation: 'IRC §86(c)(1)(C)',
    category: 'accuracy',
  }]
}

function validateSeniorDeduction(model: TaxReturn): FederalValidationItem[] {
  const { taxpayerAge65, spouseAge65 } = model.deductions
  if (!taxpayerAge65 && !spouseAge65) return []

  return [{
    code: 'OBBBA_SENIOR_DEDUCTION',
    severity: 'info',
    message: 'OBBBA §70104 senior standard deduction enhancement applied. The additional standard deduction for age 65+ has been doubled ($4,000 single/$3,200 married) for tax year 2025.',
    irsCitation: 'One Big Beautiful Bill Act, §70104',
    category: 'compliance',
  }]
}

function validateDependentFiler(model: TaxReturn): FederalValidationItem[] {
  if (!model.canBeClaimedAsDependent) return []

  return [{
    code: 'DEPENDENT_FILER_LIMITATIONS',
    severity: 'info',
    message: 'You indicated you can be claimed as a dependent. Your standard deduction is limited to the greater of $1,350 or your earned income plus $450 (not exceeding the normal standard deduction). Additional amounts for age 65+ or blind are still added.',
    irsCitation: 'IRC §63(c)(5)',
    category: 'compliance',
  }]
}

function validateForm1099RCodes(model: TaxReturn): FederalValidationItem[] {
  const items: FederalValidationItem[] = []
  for (const r of (model.form1099Rs ?? [])) {
    if (r.box7.includes('1') && r.box2a > 0) {
      items.push({
        code: 'EARLY_WITHDRAWAL_PENALTY',
        severity: 'info',
        message: `1099-R from ${r.payerName}: Distribution code "1" indicates early distribution. A 10% additional tax applies unless an exception applies. Exceptions (hardship, disability, etc.) are not automatically detected.`,
        irsCitation: 'Form 5329, Part I',
        category: 'accuracy',
      })
    }
  }
  return items
}

function validateUnsupportedSchedules(_model: TaxReturn): FederalValidationItem[] {
  // Future: check for indicators that Schedule C, Schedule F, Form 8962, etc. are needed
  return [{
    code: 'PHASE1_LIMITATIONS',
    severity: 'info',
    message: 'Federal Gap Closure Phase 1 supports: W-2 wages, investment income, retirement distributions, Social Security benefits, rental income (Schedule E), capital gains (Schedule D), and common credits/deductions. Not yet supported: self-employment (Schedule C/SE), farm income (Schedule F), Premium Tax Credit (Form 8962), foreign tax credit (Form 1116).',
    irsCitation: 'Form 1040',
    category: 'unsupported',
  }]
}

// ── Main validation entry point ────────────────────────────────

/**
 * Run all federal validation checks on a tax return.
 * Call after computation to include result-dependent checks.
 */
export function validateFederalReturn(
  model: TaxReturn,
  _result?: Form1040Result,
): FederalValidationResult {
  const items: FederalValidationItem[] = [
    ...validateSelfEmployment(model),
    ...validateFormSSA1099(model),
    ...validatePremiumTaxCredit(model),
    ...validateMFSSocialSecurity(model),
    ...validateSeniorDeduction(model),
    ...validateDependentFiler(model),
    ...validateForm1099RCodes(model),
    ...validateUnsupportedSchedules(model),
  ]

  return {
    items,
    hasErrors: items.some(i => i.severity === 'error'),
    hasWarnings: items.some(i => i.severity === 'warning'),
  }
}
