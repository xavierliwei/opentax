import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import type { TaxReturn } from '../../model/types'
import type { StateComputeResult } from '../../rules/stateEngine'
import type { StateCompiledForms, StateFormCompiler } from '../stateCompiler'
import type { NJ1040Result } from '../../rules/2025/nj/form1040'

function formatDollars(cents: number): string {
  return (cents / 100).toLocaleString('en-US', { maximumFractionDigits: 0 })
}

async function generateNJ1040(taxReturn: TaxReturn, nj: NJ1040Result): Promise<PDFDocument> {
  const doc = await PDFDocument.create()
  const page = doc.addPage([612, 792])
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  const gray = rgb(0.4, 0.4, 0.4)

  let y = 760
  page.drawText('New Jersey Resident Income Tax Return — 2025 (Unofficial Worksheet)', { x: 40, y, size: 14, font: bold })
  y -= 22
  page.drawText(`${taxReturn.taxpayer.firstName} ${taxReturn.taxpayer.lastName} • SSN ending ${taxReturn.taxpayer.ssn.slice(-4)}`, { x: 40, y, size: 10, font, color: gray })

  y -= 26
  const line = (label: string, value: number, strong = false) => {
    page.drawText(label, { x: 40, y, size: 10, font: strong ? bold : font })
    page.drawText(`$${formatDollars(value)}`, { x: 500, y, size: 10, font: strong ? bold : font })
    y -= 18
  }

  line('Federal AGI', nj.federalAGI)
  line('NJ Gross Income', nj.njGrossIncome, true)
  if (nj.apportionmentRatio < 1) {
    page.drawText(`Apportionment ratio: ${Math.round(nj.apportionmentRatio * 100)}%`, { x: 52, y: y + 6, size: 8, font, color: gray })
  }
  line('NJ Exemptions', nj.exemptionAmount)
  line('NJ Taxable Income', nj.njTaxableIncome, true)
  line('NJ Income Tax', nj.njTax)
  line('NJ State Withholding', nj.stateWithholding)

  y -= 8
  if (nj.overpaid > 0) {
    line('Refund', nj.overpaid, true)
  } else if (nj.amountOwed > 0) {
    line('Amount Owed', nj.amountOwed, true)
  } else {
    line('Balance', 0, true)
  }

  page.drawText('For planning and review only. File official NJ-1040 through New Jersey Taxation portal or mail official form.', {
    x: 40, y: 40, size: 8, font, color: gray,
  })

  return doc
}

export const njFormCompiler: StateFormCompiler = {
  stateCode: 'NJ',
  templateFiles: [],
  async compile(taxReturn: TaxReturn, stateResult: StateComputeResult): Promise<StateCompiledForms> {
    const nj = stateResult.detail as NJ1040Result
    const doc = await generateNJ1040(taxReturn, nj)

    return {
      doc,
      forms: [{ formId: 'NJ Form NJ-1040', sequenceNumber: 'NJ-01', pageCount: doc.getPageCount() }],
    }
  },
}
