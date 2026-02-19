/**
 * Form 8812 (Credits for Qualifying Children and Other Dependents) PDF field mapping.
 *
 * Field names discovered from IRS f8812.pdf (2025) using pdf-lib enumeration.
 * 36 fields, 2 pages. Uses p1-tN naming convention.
 * Page 1 prefix: "topmostSubform[0].Page1[0]."
 * Page 2 prefix: "topmostSubform[0].Page2[0]."
 *
 * The 2025 Form 8812 is a two-column worksheet.
 * Left-column fields often have x≈382–490, right-column x≈446–554.
 */

const P1 = 'topmostSubform[0].Page1[0].'

// ── Header ────────────────────────────────────────────────────

export const F8812_HEADER = {
  name: `${P1}p1-t1[0]`,
  ssn:  `${P1}p1-t4[0]`,
}

// ── Part I-A: Child Tax Credit and Credit for Other Dependents ─

export const F8812_PART1 = {
  line1:  `${P1}p1-t5[0]`,   // Number of qualifying children under age 17
  line2:  `${P1}p1-t6[0]`,   // Number of other dependents
  line3:  `${P1}p1-t7[0]`,   // $2,000 × line 1
  line4:  `${P1}p1-t8[0]`,   // $500 × line 2
  line5:  `${P1}p1-t9[0]`,   // Add lines 3 and 4 (initial credit)
  line6:  `${P1}p1-t10[0]`,  // Modified AGI (from Form 1040)
  line7:  `${P1}p1-t11[0]`,  // Threshold amount
  line8:  `${P1}p1-t12[0]`,  // Subtract line 7 from line 6
  line9:  `${P1}p1-t13[0]`,  // Divide line 8 by $1,000 (round up)
  line10: `${P1}p1-t14[0]`,  // $50 × line 9 (phase-out reduction)
  line11: `${P1}p1-t15[0]`,  // Subtract line 10 from line 5 (credit after phase-out)
  line12: `${P1}p1-t16[0]`,  // Tax liability
  line13: `${P1}p1-t17[0]`,  // Credits from other forms
  line14: `${P1}p1-t18[0]`,  // Net tax liability (line 12 - line 13)
  // Lines 15–18: CTC computation
  line15: `${P1}p1-t19[0]`,  // Smaller of line 11 or line 14
  line16: `${P1}p1-t20[0]`,  // Line 15 (for certain filers)
  line17: `${P1}p1-t21[0]`,  // CTC/ODC from worksheet
  line18: `${P1}p1-t22[0]`,  // Non-refundable credit → Form 1040 Line 19
  // Additional CTC computation
  line19: `${P1}p1-t23[0]`,  // Subtract line 18 from line 11
  line20: `${P1}p1-t24[0]`,  // Number of qualifying children × $1,700
  line21: `${P1}p1-t25[0]`,  // Smaller of line 19 or line 20
  line22: `${P1}p1-t26[0]`,  // Earned income
  line23: `${P1}p1-t27[0]`,  // $2,500
  line24: `${P1}p1-t28[0]`,  // Subtract line 23 from line 22
  line25: `${P1}p1-t29[0]`,  // Multiply line 24 by 15%
  line26: `${P1}p1-t30[0]`,  // Min of prior lines
  line27: `${P1}p1-t31[0]`,  // Additional CTC
  line28: `${P1}p1-t32[0]`,  // Additional CTC → Form 1040 Line 28
}
