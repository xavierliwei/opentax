/**
 * Tests for cross-state registry/compiler quality gates.
 */

import { describe, it, expect } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import {
  validateRegistryConsistency,
  validateComputeResult,
  validateCrossStateConsistency,
  validateCompilerOutput,
  runAllGates,
} from '../../src/rules/qualityGates'
import type { GateResult, GateViolation } from '../../src/rules/qualityGates'
import type { StateRulesModule, StateComputeResult } from '../../src/rules/stateEngine'
import type { StateFormCompiler, StateCompiledForms } from '../../src/forms/stateCompiler'
import type { SupportedStateCode, TaxReturn, StateReturnConfig } from '../../src/model/types'
import { emptyTaxReturn } from '../../src/model/types'
import { getStateModule, getSupportedStates } from '../../src/rules/stateRegistry'
import { getStateFormCompiler, getAllStateFormCompilers } from '../../src/forms/stateFormRegistry'
import { computeAll } from '../../src/rules/engine'
import { makeW2 } from '../fixtures/returns'
import { cents } from '../../src/model/traced'

// ── Helpers ──────────────────────────────────────────────────────

function makeConfig(code: SupportedStateCode, residencyType: StateReturnConfig['residencyType'] = 'full-year'): StateReturnConfig {
  return { stateCode: code, residencyType }
}

function makeStateResult(overrides: Partial<StateComputeResult> = {}): StateComputeResult {
  return {
    stateCode: 'CA',
    formLabel: 'CA Form 540',
    residencyType: 'full-year',
    stateAGI: 10000000,
    stateTaxableIncome: 8500000,
    stateTax: 500000,
    stateCredits: 15300,
    taxAfterCredits: 484700,
    stateWithholding: 600000,
    overpaid: 115300,
    amountOwed: 0,
    detail: {},
    ...overrides,
  }
}

/** Build a minimal mock StateRulesModule */
function makeMockModule(code: SupportedStateCode, overrides: Partial<StateRulesModule> = {}): StateRulesModule {
  return {
    stateCode: code,
    stateName: 'Test State',
    formLabel: `${code} Test Form`,
    sidebarLabel: `${code} Test Form`,
    compute: () => makeStateResult({ stateCode: code }),
    nodeLabels: {},
    collectTracedValues: () => new Map(),
    reviewLayout: [{ title: 'Test', items: [] }],
    reviewResultLines: [{ type: 'zero', label: 'Balance', nodeId: '', getValue: () => 0, showWhen: () => true }],
    ...overrides,
  }
}

/** Build a minimal mock StateFormCompiler */
function makeMockCompiler(code: SupportedStateCode, overrides: Partial<StateFormCompiler> = {}): StateFormCompiler {
  return {
    stateCode: code,
    templateFiles: [],
    compile: async () => {
      const doc = await PDFDocument.create()
      doc.addPage()
      return {
        doc,
        forms: [{ formId: `${code} Test Form`, sequenceNumber: `${code}-01`, pageCount: 1 }],
      }
    },
    ...overrides,
  }
}

function makeTr(overrides: Partial<TaxReturn> = {}): TaxReturn {
  return { ...emptyTaxReturn(2025), ...overrides }
}

function errorViolations(result: GateResult): GateViolation[] {
  return result.violations.filter(v => v.severity === 'error')
}

function warningViolations(result: GateResult): GateViolation[] {
  return result.violations.filter(v => v.severity === 'warning')
}

// ── Registry consistency gates ───────────────────────────────────

describe('Quality Gates — Registry Consistency', () => {
  it('passes when all modules have matching compilers', () => {
    const modules = new Map<SupportedStateCode, StateRulesModule>([
      ['CA', makeMockModule('CA')],
    ])
    const compilers = new Map<SupportedStateCode, StateFormCompiler>([
      ['CA', makeMockCompiler('CA')],
    ])
    const result = validateRegistryConsistency(modules, compilers)
    expect(result.passed).toBe(true)
    expect(errorViolations(result)).toHaveLength(0)
  })

  it('fails when module has no matching compiler', () => {
    const modules = new Map<SupportedStateCode, StateRulesModule>([
      ['CA', makeMockModule('CA')],
    ])
    const compilers = new Map<SupportedStateCode, StateFormCompiler>()
    const result = validateRegistryConsistency(modules, compilers)
    expect(result.passed).toBe(false)
    expect(errorViolations(result)).toHaveLength(1)
    expect(errorViolations(result)[0].gate).toBe('registry.module-without-compiler')
  })

  it('fails when compiler has no matching module', () => {
    const modules = new Map<SupportedStateCode, StateRulesModule>()
    const compilers = new Map<SupportedStateCode, StateFormCompiler>([
      ['CA', makeMockCompiler('CA')],
    ])
    const result = validateRegistryConsistency(modules, compilers)
    expect(result.passed).toBe(false)
    expect(errorViolations(result)).toHaveLength(1)
    expect(errorViolations(result)[0].gate).toBe('registry.compiler-without-module')
  })

  it('detects state code mismatch in module', () => {
    const modules = new Map<SupportedStateCode, StateRulesModule>([
      ['CA', makeMockModule('CA', { stateCode: 'CA' })],
    ])
    // Register under CA but module says something different
    // For now, CA matches CA. Let's test with a mock that lies about its code.
    const badModule = makeMockModule('CA')
    // Override the stateCode to be wrong. We need a cast since TS enforces SupportedStateCode.
    ;(badModule as { stateCode: string }).stateCode = 'XX'
    const modsWithBad = new Map<SupportedStateCode, StateRulesModule>([
      ['CA', badModule as StateRulesModule],
    ])
    const compilers = new Map<SupportedStateCode, StateFormCompiler>([
      ['CA', makeMockCompiler('CA')],
    ])
    const result = validateRegistryConsistency(modsWithBad, compilers)
    expect(result.passed).toBe(false)
    const mismatch = errorViolations(result).find(v => v.gate === 'registry.state-code-mismatch')
    expect(mismatch).toBeDefined()
  })

  it('warns when module has empty review layout', () => {
    const modules = new Map<SupportedStateCode, StateRulesModule>([
      ['CA', makeMockModule('CA', { reviewLayout: [] })],
    ])
    const compilers = new Map<SupportedStateCode, StateFormCompiler>([
      ['CA', makeMockCompiler('CA')],
    ])
    const result = validateRegistryConsistency(modules, compilers)
    // Empty review layout is a warning, not an error
    expect(result.passed).toBe(true)
    expect(warningViolations(result).find(v => v.gate === 'registry.empty-review-layout')).toBeDefined()
  })

  it('validates the real registry is consistent', () => {
    const modules = new Map<SupportedStateCode, StateRulesModule>()
    for (const { code } of getSupportedStates()) {
      const mod = getStateModule(code)
      if (mod) modules.set(code, mod)
    }

    const compilers = getAllStateFormCompilers()

    const result = validateRegistryConsistency(modules, compilers)
    expect(result.passed).toBe(true)
    expect(errorViolations(result)).toHaveLength(0)
  })
})

// ── Computation result gates ─────────────────────────────────────

describe('Quality Gates — Compute Result Validation', () => {
  it('passes for a valid compute result', () => {
    const sr = makeStateResult()
    const config = makeConfig('CA')
    const result = validateComputeResult(sr, config)
    expect(result.passed).toBe(true)
    expect(errorViolations(result)).toHaveLength(0)
  })

  it('detects state code mismatch with config', () => {
    const sr = makeStateResult({ stateCode: 'CA' })
    // Create config with mismatched code — need a cast
    const config = { stateCode: 'CA' as SupportedStateCode, residencyType: 'full-year' as const }
    // This should pass. Now let's make them mismatch:
    ;(sr as { stateCode: string }).stateCode = 'NY'
    const result = validateComputeResult(sr as StateComputeResult, config)
    expect(result.passed).toBe(false)
    expect(errorViolations(result).find(v => v.gate === 'compute.state-code-mismatch')).toBeDefined()
  })

  it('detects residency type mismatch', () => {
    const sr = makeStateResult({ residencyType: 'part-year' })
    const config = makeConfig('CA', 'full-year')
    const result = validateComputeResult(sr, config)
    expect(result.passed).toBe(false)
    expect(errorViolations(result).find(v => v.gate === 'compute.residency-mismatch')).toBeDefined()
  })

  it('detects negative taxable income', () => {
    const sr = makeStateResult({ stateTaxableIncome: -100 })
    const config = makeConfig('CA')
    const result = validateComputeResult(sr, config)
    expect(result.passed).toBe(false)
    expect(errorViolations(result).find(v => v.gate === 'compute.negative-taxable-income')).toBeDefined()
  })

  it('detects negative state tax', () => {
    const sr = makeStateResult({ stateTax: -100 })
    const config = makeConfig('CA')
    const result = validateComputeResult(sr, config)
    expect(result.passed).toBe(false)
    expect(errorViolations(result).find(v => v.gate === 'compute.negative-state-tax')).toBeDefined()
  })

  it('detects negative credits', () => {
    const sr = makeStateResult({ stateCredits: -100 })
    const config = makeConfig('CA')
    const result = validateComputeResult(sr, config)
    expect(result.passed).toBe(false)
    expect(errorViolations(result).find(v => v.gate === 'compute.negative-credits')).toBeDefined()
  })

  it('detects negative tax after credits', () => {
    const sr = makeStateResult({ taxAfterCredits: -100 })
    const config = makeConfig('CA')
    const result = validateComputeResult(sr, config)
    expect(result.passed).toBe(false)
    expect(errorViolations(result).find(v => v.gate === 'compute.negative-tax-after-credits')).toBeDefined()
  })

  it('detects negative withholding', () => {
    const sr = makeStateResult({ stateWithholding: -100 })
    const config = makeConfig('CA')
    const result = validateComputeResult(sr, config)
    expect(result.passed).toBe(false)
    expect(errorViolations(result).find(v => v.gate === 'compute.negative-withholding')).toBeDefined()
  })

  it('detects both overpaid and amountOwed positive', () => {
    const sr = makeStateResult({
      overpaid: 50000,
      amountOwed: 30000,
      // Fix balance so that doesn't trip as well
      stateWithholding: 0,
      taxAfterCredits: 0,
    })
    const config = makeConfig('CA')
    const result = validateComputeResult(sr, config)
    expect(result.passed).toBe(false)
    expect(errorViolations(result).find(v => v.gate === 'compute.overpaid-and-owed')).toBeDefined()
  })

  it('detects balance mismatch', () => {
    // withholding - taxAfterCredits should equal overpaid - amountOwed
    const sr = makeStateResult({
      stateWithholding: 600000,
      taxAfterCredits: 400000,
      overpaid: 100000,  // Should be 200000
      amountOwed: 0,
    })
    const config = makeConfig('CA')
    const result = validateComputeResult(sr, config)
    expect(result.passed).toBe(false)
    expect(errorViolations(result).find(v => v.gate === 'compute.balance-mismatch')).toBeDefined()
  })

  it('passes balance check with 1-cent tolerance', () => {
    const sr = makeStateResult({
      stateWithholding: 600000,
      taxAfterCredits: 400001,
      overpaid: 200000,
      amountOwed: 0,
    })
    const config = makeConfig('CA')
    const result = validateComputeResult(sr, config)
    // 600000 - 400001 = 199999, overpaid - owed = 200000, diff = 1 → within tolerance
    const balanceViolation = errorViolations(result).find(v => v.gate === 'compute.balance-mismatch')
    expect(balanceViolation).toBeUndefined()
  })

  it('warns about missing apportionment for part-year', () => {
    const sr = makeStateResult({
      residencyType: 'part-year',
      apportionmentRatio: undefined,
    })
    const config = makeConfig('CA', 'part-year')
    const result = validateComputeResult(sr, config)
    expect(warningViolations(result).find(v => v.gate === 'compute.missing-apportionment')).toBeDefined()
  })

  it('detects invalid apportionment ratio > 1', () => {
    const sr = makeStateResult({
      residencyType: 'part-year',
      apportionmentRatio: 1.5,
    })
    const config = makeConfig('CA', 'part-year')
    const result = validateComputeResult(sr, config)
    expect(result.passed).toBe(false)
    expect(errorViolations(result).find(v => v.gate === 'compute.invalid-apportionment')).toBeDefined()
  })

  it('detects invalid apportionment ratio < 0', () => {
    const sr = makeStateResult({
      residencyType: 'nonresident',
      apportionmentRatio: -0.1,
    })
    const config = makeConfig('CA', 'nonresident')
    const result = validateComputeResult(sr, config)
    expect(result.passed).toBe(false)
    expect(errorViolations(result).find(v => v.gate === 'compute.invalid-apportionment')).toBeDefined()
  })

  it('detects empty form label', () => {
    const sr = makeStateResult({ formLabel: '' })
    const config = makeConfig('CA')
    const result = validateComputeResult(sr, config)
    expect(result.passed).toBe(false)
    expect(errorViolations(result).find(v => v.gate === 'compute.missing-form-label')).toBeDefined()
  })

  it('passes for zero-balance return (no tax, no withholding)', () => {
    const sr = makeStateResult({
      stateTax: 0,
      stateCredits: 0,
      taxAfterCredits: 0,
      stateWithholding: 0,
      overpaid: 0,
      amountOwed: 0,
    })
    const config = makeConfig('CA')
    const result = validateComputeResult(sr, config)
    expect(result.passed).toBe(true)
  })
})

// ── Cross-state consistency gates ────────────────────────────────

describe('Quality Gates — Cross-State Consistency', () => {
  it('passes for a single-state return', () => {
    const tr = makeTr({
      stateReturns: [makeConfig('CA')],
      w2s: [makeW2({
        id: 'w2-1',
        employerName: 'Test',
        box1: 10000000,
        box2: 1500000,
        box17StateIncomeTax: 500000,
      })],
    })
    const sr = makeStateResult({ stateWithholding: 500000 })
    const result = validateCrossStateConsistency(tr, [sr], 10000000)
    expect(result.passed).toBe(true)
  })

  it('detects duplicate state codes in config', () => {
    const tr = makeTr({
      stateReturns: [makeConfig('CA'), makeConfig('CA')],
    })
    const result = validateCrossStateConsistency(tr, [], 10000000)
    expect(result.passed).toBe(false)
    expect(errorViolations(result).find(v => v.gate === 'cross-state.duplicate-state-codes')).toBeDefined()
  })

  it('detects missing result for configured state', () => {
    const tr = makeTr({
      stateReturns: [makeConfig('CA')],
    })
    const result = validateCrossStateConsistency(tr, [], 10000000)
    expect(result.passed).toBe(false)
    expect(errorViolations(result).find(v => v.gate === 'cross-state.missing-result')).toBeDefined()
  })

  it('warns when state withholding exceeds W-2 state withholding', () => {
    const tr = makeTr({
      stateReturns: [makeConfig('CA')],
      w2s: [makeW2({
        id: 'w2-1',
        employerName: 'Test',
        box1: 10000000,
        box2: 1500000,
        box17StateIncomeTax: 300000,
      })],
    })
    const sr = makeStateResult({ stateWithholding: 500000 })
    const result = validateCrossStateConsistency(tr, [sr], 10000000)
    expect(warningViolations(result).find(v => v.gate === 'cross-state.withholding-exceeds-w2')).toBeDefined()
  })

  it('warns on large AGI deviation for full-year resident', () => {
    const tr = makeTr({
      stateReturns: [makeConfig('CA')],
    })
    // State AGI is 10M cents, federal AGI is 100M cents — >50% deviation
    const sr = makeStateResult({ stateAGI: 10000000, residencyType: 'full-year' })
    const result = validateCrossStateConsistency(tr, [sr], 100000000)
    expect(warningViolations(result).find(v => v.gate === 'cross-state.agi-deviation')).toBeDefined()
  })

  it('does not warn on AGI deviation for part-year resident', () => {
    const tr = makeTr({
      stateReturns: [makeConfig('CA', 'part-year')],
    })
    const sr = makeStateResult({ stateAGI: 10000000, residencyType: 'part-year' })
    const result = validateCrossStateConsistency(tr, [sr], 100000000)
    expect(warningViolations(result).find(v => v.gate === 'cross-state.agi-deviation')).toBeUndefined()
  })

  it('passes for empty stateReturns', () => {
    const tr = makeTr({ stateReturns: [] })
    const result = validateCrossStateConsistency(tr, [], 10000000)
    expect(result.passed).toBe(true)
    expect(result.violations).toHaveLength(0)
  })
})

// ── Compiler output gates ────────────────────────────────────────

describe('Quality Gates — Compiler Output', () => {
  it('passes for valid compiler output', async () => {
    const doc = await PDFDocument.create()
    doc.addPage()
    const compiled: StateCompiledForms = {
      doc,
      forms: [{ formId: 'CA Form 540', sequenceNumber: 'CA-01', pageCount: 1 }],
    }
    const result = validateCompilerOutput(compiled, 'CA')
    expect(result.passed).toBe(true)
    expect(errorViolations(result)).toHaveLength(0)
  })

  it('detects no forms produced', async () => {
    const doc = await PDFDocument.create()
    doc.addPage()
    const compiled: StateCompiledForms = { doc, forms: [] }
    const result = validateCompilerOutput(compiled, 'CA')
    expect(result.passed).toBe(false)
    expect(errorViolations(result).find(v => v.gate === 'compiler.no-forms')).toBeDefined()
  })

  it('detects empty formId', async () => {
    const doc = await PDFDocument.create()
    doc.addPage()
    const compiled: StateCompiledForms = {
      doc,
      forms: [{ formId: '', sequenceNumber: 'CA-01', pageCount: 1 }],
    }
    const result = validateCompilerOutput(compiled, 'CA')
    expect(result.passed).toBe(false)
    expect(errorViolations(result).find(v => v.gate === 'compiler.empty-form-id')).toBeDefined()
  })

  it('detects empty sequence number', async () => {
    const doc = await PDFDocument.create()
    doc.addPage()
    const compiled: StateCompiledForms = {
      doc,
      forms: [{ formId: 'CA Form 540', sequenceNumber: '', pageCount: 1 }],
    }
    const result = validateCompilerOutput(compiled, 'CA')
    expect(result.passed).toBe(false)
    expect(errorViolations(result).find(v => v.gate === 'compiler.empty-sequence-number')).toBeDefined()
  })

  it('detects zero page count', async () => {
    const doc = await PDFDocument.create()
    doc.addPage()
    const compiled: StateCompiledForms = {
      doc,
      forms: [{ formId: 'CA Form 540', sequenceNumber: 'CA-01', pageCount: 0 }],
    }
    const result = validateCompilerOutput(compiled, 'CA')
    expect(result.passed).toBe(false)
    expect(errorViolations(result).find(v => v.gate === 'compiler.zero-page-count')).toBeDefined()
  })

  it('detects empty PDF document', async () => {
    const doc = await PDFDocument.create()
    // No pages added
    const compiled: StateCompiledForms = {
      doc,
      forms: [{ formId: 'CA Form 540', sequenceNumber: 'CA-01', pageCount: 1 }],
    }
    const result = validateCompilerOutput(compiled, 'CA')
    expect(result.passed).toBe(false)
    expect(errorViolations(result).find(v => v.gate === 'compiler.empty-pdf')).toBeDefined()
  })
})

// ── runAllGates aggregation ──────────────────────────────────────

describe('Quality Gates — runAllGates', () => {
  it('combines violations from multiple results', () => {
    const r1: GateResult = {
      passed: true,
      violations: [{ gate: 'test.a', category: 'computation', severity: 'warning', message: 'w' }],
    }
    const r2: GateResult = {
      passed: false,
      violations: [{ gate: 'test.b', category: 'computation', severity: 'error', message: 'e' }],
    }
    const combined = runAllGates([r1, r2])
    expect(combined.passed).toBe(false)
    expect(combined.violations).toHaveLength(2)
  })

  it('passes when all sub-results pass', () => {
    const r1: GateResult = { passed: true, violations: [] }
    const r2: GateResult = { passed: true, violations: [] }
    const combined = runAllGates([r1, r2])
    expect(combined.passed).toBe(true)
  })

  it('passes when only warnings exist', () => {
    const r1: GateResult = {
      passed: true,
      violations: [{ gate: 'test.w', category: 'computation', severity: 'warning', message: 'w' }],
    }
    const combined = runAllGates([r1])
    expect(combined.passed).toBe(true)
    expect(combined.violations).toHaveLength(1)
  })
})

// ── Integration: real CA computation through quality gates ───────

describe('Quality Gates — Integration with real CA engine', () => {
  it('CA full-year computation passes all quality gates', () => {
    const tr = makeTr({
      stateReturns: [makeConfig('CA')],
      w2s: [makeW2({
        id: 'w2-1',
        employerName: 'Tech Corp',
        box1: cents(100000),
        box2: cents(15000),
        box15State: 'CA',
        box16StateWages: cents(100000),
        box17StateIncomeTax: cents(5000),
      })],
    })
    const result = computeAll(tr)
    expect(result.qualityGates).toBeDefined()
    expect(result.qualityGates!.passed).toBe(true)
    expect(errorViolations(result.qualityGates!)).toHaveLength(0)
  })

  it('CA part-year computation passes all quality gates', () => {
    const tr = makeTr({
      stateReturns: [{
        stateCode: 'CA',
        residencyType: 'part-year',
        moveInDate: '2025-01-01',
        moveOutDate: '2025-06-30',
      }],
      w2s: [makeW2({
        id: 'w2-1',
        employerName: 'Tech Corp',
        box1: cents(100000),
        box2: cents(15000),
        box15State: 'CA',
        box16StateWages: cents(100000),
        box17StateIncomeTax: cents(5000),
      })],
    })
    const result = computeAll(tr)
    expect(result.qualityGates).toBeDefined()
    expect(result.qualityGates!.passed).toBe(true)

    // Part-year should have apportionment checked
    const computeViolations = result.qualityGates!.violations.filter(
      v => v.gate === 'compute.invalid-apportionment',
    )
    expect(computeViolations).toHaveLength(0)
  })

  it('zero-income CA return passes quality gates', () => {
    const tr = makeTr({
      stateReturns: [makeConfig('CA')],
    })
    const result = computeAll(tr)
    expect(result.qualityGates).toBeDefined()
    expect(result.qualityGates!.passed).toBe(true)
  })

  it('high-income CA return passes quality gates', () => {
    const tr = makeTr({
      stateReturns: [makeConfig('CA')],
      w2s: [makeW2({
        id: 'w2-1',
        employerName: 'MegaCorp',
        box1: cents(500000),
        box2: cents(100000),
        box15State: 'CA',
        box16StateWages: cents(500000),
        box17StateIncomeTax: cents(50000),
      })],
    })
    const result = computeAll(tr)
    expect(result.qualityGates).toBeDefined()
    expect(result.qualityGates!.passed).toBe(true)
  })

  it('no stateReturns means no qualityGates field', () => {
    const tr = makeTr()
    const result = computeAll(tr)
    expect(result.qualityGates).toBeUndefined()
  })
})
