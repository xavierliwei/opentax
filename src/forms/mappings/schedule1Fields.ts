/**
 * Schedule 1 (Additional Income and Adjustments) PDF field name mapping.
 *
 * Field names discovered from IRS f1040s1.pdf (2025) using pdf-lib enumeration.
 * 73 fields, 2 pages.
 * Page 1 prefix: "topmostSubform[0].Page1[0]."
 * Page 2 prefix: "topmostSubform[0].Page2[0]."
 */

const P1 = 'topmostSubform[0].Page1[0].'
const P2 = 'topmostSubform[0].Page2[0].'

// ── Header ────────────────────────────────────────────────────

export const SCH1_HEADER = {
  name: `${P1}f1_01[0]`,
  ssn:  `${P1}f1_02[0]`,
}

// ── Part I — Additional Income (Lines 1–10) ──────────────────

export const SCH1_PART1 = {
  line1:  `${P1}f1_03[0]`,   // Taxable refunds
  line2a: `${P1}f1_04[0]`,   // Alimony received
  line3:  `${P1}f1_06[0]`,   // Business income (Schedule C)
  line4:  `${P1}f1_07[0]`,   // Other gains/losses (Form 4797)
  line5:  `${P1}f1_08[0]`,   // Rental real estate, royalties, etc. (Schedule E)
  line6:  `${P1}f1_09[0]`,   // Farm income (Schedule F)
  line7:  `${P1}f1_10[0]`,   // Unemployment compensation
  line8a: `${P1}Line8a_ReadOrder[0].f1_13[0]`,  // Net operating loss
  line8e: `${P1}f1_17[0]`,   // Income from Form 8853 or 8889
  line8j: `${P1}f1_22[0]`,   // Stock options
  line8zDesc: `${P1}Line8z_ReadOrder[0].f1_35[0]`,  // Line 8z description
  line8z: `${P1}f1_36[0]`,   // Line 8z amount (other income)
  line9:  `${P1}f1_37[0]`,   // Total other income (sum of 8a–8z)
  line10: `${P1}f1_38[0]`,   // Total additional income (Lines 1–7 + Line 9)
}

// ── Part II — Adjustments to Income (Lines 11–26) ────────────

export const SCH1_PART2 = {
  line11: `${P2}f2_01[0]`,   // Educator expenses
  line12: `${P2}f2_02[0]`,   // Certain business expenses of reservists
  line13: `${P2}f2_03[0]`,   // HSA deduction (Form 8889)
  line14: `${P2}f2_04[0]`,   // Moving expenses for Armed Forces
  line15: `${P2}f2_05[0]`,   // Deductible part of self-employment tax
  line16: `${P2}f2_06[0]`,   // Self-employed SEP, SIMPLE, and qualified plans
  line17: `${P2}f2_07[0]`,   // Self-employed health insurance deduction
  line18: `${P2}f2_08[0]`,   // Penalty on early withdrawal of savings
  line19a:`${P2}f2_09[0]`,   // Alimony paid
  line20: `${P2}f2_12[0]`,   // IRA deduction
  line21: `${P2}f2_13[0]`,   // Student loan interest deduction
  line25: `${P2}f2_29[0]`,   // Total other adjustments (from Lines 24a–24z)
  line26: `${P2}f2_30[0]`,   // Total adjustments to income → Form 1040 Line 10
}
