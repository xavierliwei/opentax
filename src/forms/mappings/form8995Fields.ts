/**
 * Form 8995 (Qualified Business Income Deduction — Simplified) PDF field mapping.
 *
 * Field names discovered from IRS f8995.pdf (2025) using pdf-lib enumeration.
 * 33 text fields, 1 page.
 * Prefix: "topmostSubform[0].Page1[0]."
 *
 * Form structure:
 *   Header: Name, SSN
 *   Lines 1i–1v: Per-business QBI table (name, TIN, QBI — 5 rows)
 *   Lines 2–5: QBI computation
 *   Lines 6–9: REIT/PTP (not currently modeled)
 *   Lines 10–15: Deduction computation
 *   Lines 16–17: Loss carryforwards (not currently modeled)
 */

const P1 = 'topmostSubform[0].Page1[0].'
const T = `${P1}Table[0].`

// ── Header ────────────────────────────────────────────────────

export const F8995_HEADER = {
  name:  `${P1}f1_01[0]`,   // Name(s) shown on return
  ssn:   `${P1}f1_02[0]`,   // Your taxpayer identification number
}

// ── Line 1: Per-Business QBI Table (up to 5 rows) ────────────
// Each row: (a) Business name, (b) TIN, (c) QBI

export const F8995_BUSINESS = {
  row1_name:  `${T}Row1i[0].f1_03[0]`,    // Row i — business name
  row1_tin:   `${T}Row1i[0].f1_04[0]`,    // Row i — TIN
  row1_qbi:   `${T}Row1i[0].f1_05[0]`,    // Row i — QBI

  row2_name:  `${T}Row1ii[0].f1_06[0]`,   // Row ii — business name
  row2_tin:   `${T}Row1ii[0].f1_07[0]`,   // Row ii — TIN
  row2_qbi:   `${T}Row1ii[0].f1_08[0]`,   // Row ii — QBI

  row3_name:  `${T}Row1iii[0].f1_09[0]`,  // Row iii — business name
  row3_tin:   `${T}Row1iii[0].f1_10[0]`,  // Row iii — TIN
  row3_qbi:   `${T}Row1iii[0].f1_11[0]`,  // Row iii — QBI

  row4_name:  `${T}Row1iv[0].f1_12[0]`,   // Row iv — business name
  row4_tin:   `${T}Row1iv[0].f1_13[0]`,   // Row iv — TIN
  row4_qbi:   `${T}Row1iv[0].f1_14[0]`,   // Row iv — QBI

  row5_name:  `${T}Row1v[0].f1_15[0]`,    // Row v — business name
  row5_tin:   `${T}Row1v[0].f1_16[0]`,    // Row v — TIN
  row5_qbi:   `${T}Row1v[0].f1_17[0]`,    // Row v — QBI
}

// ── Lines 2–5: QBI Computation ───────────────────────────────

export const F8995_QBI = {
  line2:  `${P1}Line2_ReadOrder[0].f1_18[0]`,  // Line 2: Total QBI
  line3:  `${P1}f1_19[0]`,                     // Line 3: QBI loss carryforward (prior year)
  line4:  `${P1}f1_20[0]`,                     // Line 4: Total QBI (lines 2 + 3)
  line5:  `${P1}f1_21[0]`,                     // Line 5: QBI component (20% of line 4)
}

// ── Lines 6–9: REIT/PTP ──────────────────────────────────────

export const F8995_REIT = {
  line6:  `${P1}Line6_ReadOrder[0].f1_22[0]`,  // Line 6: REIT dividends / PTP income
  line7:  `${P1}f1_23[0]`,                     // Line 7: REIT/PTP loss carryforward
  line8:  `${P1}f1_24[0]`,                     // Line 8: Total REIT/PTP income
  line9:  `${P1}f1_25[0]`,                     // Line 9: REIT/PTP component (20%)
}

// ── Lines 10–15: Deduction Computation ──────────────────────

export const F8995_DEDUCTION = {
  line10: `${P1}f1_26[0]`,   // Line 10: QBI deduction before income limitation
  line11: `${P1}f1_27[0]`,   // Line 11: Taxable income before QBI deduction
  line12: `${P1}f1_28[0]`,   // Line 12: Net capital gain + qualified dividends
  line13: `${P1}f1_29[0]`,   // Line 13: Line 11 minus line 12
  line14: `${P1}f1_30[0]`,   // Line 14: Income limitation (20% of line 13)
  line15: `${P1}f1_31[0]`,   // Line 15: QBI deduction (lesser of line 10 or 14)
}

// ── Lines 16–17: Loss Carryforwards ─────────────────────────

export const F8995_CARRYFORWARD = {
  line16: `${P1}f1_32[0]`,   // Line 16: QBI loss carryforward
  line17: `${P1}f1_33[0]`,   // Line 17: REIT/PTP loss carryforward
}
