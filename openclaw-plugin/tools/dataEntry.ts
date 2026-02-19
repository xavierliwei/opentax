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
          stateLocalIncomeTaxes: { type: 'number', description: 'State and local income taxes (dollars, optional)' },
          stateLocalSalesTaxes: { type: 'number', description: 'State and local sales taxes (dollars, optional)' },
          realEstateTaxes: { type: 'number', description: 'Real property taxes (dollars, optional)' },
          personalPropertyTaxes: { type: 'number', description: 'Personal property taxes (dollars, optional)' },
          mortgageInterest: { type: 'number', description: 'Mortgage interest (dollars, optional)' },
          mortgagePrincipal: { type: 'number', description: 'Mortgage principal balance (dollars, optional)' },
          mortgagePreTCJA: { type: 'boolean', description: 'Mortgage originated before Dec 16, 2017 (optional)' },
          investmentInterest: { type: 'number', description: 'Investment interest / margin interest (dollars, optional)' },
          charitableCash: { type: 'number', description: 'Charitable contributions - cash (dollars, optional)' },
          charitableNoncash: { type: 'number', description: 'Charitable contributions - noncash (dollars, optional)' },
          gamblingLosses: { type: 'number', description: 'Gambling losses (dollars, optional)' },
          casualtyTheftLosses: { type: 'number', description: 'Casualty/theft losses from federally declared disasters (dollars, optional)' },
          federalEstateTaxIRD: { type: 'number', description: 'Federal estate tax on income in respect of a decedent (dollars, optional)' },
          otherMiscDeductions: { type: 'number', description: 'Other miscellaneous deductions (dollars, optional)' },
        },
        required: ['method'],
      },
      execute(args) {
        const method = args.method as 'standard' | 'itemized'
        service.setDeductionMethod(method)

        if (method === 'itemized') {
          const itemized: Record<string, number | boolean> = {}
          if (args.medicalExpenses != null) itemized.medicalExpenses = cents(args.medicalExpenses as number)
          if (args.stateLocalIncomeTaxes != null) itemized.stateLocalIncomeTaxes = cents(args.stateLocalIncomeTaxes as number)
          if (args.stateLocalSalesTaxes != null) itemized.stateLocalSalesTaxes = cents(args.stateLocalSalesTaxes as number)
          if (args.realEstateTaxes != null) itemized.realEstateTaxes = cents(args.realEstateTaxes as number)
          if (args.personalPropertyTaxes != null) itemized.personalPropertyTaxes = cents(args.personalPropertyTaxes as number)
          if (args.mortgageInterest != null) itemized.mortgageInterest = cents(args.mortgageInterest as number)
          if (args.mortgagePrincipal != null) itemized.mortgagePrincipal = cents(args.mortgagePrincipal as number)
          if (args.mortgagePreTCJA != null) itemized.mortgagePreTCJA = args.mortgagePreTCJA as boolean
          if (args.investmentInterest != null) itemized.investmentInterest = cents(args.investmentInterest as number)
          if (args.charitableCash != null) itemized.charitableCash = cents(args.charitableCash as number)
          if (args.charitableNoncash != null) itemized.charitableNoncash = cents(args.charitableNoncash as number)
          if (args.gamblingLosses != null) itemized.gamblingLosses = cents(args.gamblingLosses as number)
          if (args.casualtyTheftLosses != null) itemized.casualtyTheftLosses = cents(args.casualtyTheftLosses as number)
          if (args.federalEstateTaxIRD != null) itemized.federalEstateTaxIRD = cents(args.federalEstateTaxIRD as number)
          if (args.otherMiscDeductions != null) itemized.otherMiscDeductions = cents(args.otherMiscDeductions as number)
          if (Object.keys(itemized).length > 0) {
            service.setItemizedDeductions(itemized)
          }
        }

        const deductionAmt = dollars(service.computeResult.form1040.line12.amount)
        return `Deductions set to ${method} ($${deductionAmt.toLocaleString('en-US', { minimumFractionDigits: 2 })}). ${formatRefund(service)}`
      },
    },
    {
      name: 'tax_set_prior_year',
      description: 'Set prior-year carry-forward amounts. All dollar amounts in dollars.',
      parameters: {
        type: 'object',
        properties: {
          agi: { type: 'number', description: 'Prior-year AGI in dollars (for e-file identity verification)' },
          capitalLossCarryforwardST: { type: 'number', description: 'Short-term capital loss carryover in dollars (positive amount)' },
          capitalLossCarryforwardLT: { type: 'number', description: 'Long-term capital loss carryover in dollars (positive amount)' },
        },
      },
      execute(args) {
        const updates: Record<string, number> = {}
        if (args.agi != null) updates.agi = cents(args.agi as number)
        if (args.capitalLossCarryforwardST != null) updates.capitalLossCarryforwardST = cents(args.capitalLossCarryforwardST as number)
        if (args.capitalLossCarryforwardLT != null) updates.capitalLossCarryforwardLT = cents(args.capitalLossCarryforwardLT as number)
        service.setPriorYear(updates)
        const parts: string[] = []
        if (args.agi != null) parts.push(`AGI=$${(args.agi as number).toLocaleString('en-US')}`)
        if (args.capitalLossCarryforwardST != null) parts.push(`ST carryover=$${(args.capitalLossCarryforwardST as number).toLocaleString('en-US')}`)
        if (args.capitalLossCarryforwardLT != null) parts.push(`LT carryover=$${(args.capitalLossCarryforwardLT as number).toLocaleString('en-US')}`)
        return `Prior-year info set: ${parts.join(', ')}. ${formatRefund(service)}`
      },
    },

    {
      name: 'tax_add_1099_misc',
      description: 'Add a 1099-MISC form (rents, royalties, other income). All dollar amounts in dollars.',
      parameters: {
        type: 'object',
        properties: {
          payerName: { type: 'string', description: 'Payer name' },
          rents: { type: 'number', description: 'Box 1: Rents (dollars, optional)' },
          royalties: { type: 'number', description: 'Box 2: Royalties (dollars, optional)' },
          otherIncome: { type: 'number', description: 'Box 3: Other income — prizes, awards (dollars, optional)' },
          federalWithheld: { type: 'number', description: 'Box 4: Federal tax withheld (dollars, optional)' },
        },
        required: ['payerName'],
      },
      execute(args) {
        const id = randomUUID()
        service.addForm1099MISC({
          id,
          payerName: args.payerName as string,
          box1: args.rents != null ? cents(args.rents as number) : 0,
          box2: args.royalties != null ? cents(args.royalties as number) : 0,
          box3: args.otherIncome != null ? cents(args.otherIncome as number) : 0,
          box4: args.federalWithheld != null ? cents(args.federalWithheld as number) : 0,
        })
        const parts: string[] = []
        if (args.rents) parts.push(`$${(args.rents as number).toLocaleString('en-US')} rents`)
        if (args.royalties) parts.push(`$${(args.royalties as number).toLocaleString('en-US')} royalties`)
        if (args.otherIncome) parts.push(`$${(args.otherIncome as number).toLocaleString('en-US')} other income`)
        return `Added 1099-MISC from ${args.payerName} (${parts.join(', ') || 'no amounts'}). ${formatRefund(service)}`
      },
    },

    {
      name: 'tax_add_1099_b',
      description: 'Add a 1099-B form (stock/security sale). All dollar amounts in dollars.',
      parameters: {
        type: 'object',
        properties: {
          brokerName: { type: 'string', description: 'Broker name (e.g., "Fidelity")' },
          description: { type: 'string', description: 'Security description (e.g., "100 sh AAPL")' },
          dateAcquired: { type: 'string', description: 'Date acquired (ISO date, or null for "Various")' },
          dateSold: { type: 'string', description: 'Date sold (ISO date)' },
          proceeds: { type: 'number', description: 'Box 1d: Proceeds (dollars)' },
          costBasis: { type: 'number', description: 'Box 1e: Cost basis (dollars, optional if not reported)' },
          washSaleLossDisallowed: { type: 'number', description: 'Box 1g: Wash sale loss disallowed (dollars, optional)' },
          longTerm: { type: 'boolean', description: 'true if held > 1 year (long-term), false for short-term' },
          basisReportedToIrs: { type: 'boolean', description: 'Box 12: Basis reported to IRS (default true)' },
          federalWithheld: { type: 'number', description: 'Federal tax withheld (dollars, optional)' },
        },
        required: ['brokerName', 'description', 'dateSold', 'proceeds'],
      },
      execute(args) {
        const id = randomUUID()
        const proceedsCents = cents(args.proceeds as number)
        const basisCents = args.costBasis != null ? cents(args.costBasis as number) : null
        const washCents = args.washSaleLossDisallowed != null ? cents(args.washSaleLossDisallowed as number) : 0
        const gainLoss = basisCents != null ? proceedsCents - basisCents + washCents : 0

        service.addForm1099B({
          id,
          brokerName: args.brokerName as string,
          description: args.description as string,
          dateAcquired: (args.dateAcquired as string | null) ?? null,
          dateSold: args.dateSold as string,
          proceeds: proceedsCents,
          costBasis: basisCents,
          washSaleLossDisallowed: washCents,
          gainLoss,
          basisReportedToIrs: (args.basisReportedToIrs as boolean) ?? true,
          longTerm: (args.longTerm as boolean | undefined) ?? null,
          noncoveredSecurity: false,
          federalTaxWithheld: args.federalWithheld != null ? cents(args.federalWithheld as number) : 0,
        })
        const gainStr = dollars(gainLoss) >= 0
          ? `$${dollars(gainLoss).toFixed(2)} gain`
          : `-$${Math.abs(dollars(gainLoss)).toFixed(2)} loss`
        return `Added 1099-B from ${args.brokerName}: ${args.description} (${gainStr}). ${formatRefund(service)}`
      },
    },

    {
      name: 'tax_add_rsu_vest',
      description: 'Add an RSU vest event. Dollar amounts in dollars, share counts as numbers.',
      parameters: {
        type: 'object',
        properties: {
          vestDate: { type: 'string', description: 'Vest date (ISO date)' },
          symbol: { type: 'string', description: 'Stock ticker symbol (e.g., "MSFT")' },
          sharesVested: { type: 'number', description: 'Total shares vested' },
          sharesWithheldForTax: { type: 'number', description: 'Shares sold to cover taxes' },
          sharesDelivered: { type: 'number', description: 'Net shares received' },
          fmvPerShare: { type: 'number', description: 'Fair market value per share at vest (dollars)' },
        },
        required: ['vestDate', 'symbol', 'sharesVested', 'fmvPerShare'],
      },
      execute(args) {
        const id = randomUUID()
        const sharesVested = args.sharesVested as number
        const fmvPerShare = cents(args.fmvPerShare as number)
        const withheld = (args.sharesWithheldForTax as number | undefined) ?? 0
        const delivered = (args.sharesDelivered as number | undefined) ?? (sharesVested - withheld)

        service.addRSUVestEvent({
          id,
          vestDate: args.vestDate as string,
          symbol: args.symbol as string,
          sharesVested,
          sharesWithheldForTax: withheld,
          sharesDelivered: delivered,
          fmvAtVest: fmvPerShare,
          totalFmv: sharesVested * fmvPerShare,
        })
        return `Added RSU vest: ${sharesVested} ${args.symbol} shares on ${args.vestDate} (FMV $${(args.fmvPerShare as number).toFixed(2)}/share, total $${dollars(sharesVested * fmvPerShare).toLocaleString('en-US')}). ${formatRefund(service)}`
      },
    },

    {
      name: 'tax_set_dependent_care',
      description: 'Set dependent care expenses for the Child and Dependent Care Credit (Form 2441).',
      parameters: {
        type: 'object',
        properties: {
          totalExpenses: { type: 'number', description: 'Total dependent care expenses paid (dollars)' },
          numQualifyingPersons: { type: 'number', description: 'Number of qualifying persons (1 or 2+)' },
        },
        required: ['totalExpenses', 'numQualifyingPersons'],
      },
      execute(args) {
        service.setDependentCare({
          totalExpenses: cents(args.totalExpenses as number),
          numQualifyingPersons: args.numQualifyingPersons as number,
        })
        return `Dependent care set: $${(args.totalExpenses as number).toLocaleString('en-US')} for ${args.numQualifyingPersons} qualifying person(s). ${formatRefund(service)}`
      },
    },

    {
      name: 'tax_set_retirement_contributions',
      description: 'Set IRA contribution amounts. 401(k) is auto-derived from W-2 Box 12.',
      parameters: {
        type: 'object',
        properties: {
          traditionalIRA: { type: 'number', description: 'Traditional IRA contributions (dollars)' },
          rothIRA: { type: 'number', description: 'Roth IRA contributions (dollars)' },
        },
      },
      execute(args) {
        const updates: Record<string, number> = {}
        if (args.traditionalIRA != null) updates.traditionalIRA = cents(args.traditionalIRA as number)
        if (args.rothIRA != null) updates.rothIRA = cents(args.rothIRA as number)
        service.setRetirementContributions(updates)
        const parts: string[] = []
        if (args.traditionalIRA != null) parts.push(`Traditional IRA: $${(args.traditionalIRA as number).toLocaleString('en-US')}`)
        if (args.rothIRA != null) parts.push(`Roth IRA: $${(args.rothIRA as number).toLocaleString('en-US')}`)
        return `Retirement contributions set: ${parts.join(', ')}. ${formatRefund(service)}`
      },
    },

    {
      name: 'tax_set_energy_credits',
      description: 'Set residential energy credit amounts (Form 5695). All dollar amounts in dollars.',
      parameters: {
        type: 'object',
        properties: {
          solarElectric: { type: 'number', description: 'Solar electric property cost (dollars)' },
          solarWaterHeating: { type: 'number', description: 'Solar water heating cost (dollars)' },
          batteryStorage: { type: 'number', description: 'Battery storage cost (≥3 kWh, dollars)' },
          geothermal: { type: 'number', description: 'Geothermal heat pump cost (dollars)' },
          insulation: { type: 'number', description: 'Insulation materials cost (dollars)' },
          windows: { type: 'number', description: 'Energy efficient windows cost (dollars)' },
          exteriorDoors: { type: 'number', description: 'Exterior doors cost (dollars)' },
          centralAC: { type: 'number', description: 'Central air conditioning cost (dollars)' },
          waterHeater: { type: 'number', description: 'Water heater cost (dollars)' },
          heatPump: { type: 'number', description: 'Heat pump cost (dollars)' },
          homeEnergyAudit: { type: 'number', description: 'Home energy audit cost (dollars)' },
          biomassStove: { type: 'number', description: 'Biomass stove/boiler cost (dollars)' },
        },
      },
      execute(args) {
        const updates: Record<string, number> = {}
        const fields = [
          'solarElectric', 'solarWaterHeating', 'batteryStorage', 'geothermal',
          'insulation', 'windows', 'exteriorDoors', 'centralAC',
          'waterHeater', 'heatPump', 'homeEnergyAudit', 'biomassStove',
        ]
        const parts: string[] = []
        for (const f of fields) {
          if (args[f] != null) {
            updates[f] = cents(args[f] as number)
            parts.push(`${f}: $${(args[f] as number).toLocaleString('en-US')}`)
          }
        }
        service.setEnergyCredits(updates)
        return `Energy credits set: ${parts.join(', ') || 'no amounts'}. ${formatRefund(service)}`
      },
    },

    {
      name: 'tax_set_hsa',
      description: 'Set Health Savings Account (HSA) information.',
      parameters: {
        type: 'object',
        properties: {
          coverageType: { type: 'string', enum: ['self-only', 'family'], description: 'HSA coverage type' },
          contributions: { type: 'number', description: 'Your direct HSA contributions (dollars, not from employer/W-2)' },
          qualifiedExpenses: { type: 'number', description: 'Qualified medical expenses paid from HSA (dollars)' },
          age55OrOlder: { type: 'boolean', description: 'Age 55+ for catch-up contribution' },
          age65OrDisabled: { type: 'boolean', description: 'Age 65+ or disabled (exempt from penalty)' },
        },
        required: ['coverageType', 'contributions'],
      },
      execute(args) {
        const updates: Record<string, unknown> = {}
        if (args.coverageType != null) updates.coverageType = args.coverageType
        if (args.contributions != null) updates.contributions = cents(args.contributions as number)
        if (args.qualifiedExpenses != null) updates.qualifiedExpenses = cents(args.qualifiedExpenses as number)
        if (args.age55OrOlder != null) updates.age55OrOlder = args.age55OrOlder
        if (args.age65OrDisabled != null) updates.age65OrDisabled = args.age65OrDisabled
        service.setHSA(updates as Parameters<typeof service.setHSA>[0])
        return `HSA set: ${args.coverageType} coverage, $${(args.contributions as number).toLocaleString('en-US')} contributions. ${formatRefund(service)}`
      },
    },

    {
      name: 'tax_add_1099_sa',
      description: 'Add a 1099-SA form (HSA distributions). All dollar amounts in dollars.',
      parameters: {
        type: 'object',
        properties: {
          payerName: { type: 'string', description: 'HSA trustee/payer name' },
          grossDistribution: { type: 'number', description: 'Box 1: Gross distribution (dollars)' },
          earningsOnExcess: { type: 'number', description: 'Box 2: Earnings on excess contributions (dollars, optional)' },
        },
        required: ['payerName', 'grossDistribution'],
      },
      execute(args) {
        const id = randomUUID()
        service.addForm1099SA({
          id,
          payerName: args.payerName as string,
          box1: cents(args.grossDistribution as number),
          box2: args.earningsOnExcess != null ? cents(args.earningsOnExcess as number) : 0,
        })
        return `Added 1099-SA from ${args.payerName} ($${(args.grossDistribution as number).toLocaleString('en-US')} distribution). ${formatRefund(service)}`
      },
    },

    {
      name: 'tax_add_iso_exercise',
      description: 'Add an ISO (Incentive Stock Option) exercise event for AMT calculation.',
      parameters: {
        type: 'object',
        properties: {
          exerciseDate: { type: 'string', description: 'Exercise date (ISO date)' },
          symbol: { type: 'string', description: 'Stock ticker symbol' },
          sharesExercised: { type: 'number', description: 'Number of shares exercised' },
          exercisePrice: { type: 'number', description: 'Exercise (strike) price per share (dollars)' },
          fmvAtExercise: { type: 'number', description: 'Fair market value per share at exercise (dollars)' },
        },
        required: ['exerciseDate', 'symbol', 'sharesExercised', 'exercisePrice', 'fmvAtExercise'],
      },
      execute(args) {
        const id = randomUUID()
        const shares = args.sharesExercised as number
        const exPrice = args.exercisePrice as number
        const fmv = args.fmvAtExercise as number
        const bargainElement = (fmv - exPrice) * shares

        service.addISOExercise({
          id,
          exerciseDate: args.exerciseDate as string,
          symbol: args.symbol as string,
          sharesExercised: shares,
          exercisePrice: cents(exPrice),
          fmvAtExercise: cents(fmv),
        })
        return `Added ISO exercise: ${shares} ${args.symbol} shares at $${exPrice.toFixed(2)}/share (FMV $${fmv.toFixed(2)}, AMT bargain element $${bargainElement.toLocaleString('en-US', { minimumFractionDigits: 2 })}). ${formatRefund(service)}`
      },
    },

    {
      name: 'tax_add_rental_property',
      description: 'Add a rental property (Schedule E Part I). All dollar amounts in dollars. Reports rental income and expenses for passive activity loss calculation.',
      parameters: {
        type: 'object',
        properties: {
          address: { type: 'string', description: 'Property address' },
          propertyType: { type: 'string', enum: ['single-family', 'multi-family', 'vacation', 'commercial', 'land', 'royalties', 'other'], description: 'Type of rental property' },
          fairRentalDays: { type: 'number', description: 'Number of days rented at fair price (default 365)' },
          personalUseDays: { type: 'number', description: 'Number of days of personal use (default 0)' },
          rentsReceived: { type: 'number', description: 'Total rents received (dollars)' },
          royaltiesReceived: { type: 'number', description: 'Total royalties received (dollars, for royalty properties)' },
          advertising: { type: 'number', description: 'Advertising expense (dollars)' },
          auto: { type: 'number', description: 'Auto and travel expense (dollars)' },
          cleaning: { type: 'number', description: 'Cleaning and maintenance (dollars)' },
          commissions: { type: 'number', description: 'Commissions (dollars)' },
          insurance: { type: 'number', description: 'Insurance (dollars)' },
          legal: { type: 'number', description: 'Legal and professional fees (dollars)' },
          management: { type: 'number', description: 'Management fees (dollars)' },
          mortgageInterest: { type: 'number', description: 'Mortgage interest paid to banks (dollars)' },
          otherInterest: { type: 'number', description: 'Other interest (dollars)' },
          repairs: { type: 'number', description: 'Repairs (dollars)' },
          supplies: { type: 'number', description: 'Supplies (dollars)' },
          taxes: { type: 'number', description: 'Taxes (dollars)' },
          utilities: { type: 'number', description: 'Utilities (dollars)' },
          depreciation: { type: 'number', description: 'Depreciation — manual entry (dollars). Overridden when depreciableBasis and placedInServiceMonth/Year are provided.' },
          other: { type: 'number', description: 'Other expenses (dollars)' },
          depreciableBasis: { type: 'number', description: 'Building cost excluding land (dollars). When set with placed-in-service date, auto-computes straight-line depreciation.' },
          placedInServiceMonth: { type: 'number', description: 'Month placed in service (1–12)' },
          placedInServiceYear: { type: 'number', description: 'Year placed in service (e.g. 2020)' },
        },
        required: ['address', 'rentsReceived'],
      },
      execute(args) {
        const id = randomUUID()
        const c = (v: unknown) => v != null ? cents(v as number) : 0
        service.addScheduleEProperty({
          id,
          address: args.address as string,
          propertyType: (args.propertyType as string ?? 'single-family') as 'single-family',
          fairRentalDays: (args.fairRentalDays as number) ?? 365,
          personalUseDays: (args.personalUseDays as number) ?? 0,
          rentsReceived: c(args.rentsReceived),
          royaltiesReceived: c(args.royaltiesReceived),
          advertising: c(args.advertising),
          auto: c(args.auto),
          cleaning: c(args.cleaning),
          commissions: c(args.commissions),
          insurance: c(args.insurance),
          legal: c(args.legal),
          management: c(args.management),
          mortgageInterest: c(args.mortgageInterest),
          otherInterest: c(args.otherInterest),
          repairs: c(args.repairs),
          supplies: c(args.supplies),
          taxes: c(args.taxes),
          utilities: c(args.utilities),
          depreciation: c(args.depreciation),
          other: c(args.other),
          depreciableBasis: c(args.depreciableBasis),
          placedInServiceMonth: (args.placedInServiceMonth as number) ?? 0,
          placedInServiceYear: (args.placedInServiceYear as number) ?? 0,
        })
        const rent = args.rentsReceived as number
        return `Added rental property at ${args.address} ($${rent.toLocaleString('en-US')} rent). ${formatRefund(service)}`
      },
    },

    {
      name: 'tax_set_estimated_payments',
      description: 'Set quarterly estimated tax payments (Form 1040-ES). Amounts in dollars. These are credited on Line 26.',
      parameters: {
        type: 'object',
        properties: {
          q1: { type: 'number', description: 'Q1 payment due April 15 (dollars)' },
          q2: { type: 'number', description: 'Q2 payment due June 15 (dollars)' },
          q3: { type: 'number', description: 'Q3 payment due September 15 (dollars)' },
          q4: { type: 'number', description: 'Q4 payment due January 15 (dollars)' },
        },
        required: [],
      },
      execute(args) {
        const q1 = args.q1 != null ? cents(args.q1 as number) : 0
        const q2 = args.q2 != null ? cents(args.q2 as number) : 0
        const q3 = args.q3 != null ? cents(args.q3 as number) : 0
        const q4 = args.q4 != null ? cents(args.q4 as number) : 0
        if (q1) service.setEstimatedTaxPayment('q1', q1)
        if (q2) service.setEstimatedTaxPayment('q2', q2)
        if (q3) service.setEstimatedTaxPayment('q3', q3)
        if (q4) service.setEstimatedTaxPayment('q4', q4)
        const total = dollars(q1 + q2 + q3 + q4)
        return `Set estimated tax payments: $${total.toLocaleString('en-US', { minimumFractionDigits: 2 })} total. ${formatRefund(service)}`
      },
    },
  ]
}
