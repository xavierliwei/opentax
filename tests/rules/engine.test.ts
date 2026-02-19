/**
 * Tests for the Explainability Trace Engine.
 *
 * 7 test groups:
 * 1. Trace completeness — W-2 only traces to source, no "Unknown"
 * 2. Trace correctness — LTCG traces include scheduleD; non-LTCG line7 = $0
 * 3. Dependency order — topologicalSort succeeds; correct ordering
 * 4. Selective computation — no capital activity → no scheduleD values
 * 5. Cycle detection — inject cycle → throws
 * 6. Document resolution — resolveDocumentRef for all ref types
 * 7. explainLine formatting — dollar amounts, labels, citations, indentation
 */

import { describe, it, expect } from 'vitest'
import { cents } from '../../src/model/traced'
import { tracedFromComputation } from '../../src/model/traced'
import type { TracedValue } from '../../src/model/traced'
import {
  computeAll,
  buildTrace,
  explainLine,
  topologicalSort,
  resolveDocumentRef,
  NODE_LABELS,
} from '../../src/rules/engine'
import {
  simpleW2Return,
  singleLTSaleReturn,
  mixedTradesReturn,
  w2WithInvestmentsReturn,
  itemizedDeductionReturn,
  bigCapitalLossReturn,
} from '../fixtures/returns'

// ── 1. Trace completeness ──────────────────────────────────────────

describe('Trace completeness', () => {
  it('simple W-2 return has all Form 1040 line values', () => {
    const result = computeAll(simpleW2Return())
    const lineKeys = [
      'form1040.line1a', 'form1040.line2a', 'form1040.line2b',
      'form1040.line3a', 'form1040.line3b', 'form1040.line7',
      'form1040.line8', 'form1040.line9', 'form1040.line10',
      'form1040.line11', 'form1040.line12', 'form1040.line13',
      'form1040.line14', 'form1040.line15', 'form1040.line16',
      'form1040.line24', 'form1040.line25', 'form1040.line33',
      'form1040.line34', 'form1040.line37',
    ]
    for (const key of lineKeys) {
      expect(result.values.has(key), `missing ${key}`).toBe(true)
    }
  })

  it('explainLine for line9 traces to W-2 source', () => {
    const result = computeAll(simpleW2Return())
    const explanation = explainLine(result, 'form1040.line9')
    expect(explanation).toContain('Wages, salaries, tips')
    expect(explanation).toContain('W-2 from Acme Corp')
  })

  it('explainLine for line9 contains no Unknown nodes', () => {
    const result = computeAll(simpleW2Return())
    const explanation = explainLine(result, 'form1040.line9')
    expect(explanation).not.toContain('Unknown')
  })

  it('trace for line1a reaches W-2 document source', () => {
    const result = computeAll(simpleW2Return())
    const trace = buildTrace(result, 'form1040.line1a')
    expect(trace.inputs.length).toBe(1)
    expect(trace.inputs[0].nodeId).toBe('w2:w2-1:box1')
    expect(trace.inputs[0].inputs.length).toBe(0) // leaf node
  })

  it('W-2 + investments: line9 trace includes interest and dividend sources', () => {
    const result = computeAll(w2WithInvestmentsReturn())
    const explanation = explainLine(result, 'form1040.line9')
    expect(explanation).toContain('Wages, salaries, tips')
    expect(explanation).toContain('Taxable interest')
    expect(explanation).toContain('Ordinary dividends')
    expect(explanation).not.toContain('Unknown')
  })
})

// ── 2. Trace correctness ──────────────────────────────────────────

describe('Trace correctness', () => {
  it('LTCG return: line7 trace includes scheduleD.line21', () => {
    const result = computeAll(singleLTSaleReturn())
    const trace = buildTrace(result, 'form1040.line7')
    expect(trace.output.amount).toBeGreaterThan(0)
    expect(trace.inputs.length).toBe(1)
    expect(trace.inputs[0].nodeId).toBe('scheduleD.line21')
  })

  it('no capital activity: line7 = $0 with no inputs', () => {
    const result = computeAll(simpleW2Return())
    const trace = buildTrace(result, 'form1040.line7')
    expect(trace.output.amount).toBe(0)
    expect(trace.inputs.length).toBe(0)
  })

  it('mixed trades: line7 traces through scheduleD to form8949 to transactions', () => {
    const result = computeAll(mixedTradesReturn())
    const trace = buildTrace(result, 'form1040.line7')
    // line7 → scheduleD.line21 → scheduleD.line16 → ...
    expect(trace.inputs[0].nodeId).toBe('scheduleD.line21')

    const line21Trace = trace.inputs[0]
    expect(line21Trace.inputs[0].nodeId).toBe('scheduleD.line16')

    const line16Trace = line21Trace.inputs[0]
    const inputIds = line16Trace.inputs.map(i => i.nodeId)
    expect(inputIds).toContain('scheduleD.line7')
    expect(inputIds).toContain('scheduleD.line15')
  })

  it('capital loss return: line21 reflects loss limitation', () => {
    const result = computeAll(bigCapitalLossReturn())
    // Net loss is -$5,000, limited to -$3,000
    expect(result.values.get('scheduleD.line21')!.amount).toBe(cents(-3000))
    expect(result.values.get('scheduleD.line16')!.amount).toBe(cents(-5000))
  })

  it('form1040.line12 traces to standardDeduction for simple return', () => {
    const result = computeAll(simpleW2Return())
    const trace = buildTrace(result, 'form1040.line12')
    expect(trace.inputs.length).toBe(1)
    expect(trace.inputs[0].nodeId).toBe('standardDeduction')
  })
})

// ── 3. Dependency order ──────────────────────────────────────────

describe('Dependency order', () => {
  it('topologicalSort succeeds on simple W-2 return', () => {
    const result = computeAll(simpleW2Return())
    const sorted = topologicalSort(result.values)
    expect(sorted.length).toBe(result.values.size)
  })

  it('topologicalSort succeeds on mixed trades return', () => {
    const result = computeAll(mixedTradesReturn())
    const sorted = topologicalSort(result.values)
    expect(sorted.length).toBe(result.values.size)
  })

  it('line1a comes before line9', () => {
    const result = computeAll(simpleW2Return())
    const sorted = topologicalSort(result.values)
    const idx1a = sorted.indexOf('form1040.line1a')
    const idx9 = sorted.indexOf('form1040.line9')
    expect(idx1a).toBeLessThan(idx9)
  })

  it('line9 comes before line11', () => {
    const result = computeAll(simpleW2Return())
    const sorted = topologicalSort(result.values)
    const idx9 = sorted.indexOf('form1040.line9')
    const idx11 = sorted.indexOf('form1040.line11')
    expect(idx9).toBeLessThan(idx11)
  })

  it('line11 comes before line15', () => {
    const result = computeAll(simpleW2Return())
    const sorted = topologicalSort(result.values)
    const idx11 = sorted.indexOf('form1040.line11')
    const idx15 = sorted.indexOf('form1040.line15')
    expect(idx11).toBeLessThan(idx15)
  })

  it('document sources come before computed nodes that use them', () => {
    const result = computeAll(simpleW2Return())
    const sorted = topologicalSort(result.values)
    const idxW2 = sorted.indexOf('w2:w2-1:box1')
    const idxLine1a = sorted.indexOf('form1040.line1a')
    expect(idxW2).toBeLessThan(idxLine1a)
  })
})

// ── 4. Selective computation ─────────────────────────────────────

describe('Selective computation', () => {
  it('no capital activity → no scheduleD values in map', () => {
    const result = computeAll(simpleW2Return())
    const scheduleDKeys = [...result.values.keys()].filter(k => k.startsWith('scheduleD.'))
    expect(scheduleDKeys.length).toBe(0)
  })

  it('no capital activity → no form8949 values in map', () => {
    const result = computeAll(simpleW2Return())
    const form8949Keys = [...result.values.keys()].filter(k => k.startsWith('form8949.'))
    expect(form8949Keys.length).toBe(0)
  })

  it('with capital activity → scheduleD values present', () => {
    const result = computeAll(singleLTSaleReturn())
    expect(result.values.has('scheduleD.line21')).toBe(true)
    expect(result.values.has('scheduleD.line16')).toBe(true)
    expect(result.values.has('scheduleD.line7')).toBe(true)
    expect(result.values.has('scheduleD.line15')).toBe(true)
  })

  it('with capital activity → form8949 values present', () => {
    const result = computeAll(singleLTSaleReturn())
    expect(result.values.has('form8949.D.gainLoss')).toBe(true)
    expect(result.values.has('form8949.D.proceeds')).toBe(true)
  })

  it('executedSchedules reflects computed schedules', () => {
    const simple = computeAll(simpleW2Return())
    expect(simple.executedSchedules).toContain('B')
    expect(simple.executedSchedules).not.toContain('D')

    const withCap = computeAll(singleLTSaleReturn())
    expect(withCap.executedSchedules).toContain('B')
    expect(withCap.executedSchedules).toContain('D')
  })

  it('itemized return has Schedule A values and executedSchedules includes A', () => {
    const result = computeAll(itemizedDeductionReturn())
    expect(result.executedSchedules).toContain('A')
    expect(result.values.has('scheduleA.line17')).toBe(true)
    expect(result.values.has('scheduleA.line4')).toBe(true)
  })

  it('itemized return has all expanded Schedule A lines in values map', () => {
    const result = computeAll(itemizedDeductionReturn())
    const newLines = [
      'scheduleA.line5a',
      'scheduleA.line5b',
      'scheduleA.line5c',
      'scheduleA.line8a',
      'scheduleA.line9',
      'scheduleA.line10',
      'scheduleA.line11',
      'scheduleA.line12',
    ]
    for (const key of newLines) {
      expect(result.values.has(key), `missing ${key}`).toBe(true)
    }
  })
})

// ── 5. Cycle detection ──────────────────────────────────────────

describe('Cycle detection', () => {
  it('2-node cycle throws', () => {
    const values = new Map<string, TracedValue>()
    values.set('a', tracedFromComputation(100, 'a', ['b']))
    values.set('b', tracedFromComputation(200, 'b', ['a']))

    expect(() => topologicalSort(values)).toThrow(/Cycle detected/)
  })

  it('3-node cycle throws', () => {
    const values = new Map<string, TracedValue>()
    values.set('a', tracedFromComputation(100, 'a', ['c']))
    values.set('b', tracedFromComputation(200, 'b', ['a']))
    values.set('c', tracedFromComputation(300, 'c', ['b']))

    expect(() => topologicalSort(values)).toThrow(/Cycle detected/)
  })

  it('cycle error message includes involved node IDs', () => {
    const values = new Map<string, TracedValue>()
    values.set('x', tracedFromComputation(100, 'x', ['y']))
    values.set('y', tracedFromComputation(200, 'y', ['x']))

    expect(() => topologicalSort(values)).toThrow(/x/)
    expect(() => topologicalSort(values)).toThrow(/y/)
  })

  it('DAG with no cycles succeeds', () => {
    const values = new Map<string, TracedValue>()
    values.set('a', tracedFromComputation(100, 'a', []))
    values.set('b', tracedFromComputation(200, 'b', ['a']))
    values.set('c', tracedFromComputation(300, 'c', ['a', 'b']))

    const sorted = topologicalSort(values)
    expect(sorted).toEqual(['a', 'b', 'c'])
  })
})

// ── 6. Document resolution ──────────────────────────────────────

describe('Document resolution', () => {
  it('resolves W-2 box1 ref', () => {
    const model = simpleW2Return()
    const result = resolveDocumentRef(model, 'w2:w2-1:box1')
    expect(result.label).toContain('Acme Corp')
    expect(result.label).toContain('Box 1')
    expect(result.amount).toBe(cents(75000))
  })

  it('resolves W-2 box2 ref', () => {
    const model = simpleW2Return()
    const result = resolveDocumentRef(model, 'w2:w2-1:box2')
    expect(result.label).toContain('Acme Corp')
    expect(result.label).toContain('Box 2')
    expect(result.amount).toBe(cents(8000))
  })

  it('resolves 1099-INT box1 ref', () => {
    const model = w2WithInvestmentsReturn()
    const result = resolveDocumentRef(model, '1099int:int-1:box1')
    expect(result.label).toContain('Chase Bank')
    expect(result.label).toContain('Box 1')
    expect(result.amount).toBe(cents(2500))
  })

  it('resolves 1099-DIV box1a ref', () => {
    const model = w2WithInvestmentsReturn()
    const result = resolveDocumentRef(model, '1099div:div-1:box1a')
    expect(result.label).toContain('Schwab')
    expect(result.label).toContain('Box 1a')
    expect(result.amount).toBe(cents(3000))
  })

  it('resolves 1099-DIV box2a ref', () => {
    const model = w2WithInvestmentsReturn()
    const result = resolveDocumentRef(model, '1099div:div-1:box2a')
    expect(result.label).toContain('Schwab')
    expect(result.amount).toBe(cents(500))
  })

  it('resolves transaction ref', () => {
    const model = singleLTSaleReturn()
    const result = resolveDocumentRef(model, 'tx:tx-1')
    expect(result.label).toContain('100 sh AAPL')
    expect(result.amount).toBe(cents(2000)) // gain = $7,000 - $5,000
  })

  it('resolves standardDeduction ref', () => {
    const model = simpleW2Return()
    const result = resolveDocumentRef(model, 'standardDeduction')
    expect(result.label).toContain('Standard deduction')
    expect(result.label).toContain('single')
    expect(result.amount).toBe(cents(15000))
  })

  it('resolves itemized.medicalExpenses ref', () => {
    const model = itemizedDeductionReturn()
    const result = resolveDocumentRef(model, 'itemized.medicalExpenses')
    expect(result.label).toContain('Medical')
    expect(result.amount).toBe(cents(15000))
  })

  it('resolves itemized.stateLocalIncomeTaxes ref', () => {
    const model = itemizedDeductionReturn()
    const result = resolveDocumentRef(model, 'itemized.stateLocalIncomeTaxes')
    expect(result.label).toContain('income taxes')
    expect(result.amount).toBe(cents(18000))
  })

  it('resolves itemized.stateLocalSalesTaxes ref', () => {
    const model = itemizedDeductionReturn()
    const result = resolveDocumentRef(model, 'itemized.stateLocalSalesTaxes')
    expect(result.label).toContain('sales taxes')
    expect(result.amount).toBe(0)
  })

  it('resolves itemized.realEstateTaxes ref', () => {
    const model = itemizedDeductionReturn()
    const result = resolveDocumentRef(model, 'itemized.realEstateTaxes')
    expect(result.label).toContain('Real estate')
    expect(result.amount).toBe(0)
  })

  it('resolves itemized.personalPropertyTaxes ref', () => {
    const model = itemizedDeductionReturn()
    const result = resolveDocumentRef(model, 'itemized.personalPropertyTaxes')
    expect(result.label).toContain('Personal property')
    expect(result.amount).toBe(0)
  })

  it('resolves itemized.investmentInterest ref', () => {
    const model = itemizedDeductionReturn()
    const result = resolveDocumentRef(model, 'itemized.investmentInterest')
    expect(result.label).toContain('Investment interest')
    expect(result.amount).toBe(0)
  })

  it('returns Unknown for unrecognized ref', () => {
    const model = simpleW2Return()
    const result = resolveDocumentRef(model, 'foo:bar')
    expect(result.label).toContain('Unknown')
    expect(result.amount).toBe(0)
  })

  it('returns Unknown for missing W-2 id', () => {
    const model = simpleW2Return()
    const result = resolveDocumentRef(model, 'w2:nonexistent:box1')
    expect(result.label).toContain('Unknown')
    expect(result.amount).toBe(0)
  })
})

// ── 7. explainLine formatting ──────────────────────────────────

describe('explainLine formatting', () => {
  it('root line has no indentation prefix', () => {
    const result = computeAll(simpleW2Return())
    const explanation = explainLine(result, 'form1040.line9')
    const firstLine = explanation.split('\n')[0]
    expect(firstLine).toMatch(/^Total income:/)
  })

  it('contains dollar amounts with comma formatting', () => {
    const result = computeAll(simpleW2Return())
    const explanation = explainLine(result, 'form1040.line9')
    expect(explanation).toContain('$75,000.00')
  })

  it('contains IRS citation brackets', () => {
    const result = computeAll(simpleW2Return())
    const explanation = explainLine(result, 'form1040.line9')
    expect(explanation).toContain('[Form 1040, Line 9]')
    expect(explanation).toContain('[Form 1040, Line 1a]')
  })

  it('child lines use |- prefix with indentation', () => {
    const result = computeAll(simpleW2Return())
    const explanation = explainLine(result, 'form1040.line9')
    const lines = explanation.split('\n')
    // First child should be indented with |- prefix
    const childLine = lines.find(l => l.includes('Wages, salaries, tips'))
    expect(childLine).toMatch(/^\s+\|- /)
  })

  it('grandchild lines are indented further', () => {
    const result = computeAll(simpleW2Return())
    const explanation = explainLine(result, 'form1040.line9')
    const lines = explanation.split('\n')
    const w2Line = lines.find(l => l.includes('W-2 from Acme Corp'))
    expect(w2Line).toBeDefined()
    // Grandchild has more leading spaces than child
    const wagesLine = lines.find(l => l.includes('Wages, salaries, tips'))!
    const wagesIndent = wagesLine.match(/^(\s*)/)![1].length
    const w2Indent = w2Line!.match(/^(\s*)/)![1].length
    expect(w2Indent).toBeGreaterThan(wagesIndent)
  })

  it('negative amounts show minus sign before dollar sign', () => {
    const result = computeAll(bigCapitalLossReturn())
    const explanation = explainLine(result, 'scheduleD.line21')
    expect(explanation).toContain('-$3,000.00')
  })

  it('zero amounts display as $0.00', () => {
    const result = computeAll(simpleW2Return())
    const explanation = explainLine(result, 'form1040.line7')
    expect(explanation).toContain('$0.00')
  })

  it('NODE_LABELS covers all major form lines', () => {
    // Spot-check key entries exist
    expect(NODE_LABELS['form1040.line1a']).toBe('Wages, salaries, tips')
    expect(NODE_LABELS['form1040.line9']).toBe('Total income')
    expect(NODE_LABELS['form1040.line11']).toBe('Adjusted gross income')
    expect(NODE_LABELS['form1040.line15']).toBe('Taxable income')
    expect(NODE_LABELS['form1040.line16']).toBe('Tax')
    expect(NODE_LABELS['form1040.line37']).toBe('Amount you owe')
    expect(NODE_LABELS['scheduleD.line21']).toBe('Capital gain/loss for Form 1040')
    expect(NODE_LABELS['standardDeduction']).toBe('Standard deduction')
  })

  it('NODE_LABELS covers all new Schedule A lines', () => {
    expect(NODE_LABELS['scheduleA.line5a']).toBe('State/local income or sales taxes (elected)')
    expect(NODE_LABELS['scheduleA.line5b']).toBe('Real estate taxes')
    expect(NODE_LABELS['scheduleA.line5c']).toBe('Personal property taxes')
    expect(NODE_LABELS['scheduleA.line8a']).toBe('Home mortgage interest (after limit)')
    expect(NODE_LABELS['scheduleA.line9']).toBe('Investment interest')
    expect(NODE_LABELS['scheduleA.line10']).toBe('Total interest you paid')
    expect(NODE_LABELS['scheduleA.line11']).toBe('Cash charitable contributions')
    expect(NODE_LABELS['scheduleA.line12']).toBe('Non-cash charitable contributions')
  })
})
