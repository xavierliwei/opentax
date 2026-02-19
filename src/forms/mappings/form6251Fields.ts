/**
 * Form 6251 (Alternative Minimum Tax) PDF field name mapping.
 *
 * Field names discovered from IRS f6251.pdf (2025) using pdf-lib enumeration.
 * 62 fields, 2 pages.
 * Page 1 prefix: "topmostSubform[0].Page1[0]."
 * Page 2 prefix: "topmostSubform[0].Page2[0]."
 */

const P1 = 'topmostSubform[0].Page1[0].'
const P2 = 'topmostSubform[0].Page2[0].'

// ── Header ────────────────────────────────────────────────────

export const F6251_HEADER = {
  name: `${P1}f1_1[0]`,
  ssn:  `${P1}f1_2[0]`,
}

// ── Part I — Alternative Minimum Taxable Income (AMTI) ───────

export const F6251_PART1 = {
  line1:  `${P1}f1_3[0]`,   // Taxable income from Form 1040, line 15
  line2a: `${P1}f1_4[0]`,   // Taxes (Schedule A line 7, SALT add-back)
  line2b: `${P1}f1_5[0]`,   // Tax refund (Schedule 1, line 1)
  line2c: `${P1}f1_6[0]`,   // Investment interest expense
  line2d: `${P1}f1_7[0]`,   // Depletion
  line2e: `${P1}f1_8[0]`,   // Net operating loss deduction
  line2f: `${P1}f1_9[0]`,   // Alternative tax net operating loss deduction
  line2g: `${P1}f1_10[0]`,  // Interest from specified private activity bonds
  line2h: `${P1}f1_11[0]`,  // Qualified small business stock exclusion
  line2i: `${P1}f1_12[0]`,  // Exercise of incentive stock options (ISO spread)
  line2j: `${P1}f1_13[0]`,  // Estates and trusts (from Schedule K-1)
  line2k: `${P1}f1_14[0]`,  // Disposition of property
  line2l: `${P1}f1_15[0]`,  // Depreciation on assets
  line2m: `${P1}f1_16[0]`,  // Tax-shelter farm activities
  line2n: `${P1}f1_17[0]`,  // Passive activities
  line2o: `${P1}f1_18[0]`,  // Beneficiaries of estates and trusts
  line2p: `${P1}f1_19[0]`,  // Large partnerships
  line2q: `${P1}f1_20[0]`,  // Foreign tax credit adjustment
  line2r: `${P1}f1_21[0]`,  // Tax-exempt interest from private activity bonds
  line2s: `${P1}f1_22[0]`,  // Other adjustments
  line3:  `${P1}f1_23[0]`,  // Other adjustments (catch-all)
  line4:  `${P1}f1_24[0]`,  // Alternative minimum taxable income (AMTI)
}

// ── Part II — AMT Exemption and Computation ──────────────────

export const F6251_PART2 = {
  line5:  `${P1}f1_25[0]`,  // Exemption amount (from table)
  line6:  `${P1}f1_26[0]`,  // Subtract line 5 from line 4 (if zero or less, enter 0)
  line7:  `${P1}f1_27[0]`,  // Enter: $1,252,700 (MFJ), $626,350 (other)
  line8:  `${P1}f1_28[0]`,  // Phase-out reduction (25% of excess)
  line9:  `${P1}f1_29[0]`,  // Reduced exemption (line 5 - line 8, min 0)
  line10: `${P1}f1_30[0]`,  // AMTI after exemption (line 4 - line 9)
  line11: `${P1}f1_31[0]`,  // If line 10 ≤ $249,300 (MFJ), multiply by 26%
}

// ── Part III — Tax Computation ───────────────────────────────

export const F6251_PART3 = {
  // Page 1 bottom
  line12: `${P1}f1_32[0]`,  // If more than threshold, compute 28% bracket
  line13: `${P1}f1_33[0]`,  // Tentative minimum tax (from worksheet)
  // Page 2 — detailed computation for capital gains
  line14: `${P2}f2_1[0]`,
  line15: `${P2}f2_2[0]`,
  line16: `${P2}f2_3[0]`,
  line17: `${P2}f2_4[0]`,
  line18: `${P2}f2_5[0]`,
  line19: `${P2}f2_6[0]`,
  line20: `${P2}f2_7[0]`,
  line21: `${P2}f2_8[0]`,
  line22: `${P2}f2_9[0]`,
  line23: `${P2}f2_10[0]`,
  line24: `${P2}f2_11[0]`,
  line25: `${P2}f2_12[0]`,
  line26: `${P2}f2_13[0]`,
  line27: `${P2}f2_14[0]`,
  line28: `${P2}f2_15[0]`,
  line29: `${P2}f2_16[0]`,
  line30: `${P2}f2_17[0]`,
  line31: `${P2}f2_18[0]`,
  line32: `${P2}f2_19[0]`,
  line33: `${P2}f2_20[0]`,
  line34: `${P2}f2_21[0]`,
  // Final summary lines
  line35: `${P2}f2_22[0]`,
  line36: `${P2}f2_23[0]`,
  line37: `${P2}f2_24[0]`,
  line38: `${P2}f2_25[0]`,
  line39: `${P2}f2_26[0]`,  // Tentative minimum tax
  line40: `${P2}f2_27[0]`,  // Regular tax
  line41: `${P2}f2_28[0]`,  // TMT minus regular tax
  line42: `${P2}f2_29[0]`,  // AMT → Schedule 2, Part I, Line 1
}
