/**
 * State Form Compiler Registry — Maps state codes to their form compilers
 */

import type { SupportedStateCode } from '../model/types'
import type { StateFormCompiler } from './stateCompiler'
import { caFormCompiler } from './fillers/form540Filler'
import { ctFormCompiler } from './fillers/formCT1040Filler'
import { dcFormCompiler } from './fillers/formD40Filler'
import { gaFormCompiler } from './fillers/form500Filler'
import { maFormCompiler } from './fillers/form1Filler'
import { mdFormCompiler } from './fillers/form502Filler'
import { mnFormCompiler } from './fillers/m1Filler'
import { ncFormCompiler } from './fillers/formD400Filler'
import { njFormCompiler } from './fillers/nj1040Filler'
import { nyFormCompiler } from './fillers/formIT201Filler'
import { ohFormCompiler } from './fillers/formIT1040OHFiller'
import { paFormCompiler } from './fillers/formPA40Filler'
import { vaFormCompiler } from './fillers/form760Filler'

const STATE_COMPILERS: Map<SupportedStateCode, StateFormCompiler> = new Map([
  ['CA', caFormCompiler],
  ['CT', ctFormCompiler],
  ['DC', dcFormCompiler],
  ['GA', gaFormCompiler],
  ['MA', maFormCompiler],
  ['MD', mdFormCompiler],
  ['MN', mnFormCompiler],
  ['NC', ncFormCompiler],
  ['NJ', njFormCompiler],
  ['NY', nyFormCompiler],
  ['OH', ohFormCompiler],
  ['PA', paFormCompiler],
  ['VA', vaFormCompiler],
])

export function getStateFormCompiler(code: SupportedStateCode): StateFormCompiler | undefined {
  return STATE_COMPILERS.get(code)
}

export function getAllStateFormCompilers(): Map<SupportedStateCode, StateFormCompiler> {
  return STATE_COMPILERS
}
