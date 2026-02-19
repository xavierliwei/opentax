/**
 * Utility tools — reset and export.
 */

import type { TaxService } from '../service/TaxService.ts'
import type { ToolDef } from './dataEntry.ts'

export function createUtilityTools(service: TaxService): ToolDef[] {
  return [
    {
      name: 'tax_reset',
      description: 'Reset the tax return to a blank state. Use with caution — all data will be lost.',
      parameters: { type: 'object', properties: {} },
      execute() {
        service.resetReturn()
        return 'Tax return has been reset to a blank state.'
      },
    },

    {
      name: 'tax_export_json',
      description: 'Export the full TaxReturn as a JSON string.',
      parameters: { type: 'object', properties: {} },
      execute() {
        return JSON.stringify(service.taxReturn, null, 2)
      },
    },
  ]
}
