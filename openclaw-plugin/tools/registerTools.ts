/**
 * Master tool registration — registers all agent tools with the OpenClaw API.
 *
 * Adapts the internal ToolDef format (sync execute returning string) to
 * OpenClaw's API shape (async execute returning { content: [...] }).
 */

import type { TaxService } from '../service/TaxService.ts'
import { createDataEntryTools } from './dataEntry.ts'
import { createQueryTools } from './query.ts'
import { createDocumentTools, processDocumentAsync } from './document.ts'
import { createUtilityTools } from './utility.ts'
import type { ToolDef } from './dataEntry.ts'
import type { OCRResult } from '../../src/intake/ocr/ocrEngine.ts'

export interface OpenClawApi {
  registerTool: (tool: {
    name: string
    description: string
    parameters: Record<string, unknown>
    execute: (id: string, params: Record<string, unknown>) => Promise<{ content: { type: string; text: string }[] }>
  }, opts?: { optional?: boolean }) => void
}

function wrapTool(tool: ToolDef): {
  name: string
  description: string
  parameters: Record<string, unknown>
  execute: (id: string, params: Record<string, unknown>) => Promise<{ content: { type: string; text: string }[] }>
} {
  return {
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters,
    async execute(_id: string, params: Record<string, unknown>) {
      const text = tool.execute(params)
      return { content: [{ type: 'text', text }] }
    },
  }
}

export function registerAllTools(
  api: OpenClawApi,
  service: TaxService,
  ocrFn: (filePath: string) => Promise<OCRResult>,
): void {
  const allTools: ToolDef[] = [
    ...createDataEntryTools(service),
    ...createQueryTools(service),
    ...createDocumentTools(service, ocrFn),
    ...createUtilityTools(service),
  ]

  for (const tool of allTools) {
    if (tool.name === 'tax_process_document') {
      // Document processing is async — special-case it
      api.registerTool({
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
        async execute(_id, params) {
          const text = await processDocumentAsync(params.filePath as string, ocrFn)
          return { content: [{ type: 'text', text }] }
        },
      })
    } else {
      api.registerTool(wrapTool(tool))
    }
  }
}
