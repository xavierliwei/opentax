/**
 * Form 5695 (Residential Energy Credits) PDF field name mapping.
 *
 * Field names discovered from IRS f5695.pdf (2025) using pdf-lib enumeration.
 * 167 fields, 4 pages.
 * Page 1 prefix: "topmostSubform[0].Page1[0]."
 */

const P1 = 'topmostSubform[0].Page1[0].'

// -- Header ---------------------------------------------------------------

export const F5695_HEADER = {
  name: `${P1}f1_01[0]`,
  ssn:  `${P1}f1_02[0]`,
}

// -- Part I -- Residential Clean Energy Credit (Lines 1-15) ---------------

export const F5695_PART1 = {
  line1:  `${P1}f1_03[0]`,   // Qualified solar electric property costs
  line2:  `${P1}f1_04[0]`,   // Qualified solar water heating costs
  line3:  `${P1}f1_05[0]`,   // Qualified fuel cell property costs
  line4:  `${P1}f1_06[0]`,   // Qualified small wind energy property costs
  line5:  `${P1}f1_07[0]`,   // Qualified geothermal heat pump costs
  line6:  `${P1}f1_08[0]`,   // Qualified battery storage technology costs
  line7:  `${P1}f1_09[0]`,   // Add lines 1-6
  line8:  `${P1}f1_10[0]`,   // Multiply line 7 by 30% (.30)
  line9:  `${P1}f1_11[0]`,   // Fuel cell credit limit (if applicable)
  line10: `${P1}f1_12[0]`,   // Credit carryforward from prior year
  line11: `${P1}f1_13[0]`,   // Add lines 8-10
  line12: `${P1}f1_14[0]`,   // Tax limitation
  line13: `${P1}f1_15[0]`,   // Smaller of line 11 or line 12
  line14: `${P1}f1_16[0]`,   // Credit carryforward to next year
  line15: `${P1}f1_17[0]`,   // Residential clean energy credit
}

// -- Part II -- Energy Efficient Home Improvement Credit (Lines 16-22) ----

export const F5695_PART2 = {
  line16a: `${P1}f1_20[0]`,  // Insulation or air sealing material
  line16b: `${P1}f1_21[0]`,  // Exterior doors ($250 each, $500 max)
  line16c: `${P1}f1_22[0]`,  // Exterior windows and skylights ($600 max)
  line16d: `${P1}f1_23[0]`,  // Central AC
  line16e: `${P1}f1_24[0]`,  // Natural gas/propane/oil water heater
  line16f: `${P1}f1_25[0]`,  // Natural gas/propane/oil furnace or hot water boiler
  line17:  `${P1}f1_26[0]`,  // Add lines 16a-16f
  line18:  `${P1}f1_27[0]`,  // Maximum general credit amount ($1,200)
  line19:  `${P1}f1_28[0]`,  // Multiply line 17 by 30% (.30), max $1,200
  line20:  `${P1}f1_29[0]`,  // Heat pump / biomass stove costs
  line21:  `${P1}f1_30[0]`,  // Multiply line 20 by 30%, max $2,000
  line22:  `${P1}f1_31[0]`,  // Home energy audit costs ($150 max)
}
