/**
 * Residential Energy Credits (Form 5695)
 *
 * Part I  — Residential Clean Energy Credit (§25D): 30%, no annual cap
 * Part II — Energy Efficient Home Improvement Credit (§25C): 30%, capped
 *
 * Source: IRC §25C, §25D as amended by Inflation Reduction Act (2022)
 */

import type { EnergyCredits } from '../../model/types'
import {
  ENERGY_CLEAN_RATE,
  ENERGY_IMPROVEMENT_RATE,
  ENERGY_IMPROVEMENT_ANNUAL_CAP,
  ENERGY_HEAT_PUMP_CAP,
  ENERGY_WINDOWS_CAP,
  ENERGY_DOORS_CAP,
  ENERGY_AUDIT_CAP,
} from './constants'

// ── Result type ──────────────────────────────────────────────────

export interface EnergyCreditResult {
  partIBasis: number          // cents — qualified clean energy costs
  partICredit: number         // cents — 30% of partIBasis
  partIIHeatPumpCredit: number  // cents — min(30% cost, $2,000)
  partIIGeneralCredit: number   // cents — min(30% of capped costs, $1,200)
  partIICredit: number        // cents — heat pump + general
  totalCredit: number         // cents
}

// ── Main computation ─────────────────────────────────────────────

/**
 * Compute Residential Energy Credits (Form 5695).
 *
 * @param energy - User-entered energy improvement costs (all in cents)
 */
export function computeEnergyCredit(energy: EnergyCredits): EnergyCreditResult {
  // ── Part I: Residential Clean Energy (§25D) ──────────────
  const partIBasis =
    energy.solarElectric +
    energy.solarWaterHeating +
    energy.batteryStorage +
    energy.geothermal

  const partICredit = Math.round(partIBasis * ENERGY_CLEAN_RATE)

  // ── Part II: Energy Efficient Home Improvement (§25C) ────

  // Heat pump: separate $2,000 cap
  const heatPumpCreditRaw = Math.round(energy.heatPump * ENERGY_IMPROVEMENT_RATE)
  const partIIHeatPumpCredit = Math.min(heatPumpCreditRaw, ENERGY_HEAT_PUMP_CAP)

  // Apply sub-caps to costs before computing 30%
  const windowsCapped = Math.min(energy.windows, ENERGY_WINDOWS_CAP)
  const doorsCapped = Math.min(energy.exteriorDoors, ENERGY_DOORS_CAP)
  const auditCapped = Math.min(energy.homeEnergyAudit, ENERGY_AUDIT_CAP)

  // General items: insulation, sub-capped windows/doors, centralAC, waterHeater, audit, biomass
  const generalBasis =
    energy.insulation +
    windowsCapped +
    doorsCapped +
    energy.centralAC +
    energy.waterHeater +
    auditCapped +
    energy.biomassStove

  const generalCreditRaw = Math.round(generalBasis * ENERGY_IMPROVEMENT_RATE)
  const partIIGeneralCredit = Math.min(generalCreditRaw, ENERGY_IMPROVEMENT_ANNUAL_CAP)

  const partIICredit = partIIHeatPumpCredit + partIIGeneralCredit
  const totalCredit = partICredit + partIICredit

  return {
    partIBasis,
    partICredit,
    partIIHeatPumpCredit,
    partIIGeneralCredit,
    partIICredit,
    totalCredit,
  }
}
