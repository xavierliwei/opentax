/**
 * Utility tools — reset and export.
 */

import type { TaxService } from '../service/TaxService.ts'
import type { ToolDef } from './dataEntry.ts'

export function createUtilityTools(service: TaxService): ToolDef[] {
  return [
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
