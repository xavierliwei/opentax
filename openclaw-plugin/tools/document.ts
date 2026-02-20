/**
 * Document processing tools — PDF import and CSV import.
 */

import { readFileSync } from 'node:fs'
import type { TaxService } from '../service/TaxService.ts'
import { autoDetectBroker } from '../../src/intake/csv/autoDetect.ts'
import { convertToCapitalTransactions } from '../../src/intake/csv/convert.ts'
import { dollars } from '../../src/model/traced.ts'
import type { ToolDef } from './dataEntry.ts'

export function createDocumentTools(service: TaxService): ToolDef[] {
  return [
    {
      name: 'tax_process_document',
      description: 'Process a PDF tax document (W-2, 1099-INT, 1099-DIV) using text extraction. Returns extracted data for confirmation — does NOT auto-import.',
      parameters: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: 'Path to the PDF file' },
        },
        required: ['filePath'],
      },
      execute(args) {
        // This tool is async in nature but our interface is sync.
        // The plugin framework handles async via promise.
        return `Use tax_process_document_async for document processing.`
      },
    },

    {
      name: 'tax_import_csv',
      description: 'Import a CSV file of brokerage transactions (e.g., Robinhood). Auto-detects broker format. Returns summary for confirmation before importing.',
      parameters: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: 'Path to the CSV file' },
          confirm: { type: 'boolean', description: 'Set to true to actually import the transactions after reviewing the summary' },
        },
        required: ['filePath'],
      },
      execute(args) {
        const csv = readFileSync(args.filePath as string, 'utf-8')
        const detection = autoDetectBroker(csv)
        const { result, confidence } = detection

        if (result.errors.length > 0) {
          return `CSV parsing failed with errors:\n${result.errors.join('\n')}`
        }

        if (result.transactions.length === 0) {
          return 'No transactions found in the CSV file.'
        }

        const txns = convertToCapitalTransactions(result.transactions)

        if (args.confirm === true) {
          service.setCapitalTransactions(txns)
          const totalGain = txns.reduce((sum, t) => sum + t.gainLoss, 0)
          const gainStr = totalGain >= 0
            ? `$${dollars(totalGain).toFixed(2)} net gain`
            : `-$${Math.abs(dollars(totalGain)).toFixed(2)} net loss`
          return `Imported ${txns.length} transactions (${gainStr}). Broker: ${detection.parser.brokerName} (${confidence} confidence).`
        }

        // Summary mode
        const totalProceeds = txns.reduce((sum, t) => sum + t.proceeds, 0)
        const totalGain = txns.reduce((sum, t) => sum + t.gainLoss, 0)
        const shortTerm = txns.filter((t) => !t.longTerm).length
        const longTerm = txns.filter((t) => t.longTerm).length

        return [
          `## CSV Import Summary`,
          `- Broker: ${detection.parser.brokerName} (${confidence} confidence)`,
          `- Transactions: ${txns.length} (${shortTerm} short-term, ${longTerm} long-term)`,
          `- Total proceeds: $${dollars(totalProceeds).toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
          `- Net gain/loss: $${dollars(totalGain).toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
          result.warnings.length > 0 ? `- Warnings: ${result.warnings.join('; ')}` : '',
          '',
          'Call this tool again with confirm=true to import these transactions.',
        ].filter(Boolean).join('\n')
      },
    },
  ]
}

/**
 * Async document processing — called by the plugin framework.
 * Uses pdfjs-dist text extraction instead of Tesseract OCR.
 */
export async function processDocumentAsync(filePath: string): Promise<string> {
  // Lazy import: pdfjs-dist requires DOMMatrix (browser API) which doesn't exist at
  // Node.js module load time. Importing dynamically defers this until actually called.
  const { parseGenericFormPdf } = await import('../../src/intake/pdf/genericFormPdfParser.ts')
  const buf = readFileSync(filePath)
  const data = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
  const result = await parseGenericFormPdf(data)

  if (result.formType === 'unknown') {
    return `Could not identify the form type in this PDF. Please enter the data manually using the appropriate tool.`
  }

  const lines: string[] = [`Detected form: **${result.formType}**\n`]

  lines.push(`Extracted ${result.formType} fields:`)
  for (const [key, field] of result.fields) {
    lines.push(`- ${key}: ${field.value}`)
  }

  if (result.warnings.length > 0) {
    lines.push(`\nWarnings: ${result.warnings.join('; ')}`)
  }

  const toolName = result.formType === 'W-2' ? 'tax_add_w2'
    : result.formType === '1099-INT' ? 'tax_add_1099_int'
    : result.formType === '1099-DIV' ? 'tax_add_1099_div'
    : result.formType === '1099-R' ? 'tax_add_1099_r'
    : 'tax_add_1099_div'
  lines.push(`\nReview these values and use ${toolName} to enter them.`)

  return lines.join('\n')
}
