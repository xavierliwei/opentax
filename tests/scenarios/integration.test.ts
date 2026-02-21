/**
 * End-to-end integration tests — 5 realistic scenarios with
 * hand-calculated expected values verified to the cent.
 *
 * Each scenario tests:
 * 1. Rules engine correctness (exact Form 1040 line values)
 * 2. Schedule correctness (B, D, 8949 when applicable)
 * 3. Explainability trace (no "Unknown" labels, correct input chains)
 * 4. PDF round-trip (compileFilingPackage summary matches rules engine)
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { computeAll, buildTrace, explainLine } from '../../src/rules/engine'
import { compileFilingPackage } from '../../src/forms/compiler'
import type { FormTemplates } from '../../src/forms/types'
import {
  simpleW2Return,
  w2WithInvestmentsReturn,
  rsuSaleReturn,
  multipleTradesReturn,
  mfjBasicReturn,
} from '../fixtures/returns'

// ── Load PDF templates once ──────────────────────────────────

let templates: FormTemplates

beforeAll(() => {
  const dir = join(__dirname, '../../public/forms')
  templates = {
    f1040: new Uint8Array(readFileSync(join(dir, 'f1040.pdf'))),
    f1040sa: new Uint8Array(readFileSync(join(dir, 'f1040sa.pdf'))),
    f1040sb: new Uint8Array(readFileSync(join(dir, 'f1040sb.pdf'))),
    f1040sd: new Uint8Array(readFileSync(join(dir, 'f1040sd.pdf'))),
    f8949: new Uint8Array(readFileSync(join(dir, 'f8949.pdf'))),
  }
})

// ── Helper to set taxpayer info for PDF tests ────────────────

function setTaxpayer(ret: ReturnType<typeof simpleW2Return>, first: string, last: string) {
  ret.taxpayer.firstName = first
  ret.taxpayer.lastName = last
  ret.taxpayer.ssn = '123456789'
  ret.taxpayer.address = { street: '123 Main St', city: 'Anytown', state: 'CA', zip: '90210' }
}

// ═══════════════════════════════════════════════════════════════
// Scenario A — Simple W-2
// ═══════════════════════════════════════════════════════════════

describe('Scenario A — Simple W-2', () => {
  it('computes all Form 1040 lines correctly', () => {
    const result = computeAll(simpleW2Return())
    const f = result.form1040

    expect(f.line1a.amount).toBe(7_500_000)
    expect(f.line2a.amount).toBe(0)
    expect(f.line2b.amount).toBe(0)
    expect(f.line3a.amount).toBe(0)
    expect(f.line3b.amount).toBe(0)
    expect(f.line7.amount).toBe(0)
    expect(f.line8.amount).toBe(0)
    expect(f.line9.amount).toBe(7_500_000)
    expect(f.line10.amount).toBe(0)
    expect(f.line11.amount).toBe(7_500_000)
    expect(f.line12.amount).toBe(1_575_000)
    expect(f.line13.amount).toBe(0)
    expect(f.line14.amount).toBe(1_575_000)
    expect(f.line15.amount).toBe(5_925_000)
    expect(f.line16.amount).toBe(794_900)
    expect(f.line24.amount).toBe(794_900)
    expect(f.line25.amount).toBe(800_000)
    expect(f.line33.amount).toBe(800_000)
    expect(f.line34.amount).toBe(5_100)
    expect(f.line37.amount).toBe(0)
  })

  it('uses ordinary tax brackets (no QDCG)', () => {
    const result = computeAll(simpleW2Return())
    // No qualified dividends or capital gains → ordinary brackets
    // 10% × $11,925 + 12% × $36,550 + 22% × $10,775 = $7,949
    expect(result.form1040.line16.amount).toBe(794_900)
    expect(result.form1040.scheduleD).toBeNull()
  })

  it('trace for AGI resolves to W-2 source', () => {
    const result = computeAll(simpleW2Return())
    const explanation = explainLine(result, 'form1040.line11')
    expect(explanation).toContain('W-2 from Acme Corp')
    expect(explanation).not.toContain('Unknown')
  })

  it('PDF summary matches rules engine', async () => {
    const taxReturn = simpleW2Return()
    setTaxpayer(taxReturn, 'Alice', 'Worker')
    const compiled = await compileFilingPackage(taxReturn, templates)
    const engine = computeAll(taxReturn)

    expect(compiled.summary.agi).toBe(engine.form1040.line11.amount)
    expect(compiled.summary.totalTax).toBe(engine.form1040.line24.amount)
    expect(compiled.summary.totalPayments).toBe(engine.form1040.line33.amount)
    expect(compiled.summary.refund).toBe(engine.form1040.line34.amount)
    expect(compiled.summary.amountOwed).toBe(engine.form1040.line37.amount)
  })
})

// ═══════════════════════════════════════════════════════════════
// Scenario B — W-2 + Investments
// ═══════════════════════════════════════════════════════════════

describe('Scenario B — W-2 + Investments', () => {
  it('computes income lines with interest, dividends, cap gain dist', () => {
    const result = computeAll(w2WithInvestmentsReturn())
    const f = result.form1040

    expect(f.line1a.amount).toBe(9_000_000)
    expect(f.line2b.amount).toBe(330_000)
    expect(f.line3a.amount).toBe(150_000)
    expect(f.line3b.amount).toBe(300_000)
    expect(f.line7.amount).toBe(50_000)
    expect(f.line9.amount).toBe(9_680_000)
    expect(f.line11.amount).toBe(9_680_000)
    expect(f.line12.amount).toBe(1_575_000)
    expect(f.line15.amount).toBe(8_105_000)
    expect(f.line25.amount).toBe(1_200_000)
    expect(f.line33.amount).toBe(1_200_000)
    expect(f.line34.amount).toBe(0)
    expect(f.line37.amount).toBe(60_500)
  })

  it('applies QDCG worksheet for qualified dividends', () => {
    const result = computeAll(w2WithInvestmentsReturn())
    // QDCG: ordinary on $79,050 + 15% on $2,000 = 1,230,500 + 30,000 = 1,260,500
    expect(result.form1040.line16.amount).toBe(1_260_500)
  })

  it('Schedule B is required and correct', () => {
    const result = computeAll(w2WithInvestmentsReturn())
    expect(result.scheduleB.required).toBe(true)
    expect(result.scheduleB.line4.amount).toBe(330_000)
    expect(result.scheduleB.line6.amount).toBe(300_000)
  })

  it('Schedule D includes cap gain distributions', () => {
    const result = computeAll(w2WithInvestmentsReturn())
    const sd = result.form1040.scheduleD!
    expect(sd).not.toBeNull()
    expect(sd.line1a.amount).toBe(0)
    expect(sd.line1b.amount).toBe(0)
    expect(sd.line7.amount).toBe(0)
    expect(sd.line8a.amount).toBe(0)
    expect(sd.line8b.amount).toBe(0)
    expect(sd.line13.amount).toBe(50_000)
    expect(sd.line15.amount).toBe(50_000)
    expect(sd.line16.amount).toBe(50_000)
    expect(sd.line21.amount).toBe(50_000)
  })

  it('trace for total income includes all sources', () => {
    const result = computeAll(w2WithInvestmentsReturn())
    const explanation = explainLine(result, 'form1040.line9')
    expect(explanation).toContain('Wages, salaries, tips')
    expect(explanation).toContain('Taxable interest')
    expect(explanation).toContain('Ordinary dividends')
    expect(explanation).toContain('Capital gain or (loss)')
    expect(explanation).not.toContain('Unknown')
  })

  it('PDF summary matches rules engine', async () => {
    const taxReturn = w2WithInvestmentsReturn()
    setTaxpayer(taxReturn, 'Bob', 'Investor')
    const compiled = await compileFilingPackage(taxReturn, templates)
    const engine = computeAll(taxReturn)

    expect(compiled.summary.agi).toBe(engine.form1040.line11.amount)
    expect(compiled.summary.totalTax).toBe(engine.form1040.line24.amount)
    expect(compiled.summary.totalPayments).toBe(engine.form1040.line33.amount)
    expect(compiled.summary.refund).toBe(engine.form1040.line34.amount)
    expect(compiled.summary.amountOwed).toBe(engine.form1040.line37.amount)
  })
})

// ═══════════════════════════════════════════════════════════════
// Scenario C — RSU Double-Tax Trap
// ═══════════════════════════════════════════════════════════════

describe('Scenario C — RSU Double-Tax Trap', () => {
  it('Form 8949 shows correct adjustment', () => {
    const result = computeAll(rsuSaleReturn())
    const sd = result.form1040.scheduleD!
    expect(sd).not.toBeNull()

    const catE = sd.form8949.byCategory['E']!
    expect(catE).toBeDefined()
    expect(catE.totalProceeds.amount).toBe(3_575_000)
    expect(catE.totalBasis.amount).toBe(3_250_000)
    expect(catE.totalAdjustments.amount).toBe(3_250_000)
    expect(catE.totalGainLoss.amount).toBe(325_000)
  })

  it('Schedule D reports actual gain, not apparent gain', () => {
    const result = computeAll(rsuSaleReturn())
    const sd = result.form1040.scheduleD!

    // Actual gain is $3,250, not the apparent $35,750
    expect(sd.line8b.amount).toBe(325_000)
    expect(sd.line15.amount).toBe(325_000)
    expect(sd.line16.amount).toBe(325_000)
    expect(sd.line21.amount).toBe(325_000)
  })

  it('computes all Form 1040 lines correctly', () => {
    const result = computeAll(rsuSaleReturn())
    const f = result.form1040

    expect(f.line1a.amount).toBe(15_000_000)
    expect(f.line7.amount).toBe(325_000)
    expect(f.line9.amount).toBe(15_325_000)
    expect(f.line11.amount).toBe(15_325_000)
    expect(f.line12.amount).toBe(1_575_000)
    expect(f.line15.amount).toBe(13_750_000)
    expect(f.line16.amount).toBe(2_555_450)
    expect(f.line24.amount).toBe(2_555_450)
    expect(f.line25.amount).toBe(3_000_000)
    expect(f.line33.amount).toBe(3_000_000)
    expect(f.line34.amount).toBe(444_550)
    expect(f.line37.amount).toBe(0)
  })

  it('trace for Line 7 resolves through Schedule D', () => {
    const result = computeAll(rsuSaleReturn())
    const trace = buildTrace(result, 'form1040.line7')
    expect(trace.inputs.length).toBe(1)
    expect(trace.inputs[0].nodeId).toBe('scheduleD.line21')
    expect(explainLine(result, 'form1040.line7')).not.toContain('Unknown')
  })

  it('PDF summary matches rules engine', async () => {
    const taxReturn = rsuSaleReturn()
    setTaxpayer(taxReturn, 'Carol', 'TechWorker')
    const compiled = await compileFilingPackage(taxReturn, templates)
    const engine = computeAll(taxReturn)

    expect(compiled.summary.agi).toBe(engine.form1040.line11.amount)
    expect(compiled.summary.totalTax).toBe(engine.form1040.line24.amount)
    expect(compiled.summary.totalPayments).toBe(engine.form1040.line33.amount)
    expect(compiled.summary.refund).toBe(engine.form1040.line34.amount)
    expect(compiled.summary.amountOwed).toBe(engine.form1040.line37.amount)
  })
})

// ═══════════════════════════════════════════════════════════════
// Scenario D — Multiple Stock Trades
// ═══════════════════════════════════════════════════════════════

describe('Scenario D — Multiple Stock Trades', () => {
  it('categorizes 15 trades into correct 8949 categories', () => {
    const result = computeAll(multipleTradesReturn())
    const sd = result.form1040.scheduleD!
    expect(sd).not.toBeNull()

    const catA = sd.form8949.byCategory['A']!
    expect(catA.transactions).toHaveLength(5)
    expect(catA.totalProceeds.amount).toBe(2_170_000)
    expect(catA.totalBasis.amount).toBe(2_000_000)
    expect(catA.totalAdjustments.amount).toBe(0)
    expect(catA.totalGainLoss.amount).toBe(170_000)

    const catB = sd.form8949.byCategory['B']!
    expect(catB.transactions).toHaveLength(2)
    expect(catB.totalProceeds.amount).toBe(720_000)
    expect(catB.totalBasis.amount).toBe(750_000)
    expect(catB.totalGainLoss.amount).toBe(-30_000)

    const catD = sd.form8949.byCategory['D']!
    expect(catD.transactions).toHaveLength(5)
    expect(catD.totalProceeds.amount).toBe(3_220_000)
    expect(catD.totalBasis.amount).toBe(2_600_000)
    expect(catD.totalAdjustments.amount).toBe(0)
    expect(catD.totalGainLoss.amount).toBe(620_000)

    const catE = sd.form8949.byCategory['E']!
    expect(catE.transactions).toHaveLength(3)
    expect(catE.totalProceeds.amount).toBe(1_230_000)
    expect(catE.totalBasis.amount).toBe(1_000_000)
    expect(catE.totalAdjustments.amount).toBe(820_000)
    expect(catE.totalGainLoss.amount).toBe(300_000)
  })

  it('handles wash sale correctly', () => {
    const result = computeAll(multipleTradesReturn())
    const catE = result.form1040.scheduleD!.form8949.byCategory['E']!
    const koTrade = catE.transactions.find(t => t.description === 'KO')!
    expect(koTrade).toBeDefined()
    expect(koTrade.adjustmentCode).toBe('W')
    expect(koTrade.washSaleLossDisallowed).toBe(70_000)
    expect(koTrade.gainLoss).toBe(0) // loss fully disallowed
  })

  it('Schedule D summarizes all categories', () => {
    const result = computeAll(multipleTradesReturn())
    const sd = result.form1040.scheduleD!

    expect(sd.line1a.amount).toBe(170_000)
    expect(sd.line1b.amount).toBe(-30_000)
    expect(sd.line7.amount).toBe(140_000)
    expect(sd.line8a.amount).toBe(620_000)
    expect(sd.line8b.amount).toBe(300_000)
    expect(sd.line13.amount).toBe(0)
    expect(sd.line15.amount).toBe(920_000)
    expect(sd.line16.amount).toBe(1_060_000)
    expect(sd.line21.amount).toBe(1_060_000)
  })

  it('applies QDCG worksheet for net LTCG', () => {
    const result = computeAll(multipleTradesReturn())
    // QDCG: ordinary on $65,650 + 15% on $9,200 = 935,700 + 138,000 = 1,073,700
    expect(result.form1040.line16.amount).toBe(1_073_700)
  })

  it('computes all Form 1040 lines correctly', () => {
    const result = computeAll(multipleTradesReturn())
    const f = result.form1040

    expect(f.line1a.amount).toBe(8_000_000)
    expect(f.line7.amount).toBe(1_060_000)
    expect(f.line9.amount).toBe(9_060_000)
    expect(f.line11.amount).toBe(9_060_000)
    expect(f.line12.amount).toBe(1_575_000)
    expect(f.line15.amount).toBe(7_485_000)
    expect(f.line16.amount).toBe(1_073_700)
    expect(f.line24.amount).toBe(1_073_700)
    expect(f.line25.amount).toBe(1_200_000)
    expect(f.line33.amount).toBe(1_200_000)
    expect(f.line34.amount).toBe(126_300)
    expect(f.line37.amount).toBe(0)
  })

  it('trace for Line 7 resolves through Schedule D', () => {
    const result = computeAll(multipleTradesReturn())
    const trace = buildTrace(result, 'form1040.line7')
    expect(trace.inputs[0].nodeId).toBe('scheduleD.line21')
    expect(explainLine(result, 'form1040.line7')).not.toContain('Unknown')
  })

  it('PDF summary matches rules engine', async () => {
    const taxReturn = multipleTradesReturn()
    setTaxpayer(taxReturn, 'Dave', 'DayTrader')
    const compiled = await compileFilingPackage(taxReturn, templates)
    const engine = computeAll(taxReturn)

    expect(compiled.summary.agi).toBe(engine.form1040.line11.amount)
    expect(compiled.summary.totalTax).toBe(engine.form1040.line24.amount)
    expect(compiled.summary.totalPayments).toBe(engine.form1040.line33.amount)
    expect(compiled.summary.refund).toBe(engine.form1040.line34.amount)
    expect(compiled.summary.amountOwed).toBe(engine.form1040.line37.amount)
  })
})

// ═══════════════════════════════════════════════════════════════
// Scenario E — MFJ Basic
// ═══════════════════════════════════════════════════════════════

describe('Scenario E — MFJ Basic', () => {
  it('uses MFJ standard deduction and brackets', () => {
    const result = computeAll(mfjBasicReturn())
    const f = result.form1040

    // MFJ standard deduction = $31,500
    expect(f.line12.amount).toBe(3_150_000)
    // Tax: 10% × $23,850 + 12% × $50,850 = 238,500 + 610,200 = 848,700
    expect(f.line16.amount).toBe(848_700)
  })

  it('aggregates withholding from both W-2s', () => {
    const result = computeAll(mfjBasicReturn())
    // $6,000 + $4,500 = $10,500
    expect(result.form1040.line25.amount).toBe(1_050_000)
    expect(result.form1040.line33.amount).toBe(1_050_000)
  })

  it('Schedule B is not required', () => {
    const result = computeAll(mfjBasicReturn())
    // Interest $1,200 < $1,500 threshold
    expect(result.scheduleB.required).toBe(false)
  })

  it('computes all Form 1040 lines correctly', () => {
    const result = computeAll(mfjBasicReturn())
    const f = result.form1040

    expect(f.line1a.amount).toBe(10_500_000)
    expect(f.line2b.amount).toBe(120_000)
    expect(f.line3a.amount).toBe(0)
    expect(f.line3b.amount).toBe(0)
    expect(f.line7.amount).toBe(0)
    expect(f.line9.amount).toBe(10_620_000)
    expect(f.line11.amount).toBe(10_620_000)
    expect(f.line12.amount).toBe(3_150_000)
    expect(f.line15.amount).toBe(7_470_000)
    expect(f.line16.amount).toBe(848_700)
    expect(f.line24.amount).toBe(848_700)
    expect(f.line25.amount).toBe(1_050_000)
    expect(f.line33.amount).toBe(1_050_000)
    expect(f.line34.amount).toBe(201_300)
    expect(f.line37.amount).toBe(0)
  })

  it('trace for wages includes both W-2 sources', () => {
    const result = computeAll(mfjBasicReturn())
    const trace = buildTrace(result, 'form1040.line1a')
    expect(trace.inputs).toHaveLength(2)
    const explanation = explainLine(result, 'form1040.line1a')
    expect(explanation).toContain('Acme Corp')
    expect(explanation).toContain('Beta Inc')
    expect(explanation).not.toContain('Unknown')
  })

  it('PDF summary matches rules engine', async () => {
    const taxReturn = mfjBasicReturn()
    setTaxpayer(taxReturn, 'Eve', 'Married')
    const compiled = await compileFilingPackage(taxReturn, templates)
    const engine = computeAll(taxReturn)

    expect(compiled.summary.agi).toBe(engine.form1040.line11.amount)
    expect(compiled.summary.totalTax).toBe(engine.form1040.line24.amount)
    expect(compiled.summary.totalPayments).toBe(engine.form1040.line33.amount)
    expect(compiled.summary.refund).toBe(engine.form1040.line34.amount)
    expect(compiled.summary.amountOwed).toBe(engine.form1040.line37.amount)
  })
})
