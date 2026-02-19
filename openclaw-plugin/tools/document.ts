/**
 * Document processing tools — OCR and CSV import.
 */

import { readFileSync } from 'node:fs'
import type { TaxService } from '../service/TaxService.ts'
import { detectFormType } from '../../src/intake/ocr/formDetector.ts'
import { parseW2 } from '../../src/intake/ocr/w2Parser.ts'
import { parseForm1099Int } from '../../src/intake/ocr/form1099IntParser.ts'
import { parseForm1099Div } from '../../src/intake/ocr/form1099DivParser.ts'
import { autoDetectBroker } from '../../src/intake/csv/autoDetect.ts'
import { convertToCapitalTransactions } from '../../src/intake/csv/convert.ts'
import { dollars } from '../../src/model/traced.ts'
import type { ToolDef } from './dataEntry.ts'

export function createDocumentTools(service: TaxService, ocrFn: (filePath: string) => Promise<import('../../src/intake/ocr/ocrEngine.ts').OCRResult>): ToolDef[] {
  return [
    {
      name: 'tax_process_document',
      description: 'Process a photo of a tax document (W-2, 1099-INT, 1099-DIV) using OCR. Returns extracted data for confirmation — does NOT auto-import.',
      parameters: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: 'Path to the image file' },
        },
        required: ['filePath'],
      },
      execute(args) {
        // This tool is async in nature but our interface is sync.
        // The plugin framework handles async via promise.
        // We return a placeholder and the actual implementation uses executeAsync.
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
 */
export async function processDocumentAsync(
  filePath: string,
  ocrFn: (filePath: string) => Promise<import('../../src/intake/ocr/ocrEngine.ts').OCRResult>,
): Promise<string> {
  const ocr = await ocrFn(filePath)
  const formType = detectFormType(ocr)

  if (formType === 'unknown') {
    return `Could not identify the form type. Raw OCR text (first 500 chars):\n${ocr.rawText.slice(0, 500)}\n\nPlease enter the data manually using the appropriate tool.`
  }

  const lines: string[] = [`Detected form: **${formType}** (confidence: ${ocr.confidence.toFixed(0)}%)\n`]

  if (formType === 'W-2') {
    const result = parseW2(ocr)
    lines.push('Extracted W-2 fields:')
    for (const [key, field] of result.fields) {
      lines.push(`- ${key}: ${field.value} (confidence: ${(field.confidence * 100).toFixed(0)}%)`)
    }
    lines.push('\nReview these values and use tax_add_w2 to enter them.')
  } else if (formType === '1099-INT') {
    const result = parseForm1099Int(ocr)
    lines.push('Extracted 1099-INT fields:')
    for (const [key, field] of result.fields) {
      lines.push(`- ${key}: ${field.value} (confidence: ${(field.confidence * 100).toFixed(0)}%)`)
    }
    lines.push('\nReview these values and use tax_add_1099_int to enter them.')
  } else if (formType === '1099-DIV') {
    const result = parseForm1099Div(ocr)
    lines.push('Extracted 1099-DIV fields:')
    for (const [key, field] of result.fields) {
      lines.push(`- ${key}: ${field.value} (confidence: ${(field.confidence * 100).toFixed(0)}%)`)
    }
    lines.push('\nReview these values and use tax_add_1099_div to enter them.')
  }

  return lines.join('\n')
}
