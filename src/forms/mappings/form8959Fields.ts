/**
 * Form 8959 (Additional Medicare Tax) PDF field name mapping.
 *
 * Field names discovered from IRS f8959.pdf (2025) using pdf-lib enumeration.
 * 26 fields, 1 page.
 * Prefix: "topmostSubform[0].Page1[0]."
 */

const P1 = 'topmostSubform[0].Page1[0].'

// -- Header ---------------------------------------------------------------

export const F8959_HEADER = {
  name: `${P1}f1_1[0]`,
  ssn:  `${P1}f1_2[0]`,
}

// -- Part I -- Additional Medicare Tax on Medicare Wages (Lines 1-7) ------

export const F8959_PART1 = {
  line1: `${P1}f1_3[0]`,    // Medicare wages and tips (W-2 Box 5)
  line2: `${P1}f1_4[0]`,    // Unreported Medicare wages (Form 4137/8919)
  line3: `${P1}f1_5[0]`,    // Wages from railroad tier 1
  line4: `${P1}f1_6[0]`,    // Total Medicare wages (add 1-3)
  line5: `${P1}f1_7[0]`,    // Filing status threshold
  line6: `${P1}f1_8[0]`,    // Excess above threshold
  line7: `${P1}f1_9[0]`,    // Additional Medicare Tax on wages (0.9%)
}

// -- Part II -- Additional Medicare Tax on Self-Employment (Lines 8-12) ---

export const F8959_PART2 = {
  line8:  `${P1}f1_10[0]`,   // Self-employment income (Schedule SE)
  line9:  `${P1}f1_11[0]`,   // Threshold reduction (threshold - line 4, but >= 0)
  line10: `${P1}f1_12[0]`,   // Remaining threshold
  line11: `${P1}f1_13[0]`,   // Excess SE income
  line12: `${P1}f1_14[0]`,   // Additional Medicare Tax on SE (0.9%)
}

// -- Part III -- Additional Medicare Tax on Railroad (Lines 13-18) --------

export const F8959_PART3 = {
  line13: `${P1}f1_15[0]`,   // RR tier 1 compensation
  line14: `${P1}f1_16[0]`,   // Threshold reduction
  line15: `${P1}f1_17[0]`,   // Remaining threshold
  line16: `${P1}f1_18[0]`,   // Excess RR compensation
  line17: `${P1}f1_19[0]`,   // Additional Medicare Tax on RR
  line18: `${P1}f1_20[0]`,   // Total additional Medicare Tax (sum 7+12+17)
}

// -- Part IV -- Withholding Reconciliation (Lines 19-24) ------------------

export const F8959_PART4 = {
  line19: `${P1}f1_21[0]`,   // Medicare tax withheld (W-2 Box 6)
  line20: `${P1}f1_22[0]`,   // Regular Medicare tax (1.45% * Medicare wages)
  line21: `${P1}f1_23[0]`,   // Line 19 - line 20 (excess withholding)
  line22: `${P1}f1_24[0]`,   // Total excess withholding
  line23: `${P1}f1_25[0]`,   // Total additional Medicare tax withheld
  line24: `${P1}f1_26[0]`,   // Additional Medicare Tax withholding credit
}
