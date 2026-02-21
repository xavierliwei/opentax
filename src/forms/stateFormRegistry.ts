/**
 * State Form Compiler Registry — Maps state codes to their form compilers
 */

import type { SupportedStateCode } from '../model/types'
import type { StateFormCompiler } from './stateCompiler'
import { caFormCompiler } from './fillers/form540Filler'

const STATE_COMPILERS: Map<SupportedStateCode, StateFormCompiler> = new Map([
  ['CA', caFormCompiler],
])

export function getStateFormCompiler(code: SupportedStateCode): StateFormCompiler | undefined {
  return STATE_COMPILERS.get(code)
}

export function getAllStateFormCompilers(): Map<SupportedStateCode, StateFormCompiler> {
  return STATE_COMPILERS
}
