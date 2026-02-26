/**
 * State Module Registry — Maps state codes to their StateRulesModule implementations
 */

import type { SupportedStateCode } from '../model/types'
import type { StateRulesModule } from './stateEngine'
import { azModule } from './2025/az/module'
import { caModule } from './2025/ca/module'
import { coModule } from './2025/co/module'
import { ctModule } from './2025/ct/module'
import { dcModule } from './2025/dc/module'
import { gaModule } from './2025/ga/module'
import { ilModule } from './2025/il/module'
import { inModule } from './2025/in/module'
import { maModule } from './2025/ma/module'
import { mdModule } from './2025/md/module'
import { miModule } from './2025/mi/module'
import { ncModule } from './2025/nc/module'
import { njModule } from './2025/nj/module'
import { ohModule } from './2025/oh/module'
import { paModule } from './2025/pa/module'
import { nyModule } from './2025/ny/module'
import { vaModule } from './2025/va/module'

const STATE_MODULES: Map<SupportedStateCode, StateRulesModule> = new Map([
  ['AZ', azModule],
  ['CA', caModule],
  ['CO', coModule],
  ['CT', ctModule],
  ['DC', dcModule],
  ['GA', gaModule],
  ['IL', ilModule],
  ['IN', inModule],
  ['MA', maModule],
  ['MD', mdModule],
  ['MI', miModule],
  ['NC', ncModule],
  ['NJ', njModule],
  ['NY', nyModule],
  ['OH', ohModule],
  ['PA', paModule],
  ['VA', vaModule],
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
