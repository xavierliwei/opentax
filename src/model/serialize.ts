/**
 * Shared Map ↔ Record conversion for ComputeResult.values.
 *
 * Used by both the plugin HTTP API and the dashboard client.
 */

import type { ComputeResult } from '../rules/engine.ts'
import type { TracedValue } from './traced.ts'

export interface SerializedComputeResult {
  form1040: ComputeResult['form1040']
  scheduleB: ComputeResult['scheduleB']
  form540: ComputeResult['form540']
  stateResults: ComputeResult['stateResults']
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
    form540: result.form540,
    stateResults: result.stateResults,
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
    form540: serialized.form540 ?? null,
    stateResults: serialized.stateResults ?? [],
    values,
    executedSchedules: serialized.executedSchedules,
  }
}
