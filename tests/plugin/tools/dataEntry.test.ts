import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { TaxService } from '../../../openclaw-plugin/service/TaxService.ts'
import { createDataEntryTools } from '../../../openclaw-plugin/tools/dataEntry.ts'
import type { ToolDef } from '../../../openclaw-plugin/tools/dataEntry.ts'
import { cents } from '../../../src/model/traced.ts'

let workspace: string
let service: TaxService
let tools: Map<string, ToolDef>

beforeEach(() => {
  workspace = mkdtempSync(join(tmpdir(), 'opentax-tools-'))
  service = new TaxService(workspace)
  const toolList = createDataEntryTools(service)
  tools = new Map(toolList.map((t) => [t.name, t]))
})

afterEach(() => {
  rmSync(workspace, { recursive: true, force: true })
})

function exec(name: string, args: Record<string, unknown> = {}): string {
  const tool = tools.get(name)
  if (!tool) throw new Error(`Tool not found: ${name}`)
  return tool.execute(args)
}

describe('dataEntry tools', () => {
  it('tax_set_filing_status sets filing status', () => {
    const result = exec('tax_set_filing_status', { status: 'mfj' })
    expect(result).toContain('mfj')
    expect(service.taxReturn.filingStatus).toBe('mfj')
  })

  it('tax_set_personal_info sets name and address', () => {
    const result = exec('tax_set_personal_info', {
      firstName: 'John',
      lastName: 'Doe',
      ssn: '123456789',
      street: '123 Main St',
      city: 'Springfield',
      state: 'IL',
      zip: '62701',
    })
    expect(result).toContain('John Doe')
    expect(service.taxReturn.taxpayer.firstName).toBe('John')
    expect(service.taxReturn.taxpayer.address.street).toBe('123 Main St')
  })

  it('tax_set_spouse_info sets spouse', () => {
    exec('tax_set_filing_status', { status: 'mfj' })
    const result = exec('tax_set_spouse_info', {
      firstName: 'Jane',
      lastName: 'Doe',
      ssn: '987654321',
    })
    expect(result).toContain('Jane Doe')
    expect(service.taxReturn.spouse).toBeDefined()
    expect(service.taxReturn.spouse!.firstName).toBe('Jane')
  })

  it('tax_add_dependent adds a dependent', () => {
    const result = exec('tax_add_dependent', {
      firstName: 'Kid',
      lastName: 'Doe',
      ssn: '111111111',
      relationship: 'son',
      monthsLived: 12,
    })
    expect(result).toContain('Kid Doe')
    expect(result).toContain('son')
    expect(service.taxReturn.dependents).toHaveLength(1)
  })

  it('tax_add_w2 converts dollars to cents and adds W-2', () => {
    const result = exec('tax_add_w2', {
      employerName: 'Google',
      wages: 75000.50,
      federalWithheld: 12000,
    })
    expect(result).toContain('Google')
    expect(result).toContain('75,000.5')
    expect(service.taxReturn.w2s).toHaveLength(1)
    // Dollar→cent conversion
    expect(service.taxReturn.w2s[0].box1).toBe(cents(75000.50))
    expect(service.taxReturn.w2s[0].box1).toBe(7500050)
    expect(service.taxReturn.w2s[0].box2).toBe(cents(12000))
    // Response includes updated balance
    expect(result.toLowerCase()).toMatch(/refund|owed|balance/)
  })

  it('tax_add_w2 defaults SS/Medicare wages to box1 wages', () => {
    exec('tax_add_w2', { employerName: 'Test', wages: 60000, federalWithheld: 9000 })
    const w2 = service.taxReturn.w2s[0]
    expect(w2.box3).toBe(cents(60000))
    expect(w2.box5).toBe(cents(60000))
  })

  it('tax_add_1099_int adds interest income', () => {
    const result = exec('tax_add_1099_int', {
      payerName: 'Chase Bank',
      interestIncome: 450.25,
    })
    expect(result).toContain('Chase Bank')
    expect(service.taxReturn.form1099INTs).toHaveLength(1)
    expect(service.taxReturn.form1099INTs[0].box1).toBe(cents(450.25))
    expect(service.computeResult.form1040.line2b.amount).toBe(cents(450.25))
  })

  it('tax_add_1099_div adds dividend income', () => {
    const result = exec('tax_add_1099_div', {
      payerName: 'Vanguard',
      ordinaryDividends: 3000,
      qualifiedDividends: 2000,
    })
    expect(result).toContain('Vanguard')
    expect(service.taxReturn.form1099DIVs).toHaveLength(1)
    expect(service.taxReturn.form1099DIVs[0].box1a).toBe(cents(3000))
    expect(service.taxReturn.form1099DIVs[0].box1b).toBe(cents(2000))
  })

  it('tax_add_capital_transaction adds a transaction', () => {
    const result = exec('tax_add_capital_transaction', {
      description: '100 shares AAPL',
      dateSold: '2025-06-15',
      proceeds: 15000,
      costBasis: 10000,
      longTerm: true,
    })
    expect(result).toContain('AAPL')
    expect(result).toContain('gain')
    expect(service.taxReturn.capitalTransactions).toHaveLength(1)
    expect(service.taxReturn.capitalTransactions[0].proceeds).toBe(cents(15000))
    expect(service.taxReturn.capitalTransactions[0].gainLoss).toBe(cents(5000))
    expect(service.taxReturn.capitalTransactions[0].longTerm).toBe(true)
  })

  it('tax_add_capital_transaction shows loss for losing trade', () => {
    const result = exec('tax_add_capital_transaction', {
      description: 'TSLA',
      dateSold: '2025-03-01',
      proceeds: 5000,
      costBasis: 8000,
      longTerm: false,
    })
    expect(result).toContain('loss')
    expect(service.taxReturn.capitalTransactions[0].gainLoss).toBe(cents(-3000))
  })

  it('tax_set_deductions sets standard', () => {
    const result = exec('tax_set_deductions', { method: 'standard' })
    expect(result).toContain('standard')
    expect(service.taxReturn.deductions.method).toBe('standard')
  })

  it('tax_set_deductions sets itemized with amounts', () => {
    exec('tax_set_deductions', {
      method: 'itemized',
      stateLocalIncomeTaxes: 10000,
      charitableCash: 5000,
    })
    expect(service.taxReturn.deductions.method).toBe('itemized')
    expect(service.taxReturn.deductions.itemized!.stateLocalIncomeTaxes).toBe(cents(10000))
    expect(service.taxReturn.deductions.itemized!.charitableCash).toBe(cents(5000))
  })

  it('each W-2 gets a unique ID', () => {
    exec('tax_add_w2', { employerName: 'A', wages: 50000, federalWithheld: 5000 })
    exec('tax_add_w2', { employerName: 'B', wages: 30000, federalWithheld: 3000 })
    expect(service.taxReturn.w2s[0].id).not.toBe(service.taxReturn.w2s[1].id)
  })
})
