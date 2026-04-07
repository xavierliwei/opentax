#!/usr/bin/env tsx
/**
 * OpenTax CLI — thin wrapper around TaxService for Claude Code skill.
 *
 * Usage:  npx tsx --import ./server/resolve-hook.ts scripts/cli.ts <command> [args...]
 *
 * All dollar amounts are in dollars (not cents) at the CLI boundary.
 */

import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { TaxService } from '../openclaw-plugin/service/TaxService.ts'
import { analyzeGaps } from '../openclaw-plugin/service/GapAnalysis.ts'
import { explainLine } from '../src/rules/engine.ts'
import { cents, dollars } from '../src/model/traced.ts'
import { autoDetectBroker } from '../src/intake/csv/autoDetect.ts'
import { convertToCapitalTransactions } from '../src/intake/csv/convert.ts'
import type { FilingStatus, Dependent } from '../src/model/types.ts'

// ── Helpers ─────────────────────────────────────────────────────

const workspace = process.env.OPENTAX_WORKSPACE ?? '.'
const service = new TaxService(workspace)

function formatRefund(): string {
  const line34 = service.computeResult.form1040.line34.amount
  const line37 = service.computeResult.form1040.line37.amount
  if (line34 > 0) return `Estimated refund: $${dollars(line34).toFixed(2)}`
  if (line37 > 0) return `Amount owed: $${dollars(line37).toFixed(2)}`
  return 'Tax balance: $0.00'
}

function fmt(amountCents: number): string {
  return `$${dollars(amountCents).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
}

/** Parse --key value pairs from argv into a Record. */
function parseFlags(args: string[]): Record<string, string> {
  const flags: Record<string, string> = {}
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].slice(2)
      const val = args[i + 1]
      if (val !== undefined && !val.startsWith('--')) {
        flags[key] = val
        i++
      } else {
        flags[key] = 'true'
      }
    }
  }
  return flags
}

function requireFlag(flags: Record<string, string>, key: string, command: string): string {
  if (!flags[key]) {
    console.error(`Error: --${key} is required for "${command}"`)
    process.exit(1)
  }
  return flags[key]
}

function numFlag(flags: Record<string, string>, key: string): number | undefined {
  return flags[key] != null ? parseFloat(flags[key]) : undefined
}

// ── Commands ────────────────────────────────────────────────────

const [command, ...rest] = process.argv.slice(2)

switch (command) {
  // ── Query ───────────────────────────────────────────────────
  case 'status': {
    const gap = analyzeGaps(service.taxReturn, service.computeResult)
    const cr = service.computeResult.form1040
    const lines: string[] = []

    lines.push(`## Tax Return Status (${gap.completionPercent}% complete)`)
    lines.push('')
    lines.push(gap.readyToFile ? '**Ready to file!**' : '**Not yet ready to file.**')
    lines.push('')

    lines.push('### Tax Summary')
    lines.push(`- AGI: ${fmt(cr.line11.amount)}`)
    lines.push(`- Total tax: ${fmt(cr.line24.amount)}`)
    lines.push(`- Withheld: ${fmt(cr.line25.amount)}`)
    if (cr.line34.amount > 0) lines.push(`- **Estimated refund: ${fmt(cr.line34.amount)}**`)
    if (cr.line37.amount > 0) lines.push(`- **Amount owed: ${fmt(cr.line37.amount)}**`)
    lines.push('')

    if (gap.items.length > 0) {
      lines.push('### Missing Information')
      for (const item of gap.items) {
        const badge = item.priority === 'required' ? '[REQUIRED]' : '[recommended]'
        lines.push(`- ${badge} ${item.label}`)
      }
      lines.push('')
    }

    if (gap.warnings.length > 0) {
      lines.push('### Warnings')
      for (const w of gap.warnings) lines.push(`- ${w}`)
      lines.push('')
    }

    // Documents on file
    const tr = service.taxReturn
    const docs: string[] = []
    if (tr.w2s.length > 0) docs.push(`${tr.w2s.length} W-2(s)`)
    if (tr.form1099INTs.length > 0) docs.push(`${tr.form1099INTs.length} 1099-INT(s)`)
    if (tr.form1099DIVs.length > 0) docs.push(`${tr.form1099DIVs.length} 1099-DIV(s)`)
    if ((tr.form1099Bs ?? []).length > 0) docs.push(`${tr.form1099Bs!.length} 1099-B(s)`)
    if ((tr.form1099Gs ?? []).length > 0) docs.push(`${tr.form1099Gs!.length} 1099-G(s)`)
    if ((tr.form1099Rs ?? []).length > 0) docs.push(`${tr.form1099Rs!.length} 1099-R(s)`)
    if (tr.capitalTransactions.length > 0) docs.push(`${tr.capitalTransactions.length} capital transaction(s)`)
    if (tr.rsuVestEvents.length > 0) docs.push(`${tr.rsuVestEvents.length} RSU vest event(s)`)
    if (tr.isoExercises.length > 0) docs.push(`${tr.isoExercises.length} ISO exercise(s)`)
    if ((tr.scheduleEProperties ?? []).length > 0) docs.push(`${tr.scheduleEProperties!.length} rental propert${tr.scheduleEProperties!.length === 1 ? 'y' : 'ies'}`)
    if (docs.length > 0) {
      lines.push('### Documents on File')
      lines.push(`- ${docs.join(', ')}`)
      lines.push('')
    }

    lines.push('### Next Step')
    lines.push(gap.nextSuggestedAction)

    console.log(lines.join('\n'))
    break
  }

  case 'result': {
    const cr = service.computeResult.form1040
    console.log([
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
    ].join('\n'))
    break
  }

  case 'explain': {
    const nodeId = rest[0]
    if (!nodeId) { console.error('Usage: cli.ts explain <nodeId>'); process.exit(1) }
    console.log(explainLine(service.computeResult, nodeId))
    break
  }

  // ── Filing status ──────────────────────────────────────────
  case 'set-filing-status': {
    const status = rest[0] as FilingStatus
    if (!status) { console.error('Usage: cli.ts set-filing-status <single|mfj|mfs|hoh|qw>'); process.exit(1) }
    service.setFilingStatus(status)
    console.log(`Filing status set to "${status}". ${formatRefund()}`)
    break
  }

  // ── Personal info ──────────────────────────────────────────
  case 'set-personal-info': {
    const f = parseFlags(rest)
    requireFlag(f, 'firstName', command)
    requireFlag(f, 'lastName', command)
    requireFlag(f, 'ssn', command)

    const updates: Record<string, unknown> = {}
    if (f.firstName) updates.firstName = f.firstName
    if (f.lastName) updates.lastName = f.lastName
    if (f.middleInitial) updates.middleInitial = f.middleInitial
    if (f.ssn) updates.ssn = f.ssn
    if (f.dateOfBirth) updates.dateOfBirth = f.dateOfBirth

    const address: Record<string, unknown> = {}
    if (f.street) address.street = f.street
    if (f.apartment) address.apartment = f.apartment
    if (f.city) address.city = f.city
    if (f.state) address.state = f.state
    if (f.zip) address.zip = f.zip
    if (Object.keys(address).length > 0) updates.address = address

    service.setTaxpayer(updates as Parameters<typeof service.setTaxpayer>[0])
    console.log(`Personal info set for ${f.firstName} ${f.lastName}. ${formatRefund()}`)
    break
  }

  // ── Spouse info ────────────────────────────────────────────
  case 'set-spouse-info': {
    const f = parseFlags(rest)
    requireFlag(f, 'firstName', command)
    requireFlag(f, 'lastName', command)
    requireFlag(f, 'ssn', command)

    const updates: Record<string, unknown> = {}
    if (f.firstName) updates.firstName = f.firstName
    if (f.lastName) updates.lastName = f.lastName
    if (f.middleInitial) updates.middleInitial = f.middleInitial
    if (f.ssn) updates.ssn = f.ssn
    if (f.dateOfBirth) updates.dateOfBirth = f.dateOfBirth

    service.setSpouse(updates as Parameters<typeof service.setSpouse>[0])
    console.log(`Spouse info set for ${f.firstName} ${f.lastName}. ${formatRefund()}`)
    break
  }

  // ── Dependents ─────────────────────────────────────────────
  case 'add-dependent': {
    const f = parseFlags(rest)
    requireFlag(f, 'firstName', command)
    requireFlag(f, 'lastName', command)
    requireFlag(f, 'ssn', command)
    requireFlag(f, 'relationship', command)
    requireFlag(f, 'monthsLived', command)

    service.addDependent({
      firstName: f.firstName,
      lastName: f.lastName,
      ssn: f.ssn,
      relationship: f.relationship,
      monthsLived: parseInt(f.monthsLived, 10),
      dateOfBirth: f.dateOfBirth ?? '',
    } satisfies Dependent)
    console.log(`Added dependent: ${f.firstName} ${f.lastName} (${f.relationship}). ${formatRefund()}`)
    break
  }

  // ── W-2 ────────────────────────────────────────────────────
  case 'add-w2': {
    const f = parseFlags(rest)
    requireFlag(f, 'employer', command)
    requireFlag(f, 'wages', command)
    requireFlag(f, 'withheld', command)

    const wages = cents(parseFloat(f.wages))
    service.addW2({
      id: randomUUID(),
      employerName: f.employer,
      employerEin: f.ein || '00-0000000',
      box1: wages,
      box2: cents(parseFloat(f.withheld)),
      box3: numFlag(f, 'ssWages') != null ? cents(numFlag(f, 'ssWages')!) : wages,
      box4: numFlag(f, 'ssTax') != null ? cents(numFlag(f, 'ssTax')!) : 0,
      box5: numFlag(f, 'medicareWages') != null ? cents(numFlag(f, 'medicareWages')!) : wages,
      box6: numFlag(f, 'medicareTax') != null ? cents(numFlag(f, 'medicareTax')!) : 0,
      box7: 0, box8: 0, box10: 0, box11: 0,
      box12: [],
      box13StatutoryEmployee: false,
      box13RetirementPlan: false,
      box13ThirdPartySickPay: false,
      box14: '',
      box15State: f.stateCode,
      box16StateWages: numFlag(f, 'stateWages') != null ? cents(numFlag(f, 'stateWages')!) : undefined,
      box17StateIncomeTax: numFlag(f, 'stateTax') != null ? cents(numFlag(f, 'stateTax')!) : undefined,
    })
    console.log(`Added W-2 from ${f.employer} ($${parseFloat(f.wages).toLocaleString('en-US')} wages). ${formatRefund()}`)
    break
  }

  // ── 1099-INT ───────────────────────────────────────────────
  case 'add-1099-int': {
    const f = parseFlags(rest)
    requireFlag(f, 'payer', command)
    requireFlag(f, 'interest', command)

    service.addForm1099INT({
      id: randomUUID(),
      payerName: f.payer,
      box1: cents(parseFloat(f.interest)),
      box2: numFlag(f, 'earlyWithdrawalPenalty') != null ? cents(numFlag(f, 'earlyWithdrawalPenalty')!) : 0,
      box3: numFlag(f, 'usSavingsBond') != null ? cents(numFlag(f, 'usSavingsBond')!) : 0,
      box4: numFlag(f, 'federalWithheld') != null ? cents(numFlag(f, 'federalWithheld')!) : 0,
      box8: numFlag(f, 'taxExempt') != null ? cents(numFlag(f, 'taxExempt')!) : 0,
    })
    console.log(`Added 1099-INT from ${f.payer} ($${parseFloat(f.interest).toLocaleString('en-US')} interest). ${formatRefund()}`)
    break
  }

  // ── 1099-DIV ───────────────────────────────────────────────
  case 'add-1099-div': {
    const f = parseFlags(rest)
    requireFlag(f, 'payer', command)
    requireFlag(f, 'ordinaryDividends', command)

    service.addForm1099DIV({
      id: randomUUID(),
      payerName: f.payer,
      box1a: cents(parseFloat(f.ordinaryDividends)),
      box1b: numFlag(f, 'qualifiedDividends') != null ? cents(numFlag(f, 'qualifiedDividends')!) : 0,
      box2a: numFlag(f, 'capitalGain') != null ? cents(numFlag(f, 'capitalGain')!) : 0,
      box3: 0,
      box4: numFlag(f, 'federalWithheld') != null ? cents(numFlag(f, 'federalWithheld')!) : 0,
      box5: numFlag(f, 'section199a') != null ? cents(numFlag(f, 'section199a')!) : 0,
      box11: numFlag(f, 'exemptInterest') != null ? cents(numFlag(f, 'exemptInterest')!) : 0,
    })
    console.log(`Added 1099-DIV from ${f.payer} ($${parseFloat(f.ordinaryDividends).toLocaleString('en-US')} ordinary dividends). ${formatRefund()}`)
    break
  }

  // ── Capital transaction ────────────────────────────────────
  case 'add-capital-txn': {
    const f = parseFlags(rest)
    requireFlag(f, 'description', command)
    requireFlag(f, 'dateSold', command)
    requireFlag(f, 'proceeds', command)
    requireFlag(f, 'costBasis', command)
    requireFlag(f, 'longTerm', command)

    const proceedsCents = cents(parseFloat(f.proceeds))
    const basisCents = cents(parseFloat(f.costBasis))
    const gainLoss = proceedsCents - basisCents
    const longTerm = f.longTerm === 'true'

    const txn = {
      id: randomUUID(),
      description: f.description,
      dateAcquired: f.dateAcquired ?? null,
      dateSold: f.dateSold,
      proceeds: proceedsCents,
      reportedBasis: basisCents,
      adjustedBasis: basisCents,
      adjustmentCode: null,
      adjustmentAmount: 0,
      gainLoss,
      washSaleLossDisallowed: 0,
      longTerm,
      category: (longTerm ? 'D' : 'A') as 'A' | 'D',
      source1099BId: '',
    }

    const existing = service.taxReturn.capitalTransactions
    service.setCapitalTransactions([...existing, txn])
    const gainStr = dollars(gainLoss) >= 0
      ? `$${dollars(gainLoss).toFixed(2)} gain`
      : `-$${Math.abs(dollars(gainLoss)).toFixed(2)} loss`
    console.log(`Added ${f.description} (${gainStr}, ${longTerm ? 'long-term' : 'short-term'}). ${formatRefund()}`)
    break
  }

  // ── Deductions ─────────────────────────────────────────────
  case 'set-deductions': {
    const f = parseFlags(rest)
    requireFlag(f, 'method', command)
    const method = f.method as 'standard' | 'itemized'
    service.setDeductionMethod(method)

    if (method === 'itemized') {
      const itemized: Record<string, number | boolean> = {}
      if (f.medicalExpenses != null) itemized.medicalExpenses = cents(parseFloat(f.medicalExpenses))
      if (f.stateLocalIncomeTaxes != null) itemized.stateLocalIncomeTaxes = cents(parseFloat(f.stateLocalIncomeTaxes))
      if (f.stateLocalSalesTaxes != null) itemized.stateLocalSalesTaxes = cents(parseFloat(f.stateLocalSalesTaxes))
      if (f.realEstateTaxes != null) itemized.realEstateTaxes = cents(parseFloat(f.realEstateTaxes))
      if (f.personalPropertyTaxes != null) itemized.personalPropertyTaxes = cents(parseFloat(f.personalPropertyTaxes))
      if (f.mortgageInterest != null) itemized.mortgageInterest = cents(parseFloat(f.mortgageInterest))
      if (f.charitableCash != null) itemized.charitableCash = cents(parseFloat(f.charitableCash))
      if (f.charitableNoncash != null) itemized.charitableNoncash = cents(parseFloat(f.charitableNoncash))
      if (f.gamblingLosses != null) itemized.gamblingLosses = cents(parseFloat(f.gamblingLosses))
      if (Object.keys(itemized).length > 0) {
        service.setItemizedDeductions(itemized)
      }
    }

    const deductionAmt = dollars(service.computeResult.form1040.line12.amount)
    console.log(`Deductions set to ${method} ($${deductionAmt.toLocaleString('en-US', { minimumFractionDigits: 2 })}). ${formatRefund()}`)
    break
  }

  // ── Prior year ─────────────────────────────────────────────
  case 'set-prior-year': {
    const f = parseFlags(rest)
    const updates: Record<string, number | boolean> = {}
    if (f.agi != null) updates.agi = cents(parseFloat(f.agi))
    if (f.capitalLossCarryforwardST != null) updates.capitalLossCarryforwardST = cents(parseFloat(f.capitalLossCarryforwardST))
    if (f.capitalLossCarryforwardLT != null) updates.capitalLossCarryforwardLT = cents(parseFloat(f.capitalLossCarryforwardLT))
    if (f.itemizedLastYear != null) updates.itemizedLastYear = f.itemizedLastYear === 'true'
    service.setPriorYear(updates)
    console.log(`Prior-year info updated. ${formatRefund()}`)
    break
  }

  // ── CSV import ─────────────────────────────────────────────
  case 'import-csv': {
    const filePath = rest[0]
    const f = parseFlags(rest.slice(1))
    if (!filePath) { console.error('Usage: cli.ts import-csv <file> [--confirm]'); process.exit(1) }

    const csv = readFileSync(filePath, 'utf-8')
    const detection = autoDetectBroker(csv)
    const { result, confidence } = detection

    if (result.errors.length > 0) {
      console.error(`CSV parsing failed:\n${result.errors.join('\n')}`)
      process.exit(1)
    }
    if (result.transactions.length === 0) {
      console.log('No transactions found in the CSV file.')
      break
    }

    const txns = convertToCapitalTransactions(result.transactions)

    if (f.confirm === 'true') {
      service.setCapitalTransactions(txns)
      const totalGain = txns.reduce((sum, t) => sum + t.gainLoss, 0)
      const gainStr = totalGain >= 0
        ? `$${dollars(totalGain).toFixed(2)} net gain`
        : `-$${Math.abs(dollars(totalGain)).toFixed(2)} net loss`
      console.log(`Imported ${txns.length} transactions (${gainStr}). Broker: ${detection.parser.brokerName} (${confidence} confidence).`)
    } else {
      const totalProceeds = txns.reduce((sum, t) => sum + t.proceeds, 0)
      const totalGain = txns.reduce((sum, t) => sum + t.gainLoss, 0)
      const shortTerm = txns.filter(t => !t.longTerm).length
      const longTerm = txns.filter(t => t.longTerm).length

      console.log([
        `## CSV Import Summary`,
        `- Broker: ${detection.parser.brokerName} (${confidence} confidence)`,
        `- Transactions: ${txns.length} (${shortTerm} short-term, ${longTerm} long-term)`,
        `- Total proceeds: $${dollars(totalProceeds).toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
        `- Net gain/loss: $${dollars(totalGain).toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
        ...(result.warnings.length > 0 ? [`- Warnings: ${result.warnings.join('; ')}`] : []),
        '',
        'Run again with --confirm to import these transactions.',
      ].join('\n'))
    }
    break
  }

  // ── Document processing ────────────────────────────────────
  case 'process-document': {
    const filePath = rest[0]
    if (!filePath) { console.error('Usage: cli.ts process-document <file>'); process.exit(1) }

    // Async — dynamic import for pdfjs-dist
    const { parseGenericFormPdf } = await import('../src/intake/pdf/genericFormPdfParser.ts')
    const buf = readFileSync(filePath)
    const data = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
    const result = await parseGenericFormPdf(data)

    if (result.formType === 'unknown') {
      console.log('Could not identify the form type. Please enter data manually.')
      break
    }

    const lines: string[] = [`Detected form: **${result.formType}**\n`]
    lines.push(`Extracted fields:`)
    for (const [key, field] of result.fields) {
      lines.push(`- ${key}: ${field.value}`)
    }
    if (result.warnings.length > 0) {
      lines.push(`\nWarnings: ${result.warnings.join('; ')}`)
    }

    const cmdName = result.formType === 'W-2' ? 'add-w2'
      : result.formType === '1099-INT' ? 'add-1099-int'
      : result.formType === '1099-DIV' ? 'add-1099-div'
      : 'add-1099-div'
    lines.push(`\nReview values, then use "cli.ts ${cmdName}" to enter them.`)
    console.log(lines.join('\n'))
    break
  }

  // ── Export / Reset ─────────────────────────────────────────
  case 'export-json': {
    console.log(JSON.stringify(service.taxReturn, null, 2))
    break
  }

  case 'reset': {
    const f = parseFlags(rest)
    if (f.confirm !== 'true') {
      console.log('This will erase all tax return data. Run again with --confirm to proceed.')
      console.log('A backup snapshot will be created automatically.')
      break
    }
    service.resetReturn()
    console.log('Tax return has been reset to a blank state. Use "list-backups" to see snapshots.')
    break
  }

  // ── Backup / Restore ──────────────────────────────────────
  case 'backup': {
    service.createManualSnapshot()
    console.log('Backup snapshot created. Use "list-backups" to see all snapshots.')
    break
  }

  case 'list-backups': {
    const snapshots = service.listSnapshots()
    if (snapshots.length === 0) {
      console.log('No backup snapshots available.')
      break
    }
    console.log('Available backup snapshots:\n')
    for (const s of snapshots) {
      console.log(`  #${s.id}  ${s.createdAt}  v${s.version}  (${s.reason})`)
    }
    console.log('\nRestore with: cli.ts restore <id>')
    break
  }

  case 'restore': {
    const idStr = rest[0]
    if (!idStr) {
      console.error('Usage: cli.ts restore <snapshot-id>')
      console.error('Run "cli.ts list-backups" to see available snapshots.')
      process.exit(1)
    }
    const id = parseInt(idStr, 10)
    if (isNaN(id)) {
      console.error(`Invalid snapshot ID: ${idStr}`)
      process.exit(1)
    }
    const ok = service.restoreSnapshot(id)
    if (ok) {
      console.log(`Restored from snapshot #${id}. ${formatRefund()}`)
    } else {
      console.error(`Snapshot #${id} not found. Run "cli.ts list-backups" to see available snapshots.`)
      process.exit(1)
    }
    break
  }

  // ── Help ───────────────────────────────────────────────────
  case 'help':
  case undefined: {
    console.log(`OpenTax CLI — conversational tax filing via Claude Code

Usage: npx tsx --import ./server/resolve-hook.ts scripts/cli.ts <command> [args...]

Query commands:
  status                          Show return status, gaps, and tax summary
  result                          Show computed tax result (AGI, tax, refund)
  explain <nodeId>                Explain a line item (e.g., form1040.line15)

Data entry commands:
  set-filing-status <status>      Set filing status (single|mfj|mfs|hoh|qw)
  set-personal-info --firstName .. --lastName .. --ssn .. [--street .. --city .. --state .. --zip ..]
  set-spouse-info --firstName .. --lastName .. --ssn ..
  add-dependent --firstName .. --lastName .. --ssn .. --relationship .. --monthsLived ..
  add-w2 --employer .. --wages .. --withheld .. [--ein .. --stateCode .. --stateWages .. --stateTax ..]
  add-1099-int --payer .. --interest .. [--federalWithheld ..]
  add-1099-div --payer .. --ordinaryDividends .. [--qualifiedDividends .. --capitalGain ..]
  add-capital-txn --description .. --dateSold .. --proceeds .. --costBasis .. --longTerm true|false
  set-deductions --method standard|itemized [--medicalExpenses .. --charitableCash .. ...]
  set-prior-year [--agi .. --capitalLossCarryforwardST .. --capitalLossCarryforwardLT .. --itemizedLastYear true|false]

Document commands:
  import-csv <file> [--confirm]   Import brokerage CSV (preview first, then --confirm)
  process-document <file>         Extract data from a PDF tax document

Backup commands:
  backup                          Create a manual backup snapshot
  list-backups                    List available backup snapshots
  restore <id>                    Restore from a backup snapshot

Utility commands:
  export-json                     Export full TaxReturn as JSON
  reset --confirm                 Reset return to blank state (auto-snapshots first)

All dollar amounts are in dollars (e.g., --wages 85000 = $85,000).`)
    break
  }

  default:
    console.error(`Unknown command: ${command}\nRun "cli.ts help" for usage.`)
    process.exit(1)
}

// Ensure pending state is flushed to SQLite before exit
service.close()
