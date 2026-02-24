/**
 * Florida no-income-tax disclosure PDF generator.
 */

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import type { TaxReturn } from '../../model/types'
import type { StateComputeResult } from '../../rules/stateEngine'
import type { StateFormCompiler, StateCompiledForms, StateFormTemplates } from '../stateCompiler'

async function renderFloridaDisclosure(
  taxReturn: TaxReturn,
  stateResult: StateComputeResult,
): Promise<PDFDocument> {
  const doc = await PDFDocument.create()
  const page = doc.addPage([612, 792])
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)

  page.drawText('Florida State Income Tax Status', {
    x: 48,
    y: 744,
    size: 20,
    font: bold,
    color: rgb(0.08, 0.18, 0.45),
  })

  page.drawText(`Taxpayer: ${taxReturn.taxpayer.firstName} ${taxReturn.taxpayer.lastName}`, {
    x: 48,
    y: 712,
    size: 11,
    font,
    color: rgb(0, 0, 0),
  })
  page.drawText(`Tax year: ${taxReturn.taxYear}`, {
    x: 48,
    y: 696,
    size: 11,
    font,
    color: rgb(0, 0, 0),
  })

  let y = 656
  const lines = stateResult.disclosures ?? [
    'Florida does not impose a personal state income tax.',
    'No Florida state income tax return is required.',
  ]

  for (const line of lines) {
    page.drawText(`• ${line}`, {
      x: 56,
      y,
      size: 12,
      font,
      color: rgb(0.1, 0.1, 0.1),
      maxWidth: 510,
      lineHeight: 16,
    })
    y -= 36
  }

  page.drawText('This page is informational and included in your packet for recordkeeping.', {
    x: 48,
    y: 120,
    size: 10,
    font,
    color: rgb(0.35, 0.35, 0.35),
  })

  return doc
}

export const flNoTaxFormCompiler: StateFormCompiler = {
  stateCode: 'FL',
  templateFiles: [],

  async compile(
    taxReturn: TaxReturn,
    stateResult: StateComputeResult,
    _templates: StateFormTemplates,
  ): Promise<StateCompiledForms> {
    const doc = await renderFloridaDisclosure(taxReturn, stateResult)

    return {
      doc,
      forms: [{
        formId: 'FL NO-TAX',
        sequenceNumber: 'FL-01',
        pageCount: doc.getPageCount(),
      }],
    }
  },
}
