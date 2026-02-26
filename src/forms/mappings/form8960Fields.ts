/**
 * Form 8960 (Net Investment Income Tax) PDF field name mapping.
 *
 * Field names discovered from IRS f8960.pdf (2025) using pdf-lib enumeration.
 * 38 fields, 1 page.
 * Prefix: "topmostSubform[0].Page1[0]."
 */

const P1 = 'topmostSubform[0].Page1[0].'

// -- Header ---------------------------------------------------------------

export const F8960_HEADER = {
  name: `${P1}f1_1[0]`,
  ssn:  `${P1}f1_2[0]`,
}

// -- Filing type checkboxes -----------------------------------------------

export const F8960_CHECKBOXES = {
  individual:   `${P1}c1_1[0]`,   // Individual
  estateTrust:  `${P1}c1_2[0]`,   // Estate or trust
  other:        `${P1}c1_3[0]`,   // Other (specify)
}

// -- Part I -- Net Investment Income (Lines 1-8) --------------------------

export const F8960_PART1 = {
  line1:  `${P1}f1_3[0]`,    // Taxable interest
  line2:  `${P1}f1_4[0]`,    // Annuities (only non-excluded)
  line3:  `${P1}f1_5[0]`,    // Rental, royalty, partnership, S corp
  line4a: `${P1}f1_6[0]`,    // Net gain (loss) from capital assets
  line4b: `${P1}f1_7[0]`,    // Net gain (loss) adjustments
  line5a: `${P1}f1_8[0]`,    // Other modifications from NII
  line5b: `${P1}f1_9[0]`,    // Other modifications adjustments
  line6:  `${P1}f1_10[0]`,   // Adjustments to gain or loss
  line7:  `${P1}f1_11[0]`,   // Other modifications
  line8:  `${P1}f1_12[0]`,   // Total NII (sum of 1-7)
}

// -- Part II -- Modified Adjusted Gross Income (Lines 9a-9d) ---------------

export const F8960_PART2 = {
  line9a: `${P1}f1_13[0]`,   // MAGI
  line9b: `${P1}f1_14[0]`,   // Threshold ($200K single, $250K MFJ, etc.)
  line9c: `${P1}f1_15[0]`,   // MAGI excess (line 9a - line 9b)
  line9d: `${P1}f1_16[0]`,   // Smaller of line 8 or line 9c
}

// -- Part III -- Tax Computation (Line 10) --------------------------------

export const F8960_PART3 = {
  line10: `${P1}f1_17[0]`,   // NIIT (3.8% of line 9d)
  line11: `${P1}f1_18[0]`,   // Estimated tax payments / withholding (estates)
}
