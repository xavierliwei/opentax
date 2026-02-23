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

function validateSelfEmployment(model: TaxReturn): FederalValidationItem[] {
  const items: FederalValidationItem[] = []
  const businesses = model.scheduleCBusinesses ?? []

  // If they have Schedule C businesses, validate supported features
  for (const biz of businesses) {
    if (biz.hasInventory) {
      items.push({
        code: 'SCHEDULE_C_INVENTORY',
        severity: 'warning',
        message: `Schedule C "${biz.businessName}": Inventory/COGS detail (Part III) is not yet supported. Cost of Goods Sold is used as entered but Part III is not computed. Verify COGS accuracy.`,
        irsCitation: 'Schedule C, Part III',
        category: 'accuracy',
      })
    }
    if (biz.hasHomeOffice) {
      items.push({
        code: 'SCHEDULE_C_HOME_OFFICE',
        severity: 'warning',
        message: `Schedule C "${biz.businessName}": Home office deduction (Form 8829) is not yet supported. The deduction is $0 — you may be entitled to a deduction of up to $1,500 (simplified) or actual expenses.`,
        irsCitation: 'Form 8829',
        category: 'unsupported',
      })
    }
    if (biz.hasVehicleExpenses) {
      items.push({
        code: 'SCHEDULE_C_VEHICLE',
        severity: 'info',
        message: `Schedule C "${biz.businessName}": Vehicle expense detail (Form 4562 Part V) is not yet computed. Car/truck expenses are used as entered.`,
        irsCitation: 'Form 4562, Part V',
        category: 'accuracy',
      })
    }
  }

  // Check for 1099-MISC Box 3 without Schedule C — may be SE income
  if (businesses.length === 0) {
    const miscPrizesTotal = (model.form1099MISCs ?? []).reduce((s, f) => s + f.box3, 0)
    if (miscPrizesTotal > 60_000) { // $600 threshold
      items.push({
        code: 'POSSIBLE_SE_INCOME',
        severity: 'warning',
        message: `1099-MISC Box 3 income of $${(miscPrizesTotal / 100).toFixed(0)} detected. If this is self-employment income, add a Schedule C business to compute SE tax. Without Schedule C, the income is included as "other income" but SE tax (15.3% up to the wage base) is NOT computed.`,
        irsCitation: 'Schedule C / Schedule SE',
        category: 'accuracy',
      })
    }
  }

  // Informational when Schedule C is present
  if (businesses.length > 0) {
    items.push({
      code: 'SCHEDULE_C_SE_COMPUTED',
      severity: 'info',
      message: `Schedule C and SE tax computed for ${businesses.length} business${businesses.length > 1 ? 'es' : ''}. Net profit flows to Schedule 1 Line 3, SE tax to Schedule 2. Deductible half of SE tax reduces AGI.`,
      irsCitation: 'Schedule C / Schedule SE',
      category: 'compliance',
    })
  }

  return items
}

function validateQBIDeduction(model: TaxReturn): FederalValidationItem[] {
  const items: FederalValidationItem[] = []
  const hasScheduleC = (model.scheduleCBusinesses ?? []).length > 0
  const hasK1QBI = (model.scheduleK1s ?? []).some(k => k.section199AQBI > 0)
  const hasScheduleE = (model.scheduleEProperties ?? []).length > 0

  const hasSSTB = (model.scheduleCBusinesses ?? []).some(c => c.isSSTB) ||
    (model.scheduleK1s ?? []).some(k => k.isSSTB)

  if (hasScheduleC || hasK1QBI) {
    items.push({
      code: 'QBI_DEDUCTION_COMPUTED',
      severity: 'info',
      message: 'QBI deduction (IRC §199A) computed. Below-threshold taxpayers use Form 8995 simplified path (20% of QBI). Above-threshold taxpayers use Form 8995-A with W-2 wage / UBIA limitations. If per-business W-2 wages and UBIA are not provided for above-threshold returns, the deduction is conservatively set to $0.',
      irsCitation: 'Form 8995 / Form 8995-A / IRC §199A',
      category: 'compliance',
    })
    if (hasSSTB) {
      items.push({
        code: 'QBI_SSTB_WARNING',
        severity: 'warning',
        message: 'One or more businesses are marked as Specified Service Trade or Business (SSTB). For above-threshold taxpayers, SSTB income is reduced or excluded from the QBI deduction. If taxable income is fully above the phase-in range, SSTB QBI is $0. Verify SSTB classification with a tax professional.',
        irsCitation: 'IRC §199A(d)(2) / Form 8995-A',
        category: 'compliance',
      })
    }
  } else if (hasScheduleE) {
    // Rental real estate may have QBI if safe harbor elected — informational
    items.push({
      code: 'QBI_RENTAL_NOT_COMPUTED',
      severity: 'info',
      message: 'Rental real estate income may qualify for the QBI deduction (IRC §199A) if you elected the safe harbor under Rev. Proc. 2019-38. This election is not yet supported. Consult a tax professional.',
      irsCitation: 'Form 8995 / Rev. Proc. 2019-38',
      category: 'unsupported',
    })
  }

  return items
}

function validateK1(model: TaxReturn): FederalValidationItem[] {
  const k1s = model.scheduleK1s ?? []

  if (k1s.length === 0) {
    return []
  }

  const items: FederalValidationItem[] = []
  const totalAllIncome = k1s.reduce((s, k) =>
    s + k.ordinaryIncome + k.rentalIncome + k.interestIncome +
    k.dividendIncome + k.shortTermCapitalGain + k.longTermCapitalGain, 0)

  // K-1 income is now computed — emit info about what's included
  items.push({
    code: 'K1_INCOME_COMPUTED',
    severity: 'info',
    message: `${k1s.length} Schedule K-1 form${k1s.length > 1 ? 's' : ''} with total passthrough income of $${(totalAllIncome / 100).toFixed(0)} included in return. Ordinary/rental income → Schedule 1 Line 5, interest → Line 2b, dividends → Line 3b, capital gains → Schedule D, QBI → Form 8995.`,
    irsCitation: 'Schedule K-1 (Form 1065/1120-S/1041)',
    category: 'compliance',
  })

  // Warn that K-1 dividends are treated as non-qualified (conservative)
  const totalDividends = k1s.reduce((s, k) => s + k.dividendIncome, 0)
  if (totalDividends > 0) {
    items.push({
      code: 'K1_DIVIDENDS_NOT_QUALIFIED',
      severity: 'warning',
      message: `K-1 dividends of $${(totalDividends / 100).toFixed(0)} are treated as ordinary (non-qualified) dividends because the qualified dividend breakdown is not yet captured. This may overstate tax if some dividends qualify for the preferential rate. Verify with your K-1 Schedule for Box 6b (qualified dividends).`,
      irsCitation: 'Form 1040, Line 3a',
      category: 'accuracy',
    })
  }

  // Warn about rental income PAL limitations not applied
  const totalRentalLoss = k1s.reduce((s, k) => s + Math.min(0, k.rentalIncome), 0)
  if (totalRentalLoss < 0) {
    items.push({
      code: 'K1_RENTAL_LOSS_NO_PAL',
      severity: 'warning',
      message: `K-1 rental loss of $${(Math.abs(totalRentalLoss) / 100).toFixed(0)} is included without passive activity loss limitations. Actual deductibility depends on at-risk and passive activity rules (IRC §465/§469) which require basis tracking not yet modeled. The loss may be overstated.`,
      irsCitation: 'IRC §469, Form 8582',
      category: 'accuracy',
    })
  }

  // Warn about SE income not computed from partnership K-1s
  const partnershipOrdinary = k1s
    .filter(k => k.entityType === 'partnership')
    .reduce((s, k) => s + k.ordinaryIncome, 0)
  if (partnershipOrdinary > 0) {
    items.push({
      code: 'K1_PARTNERSHIP_SE_NOT_COMPUTED',
      severity: 'warning',
      message: `Partnership ordinary income of $${(partnershipOrdinary / 100).toFixed(0)} may be subject to self-employment tax depending on your participation (general partner vs. limited partner). SE tax on K-1 partnership income is not yet computed. Consult IRS instructions for Schedule K-1 (Form 1065) Box 14.`,
      irsCitation: 'Schedule SE, K-1 Box 14',
      category: 'accuracy',
    })
  }

  // Unsupported K-1 items warning (guaranteed payments, foreign taxes, AMT, etc.)
  items.push({
    code: 'K1_UNSUPPORTED_BOXES',
    severity: 'info',
    message: 'K-1 computation supports: Box 1 (ordinary income), Box 2 (rental), Box 5 (interest), Box 6a (dividends), Box 8/9a (capital gains), and Box 20 Code Z / Box 17 Code V (QBI). Not yet supported: guaranteed payments (Box 4), royalties, foreign taxes (Box 16), AMT items, tax-exempt income, and other code-specific items. Review your K-1 for items requiring manual adjustment.',
    irsCitation: 'Schedule K-1',
    category: 'unsupported',
  })

  return items
}

function validateForeignTaxCredit(model: TaxReturn): FederalValidationItem[] {
  const items: FederalValidationItem[] = []

  // Check if there are foreign taxes paid
  const foreignTaxDIV = model.form1099DIVs.reduce((s, f) => s + (f.box7 ?? 0), 0)
  const foreignTaxINT = model.form1099INTs.reduce((s, f) => s + (f.box6 ?? 0), 0)
  const totalForeignTax = foreignTaxDIV + foreignTaxINT

  if (totalForeignTax <= 0) return items

  // Informational: FTC is being computed
  const threshold = model.filingStatus === 'mfj' ? 60_000 : 30_000
  const directElection = totalForeignTax <= threshold
  items.push({
    code: 'FTC_COMPUTED',
    severity: 'info',
    message: `Foreign Tax Credit computed: $${(totalForeignTax / 100).toFixed(2)} in foreign taxes paid on passive category income (1099-DIV Box 7: $${(foreignTaxDIV / 100).toFixed(2)}, 1099-INT Box 6: $${(foreignTaxINT / 100).toFixed(2)}).${directElection ? ' Direct credit election applies (no Form 1116 required).' : ' Form 1116 is required (foreign taxes exceed direct credit threshold).'}`,
    irsCitation: 'Form 1116 / IRC §901',
    category: 'compliance',
  })

  // Warning: carryforward/carryback not supported
  items.push({
    code: 'FTC_NO_CARRYOVER',
    severity: 'warning',
    message: 'Foreign tax credit carryback (1 year) and carryforward (10 years) are not yet supported. If your foreign taxes exceed the limitation, the excess is shown but not tracked across years. You may be able to carry excess credits to other tax years — consult a tax professional.',
    irsCitation: 'IRC §904(c)',
    category: 'unsupported',
  })

  // Warning: only passive category supported
  items.push({
    code: 'FTC_PASSIVE_ONLY',
    severity: 'warning',
    message: 'Only passive category foreign income (portfolio dividends and interest) is supported. General category income (foreign wages, business income), Section 901(j) sanctioned country income, treaty-based re-sourcing, and foreign branch income are not computed. If you have non-passive foreign income, consult a tax professional.',
    irsCitation: 'Form 1116, Part I',
    category: 'unsupported',
  })

  return items
}

function validateUnsupportedSchedules(_model: TaxReturn): FederalValidationItem[] {
  return [{
    code: 'SUPPORTED_SCOPE',
    severity: 'info',
    message: 'Supported: W-2 wages, self-employment (Schedule C/SE), QBI deduction (Form 8995 with partial 8995-A above-threshold handling), investment income, retirement distributions (1099-R), Social Security benefits (SSA-1099), rental income (Schedule E), capital gains (Schedule D/8949), Premium Tax Credit (Form 8962/1095-A), Foreign Tax Credit (Form 1116 passive category), K-1 passthrough income core flows (ordinary, rental, interest, dividends, capital gains), HSA (Form 8889), education credits, energy credits, and common deductions. Not yet supported: farm income (Schedule F), general-category FTC, FTC carryover, K-1 SE tax (partnership Box 14), K-1 guaranteed payments (Box 4), passive activity loss limits for K-1 rental losses, and full complex Form 8995-A/SSTB edge cases.',
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
    ...validateSelfEmployment(model),
    ...validateQBIDeduction(model),
    ...validateK1(model),
    ...validateForeignTaxCredit(model),
    ...validateUnsupportedSchedules(model),
  ]

  return {
    items,
    hasErrors: items.some(i => i.severity === 'error'),
    hasWarnings: items.some(i => i.severity === 'warning'),
  }
}
