import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { TaxService } from '../../../openclaw-plugin/service/TaxService.ts'
import { createQueryTools } from '../../../openclaw-plugin/tools/query.ts'
import { createDataEntryTools } from '../../../openclaw-plugin/tools/dataEntry.ts'
import type { ToolDef } from '../../../openclaw-plugin/tools/dataEntry.ts'
import { cents } from '../../../src/model/traced.ts'
import { explainLine } from '../../../src/rules/engine.ts'

let workspace: string
let service: TaxService
let tools: Map<string, ToolDef>

beforeEach(() => {
  workspace = mkdtempSync(join(tmpdir(), 'opentax-query-'))
  service = new TaxService(workspace)
  const allTools = [...createQueryTools(service), ...createDataEntryTools(service)]
  tools = new Map(allTools.map((t) => [t.name, t]))
})

afterEach(() => {
  rmSync(workspace, { recursive: true, force: true })
})

function exec(name: string, args: Record<string, unknown> = {}): string {
  const tool = tools.get(name)
  if (!tool) throw new Error(`Tool not found: ${name}`)
  return tool.execute(args)
}

describe('query tools', () => {
  describe('tax_get_status', () => {
    it('returns formatted gap report with completion %', () => {
      const result = exec('tax_get_status')
      expect(result).toContain('% complete')
      expect(result).toContain('Not yet ready to file')
      expect(result).toContain('[REQUIRED]')
      expect(result).toContain('Next Step')
    })

    it('shows completion improving as data is added', () => {
      const before = exec('tax_get_status')
      exec('tax_set_personal_info', {
        firstName: 'John',
        lastName: 'Doe',
        ssn: '123456789',
        street: '123 Main',
        city: 'City',
        state: 'IL',
        zip: '60000',
      })
      const after = exec('tax_get_status')

      // Extract completion percentages
      const beforePct = parseInt(before.match(/(\d+)% complete/)![1])
      const afterPct = parseInt(after.match(/(\d+)% complete/)![1])
      expect(afterPct).toBeGreaterThan(beforePct)
    })

    it('shows ready to file when complete', () => {
      exec('tax_set_personal_info', {
        firstName: 'John',
        lastName: 'Doe',
        ssn: '123456789',
        street: '123 Main',
        city: 'City',
        state: 'IL',
        zip: '60000',
      })
      exec('tax_add_w2', { employerName: 'Acme', wages: 60000, federalWithheld: 9000 })
      const result = exec('tax_get_status')
      expect(result).toContain('Ready to file')
    })

    it('shows documents on file', () => {
      exec('tax_add_w2', { employerName: 'Acme', wages: 60000, federalWithheld: 9000 })
      exec('tax_add_1099_int', { payerName: 'Bank', interestIncome: 500 })
      const result = exec('tax_get_status')
      expect(result).toContain('1 W-2')
      expect(result).toContain('1 1099-INT')
    })
  })

  describe('tax_get_result', () => {
    it('returns AGI, tax, refund/owed numbers', () => {
      exec('tax_add_w2', { employerName: 'Acme', wages: 60000, federalWithheld: 9000 })
      const result = exec('tax_get_result')

      expect(result).toContain('Adjusted gross income')
      expect(result).toContain('$60,000.00')
      expect(result).toContain('Total tax')
      expect(result).toContain('Federal withholding')
      // Should have either refund or owed
      expect(result).toMatch(/refund|owed/i)
    })

    it('shows $0 for empty return', () => {
      const result = exec('tax_get_result')
      expect(result).toContain('$0.00')
    })
  })

  describe('tax_explain', () => {
    it('output matches explainLine() for same nodeId', () => {
      exec('tax_add_w2', { employerName: 'Acme', wages: 60000, federalWithheld: 9000 })
      const toolOutput = exec('tax_explain', { nodeId: 'form1040.line1a' })
      const directOutput = explainLine(service.computeResult, 'form1040.line1a')
      expect(toolOutput).toBe(directOutput)
    })

    it('explains wages line with W-2 source', () => {
      exec('tax_add_w2', { employerName: 'Acme', wages: 60000, federalWithheld: 9000 })
      const result = exec('tax_explain', { nodeId: 'form1040.line1a' })
      expect(result).toContain('Wages')
      expect(result).toContain('$60,000.00')
    })

    it('explains unknown node gracefully', () => {
      const result = exec('tax_explain', { nodeId: 'nonexistent.node' })
      expect(result).toContain('Unknown')
    })
  })
})
