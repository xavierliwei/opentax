/**
 * State Module Registry — Maps state codes to their StateRulesModule implementations
 */

import type { SupportedStateCode } from '../model/types'
import type { StateRulesModule } from './stateEngine'
import { caModule } from './2025/ca/module'
import { gaModule } from './2025/ga/module'

const STATE_MODULES: Map<SupportedStateCode, StateRulesModule> = new Map([
  ['CA', caModule],
  ['GA', gaModule],
])

export function getStateModule(code: SupportedStateCode): StateRulesModule | undefined {
  return STATE_MODULES.get(code)
}

export function getSupportedStates(): { code: SupportedStateCode; label: string; stateName: string }[] {
  return [...STATE_MODULES.entries()].map(([code, mod]) => ({
    code,
    label: mod.formLabel,
    stateName: mod.stateName,
  }))
}

export function getAllStateNodeLabels(): Record<string, string> {
  const labels: Record<string, string> = {}
  for (const mod of STATE_MODULES.values()) {
    Object.assign(labels, mod.nodeLabels)
  }
  return labels
}
