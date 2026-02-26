/**
 * Form 8880 (Credit for Qualified Retirement Savings Contributions) PDF field name mapping.
 *
 * Field names discovered from IRS f8880.pdf (2025) using pdf-lib enumeration.
 * 23 fields, 2 pages.
 * Page 1 prefix: "topmostSubform[0].Page1[0]."
 */

const P1 = 'topmostSubform[0].Page1[0].'

// -- Header ---------------------------------------------------------------

export const F8880_HEADER = {
  name: `${P1}f1_1[0]`,
  ssn:  `${P1}f1_2[0]`,
}

// -- Lines 1-6 (contribution detail, paired: you / spouse) ----------------

export const F8880_TABLE = {
  line1You:    `${P1}Table_Ln1[0].BodyRow1[0].f1_3[0]`,   // Traditional IRA — you
  line1Spouse: `${P1}Table_Ln1[0].BodyRow1[0].f1_4[0]`,   // Traditional IRA — spouse
  line2You:    `${P1}Table_Ln1[0].BodyRow2[0].f1_5[0]`,   // Roth IRA — you
  line2Spouse: `${P1}Table_Ln1[0].BodyRow2[0].f1_6[0]`,   // Roth IRA — spouse
  line3You:    `${P1}Table_Ln1[0].BodyRow3[0].f1_7[0]`,   // Elective deferrals — you
  line3Spouse: `${P1}Table_Ln1[0].BodyRow3[0].f1_8[0]`,   // Elective deferrals — spouse
  line4You:    `${P1}Table_Ln1[0].BodyRow4[0].f1_9[0]`,   // Total (lines 1-3) — you
  line4Spouse: `${P1}Table_Ln1[0].BodyRow4[0].f1_10[0]`,  // Total (lines 1-3) — spouse
  line5You:    `${P1}Table_Ln1[0].BodyRow5[0].f1_11[0]`,  // Distributions — you
  line5Spouse: `${P1}Table_Ln1[0].BodyRow5[0].f1_12[0]`,  // Distributions — spouse
  line6You:    `${P1}Table_Ln1[0].BodyRow6[0].f1_13[0]`,  // Net contributions — you
  line6Spouse: `${P1}Table_Ln1[0].BodyRow6[0].f1_14[0]`,  // Net contributions — spouse
}

// -- Lines 7-12 -----------------------------------------------------------

export const F8880_LINES = {
  line7:  `${P1}f1_15[0]`,   // Eligible contributions (smaller of line 6 or $2K/$4K)
  line8:  `${P1}f1_16[0]`,   // AGI
  line9:  `${P1}f1_17[0]`,   // Filing status amount
  line10: `${P1}f1_18[0]`,   // Credit rate (decimal, e.g., ".50")
  line11: `${P1}f1_19[0]`,   // Credit (line 7 * line 10)
  line12: `${P1}f1_20[0]`,   // Tax liability limit
}
