/**
 * State Form Compiler Registry — Maps state codes to their form compilers
 */

import type { SupportedStateCode } from '../model/types'
import type { StateFormCompiler } from './stateCompiler'
import { azFormCompiler } from './fillers/az140Filler'
import { caFormCompiler } from './fillers/form540Filler'
import { coFormCompiler } from './fillers/dr0104Filler'
import { ctFormCompiler } from './fillers/formCT1040Filler'
import { dcFormCompiler } from './fillers/formD40Filler'
import { gaFormCompiler } from './fillers/form500Filler'
import { iaFormCompiler } from './fillers/ia1040Filler'
import { ilFormCompiler } from './fillers/il1040Filler'
import { inFormCompiler } from './fillers/inIT40Filler'
import { kyFormCompiler } from './fillers/form740Filler'
import { laFormCompiler } from './fillers/laIT540Filler'
import { maFormCompiler } from './fillers/form1Filler'
import { mdFormCompiler } from './fillers/form502Filler'
import { miFormCompiler } from './fillers/mi1040Filler'
import { mnFormCompiler } from './fillers/m1Filler'
import { moFormCompiler } from './fillers/mo1040Filler'
import { ncFormCompiler } from './fillers/formD400Filler'
import { njFormCompiler } from './fillers/nj1040Filler'
import { nyFormCompiler } from './fillers/formIT201Filler'
import { ohFormCompiler } from './fillers/formIT1040OHFiller'
import { orFormCompiler } from './fillers/or40Filler'
import { paFormCompiler } from './fillers/formPA40Filler'
import { scFormCompiler } from './fillers/sc1040Filler'
import { utFormCompiler } from './fillers/tc40Filler'
import { vaFormCompiler } from './fillers/form760Filler'
import { wiFormCompiler } from './fillers/wiForm1Filler'

const STATE_COMPILERS: Map<SupportedStateCode, StateFormCompiler> = new Map([
  ['AZ', azFormCompiler],
  ['CA', caFormCompiler],
  ['CO', coFormCompiler],
  ['CT', ctFormCompiler],
  ['DC', dcFormCompiler],
  ['GA', gaFormCompiler],
  ['IA', iaFormCompiler],
  ['IL', ilFormCompiler],
  ['IN', inFormCompiler],
  ['KY', kyFormCompiler],
  ['LA', laFormCompiler],
  ['MA', maFormCompiler],
  ['MD', mdFormCompiler],
  ['MI', miFormCompiler],
  ['MN', mnFormCompiler],
  ['MO', moFormCompiler],
  ['NC', ncFormCompiler],
  ['NJ', njFormCompiler],
  ['NY', nyFormCompiler],
  ['OH', ohFormCompiler],
  ['OR', orFormCompiler],
  ['PA', paFormCompiler],
  ['SC', scFormCompiler],
  ['UT', utFormCompiler],
  ['VA', vaFormCompiler],
  ['WI', wiFormCompiler],
])

export function getStateFormCompiler(code: SupportedStateCode): StateFormCompiler | undefined {
  return STATE_COMPILERS.get(code)
}

export function getAllStateFormCompilers(): Map<SupportedStateCode, StateFormCompiler> {
  return STATE_COMPILERS
}
