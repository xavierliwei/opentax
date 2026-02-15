/**
 * Schedule A (Itemized Deductions) PDF field name mapping.
 *
 * Field names discovered from IRS f1040sa.pdf (2025) using pdf-lib enumeration.
 * 33 fields, 1 page.
 * Prefix: "form1[0].Page1[0]."
 */

const P1 = 'form1[0].Page1[0].'

// ── Header fields ────────────────────────────────────────────

export const SCHA_HEADER = {
  name: `${P1}f1_1[0]`,   // Name(s) shown on Form 1040
  ssn:  `${P1}f1_2[0]`,   // Your social security number
}

// ── Medical and Dental Expenses (Lines 1–4) ──────────────────

export const SCHA_MEDICAL = {
  line1: `${P1}f1_3[0]`,  // Medical and dental expenses
  line2: `${P1}Line2_ReadOrder[0].f1_4[0]`,  // Amount from Form 1040, line 11 (AGI)
  line3: `${P1}f1_5[0]`,  // Multiply line 2 by 7.5% (0.075)
  line4: `${P1}f1_6[0]`,  // Subtract line 3 from line 1 (medical deduction)
}

// ── Taxes You Paid (Lines 5–7) ───────────────────────────────

export const SCHA_TAXES = {
  line5a: `${P1}f1_7[0]`,   // State and local income taxes
  line5b: `${P1}f1_8[0]`,   // State and local sales taxes
  line5c: `${P1}f1_9[0]`,   // Real estate taxes
  line5d: `${P1}f1_10[0]`,  // Personal property taxes
  line5e: `${P1}f1_11[0]`,  // Add lines 5a through 5d (total state/local taxes)
  line6:  `${P1}f1_12[0]`,  // Other taxes
  line7:  `${P1}f1_13[0]`,  // Total taxes paid (after $10,000 cap)
}

// ── Interest You Paid (Lines 8–10) ───────────────────────────

export const SCHA_INTEREST = {
  line8a: `${P1}f1_14[0]`,  // Home mortgage interest (reported on Form 1098)
  line8b: `${P1}f1_15[0]`,  // Home mortgage interest not reported on Form 1098
  line8c: `${P1}Line8b_ReadOrder[0].f1_16[0]`,  // Points not reported on Form 1098
  line8d: `${P1}f1_17[0]`,  // Mortgage insurance premiums
  line8e: `${P1}f1_18[0]`,  // Add lines 8a through 8d
  line9:  `${P1}f1_19[0]`,  // Investment interest (Form 4952)
  line10: `${P1}f1_20[0]`,  // Total interest you paid (add lines 8e and 9)
}

// ── Gifts to Charity (Lines 11–14) ───────────────────────────

export const SCHA_CHARITY = {
  line11: `${P1}f1_21[0]`,  // Gifts by cash or check
  line12: `${P1}f1_22[0]`,  // Other than by cash or check
  line13: `${P1}f1_23[0]`,  // Carryover from prior year
  line14: `${P1}f1_24[0]`,  // Total gifts to charity (add lines 11–13)
}

// ── Other Deductions and Totals (Lines 15–18) ────────────────

export const SCHA_OTHER = {
  line15: `${P1}f1_25[0]`,  // Casualty and theft losses (Form 4684)
  line16: `${P1}f1_26[0]`,  // Other itemized deductions
  line17: `${P1}f1_27[0]`,  // Total itemized deductions (add lines 4, 7, 10, 14–16)
  line18: `${P1}f1_28[0]`,  // Check if you could be claimed as a dependent
}
