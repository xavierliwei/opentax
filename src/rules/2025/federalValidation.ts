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

  const totalGP = k1s.reduce((s, k) => s + (k.guaranteedPayments ?? 0), 0)
  const totalSE = k1s.reduce((s, k) => s + (k.selfEmploymentEarnings ?? 0), 0)

  // K-1 income is now computed — emit info about what's included
  const gpNote = totalGP > 0 ? `, guaranteed payments ($${(totalGP / 100).toFixed(0)}) → Schedule 1 Line 5 + SE tax` : ''
  const seNote = totalSE > 0 ? `, Box 14 SE earnings ($${(totalSE / 100).toFixed(0)}) → Schedule SE` : ''
  items.push({
    code: 'K1_INCOME_COMPUTED',
    severity: 'info',
    message: `${k1s.length} Schedule K-1 form${k1s.length > 1 ? 's' : ''} with total passthrough income of $${(totalAllIncome / 100).toFixed(0)} included in return. Ordinary/rental income → Schedule 1 Line 5, interest → Line 2b, dividends → Line 3b, capital gains → Schedule D, QBI → Form 8995${gpNote}${seNote}.`,
    irsCitation: 'Schedule K-1 (Form 1065/1120-S/1041)',
    category: 'compliance',
  })

  // Warn when K-1 dividends exist but qualified breakdown is not specified
  const unclassifiedDividends = k1s.reduce(
    (s, k) => s + (k.dividendIncome > 0 && k.qualifiedDividends == null ? k.dividendIncome : 0), 0,
  )
  if (unclassifiedDividends > 0) {
    items.push({
      code: 'K1_DIVIDENDS_NOT_QUALIFIED',
      severity: 'warning',
      message: `K-1 dividends of $${(unclassifiedDividends / 100).toFixed(0)} do not have a qualified dividend breakdown entered. These are treated as ordinary (non-qualified) dividends. If some are qualified, enter the qualified amount from Box 6b (Form 1065) / Box 5b (Form 1120-S) to receive the preferential tax rate.`,
      irsCitation: 'Form 1040, Line 3a',
      category: 'accuracy',
    })
  }

  // Warn about rental losses with PAL guardrail applied
  const totalRentalLoss = k1s.reduce((s, k) => s + Math.min(0, k.rentalIncome), 0)
  if (totalRentalLoss < 0) {
    items.push({
      code: 'K1_RENTAL_LOSS_PAL_GUARDRAIL',
      severity: 'warning',
      message: `K-1 rental loss of $${(Math.abs(totalRentalLoss) / 100).toFixed(0)} is subject to a conservative PAL guardrail: the $25,000 special allowance (IRC §469(i)) is applied, phased out between $100K–$150K AGI, and shared with Schedule E Part I losses. Full passive activity loss rules (basis tracking, at-risk limits, material participation) are not yet modeled. The allowed loss may differ from a full Form 8582 computation.`,
      irsCitation: 'IRC §469(i), Form 8582',
      category: 'accuracy',
    })
  }

  // SE tax handling for partnership K-1s
  const partnershipsWithSE = k1s.filter(k => k.entityType === 'partnership' && (k.selfEmploymentEarnings ?? 0) > 0)
  const partnershipsWithGP = k1s.filter(k => k.entityType === 'partnership' && (k.guaranteedPayments ?? 0) > 0)
  const partnershipsWithoutSE = k1s.filter(
    k => k.entityType === 'partnership' && k.ordinaryIncome > 0 &&
      (k.selfEmploymentEarnings ?? 0) === 0 && (k.guaranteedPayments ?? 0) === 0,
  )

  if (partnershipsWithSE.length > 0 || partnershipsWithGP.length > 0) {
    const seTotal = partnershipsWithSE.reduce((s, k) => s + (k.selfEmploymentEarnings ?? 0), 0)
    const gpTotal = partnershipsWithGP.reduce((s, k) => s + (k.guaranteedPayments ?? 0), 0)
    items.push({
      code: 'K1_PARTNERSHIP_SE_COMPUTED',
      severity: 'info',
      message: `Partnership SE tax computed: Box 14 SE earnings of $${(seTotal / 100).toFixed(0)} and guaranteed payments of $${(gpTotal / 100).toFixed(0)} are included in Schedule SE. Guaranteed payments are always subject to SE tax per IRC §1402(a).`,
      irsCitation: 'Schedule SE, K-1 Box 14, IRC §1402(a)',
      category: 'compliance',
    })
  }

  if (partnershipsWithoutSE.length > 0) {
    const ordinaryWithoutSE = partnershipsWithoutSE.reduce((s, k) => s + k.ordinaryIncome, 0)
    items.push({
      code: 'K1_PARTNERSHIP_SE_NOT_COMPUTED',
      severity: 'warning',
      message: `Partnership ordinary income of $${(ordinaryWithoutSE / 100).toFixed(0)} from ${partnershipsWithoutSE.length} K-1(s) may be subject to SE tax (general partners), but no Box 14 Code A (SE earnings) or Box 4 (guaranteed payments) were entered. Limited partners are generally exempt from SE tax on ordinary income. If you are a general partner, enter Box 14 Code A to compute SE tax. Consult IRS Schedule K-1 (Form 1065) instructions.`,
      irsCitation: 'Schedule SE, K-1 Box 14, IRC §1402(a)(13)',
      category: 'accuracy',
    })
  }

  // Unsupported K-1 items warning
  items.push({
    code: 'K1_UNSUPPORTED_BOXES',
    severity: 'info',
    message: 'K-1 computation supports: Box 1 (ordinary income), Box 2 (rental), Box 4 (guaranteed payments), Box 5 (interest), Box 6a (dividends), Box 8/9a (capital gains), Box 14 Code A (SE earnings), and Box 20 Code Z / Box 17 Code V (QBI). K-1 rental losses are limited by a conservative $25K PAL guardrail. Not yet supported: royalties, foreign taxes (Box 16), AMT items, tax-exempt income, and other code-specific items. Review your K-1 for items requiring manual adjustment.',
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


function validateUnsupportedFormsWave1(
  model: TaxReturn,
  result?: Form1040Result,
): FederalValidationItem[] {
  const items: FederalValidationItem[] = []

  const iraDistributions = (model.form1099Rs ?? []).filter(r => r.iraOrSep)
  if (iraDistributions.some(r => r.box2bTaxableNotDetermined)) {
    items.push({
      code: 'FORM_8606_BASIS_NOT_SUPPORTED',
      severity: 'warning',
      message: 'One or more IRA distributions have "taxable amount not determined" checked on Form 1099-R. OpenTax does not prepare Form 8606 basis calculations (nondeductible traditional IRA basis, Roth conversions, or pro-rata allocation). Enter a validated taxable amount in Box 2a or complete Form 8606 with a tax professional to avoid over/under-reporting taxable IRA income.',
      irsCitation: 'Form 8606 / Publication 590-B',
      category: 'unsupported',
    })
  }

  if ((result?.line37.amount ?? 0) > 0) {
    items.push({
      code: 'FORM_2210_NOT_COMPUTED',
      severity: 'info',
      message: 'You have a balance due on Form 1040 Line 37. OpenTax does not compute the Form 2210 underpayment penalty safe-harbor analysis. The IRS may bill a penalty/interest later, or you may need to file Form 2210 manually if an exception applies.',
      irsCitation: 'Form 2210 / Form 1040 Line 38',
      category: 'unsupported',
    })

    items.push({
      code: 'FORM_4868_EXTENSION_WORKFLOW',
      severity: 'info',
      message: 'If you need more time to file, submit Form 4868 by the filing deadline. OpenTax does not currently file or generate Form 4868. An extension gives more time to file, not more time to pay — pay your expected balance due by the deadline to reduce penalties and interest.',
      irsCitation: 'Form 4868 / Publication 17',
      category: 'unsupported',
    })
  }

  return items
}
function validateUnsupportedSchedules(_model: TaxReturn): FederalValidationItem[] {
  return [{
    code: 'SUPPORTED_SCOPE',
    severity: 'info',
    message: 'Supported: W-2 wages, self-employment (Schedule C/SE), QBI deduction (Form 8995 with partial 8995-A above-threshold handling), investment income, retirement distributions (1099-R), Social Security benefits (SSA-1099), rental income (Schedule E), capital gains (Schedule D/8949), Premium Tax Credit (Form 8962/1095-A), Foreign Tax Credit (Form 1116 passive category), K-1 passthrough income (ordinary, rental, interest, dividends, capital gains, guaranteed payments, Box 14 SE earnings), K-1 rental loss PAL guardrail, HSA (Form 8889), education credits, energy credits, and common deductions. Not yet supported: farm income (Schedule F), Form 8606 basis tracking, Form 2210 underpayment penalty computation, Form 4868 extension filing workflow, general-category FTC, FTC carryover, full Form 8582 passive activity loss computation, and full complex Form 8995-A/SSTB edge cases.',
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
  result?: Form1040Result,
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
    ...validateUnsupportedFormsWave1(model, result),
  ]

  return {
    items,
    hasErrors: items.some(i => i.severity === 'error'),
    hasWarnings: items.some(i => i.severity === 'warning'),
  }
}
