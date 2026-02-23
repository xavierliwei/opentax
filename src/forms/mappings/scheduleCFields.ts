/**
 * Schedule C (Profit or Loss From Business) — PDF field name mapping.
 *
 * Field names match the synthetic f1040sc.pdf template generated from
 * IRS field naming conventions. 2 pages: Part I/II on page 1;
 * Parts III–V on page 2.
 *
 * Prefix: "topmostSubform[0].Page1[0]."
 */

const P1 = 'topmostSubform[0].Page1[0].'

// ── Header ────────────────────────────────────────────────────

export const SCHC_HEADER = {
  name: `${P1}f1_1[0]`,
  ssn:  `${P1}f1_2[0]`,
}

// ── Business Info (Lines A–F) ──────────────────────────────────

export const SCHC_BUSINESS = {
  lineA: `${P1}f1_3[0]`,  // Principal business or profession
  lineB: `${P1}f1_4[0]`,  // Business code (6-digit NAICS)
  lineC: `${P1}f1_5[0]`,  // Business name
  lineD: `${P1}f1_6[0]`,  // EIN
  lineE: `${P1}f1_7[0]`,  // Business address
}

// ── Accounting Method Checkboxes ───────────────────────────────

export const SCHC_METHOD = {
  cash:    `${P1}c1_1[0]`,
  accrual: `${P1}c1_1[1]`,
}

// ── Part I — Income ────────────────────────────────────────────

export const SCHC_INCOME = {
  line1:  `${P1}f1_8[0]`,   // Gross receipts or sales
  line2:  `${P1}f1_9[0]`,   // Returns and allowances
  line3:  `${P1}f1_10[0]`,  // line 1 minus line 2
  line4:  `${P1}f1_11[0]`,  // Cost of goods sold
  line5:  `${P1}f1_12[0]`,  // Gross profit (line 3 - line 4)
  line6:  `${P1}f1_13[0]`,  // Other income
  line7:  `${P1}f1_14[0]`,  // Gross income (line 5 + line 6)
}

// ── Part II — Expenses ─────────────────────────────────────────

export const SCHC_EXPENSES = {
  line8:   `${P1}f1_15[0]`,  // Advertising
  line9:   `${P1}f1_16[0]`,  // Car and truck expenses
  line10:  `${P1}f1_17[0]`,  // Commissions and fees
  line11:  `${P1}f1_18[0]`,  // Contract labor
  line12:  `${P1}f1_19[0]`,  // Depletion
  line13:  `${P1}f1_20[0]`,  // Depreciation (and section 179)
  line14:  `${P1}f1_21[0]`,  // Employee benefit programs
  line15:  `${P1}f1_22[0]`,  // Insurance (other than health)
  line16a: `${P1}f1_23[0]`,  // Mortgage interest paid to banks
  line16b: `${P1}f1_24[0]`,  // Other interest
  line17:  `${P1}f1_25[0]`,  // Legal and professional services
  line18:  `${P1}f1_26[0]`,  // Office expense
  line19:  `${P1}f1_27[0]`,  // Pension and profit-sharing plans
  line20a: `${P1}f1_28[0]`,  // Rent — vehicles, machinery, equipment
  line20b: `${P1}f1_29[0]`,  // Rent — other business property
  line21:  `${P1}f1_30[0]`,  // Repairs and maintenance
  line22:  `${P1}f1_31[0]`,  // Supplies
  line23:  `${P1}f1_32[0]`,  // Taxes and licenses
  line24a: `${P1}f1_33[0]`,  // Travel
  line24b: `${P1}f1_34[0]`,  // Deductible meals
  line25:  `${P1}f1_35[0]`,  // Utilities
  line26:  `${P1}f1_36[0]`,  // Wages
  line27a: `${P1}f1_37[0]`,  // Other expenses
}

// ── Part II — Summary ──────────────────────────────────────────

export const SCHC_SUMMARY = {
  line28: `${P1}f1_38[0]`,  // Total expenses
  line29: `${P1}f1_39[0]`,  // Tentative profit (loss): line 7 − line 28
  line30: `${P1}f1_40[0]`,  // Expenses for business use of home (Form 8829)
  line31: `${P1}f1_41[0]`,  // Net profit or (loss)
}
