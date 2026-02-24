/**
 * State Form Compiler Registry — Maps state codes to their form compilers
 */

import type { SupportedStateCode } from '../model/types'
import type { StateFormCompiler } from './stateCompiler'
import { caFormCompiler } from './fillers/form540Filler'
import { gaFormCompiler } from './fillers/form500Filler'
import { maFormCompiler } from './fillers/form1Filler'
import { mdFormCompiler } from './fillers/form502Filler'
import { njFormCompiler } from './fillers/nj1040Filler'
import { vaFormCompiler } from './fillers/form760Filler'

const STATE_COMPILERS: Map<SupportedStateCode, StateFormCompiler> = new Map([
  ['CA', caFormCompiler],
  ['GA', gaFormCompiler],
  ['MA', maFormCompiler],
  ['MD', mdFormCompiler],
  ['NJ', njFormCompiler],
  ['VA', vaFormCompiler],
])

export function getStateFormCompiler(code: SupportedStateCode): StateFormCompiler | undefined {
  return STATE_COMPILERS.get(code)
}

export function getAllStateFormCompilers(): Map<SupportedStateCode, StateFormCompiler> {
  return STATE_COMPILERS
}
