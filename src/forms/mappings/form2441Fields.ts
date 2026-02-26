/**
 * Form 2441 (Child and Dependent Care Expenses) PDF field name mapping.
 *
 * Field names discovered from IRS f2441.pdf (2025) using pdf-lib enumeration.
 * 72 fields, 2 pages.
 * Page 1 prefix: "topmostSubform[0].Page1[0]."
 * Page 2 prefix: "topmostSubform[0].Page2[0]."
 */

const P1 = 'topmostSubform[0].Page1[0].'
const P2 = 'topmostSubform[0].Page2[0].'

// -- Header ---------------------------------------------------------------

export const F2441_HEADER = {
  name: `${P1}f1_1[0]`,
  ssn:  `${P1}f1_2[0]`,
}

// -- Part III -- Dependent Care Benefits (Lines 12-27 on Page 2) ----------
// We skip Part I (qualifying persons) and Part II (care providers).
// Part III lines 3-11 are on Page 1:

export const F2441_PART3 = {
  line3:  `${P1}f1_27[0]`,   // Total qualified expenses
  line4:  `${P1}f1_28[0]`,   // Earned income (you)
  line5:  `${P1}f1_29[0]`,   // Earned income (spouse)
  line6:  `${P1}f1_30[0]`,   // Smallest of lines 3, 4, or 5
  line7:  `${P1}f1_31[0]`,   // Expense limit ($3K or $6K)
  line8:  `${P1}f1_32[0]`,   // Smaller of line 6 or line 7
  line9:  `${P1}f1_33[0]`,   // Decimal rate (e.g., ".20")
  line10: `${P1}f1_34[0]`,   // Multiply line 8 by line 9 (credit)
  line11: `${P1}f1_35[0]`,   // Tax liability limit
}

// Page 2 lines (for dependent care benefits — not used in basic computation)
export const F2441_PAGE2 = {
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
}
