/**
 * Serialization helpers for ComputeResult.
 *
 * ComputeResult.values is a Map<string, TracedValue> which doesn't serialize
 * to JSON natively. These functions convert between Map and Record.
 */

import type { ComputeResult } from '../../src/rules/engine.ts'
import type { TracedValue } from '../../src/model/traced.ts'

export interface SerializedComputeResult {
  form1040: ComputeResult['form1040']
  scheduleB: ComputeResult['scheduleB']
  values: Record<string, TracedValue>
  executedSchedules: string[]
}

export function serializeComputeResult(result: ComputeResult): SerializedComputeResult {
  const values: Record<string, TracedValue> = {}
  for (const [key, val] of result.values) {
    values[key] = val
  }
  return {
    form1040: result.form1040,
    scheduleB: result.scheduleB,
    values,
    executedSchedules: result.executedSchedules,
  }
}

export function deserializeComputeResult(serialized: SerializedComputeResult): ComputeResult {
  const values = new Map<string, TracedValue>()
  for (const [key, val] of Object.entries(serialized.values)) {
    values.set(key, val)
  }
  return {
    form1040: serialized.form1040,
    scheduleB: serialized.scheduleB,
    values,
    executedSchedules: serialized.executedSchedules,
  }
}
