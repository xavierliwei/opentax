/**
 * Quality Gates — Validation framework for cross-state registry & compiler
 *
 * Enforces invariants at three levels:
 *   1. Registry gates:   Every rules module ↔ form compiler pairing is complete
 *   2. Computation gates: StateComputeResult satisfies numeric/structural invariants
 *   3. Cross-state gates: Multi-state returns are internally consistent
 *
 * Gate violations are collected (not thrown) so callers can surface all issues
 * at once rather than failing on the first one.
 */

import type { SupportedStateCode, TaxReturn, StateReturnConfig } from '../model/types'
import type { StateComputeResult, StateRulesModule } from './stateEngine'
import type { StateFormCompiler } from '../forms/stateCompiler'
import type { StateCompiledForms } from '../forms/stateCompiler'

// ── Types ────────────────────────────────────────────────────────

export type GateSeverity = 'error' | 'warning'

export type GateCategory =
  | 'registry'
  | 'computation'
  | 'cross-state'
  | 'compiler'

export interface GateViolation {
  gate: string
  category: GateCategory
  severity: GateSeverity
  message: string
  stateCode?: SupportedStateCode
}

export interface GateResult {
  passed: boolean
  violations: GateViolation[]
}

// ── Registry gates ───────────────────────────────────────────────

/**
 * Validate that every rules module has a matching form compiler and vice versa.
 */
export function validateRegistryConsistency(
  modules: Map<SupportedStateCode, StateRulesModule>,
  compilers: Map<SupportedStateCode, StateFormCompiler>,
): GateResult {
  const violations: GateViolation[] = []

  // Every rules module must have a form compiler
  for (const [code, mod] of modules) {
    if (!compilers.has(code)) {
      violations.push({
        gate: 'registry.module-without-compiler',
        category: 'registry',
        severity: 'error',
        message: `State module "${mod.stateName}" (${code}) has no registered form compiler`,
        stateCode: code,
      })
    }
  }

  // Every form compiler must have a rules module
  for (const [code] of compilers) {
    if (!modules.has(code)) {
      violations.push({
        gate: 'registry.compiler-without-module',
        category: 'registry',
        severity: 'error',
        message: `Form compiler for ${code} has no registered rules module`,
        stateCode: code,
      })
    }
  }

  // Validate module interface completeness
  for (const [code, mod] of modules) {
    if (!mod.stateCode) {
      violations.push({
        gate: 'registry.missing-state-code',
        category: 'registry',
        severity: 'error',
        message: `State module for ${code} is missing stateCode`,
        stateCode: code,
      })
    }
    if (mod.stateCode !== code) {
      violations.push({
        gate: 'registry.state-code-mismatch',
        category: 'registry',
        severity: 'error',
        message: `State module registered as ${code} declares stateCode="${mod.stateCode}"`,
        stateCode: code,
      })
    }
    if (!mod.stateName) {
      violations.push({
        gate: 'registry.missing-state-name',
        category: 'registry',
        severity: 'error',
        message: `State module for ${code} is missing stateName`,
        stateCode: code,
      })
    }
    if (!mod.formLabel) {
      violations.push({
        gate: 'registry.missing-form-label',
        category: 'registry',
        severity: 'error',
        message: `State module for ${code} is missing formLabel`,
        stateCode: code,
      })
    }
    if (!mod.reviewLayout || mod.reviewLayout.length === 0) {
      violations.push({
        gate: 'registry.empty-review-layout',
        category: 'registry',
        severity: 'warning',
        message: `State module for ${code} has no review layout sections`,
        stateCode: code,
      })
    }
    if (!mod.reviewResultLines || mod.reviewResultLines.length === 0) {
      violations.push({
        gate: 'registry.empty-review-result-lines',
        category: 'registry',
        severity: 'warning',
        message: `State module for ${code} has no review result lines`,
        stateCode: code,
      })
    }
  }

  // Validate compiler interface completeness
  for (const [code, compiler] of compilers) {
    if (compiler.stateCode !== code) {
      violations.push({
        gate: 'registry.compiler-code-mismatch',
        category: 'registry',
        severity: 'error',
        message: `Form compiler registered as ${code} declares stateCode="${compiler.stateCode}"`,
        stateCode: code,
      })
    }
  }

  return { passed: violations.filter(v => v.severity === 'error').length === 0, violations }
}

// ── Computation gates ────────────────────────────────────────────

/**
 * Validate a single state's compute result against numeric invariants.
 */
export function validateComputeResult(
  result: StateComputeResult,
  config: StateReturnConfig,
): GateResult {
  const violations: GateViolation[] = []
  const code = result.stateCode

  // State code must match config
  if (result.stateCode !== config.stateCode) {
    violations.push({
      gate: 'compute.state-code-mismatch',
      category: 'computation',
      severity: 'error',
      message: `Compute result stateCode="${result.stateCode}" does not match config stateCode="${config.stateCode}"`,
      stateCode: code,
    })
  }

  // Residency type must match config
  if (result.residencyType !== config.residencyType) {
    violations.push({
      gate: 'compute.residency-mismatch',
      category: 'computation',
      severity: 'error',
      message: `Compute result residencyType="${result.residencyType}" does not match config residencyType="${config.residencyType}"`,
      stateCode: code,
    })
  }

  // Non-negative constraints (all values in cents)
  if (result.stateTaxableIncome < 0) {
    violations.push({
      gate: 'compute.negative-taxable-income',
      category: 'computation',
      severity: 'error',
      message: `${code}: stateTaxableIncome is negative (${result.stateTaxableIncome})`,
      stateCode: code,
    })
  }

  if (result.stateTax < 0) {
    violations.push({
      gate: 'compute.negative-state-tax',
      category: 'computation',
      severity: 'error',
      message: `${code}: stateTax is negative (${result.stateTax})`,
      stateCode: code,
    })
  }

  if (result.stateCredits < 0) {
    violations.push({
      gate: 'compute.negative-credits',
      category: 'computation',
      severity: 'error',
      message: `${code}: stateCredits is negative (${result.stateCredits})`,
      stateCode: code,
    })
  }

  if (result.taxAfterCredits < 0) {
    violations.push({
      gate: 'compute.negative-tax-after-credits',
      category: 'computation',
      severity: 'error',
      message: `${code}: taxAfterCredits is negative (${result.taxAfterCredits})`,
      stateCode: code,
    })
  }

  if (result.stateWithholding < 0) {
    violations.push({
      gate: 'compute.negative-withholding',
      category: 'computation',
      severity: 'error',
      message: `${code}: stateWithholding is negative (${result.stateWithholding})`,
      stateCode: code,
    })
  }

  if (result.overpaid < 0) {
    violations.push({
      gate: 'compute.negative-overpaid',
      category: 'computation',
      severity: 'error',
      message: `${code}: overpaid is negative (${result.overpaid})`,
      stateCode: code,
    })
  }

  if (result.amountOwed < 0) {
    violations.push({
      gate: 'compute.negative-amount-owed',
      category: 'computation',
      severity: 'error',
      message: `${code}: amountOwed is negative (${result.amountOwed})`,
      stateCode: code,
    })
  }

  // Mutual exclusivity: overpaid and amountOwed cannot both be positive
  if (result.overpaid > 0 && result.amountOwed > 0) {
    violations.push({
      gate: 'compute.overpaid-and-owed',
      category: 'computation',
      severity: 'error',
      message: `${code}: both overpaid (${result.overpaid}) and amountOwed (${result.amountOwed}) are positive`,
      stateCode: code,
    })
  }

  // Balance equation: overpaid - amountOwed = withholding - taxAfterCredits
  const balance = result.stateWithholding - result.taxAfterCredits
  const reported = result.overpaid - result.amountOwed
  if (Math.abs(balance - reported) > 1) { // 1 cent tolerance for rounding
    violations.push({
      gate: 'compute.balance-mismatch',
      category: 'computation',
      severity: 'error',
      message: `${code}: balance mismatch — withholding(${result.stateWithholding}) - taxAfterCredits(${result.taxAfterCredits}) = ${balance}, but overpaid(${result.overpaid}) - amountOwed(${result.amountOwed}) = ${reported}`,
      stateCode: code,
    })
  }

  // Part-year / nonresident: apportionment ratio must be 0–1
  if (config.residencyType !== 'full-year') {
    if (result.apportionmentRatio === undefined) {
      violations.push({
        gate: 'compute.missing-apportionment',
        category: 'computation',
        severity: 'warning',
        message: `${code}: part-year/nonresident return has no apportionmentRatio`,
        stateCode: code,
      })
    } else if (result.apportionmentRatio < 0 || result.apportionmentRatio > 1) {
      violations.push({
        gate: 'compute.invalid-apportionment',
        category: 'computation',
        severity: 'error',
        message: `${code}: apportionmentRatio ${result.apportionmentRatio} is outside 0–1 range`,
        stateCode: code,
      })
    }
  }

  // Form label must be non-empty
  if (!result.formLabel) {
    violations.push({
      gate: 'compute.missing-form-label',
      category: 'computation',
      severity: 'error',
      message: `${code}: compute result has empty formLabel`,
      stateCode: code,
    })
  }

  return { passed: violations.filter(v => v.severity === 'error').length === 0, violations }
}

// ── Cross-state gates ────────────────────────────────────────────

/**
 * Validate cross-state consistency across all configured state returns.
 */
export function validateCrossStateConsistency(
  taxReturn: TaxReturn,
  stateResults: StateComputeResult[],
  federalAGI: number,
): GateResult {
  const violations: GateViolation[] = []

  // No duplicate state codes in config
  const configCodes = (taxReturn.stateReturns ?? []).map(c => c.stateCode)
  const uniqueCodes = new Set(configCodes)
  if (uniqueCodes.size !== configCodes.length) {
    const dupes = configCodes.filter((c, i) => configCodes.indexOf(c) !== i)
    violations.push({
      gate: 'cross-state.duplicate-state-codes',
      category: 'cross-state',
      severity: 'error',
      message: `Duplicate state codes in stateReturns: ${[...new Set(dupes)].join(', ')}`,
    })
  }

  // Every configured state must have a result
  for (const config of taxReturn.stateReturns ?? []) {
    const result = stateResults.find(r => r.stateCode === config.stateCode)
    if (!result) {
      violations.push({
        gate: 'cross-state.missing-result',
        category: 'cross-state',
        severity: 'error',
        message: `No compute result for configured state ${config.stateCode}`,
        stateCode: config.stateCode,
      })
    }
  }

  // Total state withholding should not exceed total W-2 state withholding
  const totalComputedWithholding = stateResults.reduce((s, r) => s + r.stateWithholding, 0)
  const totalW2StateWithholding = taxReturn.w2s.reduce((s, w) => s + (w.box17StateIncomeTax ?? 0), 0)
  if (totalComputedWithholding > totalW2StateWithholding + 1) { // 1 cent tolerance
    violations.push({
      gate: 'cross-state.withholding-exceeds-w2',
      category: 'cross-state',
      severity: 'warning',
      message: `Total state withholding (${totalComputedWithholding}) exceeds total W-2 state withholding (${totalW2StateWithholding})`,
    })
  }

  // Full-year resident state AGI should equal federal AGI (± state adjustments)
  // This is a soft check — large deviations are suspicious
  for (const result of stateResults) {
    if (result.residencyType === 'full-year' && federalAGI > 0) {
      const deviation = Math.abs(result.stateAGI - federalAGI) / federalAGI
      if (deviation > 0.5) {
        violations.push({
          gate: 'cross-state.agi-deviation',
          category: 'cross-state',
          severity: 'warning',
          message: `${result.stateCode}: stateAGI (${result.stateAGI}) deviates >50% from federal AGI (${federalAGI})`,
          stateCode: result.stateCode,
        })
      }
    }
  }

  return { passed: violations.filter(v => v.severity === 'error').length === 0, violations }
}

// ── Compiler output gates ────────────────────────────────────────

/**
 * Validate the output of a state form compiler.
 */
export function validateCompilerOutput(
  compiled: StateCompiledForms,
  stateCode: SupportedStateCode,
): GateResult {
  const violations: GateViolation[] = []

  // Must have at least one form
  if (!compiled.forms || compiled.forms.length === 0) {
    violations.push({
      gate: 'compiler.no-forms',
      category: 'compiler',
      severity: 'error',
      message: `${stateCode}: compiler produced no forms`,
      stateCode,
    })
  }

  // Each form must have a formId and sequenceNumber
  for (const form of compiled.forms ?? []) {
    if (!form.formId) {
      violations.push({
        gate: 'compiler.empty-form-id',
        category: 'compiler',
        severity: 'error',
        message: `${stateCode}: compiled form has empty formId`,
        stateCode,
      })
    }
    if (!form.sequenceNumber) {
      violations.push({
        gate: 'compiler.empty-sequence-number',
        category: 'compiler',
        severity: 'error',
        message: `${stateCode}: compiled form "${form.formId}" has empty sequenceNumber`,
        stateCode,
      })
    }
    if (form.pageCount < 1) {
      violations.push({
        gate: 'compiler.zero-page-count',
        category: 'compiler',
        severity: 'error',
        message: `${stateCode}: compiled form "${form.formId}" has ${form.pageCount} pages`,
        stateCode,
      })
    }
  }

  // PDF document must have at least one page
  if (compiled.doc && compiled.doc.getPageCount() < 1) {
    violations.push({
      gate: 'compiler.empty-pdf',
      category: 'compiler',
      severity: 'error',
      message: `${stateCode}: compiled PDF document has no pages`,
      stateCode,
    })
  }

  return { passed: violations.filter(v => v.severity === 'error').length === 0, violations }
}

// ── Aggregate runner ─────────────────────────────────────────────

/**
 * Run all quality gates and return a combined result.
 */
export function runAllGates(results: GateResult[]): GateResult {
  const violations = results.flatMap(r => r.violations)
  return {
    passed: violations.filter(v => v.severity === 'error').length === 0,
    violations,
  }
}
