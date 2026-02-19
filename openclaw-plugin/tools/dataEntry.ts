/**
 * Data entry tools — agent tools for entering tax data.
 *
 * All tools accept dollar amounts at the boundary, convert to cents internally,
 * and generate UUIDs for document IDs.
 */

import { randomUUID } from 'node:crypto'
import type { TaxService } from '../service/TaxService.ts'
import { cents, dollars } from '../../src/model/traced.ts'
import type { FilingStatus } from '../../src/model/types.ts'

function formatRefund(service: TaxService): string {
  const line34 = service.computeResult.form1040.line34.amount
  const line37 = service.computeResult.form1040.line37.amount
  if (line34 > 0) return `Estimated refund: $${dollars(line34).toFixed(2)}`
  if (line37 > 0) return `Amount owed: $${dollars(line37).toFixed(2)}`
  return 'Tax balance: $0.00'
}

// ── Tool definitions ─────────────────────────────────────────────

export interface ToolDef {
  name: string
  description: string
  parameters: Record<string, unknown>
  execute: (args: Record<string, unknown>) => string
}

export function createDataEntryTools(service: TaxService): ToolDef[] {
  return [
    {
      name: 'tax_set_filing_status',
      description: 'Set the filing status for the tax return.',
      parameters: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['single', 'mfj', 'mfs', 'hoh', 'qw'],
            description: 'Filing status: single, mfj (married filing jointly), mfs (married filing separately), hoh (head of household), qw (qualifying widow/er)',
          },
        },
        required: ['status'],
      },
      execute(args) {
        service.setFilingStatus(args.status as FilingStatus)
        return `Filing status set to "${args.status}". ${formatRefund(service)}`
      },
    },

    {
      name: 'tax_set_personal_info',
      description: 'Set the primary taxpayer\'s personal information.',
      parameters: {
        type: 'object',
        properties: {
          firstName: { type: 'string', description: 'First name' },
          lastName: { type: 'string', description: 'Last name' },
          middleInitial: { type: 'string', description: 'Middle initial (optional)' },
          ssn: { type: 'string', description: 'Social Security Number (9 digits, no dashes)' },
          dateOfBirth: { type: 'string', description: 'Date of birth (ISO date, optional)' },
          street: { type: 'string', description: 'Street address' },
          apartment: { type: 'string', description: 'Apartment/unit number (optional)' },
          city: { type: 'string', description: 'City' },
          state: { type: 'string', description: '2-letter state code' },
          zip: { type: 'string', description: 'ZIP code' },
        },
        required: ['firstName', 'lastName', 'ssn'],
      },
      execute(args) {
        const updates: Record<string, unknown> = {}
        if (args.firstName) updates.firstName = args.firstName
        if (args.lastName) updates.lastName = args.lastName
        if (args.middleInitial) updates.middleInitial = args.middleInitial
        if (args.ssn) updates.ssn = args.ssn
        if (args.dateOfBirth) updates.dateOfBirth = args.dateOfBirth

        const address: Record<string, unknown> = {}
        if (args.street) address.street = args.street
        if (args.apartment) address.apartment = args.apartment
        if (args.city) address.city = args.city
        if (args.state) address.state = args.state
        if (args.zip) address.zip = args.zip
        if (Object.keys(address).length > 0) updates.address = address

        service.setTaxpayer(updates as Parameters<typeof service.setTaxpayer>[0])
        return `Personal info set for ${args.firstName} ${args.lastName}. ${formatRefund(service)}`
      },
    },

    {
      name: 'tax_set_spouse_info',
      description: 'Set spouse information (for married filing jointly).',
      parameters: {
        type: 'object',
        properties: {
          firstName: { type: 'string', description: 'Spouse first name' },
          lastName: { type: 'string', description: 'Spouse last name' },
          middleInitial: { type: 'string', description: 'Middle initial (optional)' },
          ssn: { type: 'string', description: 'Spouse SSN (9 digits, no dashes)' },
          dateOfBirth: { type: 'string', description: 'Date of birth (ISO date, optional)' },
        },
        required: ['firstName', 'lastName', 'ssn'],
      },
      execute(args) {
        const updates: Record<string, unknown> = {}
        if (args.firstName) updates.firstName = args.firstName
        if (args.lastName) updates.lastName = args.lastName
        if (args.middleInitial) updates.middleInitial = args.middleInitial
        if (args.ssn) updates.ssn = args.ssn
        if (args.dateOfBirth) updates.dateOfBirth = args.dateOfBirth

        service.setSpouse(updates as Parameters<typeof service.setSpouse>[0])
        return `Spouse info set for ${args.firstName} ${args.lastName}. ${formatRefund(service)}`
      },
    },

    {
      name: 'tax_add_dependent',
      description: 'Add a dependent to the tax return.',
      parameters: {
        type: 'object',
        properties: {
          firstName: { type: 'string', description: 'Dependent first name' },
          lastName: { type: 'string', description: 'Dependent last name' },
          ssn: { type: 'string', description: 'Dependent SSN (9 digits, no dashes)' },
          relationship: { type: 'string', description: 'Relationship (e.g., "son", "daughter", "parent")' },
          monthsLived: { type: 'number', description: 'Months lived with taxpayer (0-12)' },
        },
        required: ['firstName', 'lastName', 'ssn', 'relationship', 'monthsLived'],
      },
      execute(args) {
        service.addDependent({
          firstName: args.firstName as string,
          lastName: args.lastName as string,
          ssn: args.ssn as string,
          relationship: args.relationship as string,
          monthsLived: args.monthsLived as number,
        })
        return `Added dependent: ${args.firstName} ${args.lastName} (${args.relationship}). ${formatRefund(service)}`
      },
    },

    {
      name: 'tax_add_w2',
      description: 'Add a W-2 form. All dollar amounts are in dollars (e.g., 60000 = $60,000).',
      parameters: {
        type: 'object',
        properties: {
          employerName: { type: 'string', description: 'Employer name' },
          employerEin: { type: 'string', description: 'Employer EIN (XX-XXXXXXX format, optional)' },
          wages: { type: 'number', description: 'Box 1: Wages, tips, other compensation (dollars)' },
          federalWithheld: { type: 'number', description: 'Box 2: Federal income tax withheld (dollars)' },
          ssWages: { type: 'number', description: 'Box 3: Social security wages (dollars, optional)' },
          ssTax: { type: 'number', description: 'Box 4: Social security tax withheld (dollars, optional)' },
          medicareWages: { type: 'number', description: 'Box 5: Medicare wages (dollars, optional)' },
          medicareTax: { type: 'number', description: 'Box 6: Medicare tax withheld (dollars, optional)' },
          stateCode: { type: 'string', description: 'Box 15: State code (optional)' },
          stateWages: { type: 'number', description: 'Box 16: State wages (dollars, optional)' },
          stateIncomeTax: { type: 'number', description: 'Box 17: State income tax (dollars, optional)' },
        },
        required: ['employerName', 'wages', 'federalWithheld'],
      },
      execute(args) {
        const id = randomUUID()
        const wages = cents(args.wages as number)
        service.addW2({
          id,
          employerName: args.employerName as string,
          employerEin: (args.employerEin as string) || '00-0000000',
          box1: wages,
          box2: cents(args.federalWithheld as number),
          box3: args.ssWages != null ? cents(args.ssWages as number) : wages,
          box4: args.ssTax != null ? cents(args.ssTax as number) : 0,
          box5: args.medicareWages != null ? cents(args.medicareWages as number) : wages,
          box6: args.medicareTax != null ? cents(args.medicareTax as number) : 0,
          box7: 0,
          box8: 0,
          box10: 0,
          box11: 0,
          box12: [],
          box13StatutoryEmployee: false,
          box13RetirementPlan: false,
          box13ThirdPartySickPay: false,
          box14: '',
          box15State: args.stateCode as string | undefined,
          box16StateWages: args.stateWages != null ? cents(args.stateWages as number) : undefined,
          box17StateIncomeTax: args.stateIncomeTax != null ? cents(args.stateIncomeTax as number) : undefined,
        })
        return `Added W-2 from ${args.employerName} ($${(args.wages as number).toLocaleString('en-US')} wages). ${formatRefund(service)}`
      },
    },

    {
      name: 'tax_add_1099_int',
      description: 'Add a 1099-INT form. All dollar amounts in dollars.',
      parameters: {
        type: 'object',
        properties: {
          payerName: { type: 'string', description: 'Payer name (bank/institution)' },
          interestIncome: { type: 'number', description: 'Box 1: Interest income (dollars)' },
          earlyWithdrawalPenalty: { type: 'number', description: 'Box 2: Early withdrawal penalty (dollars, optional)' },
          usSavingsBondInterest: { type: 'number', description: 'Box 3: US savings bond interest (dollars, optional)' },
          federalWithheld: { type: 'number', description: 'Box 4: Federal tax withheld (dollars, optional)' },
          taxExemptInterest: { type: 'number', description: 'Box 8: Tax-exempt interest (dollars, optional)' },
        },
        required: ['payerName', 'interestIncome'],
      },
      execute(args) {
        const id = randomUUID()
        service.addForm1099INT({
          id,
          payerName: args.payerName as string,
          box1: cents(args.interestIncome as number),
          box2: args.earlyWithdrawalPenalty != null ? cents(args.earlyWithdrawalPenalty as number) : 0,
          box3: args.usSavingsBondInterest != null ? cents(args.usSavingsBondInterest as number) : 0,
          box4: args.federalWithheld != null ? cents(args.federalWithheld as number) : 0,
          box8: args.taxExemptInterest != null ? cents(args.taxExemptInterest as number) : 0,
        })
        return `Added 1099-INT from ${args.payerName} ($${(args.interestIncome as number).toLocaleString('en-US')} interest). ${formatRefund(service)}`
      },
    },

    {
      name: 'tax_add_1099_div',
      description: 'Add a 1099-DIV form. All dollar amounts in dollars.',
      parameters: {
        type: 'object',
        properties: {
          payerName: { type: 'string', description: 'Payer name (brokerage/fund)' },
          ordinaryDividends: { type: 'number', description: 'Box 1a: Total ordinary dividends (dollars)' },
          qualifiedDividends: { type: 'number', description: 'Box 1b: Qualified dividends (dollars, optional)' },
          capitalGainDistributions: { type: 'number', description: 'Box 2a: Capital gain distributions (dollars, optional)' },
          federalWithheld: { type: 'number', description: 'Box 4: Federal tax withheld (dollars, optional)' },
          section199a: { type: 'number', description: 'Box 5: Section 199A dividends (dollars, optional)' },
          exemptInterestDividends: { type: 'number', description: 'Box 11: Exempt-interest dividends (dollars, optional)' },
        },
        required: ['payerName', 'ordinaryDividends'],
      },
      execute(args) {
        const id = randomUUID()
        service.addForm1099DIV({
          id,
          payerName: args.payerName as string,
          box1a: cents(args.ordinaryDividends as number),
          box1b: args.qualifiedDividends != null ? cents(args.qualifiedDividends as number) : 0,
          box2a: args.capitalGainDistributions != null ? cents(args.capitalGainDistributions as number) : 0,
          box3: 0,
          box4: args.federalWithheld != null ? cents(args.federalWithheld as number) : 0,
          box5: args.section199a != null ? cents(args.section199a as number) : 0,
          box11: args.exemptInterestDividends != null ? cents(args.exemptInterestDividends as number) : 0,
        })
        return `Added 1099-DIV from ${args.payerName} ($${(args.ordinaryDividends as number).toLocaleString('en-US')} ordinary dividends). ${formatRefund(service)}`
      },
    },

    {
      name: 'tax_add_capital_transaction',
      description: 'Add a capital gain/loss transaction. All dollar amounts in dollars.',
      parameters: {
        type: 'object',
        properties: {
          description: { type: 'string', description: 'Security description (e.g., "100 shares AAPL")' },
          dateAcquired: { type: 'string', description: 'Date acquired (ISO date or null for "Various")' },
          dateSold: { type: 'string', description: 'Date sold (ISO date)' },
          proceeds: { type: 'number', description: 'Sale proceeds (dollars)' },
          costBasis: { type: 'number', description: 'Cost basis (dollars)' },
          longTerm: { type: 'boolean', description: 'true if held > 1 year' },
        },
        required: ['description', 'dateSold', 'proceeds', 'costBasis', 'longTerm'],
      },
      execute(args) {
        const id = randomUUID()
        const proceedsCents = cents(args.proceeds as number)
        const basisCents = cents(args.costBasis as number)
        const gainLoss = proceedsCents - basisCents
        const longTerm = args.longTerm as boolean
        const category = longTerm ? 'D' : 'A'

        const txn = {
          id,
          description: args.description as string,
          dateAcquired: (args.dateAcquired as string | null) ?? null,
          dateSold: args.dateSold as string,
          proceeds: proceedsCents,
          reportedBasis: basisCents,
          adjustedBasis: basisCents,
          adjustmentCode: null,
          adjustmentAmount: 0,
          gainLoss,
          washSaleLossDisallowed: 0,
          longTerm,
          category: category as 'A' | 'D',
          source1099BId: '',
        }

        const existing = service.taxReturn.capitalTransactions
        service.setCapitalTransactions([...existing, txn])
        const gainStr = dollars(gainLoss) >= 0
          ? `$${dollars(gainLoss).toFixed(2)} gain`
          : `-$${Math.abs(dollars(gainLoss)).toFixed(2)} loss`
        return `Added ${args.description} (${gainStr}, ${longTerm ? 'long-term' : 'short-term'}). ${formatRefund(service)}`
      },
    },

    {
      name: 'tax_set_deductions',
      description: 'Set deduction method and/or itemized deduction amounts. All dollar amounts in dollars.',
      parameters: {
        type: 'object',
        properties: {
          method: { type: 'string', enum: ['standard', 'itemized'], description: 'Deduction method' },
          medicalExpenses: { type: 'number', description: 'Medical and dental expenses (dollars, optional)' },
          stateLocalTaxes: { type: 'number', description: 'State and local taxes (dollars, optional)' },
          mortgageInterest: { type: 'number', description: 'Mortgage interest (dollars, optional)' },
          charitableCash: { type: 'number', description: 'Charitable contributions - cash (dollars, optional)' },
          charitableNoncash: { type: 'number', description: 'Charitable contributions - noncash (dollars, optional)' },
          otherDeductions: { type: 'number', description: 'Other deductions (dollars, optional)' },
        },
        required: ['method'],
      },
      execute(args) {
        const method = args.method as 'standard' | 'itemized'
        service.setDeductionMethod(method)

        if (method === 'itemized') {
          const itemized: Record<string, number> = {}
          if (args.medicalExpenses != null) itemized.medicalExpenses = cents(args.medicalExpenses as number)
          if (args.stateLocalTaxes != null) itemized.stateLocalTaxes = cents(args.stateLocalTaxes as number)
          if (args.mortgageInterest != null) itemized.mortgageInterest = cents(args.mortgageInterest as number)
          if (args.charitableCash != null) itemized.charitableCash = cents(args.charitableCash as number)
          if (args.charitableNoncash != null) itemized.charitableNoncash = cents(args.charitableNoncash as number)
          if (args.otherDeductions != null) itemized.otherDeductions = cents(args.otherDeductions as number)
          if (Object.keys(itemized).length > 0) {
            service.setItemizedDeductions(itemized)
          }
        }

        const deductionAmt = dollars(service.computeResult.form1040.line12.amount)
        return `Deductions set to ${method} ($${deductionAmt.toLocaleString('en-US', { minimumFractionDigits: 2 })}). ${formatRefund(service)}`
      },
    },
  ]
}
