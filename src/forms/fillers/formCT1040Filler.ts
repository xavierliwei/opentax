import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import type { TaxReturn } from '../../model/types'
import type { StateComputeResult } from '../../rules/stateEngine'
import type { FormCT1040Result } from '../../rules/2025/ct/formCT1040'
import type { StateCompiledForms, StateFormCompiler, StateFormTemplates } from '../stateCompiler'
import { filingStatusLabel, formatDollars, formatSSN } from '../helpers'

async function generateFormCT1040(taxReturn: TaxReturn, ct: FormCT1040Result): Promise<PDFDocument> {
  const doc = await PDFDocument.create()
  const page = doc.addPage([612, 792])
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  const blue = rgb(0.1, 0.15, 0.35)
  let y = 750
  const line = (label: string, value: number) => {
    page.drawText(label, { x: 72, y, size: 9, font })
    page.drawText(`$${formatDollars(value)}`, { x: 460, y, size: 9, font: bold })
    y -= 16
  }

  page.drawText('Connecticut Form CT-1040 (2025)', { x: 72, y, size: 16, font: bold, color: blue }); y -= 20
  page.drawText(`${taxReturn.taxpayer.firstName} ${taxReturn.taxpayer.lastName}  SSN ${formatSSN(taxReturn.taxpayer.ssn || '000000000')}`, { x: 72, y, size: 9, font }); y -= 14
  page.drawText(`Filing status: ${filingStatusLabel(taxReturn.filingStatus)} (${ct.residencyType})`, { x: 72, y, size: 9, font }); y -= 24

  line('CT AGI', ct.ctAGI)
  line('Personal exemption', ct.effectiveExemption)
  line('CT taxable income', ct.ctTaxableIncome)
  line('Tax from brackets', ct.bracketTax)
  line('Table C add-back', ct.tableC_addBack)
  line('Table D recapture', ct.tableD_recapture)
  line('CT income tax', ct.ctIncomeTax)
  line('Property tax credit', ct.propertyTaxCredit)
  line('Tax after credits', ct.taxAfterCredits)
  line('CT EITC (refundable)', ct.ctEITC)
  line('CT withholding', ct.stateWithholding)
  line('Total payments', ct.totalPayments)
  if (ct.overpaid > 0) line('Refund', ct.overpaid)
  if (ct.amountOwed > 0) line('Amount owed', ct.amountOwed)

  return doc
}

export const ctFormCompiler: StateFormCompiler = {
  stateCode: 'CT',
  templateFiles: ['ct1040.pdf'],
  async compile(taxReturn: TaxReturn, stateResult: StateComputeResult, _templates: StateFormTemplates): Promise<StateCompiledForms> {
    const detail = stateResult.detail as FormCT1040Result
    const doc = await generateFormCT1040(taxReturn, detail)
    return {
      doc,
      forms: [{ formId: 'CT Form CT-1040', sequenceNumber: 'CT-01', pageCount: doc.getPageCount() }],
    }
  },
}
