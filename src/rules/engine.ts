/**
 * Explainability Trace Engine
 *
 * Wraps existing compute functions, collects all results into a flat
 * Map<string, TracedValue>, then provides trace tree building and
 * human-readable explanation.
 *
 * No existing files are modified — this is a pure overlay.
 */

import type { TaxReturn, ItemizedDeductions } from '../model/types'
import type { TracedValue } from '../model/traced'
import { tracedFromComputation, tracedZero } from '../model/traced'
import { computeForm1040 } from './2025/form1040'
import type { Form1040Result } from './2025/form1040'
import { computeScheduleB } from './2025/scheduleB'
import type { ScheduleBResult } from './2025/scheduleB'
import { STANDARD_DEDUCTION } from './2025/constants'
import { computeForm540 } from './2025/ca/form540'
import type { Form540Result } from './2025/ca/form540'

// ── Types ────────────────────────────────────────────────────────

export interface ComputeResult {
  form1040: Form1040Result
  scheduleB: ScheduleBResult
  form540: Form540Result | null
  values: Map<string, TracedValue>
  executedSchedules: string[]
}

export interface ComputeTrace {
  nodeId: string
  label: string
  output: TracedValue
  inputs: ComputeTrace[]
  irsCitation?: string
}

// ── Node labels ──────────────────────────────────────────────────

export const NODE_LABELS: Record<string, string> = {
  // Form 1040
  'form1040.line1a': 'Wages, salaries, tips',
  'form1040.line1z': 'Add lines 1a through 1i',
  'form1040.line2a': 'Tax-exempt interest',
  'form1040.line2b': 'Taxable interest',
  'form1040.line3a': 'Qualified dividends',
  'form1040.line3b': 'Ordinary dividends',
  'form1040.line4a': 'IRA distributions',
  'form1040.line4b': 'IRA distributions (taxable)',
  'form1040.line5a': 'Pensions and annuities',
  'form1040.line5b': 'Pensions and annuities (taxable)',
  'form1040.line7': 'Capital gain or (loss)',
  'form1040.line8': 'Other income',
  'form1040.line9': 'Total income',
  'form1040.line10': 'Adjustments to income',
  'form1040.line11': 'Adjusted gross income',
  'form1040.line12': 'Deductions',
  'form1040.line13': 'Qualified business income deduction',
  'form1040.line14': 'Total deductions',
  'form1040.line15': 'Taxable income',
  'form1040.line16': 'Tax',
  'form1040.line17': 'Amount from Schedule 2, Part I',
  'form1040.line18': 'Tax + Schedule 2',
  'form1040.line19': 'Child tax credit / credit for other dependents',
  'form1040.line20': 'Other nonrefundable credits',
  'form1040.line21': 'Total credits',
  'form1040.line22': 'Tax after credits',
  'form1040.line23': 'Other taxes',
  'form1040.line24': 'Total tax',
  'form1040.line25': 'Federal income tax withheld',
  'form1040.line26': 'Estimated tax payments',
  'form1040.line27': 'Earned income credit',
  'form1040.line28': 'Additional child tax credit',
  'form1040.line29': 'American opportunity credit',
  'form1040.line31': 'Other refundable credits',
  'form1040.line32': 'Total other payments and refundable credits',
  'form1040.line33': 'Total payments',
  'form1040.line34': 'Overpaid',
  'form1040.line37': 'Amount you owe',

  // Schedule A
  'scheduleA.line1': 'Medical and dental expenses',
  'scheduleA.line2': 'AGI (from Form 1040)',
  'scheduleA.line3': 'AGI x 7.5%',
  'scheduleA.line4': 'Medical deduction (excess over floor)',
  'scheduleA.line5a': 'State/local income or sales taxes (elected)',
  'scheduleA.line5b': 'Real estate taxes',
  'scheduleA.line5c': 'Personal property taxes',
  'scheduleA.line5e': 'State and local taxes (before cap)',
  'scheduleA.line7': 'State and local taxes (after cap)',
  'scheduleA.line8a': 'Home mortgage interest (after limit)',
  'scheduleA.line9': 'Investment interest',
  'form4952.carryforward': 'Investment interest carryforward to next year',
  'scheduleA.line10': 'Total interest you paid',
  'scheduleA.line11': 'Cash charitable contributions',
  'scheduleA.line12': 'Non-cash charitable contributions',
  'scheduleA.line14': 'Charitable contributions',
  'scheduleA.line16': 'Other itemized deductions',
  'scheduleA.line17': 'Total itemized deductions',

  // Schedule 1
  'schedule1.line1': 'Taxable refunds of state/local taxes',
  'schedule1.line5': 'Rents and royalties',
  'schedule1.line7': 'Unemployment compensation',
  'schedule1.line8z': 'Other income (prizes, awards, etc.)',
  'schedule1.line10': 'Total additional income',

  // Schedule E
  'scheduleE.line23a': 'Total rental/royalty income or loss',
  'scheduleE.line25': 'Total rental/royalty losses allowed',
  'scheduleE.line26': 'Total Schedule E income',

  // Schedule B
  'scheduleB.line4': 'Total interest',
  'scheduleB.line6': 'Total ordinary dividends',

  // Schedule D
  'scheduleD.line1a': 'Short-term gain/loss (Box A)',
  'scheduleD.line1b': 'Short-term gain/loss (Box B)',
  'scheduleD.line6': 'Short-term capital loss carryover from prior year',
  'scheduleD.line7': 'Net short-term capital gain or (loss)',
  'scheduleD.line8a': 'Long-term gain/loss (Box D)',
  'scheduleD.line8b': 'Long-term gain/loss (Box E)',
  'scheduleD.line13': 'Capital gain distributions',
  'scheduleD.line14': 'Long-term capital loss carryover from prior year',
  'scheduleD.line15': 'Net long-term capital gain or (loss)',
  'scheduleD.line16': 'Combined net gain or (loss)',
  'scheduleD.line21': 'Capital gain/loss for Form 1040',

  // Form 8949 categories
  'form8949.A.proceeds': 'Form 8949 Box A — Total proceeds',
  'form8949.A.basis': 'Form 8949 Box A — Total basis',
  'form8949.A.adjustments': 'Form 8949 Box A — Total adjustments',
  'form8949.A.gainLoss': 'Form 8949 Box A — Total gain/loss',
  'form8949.B.proceeds': 'Form 8949 Box B — Total proceeds',
  'form8949.B.basis': 'Form 8949 Box B — Total basis',
  'form8949.B.adjustments': 'Form 8949 Box B — Total adjustments',
  'form8949.B.gainLoss': 'Form 8949 Box B — Total gain/loss',
  'form8949.D.proceeds': 'Form 8949 Box D — Total proceeds',
  'form8949.D.basis': 'Form 8949 Box D — Total basis',
  'form8949.D.adjustments': 'Form 8949 Box D — Total adjustments',
  'form8949.D.gainLoss': 'Form 8949 Box D — Total gain/loss',
  'form8949.E.proceeds': 'Form 8949 Box E — Total proceeds',
  'form8949.E.basis': 'Form 8949 Box E — Total basis',
  'form8949.E.adjustments': 'Form 8949 Box E — Total adjustments',
  'form8949.E.gainLoss': 'Form 8949 Box E — Total gain/loss',

  // Child Tax Credit detail
  'ctc.initialCredit': 'Initial child tax credit',
  'ctc.phaseOutReduction': 'CTC phase-out reduction',
  'ctc.creditAfterPhaseOut': 'CTC after phase-out',

  // Earned Income Credit detail
  'eic.creditAtEarnedIncome': 'EIC at earned income',
  'eic.creditAtAGI': 'EIC at AGI',
  'eic.creditAmount': 'Earned income credit',

  // Adjustments (Line 10 components)
  'adjustments.ira': 'IRA deduction (Schedule 1, Line 20)',
  'adjustments.hsa': 'HSA deduction (Form 8889)',
  'adjustments.studentLoan': 'Student loan interest deduction (Schedule 1, Line 21)',
  'hsa.taxableDistributions': 'Taxable HSA distributions',
  'hsa.penalties': 'HSA penalties',

  // Other credits (Line 20 components)
  'credits.dependentCare': 'Dependent care credit (Form 2441)',
  'credits.savers': "Saver's credit (Form 8880)",
  'credits.energy': 'Residential energy credit (Form 5695)',
  'credits.education': 'Education credits (Form 8863)',
  'credits.aotcRefundable': 'AOTC refundable (Line 29)',

  // AMT (Form 6251)
  'amt.amti': 'Alternative minimum taxable income (AMTI)',
  'amt.saltAddBack': 'SALT deduction add-back',
  'amt.isoSpread': 'ISO exercise spread (AMT preference)',
  'amt.exemption': 'AMT exemption',
  'amt.phaseOutReduction': 'AMT exemption phase-out reduction',
  'amt.reducedExemption': 'AMT exemption (after phase-out)',
  'amt.amtiAfterExemption': 'AMTI after exemption',
  'amt.tentativeMinimumTax': 'Tentative minimum tax',
  'amt.amt': 'Alternative minimum tax',

  // Form 540 (California)
  'form540.caAGI': 'California adjusted gross income',
  'form540.caDeduction': 'California deduction',
  'form540.caTaxableIncome': 'California taxable income',
  'form540.caTax': 'California tax',
  'form540.mentalHealthTax': 'Mental health services tax (1%)',
  'form540.exemptionCredits': 'CA exemption credits',
  'form540.rentersCredit': "CA renter's credit",
  'form540.taxAfterCredits': 'CA tax after credits',
  'form540.stateWithholding': 'CA state income tax withheld',
  'form540.overpaid': 'CA overpaid (refund)',
  'form540.amountOwed': 'CA amount you owe',

  // Schedule CA
  'scheduleCA.hsaAddBack': 'HSA deduction add-back (CA)',
  'scheduleCA.additions': 'CA income additions',
  'scheduleCA.subtractions': 'CA income subtractions',

  // Pseudo-nodes
  'standardDeduction': 'Standard deduction',
  'itemized.medicalExpenses': 'Medical expenses',
  'itemized.stateLocalIncomeTaxes': 'State/local income taxes',
  'itemized.stateLocalSalesTaxes': 'General sales taxes',
  'itemized.realEstateTaxes': 'Real estate taxes',
  'itemized.personalPropertyTaxes': 'Personal property taxes',
  'itemized.mortgageInterest': 'Mortgage interest',
  'itemized.investmentInterest': 'Investment interest',
  'itemized.charitableCash': 'Charitable contributions (cash)',
  'itemized.charitableNoncash': 'Charitable contributions (non-cash)',
  'itemized.gamblingLosses': 'Gambling losses',
  'itemized.casualtyTheftLosses': 'Casualty & theft losses',
  'itemized.federalEstateTaxIRD': 'Federal estate tax on IRD',
  'itemized.otherMiscDeductions': 'Other miscellaneous deductions',
}

// ── computeAll ───────────────────────────────────────────────────

export function computeAll(model: TaxReturn): ComputeResult {
  const form1040 = computeForm1040(model)
  const scheduleB = computeScheduleB(model)

  // CA state return (only for CA residents)
  const form540 = model.caResident ? computeForm540(model, form1040) : null

  const values = collectAllValues(form1040, scheduleB, model, form540)

  const executedSchedules: string[] = ['B']
  if (form1040.schedule1) executedSchedules.push('1')
  if (form1040.scheduleA) executedSchedules.push('A')
  if (form1040.scheduleD) executedSchedules.push('D')
  if (form1040.scheduleE) executedSchedules.push('E')
  if (form540) executedSchedules.push('CA-540')

  return { form1040, scheduleB, form540, values, executedSchedules }
}

// ── collectAllValues ─────────────────────────────────────────────

export function collectAllValues(
  form1040: Form1040Result,
  scheduleB: ScheduleBResult,
  model: TaxReturn,
  form540?: Form540Result | null,
): Map<string, TracedValue> {
  const values = new Map<string, TracedValue>()

  function add(tv: TracedValue): void {
    if (tv.source.kind === 'computed') {
      values.set(tv.source.nodeId, tv)
    }
  }

  // Form 1040 lines
  add(form1040.line1a)
  add(form1040.line1z)
  add(form1040.line2a)
  add(form1040.line2b)
  add(form1040.line3a)
  add(form1040.line3b)
  add(form1040.line4a)
  add(form1040.line4b)
  add(form1040.line5a)
  add(form1040.line5b)
  add(form1040.line7)
  add(form1040.line8)
  add(form1040.line9)
  add(form1040.line10)
  add(form1040.line11)
  add(form1040.line12)
  add(form1040.line13)
  add(form1040.line14)
  add(form1040.line15)
  add(form1040.line16)
  add(form1040.line17)
  add(form1040.line18)
  add(form1040.line19)
  add(form1040.line20)
  add(form1040.line21)
  add(form1040.line22)
  add(form1040.line23)
  add(form1040.line24)
  add(form1040.line25)
  add(form1040.line26)
  add(form1040.line27)
  add(form1040.line28)
  add(form1040.line29)
  add(form1040.line31)
  add(form1040.line32)
  add(form1040.line33)
  add(form1040.line34)
  add(form1040.line37)

  // IRA deduction detail node
  if (form1040.iraDeduction && form1040.iraDeduction.deductibleAmount > 0) {
    values.set('adjustments.ira', tracedFromComputation(
      form1040.iraDeduction.deductibleAmount,
      'adjustments.ira',
      [],
      'IRA deduction (Schedule 1, Line 20)',
    ))
  }

  // HSA deduction detail nodes (Form 8889)
  if (form1040.hsaResult) {
    const hsa = form1040.hsaResult
    if (hsa.deductibleAmount > 0) {
      values.set('adjustments.hsa', tracedFromComputation(
        hsa.deductibleAmount,
        'adjustments.hsa',
        [],
        'HSA deduction (Form 8889)',
      ))
    }
    if (hsa.taxableDistributions > 0) {
      values.set('hsa.taxableDistributions', tracedFromComputation(
        hsa.taxableDistributions,
        'hsa.taxableDistributions',
        [],
        'Taxable HSA distributions',
      ))
    }
    const totalPenalty = hsa.distributionPenalty + hsa.excessPenalty
    if (totalPenalty > 0) {
      values.set('hsa.penalties', tracedFromComputation(
        totalPenalty,
        'hsa.penalties',
        [],
        'HSA penalties',
      ))
    }
  }

  // Student loan interest deduction detail node
  if (form1040.studentLoanDeduction && form1040.studentLoanDeduction.deductibleAmount > 0) {
    values.set('adjustments.studentLoan', tracedFromComputation(
      form1040.studentLoanDeduction.deductibleAmount,
      'adjustments.studentLoan',
      [],
      'Student loan interest deduction (Schedule 1, Line 21)',
    ))
  }

  // Child Tax Credit detail nodes
  if (form1040.childTaxCredit) {
    const ctc = form1040.childTaxCredit
    values.set('ctc.initialCredit', tracedFromComputation(
      ctc.initialCredit,
      'ctc.initialCredit',
      [],
      'Child Tax Credit — initial',
    ))
    values.set('ctc.phaseOutReduction', tracedFromComputation(
      ctc.phaseOutReduction,
      'ctc.phaseOutReduction',
      ['ctc.initialCredit'],
      'Child Tax Credit — phase-out reduction',
    ))
    values.set('ctc.creditAfterPhaseOut', tracedFromComputation(
      ctc.creditAfterPhaseOut,
      'ctc.creditAfterPhaseOut',
      ['ctc.initialCredit', 'ctc.phaseOutReduction'],
      'Child Tax Credit — after phase-out',
    ))
  }

  // Earned Income Credit detail nodes
  if (form1040.earnedIncomeCredit && form1040.earnedIncomeCredit.eligible) {
    const eic = form1040.earnedIncomeCredit
    values.set('eic.creditAtEarnedIncome', tracedFromComputation(
      eic.creditAtEarnedIncome,
      'eic.creditAtEarnedIncome',
      [],
      'EIC — credit at earned income',
    ))
    values.set('eic.creditAtAGI', tracedFromComputation(
      eic.creditAtAGI,
      'eic.creditAtAGI',
      [],
      'EIC — credit at AGI',
    ))
    values.set('eic.creditAmount', tracedFromComputation(
      eic.creditAmount,
      'eic.creditAmount',
      ['eic.creditAtEarnedIncome', 'eic.creditAtAGI'],
      'Earned Income Credit',
    ))
  }

  // Other credits detail nodes (Line 20 components)
  if (form1040.dependentCareCredit && form1040.dependentCareCredit.creditAmount > 0) {
    values.set('credits.dependentCare', tracedFromComputation(
      form1040.dependentCareCredit.creditAmount,
      'credits.dependentCare',
      [],
      'Dependent care credit (Form 2441)',
    ))
  }
  if (form1040.saversCredit && form1040.saversCredit.creditAmount > 0) {
    values.set('credits.savers', tracedFromComputation(
      form1040.saversCredit.creditAmount,
      'credits.savers',
      [],
      "Saver's credit (Form 8880)",
    ))
  }
  if (form1040.energyCredit && form1040.energyCredit.totalCredit > 0) {
    values.set('credits.energy', tracedFromComputation(
      form1040.energyCredit.totalCredit,
      'credits.energy',
      [],
      'Residential energy credit (Form 5695)',
    ))
  }
  if (form1040.educationCredit) {
    if (form1040.educationCredit.totalNonRefundable > 0) {
      values.set('credits.education', tracedFromComputation(
        form1040.educationCredit.totalNonRefundable,
        'credits.education', [], 'Education credits (Form 8863)',
      ))
    }
    if (form1040.educationCredit.totalRefundable > 0) {
      values.set('credits.aotcRefundable', tracedFromComputation(
        form1040.educationCredit.totalRefundable,
        'credits.aotcRefundable', [], 'AOTC refundable (Line 29)',
      ))
    }
  }

  // AMT detail nodes (Form 6251)
  if (form1040.amtResult && form1040.amtResult.amt > 0) {
    const a = form1040.amtResult
    values.set('amt.saltAddBack', tracedFromComputation(
      a.line2a_saltAddBack, 'amt.saltAddBack', [], 'SALT deduction add-back',
    ))
    values.set('amt.isoSpread', tracedFromComputation(
      a.line2i_isoSpread, 'amt.isoSpread', [], 'ISO exercise spread (AMT preference)',
    ))
    const amtiInputs: string[] = ['form1040.line15']
    if (a.line2a_saltAddBack > 0) amtiInputs.push('amt.saltAddBack')
    if (a.line2i_isoSpread > 0) amtiInputs.push('amt.isoSpread')
    values.set('amt.amti', tracedFromComputation(
      a.line4_amti, 'amt.amti', amtiInputs, 'Alternative minimum taxable income (AMTI)',
    ))
    values.set('amt.exemption', tracedFromComputation(
      a.line5_exemption, 'amt.exemption', [], 'AMT exemption',
    ))
    values.set('amt.phaseOutReduction', tracedFromComputation(
      a.line8_phaseOutReduction, 'amt.phaseOutReduction', ['amt.amti'], 'AMT exemption phase-out reduction',
    ))
    values.set('amt.reducedExemption', tracedFromComputation(
      a.line9_reducedExemption, 'amt.reducedExemption', ['amt.exemption', 'amt.phaseOutReduction'], 'AMT exemption (after phase-out)',
    ))
    values.set('amt.amtiAfterExemption', tracedFromComputation(
      a.line10_amtiAfterExemption, 'amt.amtiAfterExemption', ['amt.amti', 'amt.reducedExemption'], 'AMTI after exemption',
    ))
    values.set('amt.tentativeMinimumTax', tracedFromComputation(
      a.tentativeMinimumTax, 'amt.tentativeMinimumTax', ['amt.amtiAfterExemption'], 'Tentative minimum tax',
    ))
    values.set('amt.amt', tracedFromComputation(
      a.amt, 'amt.amt', ['amt.tentativeMinimumTax', 'form1040.line16'], 'Alternative minimum tax',
    ))
  }

  // Schedule 1
  if (form1040.schedule1) {
    const s1 = form1040.schedule1
    add(s1.line1)
    add(s1.line5)
    add(s1.line7)
    add(s1.line8z)
    add(s1.line10)
  }

  // Schedule E
  if (form1040.scheduleE) {
    const se = form1040.scheduleE
    add(se.line23a)
    add(se.line25)
    add(se.line26)
    for (const prop of se.properties) {
      add(prop.income)
      add(prop.expenses)
      add(prop.netIncome)
    }
  }

  // Schedule E property source leaf nodes
  for (const p of (model.scheduleEProperties ?? [])) {
    if (p.rentsReceived > 0) {
      values.set(`scheduleE:${p.id}:rentsReceived`, {
        amount: p.rentsReceived,
        source: {
          kind: 'document',
          documentType: 'Schedule E',
          documentId: p.id,
          field: 'Rents received',
          description: `${p.address || 'Property'} — Rents received`,
        },
        confidence: 1.0,
      })
    }
    if (p.royaltiesReceived > 0) {
      values.set(`scheduleE:${p.id}:royaltiesReceived`, {
        amount: p.royaltiesReceived,
        source: {
          kind: 'document',
          documentType: 'Schedule E',
          documentId: p.id,
          field: 'Royalties received',
          description: `${p.address || 'Property'} — Royalties received`,
        },
        confidence: 1.0,
      })
    }
    const expenseTotal =
      p.advertising + p.auto + p.cleaning + p.commissions + p.insurance +
      p.legal + p.management + p.mortgageInterest + p.otherInterest +
      p.repairs + p.supplies + p.taxes + p.utilities + p.depreciation + p.other
    if (expenseTotal > 0) {
      values.set(`scheduleE:${p.id}:expenses`, {
        amount: expenseTotal,
        source: {
          kind: 'document',
          documentType: 'Schedule E',
          documentId: p.id,
          field: 'Total expenses',
          description: `${p.address || 'Property'} — Total expenses`,
        },
        confidence: 1.0,
      })
    }
  }

  // Schedule A
  if (form1040.scheduleA) {
    const sa = form1040.scheduleA
    add(sa.line1)
    add(sa.line2)
    add(sa.line3)
    add(sa.line4)
    add(sa.line5a)
    add(sa.line5b)
    add(sa.line5c)
    add(sa.line5e)
    add(sa.line7)
    add(sa.line8a)
    add(sa.line9)
    add(sa.line10)
    add(sa.investmentInterestCarryforward)
    add(sa.line11)
    add(sa.line12)
    add(sa.line14)
    add(sa.line16)
    add(sa.line17)
  }

  // Schedule B
  add(scheduleB.line4)
  add(scheduleB.line6)

  // Schedule D + Form 8949
  if (form1040.scheduleD) {
    const sd = form1040.scheduleD
    add(sd.line1a)
    add(sd.line1b)
    add(sd.line6)
    add(sd.line7)
    add(sd.line8a)
    add(sd.line8b)
    add(sd.line13)
    add(sd.line14)
    add(sd.line15)
    add(sd.line16)
    add(sd.line21)

    for (const cat of sd.form8949.categories) {
      add(cat.totalProceeds)
      add(cat.totalBasis)
      add(cat.totalAdjustments)
      add(cat.totalGainLoss)
    }
  }

  // ── Document source leaf nodes ───────────────────────────────

  // W-2s
  for (const w2 of model.w2s) {
    const fields: Array<[string, number]> = [
      ['box1', w2.box1],
      ['box2', w2.box2],
    ]
    for (const [field, amount] of fields) {
      values.set(`w2:${w2.id}:${field}`, {
        amount,
        source: {
          kind: 'document',
          documentType: 'W-2',
          documentId: w2.id,
          field: boxLabel(field),
          description: `W-2 from ${w2.employerName} (${boxLabel(field)})`,
        },
        confidence: 1.0,
      })
    }
  }

  // 1099-INTs
  for (const f of model.form1099INTs) {
    const fields: Array<[string, number]> = [
      ['box1', f.box1],
      ['box4', f.box4],
      ['box8', f.box8],
    ]
    for (const [field, amount] of fields) {
      values.set(`1099int:${f.id}:${field}`, {
        amount,
        source: {
          kind: 'document',
          documentType: '1099-INT',
          documentId: f.id,
          field: boxLabel(field),
          description: `1099-INT from ${f.payerName} (${boxLabel(field)})`,
        },
        confidence: 1.0,
      })
    }
  }

  // 1099-DIVs
  for (const f of model.form1099DIVs) {
    const fields: Array<[string, number]> = [
      ['box1a', f.box1a],
      ['box1b', f.box1b],
      ['box2a', f.box2a],
      ['box4', f.box4],
    ]
    for (const [field, amount] of fields) {
      values.set(`1099div:${f.id}:${field}`, {
        amount,
        source: {
          kind: 'document',
          documentType: '1099-DIV',
          documentId: f.id,
          field: boxLabel(field),
          description: `1099-DIV from ${f.payerName} (${boxLabel(field)})`,
        },
        confidence: 1.0,
      })
    }
  }

  // 1099-MISCs
  for (const f of (model.form1099MISCs ?? [])) {
    const fields: Array<[string, number]> = [
      ['box1', f.box1],
      ['box2', f.box2],
      ['box3', f.box3],
      ['box4', f.box4],
    ]
    for (const [field, amount] of fields) {
      if (amount > 0) {
        values.set(`1099misc:${f.id}:${field}`, {
          amount,
          source: {
            kind: 'document',
            documentType: '1099-MISC',
            documentId: f.id,
            field: boxLabel(field),
            description: `1099-MISC from ${f.payerName} (${boxLabel(field)})`,
          },
          confidence: 1.0,
        })
      }
    }
  }

  // 1099-Rs
  for (const f of (model.form1099Rs ?? [])) {
    const fields: Array<[string, number]> = [
      ['box1', f.box1],
      ['box2a', f.box2a],
      ['box4', f.box4],
    ]
    for (const [fld, amount] of fields) {
      if (amount > 0) {
        values.set(`1099r:${f.id}:${fld}`, {
          amount,
          source: {
            kind: 'document',
            documentType: '1099-R',
            documentId: f.id,
            field: boxLabel(fld),
            description: `1099-R from ${f.payerName} (${boxLabel(fld)})`,
          },
          confidence: 1.0,
        })
      }
    }
  }

  // 1099-Gs
  for (const f of (model.form1099Gs ?? [])) {
    const fields: Array<[string, number]> = [
      ['box1', f.box1],
      ['box2', f.box2],
      ['box4', f.box4],
    ]
    for (const [fld, amount] of fields) {
      if (amount > 0) {
        values.set(`1099g:${f.id}:${fld}`, {
          amount,
          source: {
            kind: 'document',
            documentType: '1099-G',
            documentId: f.id,
            field: boxLabel(fld),
            description: `1099-G from ${f.payerName} (${boxLabel(fld)})`,
          },
          confidence: 1.0,
        })
      }
    }
  }

  // 1099-Bs
  for (const f of model.form1099Bs) {
    if (f.federalTaxWithheld > 0) {
      values.set(`1099b:${f.id}:federalTaxWithheld`, {
        amount: f.federalTaxWithheld,
        source: {
          kind: 'document',
          documentType: '1099-B',
          documentId: f.id,
          field: 'Federal tax withheld',
          description: `1099-B from ${f.brokerName} (Federal tax withheld)`,
        },
        confidence: 1.0,
      })
    }
  }

  // Capital transactions — aggregated by broker + category when 1099-Bs exist
  if (model.form1099Bs.length > 0) {
    const brokerCatAgg = new Map<string, { count: number; gainLoss: number; brokerName: string; category: string }>()
    for (const tx of model.capitalTransactions) {
      const b = model.form1099Bs.find(b => b.id === tx.source1099BId)
      const brokerName = b?.brokerName || 'Unknown'
      const key = `broker:${brokerName}:${tx.category}`
      const existing = brokerCatAgg.get(key)
      if (existing) {
        existing.count++
        existing.gainLoss += tx.gainLoss
      } else {
        brokerCatAgg.set(key, { count: 1, gainLoss: tx.gainLoss, brokerName, category: tx.category })
      }
    }
    for (const [key, agg] of brokerCatAgg) {
      values.set(key, {
        amount: agg.gainLoss,
        source: {
          kind: 'document',
          documentType: '1099-B',
          documentId: key,
          field: 'Net Gain/Loss',
          description: `${agg.brokerName} — ${agg.count} sale${agg.count !== 1 ? 's' : ''} (Category ${agg.category})`,
        },
        confidence: 1.0,
      })
    }
  } else {
    // Fallback: per-transaction nodes when no 1099-Bs
    for (const tx of model.capitalTransactions) {
      values.set(`tx:${tx.id}`, {
        amount: tx.gainLoss,
        source: {
          kind: 'document',
          documentType: 'Transaction',
          documentId: tx.id,
          field: 'Gain/Loss',
          description: `Sale of ${tx.description}`,
        },
        confidence: 1.0,
      })
    }
  }

  // Standard deduction pseudo-node
  values.set('standardDeduction', tracedFromComputation(
    STANDARD_DEDUCTION[model.filingStatus],
    'standardDeduction',
    [],
    'Standard Deduction',
  ))

  // Form 540 (California) nodes
  if (form540) {
    const caInputs = ['form1040.line11']
    if (form540.caAdjustments.hsaAddBack > 0) caInputs.push('scheduleCA.hsaAddBack')

    if (form540.caAdjustments.hsaAddBack > 0) {
      values.set('scheduleCA.hsaAddBack', tracedFromComputation(
        form540.caAdjustments.hsaAddBack, 'scheduleCA.hsaAddBack', ['adjustments.hsa'],
        'HSA deduction add-back (CA)',
      ))
    }
    if (form540.caAdjustments.additions > 0) {
      values.set('scheduleCA.additions', tracedFromComputation(
        form540.caAdjustments.additions, 'scheduleCA.additions',
        form540.caAdjustments.hsaAddBack > 0 ? ['scheduleCA.hsaAddBack'] : [],
        'CA income additions',
      ))
    }

    values.set('form540.caAGI', tracedFromComputation(
      form540.caAGI, 'form540.caAGI', caInputs, 'California adjusted gross income',
    ))
    values.set('form540.caDeduction', tracedFromComputation(
      form540.deductionUsed, 'form540.caDeduction', [],
      `CA ${form540.deductionMethod} deduction`,
    ))
    values.set('form540.caTaxableIncome', tracedFromComputation(
      form540.caTaxableIncome, 'form540.caTaxableIncome',
      ['form540.caAGI', 'form540.caDeduction'],
      'California taxable income',
    ))
    values.set('form540.caTax', tracedFromComputation(
      form540.caTax, 'form540.caTax', ['form540.caTaxableIncome'], 'California tax',
    ))

    if (form540.totalExemptionCredits > 0) {
      values.set('form540.exemptionCredits', tracedFromComputation(
        form540.totalExemptionCredits, 'form540.exemptionCredits', [],
        'CA exemption credits',
      ))
    }

    if (form540.mentalHealthTax > 0) {
      values.set('form540.mentalHealthTax', tracedFromComputation(
        form540.mentalHealthTax, 'form540.mentalHealthTax', ['form540.caTaxableIncome'],
        'Mental health services tax (1%)',
      ))
    }

    if (form540.rentersCredit > 0) {
      values.set('form540.rentersCredit', tracedFromComputation(
        form540.rentersCredit, 'form540.rentersCredit', [],
        "CA renter's credit",
      ))
    }

    const taxAfterInputs = ['form540.caTax']
    if (form540.totalExemptionCredits > 0) taxAfterInputs.push('form540.exemptionCredits')
    if (form540.mentalHealthTax > 0) taxAfterInputs.push('form540.mentalHealthTax')
    if (form540.rentersCredit > 0) taxAfterInputs.push('form540.rentersCredit')
    values.set('form540.taxAfterCredits', tracedFromComputation(
      form540.taxAfterCredits, 'form540.taxAfterCredits', taxAfterInputs,
      'CA tax after credits',
    ))

    if (form540.stateWithholding > 0) {
      values.set('form540.stateWithholding', tracedFromComputation(
        form540.stateWithholding, 'form540.stateWithholding', [],
        'CA state income tax withheld',
      ))
    }

    const resultInputs = ['form540.taxAfterCredits']
    if (form540.stateWithholding > 0) resultInputs.push('form540.stateWithholding')
    if (form540.overpaid > 0) {
      values.set('form540.overpaid', tracedFromComputation(
        form540.overpaid, 'form540.overpaid', resultInputs, 'CA overpaid (refund)',
      ))
    }
    if (form540.amountOwed > 0) {
      values.set('form540.amountOwed', tracedFromComputation(
        form540.amountOwed, 'form540.amountOwed', resultInputs, 'CA amount you owe',
      ))
    }
  }

  // Itemized deduction pseudo-nodes
  if (model.deductions.itemized) {
    const d = model.deductions.itemized
    const items: Array<[string, number]> = [
      ['itemized.medicalExpenses', d.medicalExpenses],
      ['itemized.stateLocalIncomeTaxes', d.stateLocalIncomeTaxes],
      ['itemized.stateLocalSalesTaxes', d.stateLocalSalesTaxes],
      ['itemized.realEstateTaxes', d.realEstateTaxes],
      ['itemized.personalPropertyTaxes', d.personalPropertyTaxes],
      ['itemized.mortgageInterest', d.mortgageInterest],
      ['itemized.investmentInterest', d.investmentInterest],
      ['itemized.charitableCash', d.charitableCash],
      ['itemized.charitableNoncash', d.charitableNoncash],
      ['itemized.gamblingLosses', d.gamblingLosses],
      ['itemized.casualtyTheftLosses', d.casualtyTheftLosses],
      ['itemized.federalEstateTaxIRD', d.federalEstateTaxIRD],
      ['itemized.otherMiscDeductions', d.otherMiscDeductions],
    ]
    for (const [nodeId, amount] of items) {
      values.set(nodeId, tracedFromComputation(
        amount,
        nodeId,
        [],
        NODE_LABELS[nodeId] ?? nodeId,
      ))
    }
  }

  return values
}

// ── buildTrace ───────────────────────────────────────────────────

export function buildTrace(result: ComputeResult, nodeId: string): ComputeTrace {
  const tv = result.values.get(nodeId)

  if (!tv) {
    return {
      nodeId,
      label: NODE_LABELS[nodeId] ?? `Unknown (${nodeId})`,
      output: tracedZero(nodeId),
      inputs: [],
    }
  }

  if (tv.source.kind === 'document') {
    return {
      nodeId,
      label: tv.source.description ?? NODE_LABELS[nodeId] ?? nodeId,
      output: tv,
      inputs: [],
      irsCitation: tv.irsCitation,
    }
  }

  if (tv.source.kind === 'computed') {
    const inputs = tv.source.inputs.map(inputId => buildTrace(result, inputId))
    return {
      nodeId,
      label: NODE_LABELS[nodeId] ?? nodeId,
      output: tv,
      inputs,
      irsCitation: tv.irsCitation,
    }
  }

  // user-entry
  return {
    nodeId,
    label: NODE_LABELS[nodeId] ?? nodeId,
    output: tv,
    inputs: [],
    irsCitation: tv.irsCitation,
  }
}

// ── explainLine ──────────────────────────────────────────────────

export function explainLine(result: ComputeResult, nodeId: string): string {
  const trace = buildTrace(result, nodeId)
  return formatTrace(trace, 0)
}

function formatTrace(trace: ComputeTrace, depth: number): string {
  const prefix = depth === 0 ? '' : '  '.repeat(depth) + '|- '
  const amount = formatDollars(trace.output.amount)
  const citation = trace.irsCitation ? ` [${trace.irsCitation}]` : ''
  const line = `${prefix}${trace.label}: ${amount}${citation}`

  if (trace.inputs.length === 0) return line

  const children = trace.inputs.map(child => formatTrace(child, depth + 1))
  return [line, ...children].join('\n')
}

function formatDollars(amountInCents: number): string {
  const d = amountInCents / 100
  const abs = Math.abs(d)
  const formatted = abs.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return d < 0 ? `-$${formatted}` : `$${formatted}`
}

// ── topologicalSort ──────────────────────────────────────────────

export function topologicalSort(values: Map<string, TracedValue>): string[] {
  const inDegree = new Map<string, number>()
  const dependents = new Map<string, string[]>()

  for (const nodeId of values.keys()) {
    inDegree.set(nodeId, 0)
    dependents.set(nodeId, [])
  }

  for (const [nodeId, tv] of values) {
    if (tv.source.kind === 'computed') {
      let count = 0
      for (const inputId of tv.source.inputs) {
        if (values.has(inputId)) {
          count++
          dependents.get(inputId)!.push(nodeId)
        }
      }
      inDegree.set(nodeId, count)
    }
  }

  const queue: string[] = []
  for (const [nodeId, deg] of inDegree) {
    if (deg === 0) queue.push(nodeId)
  }

  const sorted: string[] = []
  while (queue.length > 0) {
    const node = queue.shift()!
    sorted.push(node)
    for (const dep of dependents.get(node) ?? []) {
      const newDeg = inDegree.get(dep)! - 1
      inDegree.set(dep, newDeg)
      if (newDeg === 0) queue.push(dep)
    }
  }

  if (sorted.length !== values.size) {
    const remaining = [...values.keys()].filter(k => !sorted.includes(k))
    throw new Error(`Cycle detected involving: ${remaining.join(', ')}`)
  }

  return sorted
}

// ── resolveDocumentRef ───────────────────────────────────────────

export function resolveDocumentRef(
  model: TaxReturn,
  refId: string,
): { label: string; amount: number } {
  // W-2: w2:{id}:{field}
  let m = refId.match(/^w2:(.+?):(.+)$/)
  if (m) {
    const w2 = model.w2s.find(w => w.id === m![1])
    if (!w2) return { label: `Unknown W-2 (${m[1]})`, amount: 0 }
    const field = m[2]
    const amount = (w2 as unknown as Record<string, number>)[field] ?? 0
    return {
      label: `W-2 from ${w2.employerName} (${boxLabel(field)})`,
      amount,
    }
  }

  // 1099-INT: 1099int:{id}:{field}
  m = refId.match(/^1099int:(.+?):(.+)$/)
  if (m) {
    const f = model.form1099INTs.find(f => f.id === m![1])
    if (!f) return { label: `Unknown 1099-INT (${m[1]})`, amount: 0 }
    const field = m[2]
    const amount = (f as unknown as Record<string, number>)[field] ?? 0
    return {
      label: `1099-INT from ${f.payerName} (${boxLabel(field)})`,
      amount,
    }
  }

  // 1099-DIV: 1099div:{id}:{field}
  m = refId.match(/^1099div:(.+?):(.+)$/)
  if (m) {
    const f = model.form1099DIVs.find(f => f.id === m![1])
    if (!f) return { label: `Unknown 1099-DIV (${m[1]})`, amount: 0 }
    const field = m[2]
    const amount = (f as unknown as Record<string, number>)[field] ?? 0
    return {
      label: `1099-DIV from ${f.payerName} (${boxLabel(field)})`,
      amount,
    }
  }

  // 1099-MISC: 1099misc:{id}:{field}
  m = refId.match(/^1099misc:(.+?):(.+)$/)
  if (m) {
    const f = (model.form1099MISCs ?? []).find(f => f.id === m![1])
    if (!f) return { label: `Unknown 1099-MISC (${m[1]})`, amount: 0 }
    const field = m[2]
    const amount = (f as unknown as Record<string, number>)[field] ?? 0
    return {
      label: `1099-MISC from ${f.payerName} (${boxLabel(field)})`,
      amount,
    }
  }

  // 1099-R: 1099r:{id}:{field}
  m = refId.match(/^1099r:(.+?):(.+)$/)
  if (m) {
    const f = (model.form1099Rs ?? []).find(f => f.id === m![1])
    if (!f) return { label: `Unknown 1099-R (${m[1]})`, amount: 0 }
    const field = m[2]
    const amount = (f as unknown as Record<string, number>)[field] ?? 0
    return {
      label: `1099-R from ${f.payerName} (${boxLabel(field)})`,
      amount,
    }
  }

  // 1099-G: 1099g:{id}:{field}
  m = refId.match(/^1099g:(.+?):(.+)$/)
  if (m) {
    const f = (model.form1099Gs ?? []).find(f => f.id === m![1])
    if (!f) return { label: `Unknown 1099-G (${m[1]})`, amount: 0 }
    const field = m[2]
    const amount = (f as unknown as Record<string, number>)[field] ?? 0
    return {
      label: `1099-G from ${f.payerName} (${boxLabel(field)})`,
      amount,
    }
  }

  // 1099-B: 1099b:{id}:{field}
  m = refId.match(/^1099b:(.+?):(.+)$/)
  if (m) {
    const f = model.form1099Bs.find(b => b.id === m![1])
    if (!f) return { label: `Unknown 1099-B (${m[1]})`, amount: 0 }
    const field = m[2]
    const fieldLabels: Record<string, string> = {
      federalTaxWithheld: 'Federal tax withheld',
    }
    const amount = (f as unknown as Record<string, number>)[field] ?? 0
    return {
      label: `1099-B from ${f.brokerName} (${fieldLabels[field] ?? field})`,
      amount,
    }
  }

  // Broker aggregate: broker:{name}:{category}
  m = refId.match(/^broker:(.+):([ABDE])$/)
  if (m) {
    const brokerName = m[1]
    const category = m[2]
    const txs = model.capitalTransactions.filter(t => {
      const b = model.form1099Bs.find(b => b.id === t.source1099BId)
      return (b?.brokerName || 'Unknown') === brokerName && t.category === category
    })
    const total = txs.reduce((s, t) => s + t.gainLoss, 0)
    return {
      label: `${brokerName} — ${txs.length} sale${txs.length !== 1 ? 's' : ''} (Category ${category})`,
      amount: total,
    }
  }

  // Transaction: tx:{id} (legacy fallback)
  m = refId.match(/^tx:(.+)$/)
  if (m) {
    const tx = model.capitalTransactions.find(t => t.id === m![1])
    if (!tx) return { label: `Unknown transaction (${m[1]})`, amount: 0 }
    return {
      label: `Sale of ${tx.description}`,
      amount: tx.gainLoss,
    }
  }

  // Schedule E property: scheduleE:{id}:{field}
  m = refId.match(/^scheduleE:(.+?):(.+)$/)
  if (m) {
    const p = (model.scheduleEProperties ?? []).find(p => p.id === m![1])
    if (!p) return { label: `Unknown property (${m[1]})`, amount: 0 }
    const field = m[2]
    if (field === 'rentsReceived') return { label: `${p.address || 'Property'} — Rents received`, amount: p.rentsReceived }
    if (field === 'royaltiesReceived') return { label: `${p.address || 'Property'} — Royalties received`, amount: p.royaltiesReceived }
    if (field === 'expenses') {
      const total = p.advertising + p.auto + p.cleaning + p.commissions + p.insurance +
        p.legal + p.management + p.mortgageInterest + p.otherInterest +
        p.repairs + p.supplies + p.taxes + p.utilities + p.depreciation + p.other
      return { label: `${p.address || 'Property'} — Total expenses`, amount: total }
    }
    return { label: `${p.address || 'Property'} — ${field}`, amount: 0 }
  }

  // Standard deduction
  if (refId === 'standardDeduction') {
    return {
      label: `Standard deduction (${model.filingStatus})`,
      amount: STANDARD_DEDUCTION[model.filingStatus],
    }
  }

  // Itemized: itemized.{key}
  if (refId.startsWith('itemized.') && model.deductions.itemized) {
    const key = refId.slice('itemized.'.length) as keyof ItemizedDeductions
    const labels: Record<string, string> = {
      medicalExpenses: 'Medical expenses',
      stateLocalIncomeTaxes: 'State/local income taxes',
      stateLocalSalesTaxes: 'General sales taxes',
      realEstateTaxes: 'Real estate taxes',
      personalPropertyTaxes: 'Personal property taxes',
      mortgageInterest: 'Mortgage interest',
      investmentInterest: 'Investment interest',
      charitableCash: 'Charitable contributions (cash)',
      charitableNoncash: 'Charitable contributions (non-cash)',
      gamblingLosses: 'Gambling losses',
      casualtyTheftLosses: 'Casualty & theft losses',
      federalEstateTaxIRD: 'Federal estate tax on IRD',
      otherMiscDeductions: 'Other miscellaneous deductions',
    }
    const val = model.deductions.itemized[key]
    return {
      label: labels[key] ?? refId,
      amount: typeof val === 'number' ? val : 0,
    }
  }

  // Estimated tax payments: estimatedTax.{q1|q2|q3|q4}
  m = refId.match(/^estimatedTax\.(q[1-4])$/)
  if (m) {
    const quarter = m[1] as 'q1' | 'q2' | 'q3' | 'q4'
    const labels: Record<string, string> = {
      q1: 'Q1 estimated payment (Apr 15)',
      q2: 'Q2 estimated payment (Jun 15)',
      q3: 'Q3 estimated payment (Sep 15)',
      q4: 'Q4 estimated payment (Jan 15)',
    }
    const amount = model.estimatedTaxPayments?.[quarter] ?? 0
    return { label: labels[quarter], amount }
  }

  return { label: `Unknown (${refId})`, amount: 0 }
}

// ── Helpers ──────────────────────────────────────────────────────

function boxLabel(field: string): string {
  // 'box1' → 'Box 1', 'box1a' → 'Box 1a', 'box2a' → 'Box 2a'
  return field.replace(/^box/, 'Box ')
}
