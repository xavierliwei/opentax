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

function validateFormSSA1099(model: TaxReturn): FederalValidationItem[] {
  const items: FederalValidationItem[] = []
  const ssaForms = model.formSSA1099s ?? []

  for (const ssa of ssaForms) {
    // Negative net benefits (repaid more than received)
    if (ssa.box5 < 0) {
      items.push({
        code: 'SSA_NEGATIVE_NET_BENEFITS',
        severity: 'warning',
        message: `SSA-1099 for ${ssa.recipientName}: Net benefits (Box 5) is negative ($${(ssa.box5 / 100).toFixed(2)}). This indicates benefits were repaid exceeding amounts received this year. You may be eligible for an itemized deduction or tax credit under IRC §1341 for the repaid amount. Consult IRS Publication 915 and a tax professional.`,
        irsCitation: 'Publication 915, IRC §1341',
        category: 'accuracy',
      })
    }

    // Significant benefits repaid (Box 4 > 0) — informational
    if (ssa.box4 > 0 && ssa.box5 >= 0) {
      items.push({
        code: 'SSA_BENEFITS_REPAID',
        severity: 'info',
        message: `SSA-1099 for ${ssa.recipientName}: Benefits repaid (Box 4) of $${(ssa.box4 / 100).toFixed(2)}. Net benefits (Box 5 = Box 3 − Box 4) are used for taxability computation. If the repayment exceeds $3,000 and relates to benefits included in prior-year income, you may use IRC §1341 claim-of-right for a larger benefit.`,
        irsCitation: 'Publication 915, IRC §1341',
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

function validatePremiumTaxCredit(model: TaxReturn): FederalValidationItem[] {
  const forms = model.form1095As ?? []
  if (forms.length === 0) return []

  return [{
    code: 'PTC_FORM_8962',
    severity: 'info',
    message: `Form 1095-A marketplace data detected (${forms.length} statement${forms.length > 1 ? 's' : ''}). Form 8962 Premium Tax Credit reconciliation has been computed. Verify SLCSP amounts match your marketplace notice.`,
    irsCitation: 'Form 8962 / IRC §36B',
    category: 'compliance',
  }]
}

function validateMFSSocialSecurity(model: TaxReturn): FederalValidationItem[] {
  if (model.filingStatus !== 'mfs') return []
  const ssaForms = model.formSSA1099s ?? []
  if (ssaForms.length === 0) return []

  const livedApart = model.deductions.mfsLivedApartAllYear ?? false

  if (livedApart) {
    return [{
      code: 'MFS_SS_BENEFITS_LIVED_APART',
      severity: 'info',
      message: 'Filing as Married Filing Separately with Social Security benefits. You indicated you lived apart from your spouse all year, so single-filer thresholds ($25,000 base / $34,000 additional) are being used per IRC §86(c)(1)(C)(ii).',
      irsCitation: 'IRC §86(c)(1)(C)(ii), Publication 915',
      category: 'compliance',
    }]
  }

  return [{
    code: 'MFS_SS_BENEFITS',
    severity: 'warning',
    message: 'Filing as Married Filing Separately with Social Security benefits: if you lived with your spouse at any time during the year, up to 85% of benefits may be taxable regardless of income level ($0 base amount). If you lived apart from your spouse for the entire year, indicate this to use the more favorable single-filer thresholds ($25,000/$34,000).',
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

function validateSelfEmploymentGap(model: TaxReturn): FederalValidationItem[] {
  // Check for 1099-NEC-like indicators (large 1099-MISC Box 3 or other SE markers)
  const miscPrizesTotal = (model.form1099MISCs ?? []).reduce((s, f) => s + f.box3, 0)
  const items: FederalValidationItem[] = []

  if (miscPrizesTotal > 60_000) { // $600 threshold
    items.push({
      code: 'UNSUPPORTED_SCHEDULE_C',
      severity: 'warning',
      message: `1099-MISC Box 3 income of $${(miscPrizesTotal / 100).toFixed(0)} detected. If this is self-employment income, Schedule C (profit/loss from business) and Schedule SE (self-employment tax) are required but not yet supported. The income is included as "other income" but SE tax (15.3% up to the wage base) is NOT computed. This may significantly understate your tax liability. Consult a tax professional.`,
      irsCitation: 'Schedule C / Schedule SE',
      category: 'unsupported',
    })
  }

  return items
}

function validateQBIDeductionGap(model: TaxReturn): FederalValidationItem[] {
  // QBI deduction (Form 8995/8995-A) is relevant for:
  // - Self-employment income (Schedule C)
  // - Rental real estate (if elected safe harbor)
  // - Partnership/S-corp K-1 income
  const hasScheduleE = (model.scheduleEProperties ?? []).length > 0
  const hasMiscIncome = (model.form1099MISCs ?? []).some(f => f.box3 > 60_000) // $600

  if (!hasScheduleE && !hasMiscIncome) return []

  return [{
    code: 'UNSUPPORTED_QBI_DEDUCTION',
    severity: 'info',
    message: 'Qualified Business Income (QBI) deduction (IRC §199A) is not yet implemented. If you have qualified business income from sole proprietorship, partnership, S-corp, or elected rental real estate, you may be entitled to a deduction of up to 20% of QBI on Form 1040, Line 13. This is currently $0 — consult a tax professional.',
    irsCitation: 'Form 8995 / IRC §199A',
    category: 'unsupported',
  }]
}

function validateK1Gap(_model: TaxReturn): FederalValidationItem[] {
  // K-1 income from partnerships (Form 1065) and S-corps (Form 1120-S)
  // is not in the data model. Emit an informational message about this limitation.
  return [{
    code: 'UNSUPPORTED_K1_INCOME',
    severity: 'info',
    message: 'Schedule K-1 income from partnerships (Form 1065), S-corporations (Form 1120-S), and trusts/estates (Form 1041) is not yet supported. If you received K-1 forms, the associated income, deductions, and credits are not included in this return.',
    irsCitation: 'Schedule K-1 (Form 1065/1120-S/1041)',
    category: 'unsupported',
  }]
}

function validateUnsupportedSchedules(_model: TaxReturn): FederalValidationItem[] {
  return [{
    code: 'PHASE2_LIMITATIONS',
    severity: 'info',
    message: 'Federal Gap Closure Phase 2 supports: W-2 wages, investment income, retirement distributions, Social Security benefits (including MFS lived-apart exception), rental income (Schedule E), capital gains (Schedule D), Premium Tax Credit (Form 8962), and common credits/deductions. Not yet supported: self-employment (Schedule C/SE), farm income (Schedule F), foreign tax credit (Form 1116), K-1 passthrough income.',
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
    ...validateFormSSA1099(model),
    ...validatePremiumTaxCredit(model),
    ...validateMFSSocialSecurity(model),
    ...validateSeniorDeduction(model),
    ...validateDependentFiler(model),
    ...validateForm1099RCodes(model),
    ...validateSelfEmploymentGap(model),
    ...validateQBIDeductionGap(model),
    ...validateK1Gap(model),
    ...validateUnsupportedSchedules(model),
  ]

  return {
    items,
    hasErrors: items.some(i => i.severity === 'error'),
    hasWarnings: items.some(i => i.severity === 'warning'),
  }
}
