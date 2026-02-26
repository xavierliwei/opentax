/**
 * Form 5695 (Residential Energy Credits) PDF filler.
 *
 * Part I: Residential Clean Energy Credit (§25D) — 30%, no annual cap
 * Part II: Energy Efficient Home Improvement Credit (§25C) — 30%, capped
 */

import { PDFDocument } from 'pdf-lib'
import type { TaxReturn } from '../../model/types'
import type { EnergyCreditResult } from '../../rules/2025/energyCredit'
import { F5695_HEADER, F5695_PART1, F5695_PART2 } from '../mappings/form5695Fields'
import { setTextField, setDollarField, formatSSN } from '../helpers'

export async function fillForm5695(
  templateBytes: Uint8Array,
  taxReturn: TaxReturn,
  result: EnergyCreditResult,
  options: { flatten?: boolean } = {},
): Promise<PDFDocument> {
  const { flatten = true } = options
  const pdfDoc = await PDFDocument.load(templateBytes, { ignoreEncryption: true })
  const form = pdfDoc.getForm()
  try { form.deleteXFA() } catch { /* ok */ }

  const energy = taxReturn.energyCredits

  // Header
  setTextField(form, F5695_HEADER.name, `${taxReturn.taxpayer.firstName} ${taxReturn.taxpayer.lastName}`)
  setTextField(form, F5695_HEADER.ssn, formatSSN(taxReturn.taxpayer.ssn))

  // Part I — Residential Clean Energy Credit
  if (energy) {
    setDollarField(form, F5695_PART1.line1, energy.solarElectric)
    setDollarField(form, F5695_PART1.line2, energy.solarWaterHeating)
    // line3 = fuel cell (not in our model — skip)
    // line4 = small wind (not in our model — skip)
    setDollarField(form, F5695_PART1.line5, energy.geothermal)
    setDollarField(form, F5695_PART1.line6, energy.batteryStorage)
  }

  // Line 7: Total clean energy costs (Part I basis)
  setDollarField(form, F5695_PART1.line7, result.partIBasis)

  // Line 8: 30% of line 7
  setDollarField(form, F5695_PART1.line8, result.partICredit)

  // Line 13/15: Part I credit (= line 8 for most filers without carryforwards)
  setDollarField(form, F5695_PART1.line13, result.partICredit)
  setDollarField(form, F5695_PART1.line15, result.partICredit)

  // Part II — Energy Efficient Home Improvement Credit
  if (energy) {
    setDollarField(form, F5695_PART2.line16a, energy.insulation)
    setDollarField(form, F5695_PART2.line16b, energy.exteriorDoors)
    setDollarField(form, F5695_PART2.line16c, energy.windows)
    setDollarField(form, F5695_PART2.line16d, energy.centralAC)
    setDollarField(form, F5695_PART2.line16e, energy.waterHeater)
    // line16f = furnace/boiler (not in our model — skip)

    // Line 17: Sum of general improvement costs
    const generalCosts = energy.insulation + energy.exteriorDoors +
      energy.windows + energy.centralAC + energy.waterHeater + energy.biomassStove
    setDollarField(form, F5695_PART2.line17, generalCosts)
  }

  // Line 19: General improvement credit (30%, max $1,200)
  setDollarField(form, F5695_PART2.line19, result.partIIGeneralCredit)

  // Line 20: Heat pump / biomass costs
  if (energy) {
    setDollarField(form, F5695_PART2.line20, energy.heatPump + energy.biomassStove)
  }

  // Line 21: Heat pump credit (30%, max $2,000)
  setDollarField(form, F5695_PART2.line21, result.partIIHeatPumpCredit)

  // Line 22: Home energy audit costs ($150 max)
  if (energy) {
    setDollarField(form, F5695_PART2.line22, Math.min(energy.homeEnergyAudit, 15000))
  }

  if (flatten) form.flatten()
  return pdfDoc
}
