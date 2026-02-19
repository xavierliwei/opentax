/**
 * Query tools — read-only tools for checking tax status and getting explanations.
 */

import type { TaxService } from '../service/TaxService.ts'
import { analyzeGaps } from '../service/GapAnalysis.ts'
import { explainLine } from '../../src/rules/engine.ts'
import { dollars } from '../../src/model/traced.ts'
import type { ToolDef } from './dataEntry.ts'

export function createQueryTools(service: TaxService): ToolDef[] {
  return [
    {
      name: 'tax_get_status',
      description: 'Get the current tax return status including completion percentage, gaps, and suggestions.',
      parameters: { type: 'object', properties: {} },
      execute() {
        const gap = analyzeGaps(service.taxReturn, service.computeResult)
        const lines: string[] = []

        lines.push(`## Tax Return Status (${gap.completionPercent}% complete)`)
        lines.push('')

        if (gap.readyToFile) {
          lines.push('**Ready to file!**')
        } else {
          lines.push('**Not yet ready to file.**')
        }
        lines.push('')

        // Summary
        const cr = service.computeResult.form1040
        const agi = dollars(cr.line11.amount)
        const tax = dollars(cr.line24.amount)
        const withheld = dollars(cr.line25.amount)
        const refund = dollars(cr.line34.amount)
        const owed = dollars(cr.line37.amount)

        lines.push('### Tax Summary')
        lines.push(`- AGI: $${agi.toLocaleString('en-US', { minimumFractionDigits: 2 })}`)
        lines.push(`- Total tax: $${tax.toLocaleString('en-US', { minimumFractionDigits: 2 })}`)
        lines.push(`- Withheld: $${withheld.toLocaleString('en-US', { minimumFractionDigits: 2 })}`)
        if (refund > 0) lines.push(`- **Estimated refund: $${refund.toLocaleString('en-US', { minimumFractionDigits: 2 })}**`)
        if (owed > 0) lines.push(`- **Amount owed: $${owed.toLocaleString('en-US', { minimumFractionDigits: 2 })}**`)
        lines.push('')

        // Gap items
        if (gap.items.length > 0) {
          lines.push('### Missing Information')
          for (const item of gap.items) {
            const badge = item.priority === 'required' ? '[REQUIRED]' : '[recommended]'
            lines.push(`- ${badge} ${item.label}`)
          }
          lines.push('')
        }

        // Warnings
        if (gap.warnings.length > 0) {
          lines.push('### Warnings')
          for (const w of gap.warnings) {
            lines.push(`- ${w}`)
          }
          lines.push('')
        }

        // Documents on file
        const docs: string[] = []
        const tr = service.taxReturn
        if (tr.w2s.length > 0) {
          docs.push(`${tr.w2s.length} W-2(s)`)
        }
        if (tr.form1099INTs.length > 0) {
          docs.push(`${tr.form1099INTs.length} 1099-INT(s)`)
        }
        if (tr.form1099DIVs.length > 0) {
          docs.push(`${tr.form1099DIVs.length} 1099-DIV(s)`)
        }
        if ((tr.form1099MISCs ?? []).length > 0) {
          docs.push(`${tr.form1099MISCs!.length} 1099-MISC(s)`)
        }
        if ((tr.form1099Bs ?? []).length > 0) {
          docs.push(`${tr.form1099Bs!.length} 1099-B(s)`)
        }
        if (tr.capitalTransactions.length > 0) {
          docs.push(`${tr.capitalTransactions.length} capital transaction(s)`)
        }
        if (tr.rsuVestEvents.length > 0) {
          docs.push(`${tr.rsuVestEvents.length} RSU vest event(s)`)
        }
        if ((tr.form1099SAs ?? []).length > 0) {
          docs.push(`${tr.form1099SAs!.length} 1099-SA(s)`)
        }
        if (tr.isoExercises.length > 0) {
          docs.push(`${tr.isoExercises.length} ISO exercise(s)`)
        }
        if (docs.length > 0) {
          lines.push(`### Documents on File`)
          lines.push(`- ${docs.join(', ')}`)
          lines.push('')
        }

        lines.push(`### Next Step`)
        lines.push(gap.nextSuggestedAction)

        return lines.join('\n')
      },
    },

    {
      name: 'tax_get_result',
      description: 'Get the computed tax result: AGI, taxable income, tax, payments, refund/owed.',
      parameters: { type: 'object', properties: {} },
      execute() {
        const cr = service.computeResult.form1040
        const fmt = (v: number) => `$${dollars(v).toLocaleString('en-US', { minimumFractionDigits: 2 })}`

        return [
          `Total income (Line 9): ${fmt(cr.line9.amount)}`,
          `Adjusted gross income (Line 11): ${fmt(cr.line11.amount)}`,
          `Deductions (Line 14): ${fmt(cr.line14.amount)}`,
          `Taxable income (Line 15): ${fmt(cr.line15.amount)}`,
          `Tax (Line 16): ${fmt(cr.line16.amount)}`,
          `Total tax (Line 24): ${fmt(cr.line24.amount)}`,
          `Federal withholding (Line 25): ${fmt(cr.line25.amount)}`,
          `Total payments (Line 33): ${fmt(cr.line33.amount)}`,
          cr.line34.amount > 0
            ? `Estimated refund (Line 34): ${fmt(cr.line34.amount)}`
            : `Amount owed (Line 37): ${fmt(cr.line37.amount)}`,
        ].join('\n')
      },
    },

    {
      name: 'tax_explain',
      description: 'Explain how a specific tax line was calculated. Use node IDs like "form1040.line1a", "form1040.line15", etc.',
      parameters: {
        type: 'object',
        properties: {
          nodeId: { type: 'string', description: 'The computation node ID to explain (e.g., "form1040.line1a")' },
        },
        required: ['nodeId'],
      },
      execute(args) {
        return explainLine(service.computeResult, args.nodeId as string)
      },
    },
  ]
}
