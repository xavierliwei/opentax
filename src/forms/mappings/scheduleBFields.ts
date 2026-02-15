/**
 * Schedule B (Interest and Ordinary Dividends) PDF field name mapping.
 *
 * Field names discovered from IRS f1040sb.pdf (2025) using pdf-lib enumeration.
 * 72 fields, 1 page.
 * Prefix: "topmostSubform[0].Page1[0]."
 */

const P1 = 'topmostSubform[0].Page1[0].'

// ── Header fields ────────────────────────────────────────────

export const SCHB_HEADER = {
  name: `${P1}f1_01[0]`,  // Name(s) shown on return
  ssn:  `${P1}f1_02[0]`,  // Your social security number
}

// ── Part I: Interest (Lines 1–4) ─────────────────────────────
// 14 payer rows, each with a name and amount field.

/** Column offsets within each interest payer row */
interface PayerRow {
  /** Full PDF field name for the payer name */
  name: string
  /** Full PDF field name for the amount */
  amount: string
}

/**
 * Interest payer rows (Part I, Line 1).
 * Index 0 = Row 1, Index 13 = Row 14.
 * Row 1 name is nested inside Line1_ReadOrder.
 */
export const SCHB_INTEREST_ROWS: readonly PayerRow[] = [
  { name: `${P1}Line1_ReadOrder[0].f1_03[0]`, amount: `${P1}f1_04[0]` },
  { name: `${P1}f1_05[0]`, amount: `${P1}f1_06[0]` },
  { name: `${P1}f1_07[0]`, amount: `${P1}f1_08[0]` },
  { name: `${P1}f1_09[0]`, amount: `${P1}f1_10[0]` },
  { name: `${P1}f1_11[0]`, amount: `${P1}f1_12[0]` },
  { name: `${P1}f1_13[0]`, amount: `${P1}f1_14[0]` },
  { name: `${P1}f1_15[0]`, amount: `${P1}f1_16[0]` },
  { name: `${P1}f1_17[0]`, amount: `${P1}f1_18[0]` },
  { name: `${P1}f1_19[0]`, amount: `${P1}f1_20[0]` },
  { name: `${P1}f1_21[0]`, amount: `${P1}f1_22[0]` },
  { name: `${P1}f1_23[0]`, amount: `${P1}f1_24[0]` },
  { name: `${P1}f1_25[0]`, amount: `${P1}f1_26[0]` },
  { name: `${P1}f1_27[0]`, amount: `${P1}f1_28[0]` },
  { name: `${P1}f1_29[0]`, amount: `${P1}f1_30[0]` },
] as const

export const SCHB_INTEREST_TOTALS = {
  line2: `${P1}f1_31[0]`,  // Other interest (not used for MVP)
  line3: `${P1}f1_32[0]`,  // Excludable interest on Series EE/I bonds
  line4: `${P1}ReadOrderControl[0].f1_34[0]`,  // Total interest (subtract line 3 from line 2 subtotal)
}

// ── Part II: Ordinary Dividends (Lines 5–6) ──────────────────
// 14 payer rows, each with a name and amount field.

/**
 * Dividend payer rows (Part II, Line 5).
 * Index 0 = Row 1, Index 13 = Row 14.
 */
export const SCHB_DIVIDEND_ROWS: readonly PayerRow[] = [
  { name: `${P1}f1_35[0]`, amount: `${P1}f1_36[0]` },
  { name: `${P1}f1_37[0]`, amount: `${P1}f1_38[0]` },
  { name: `${P1}f1_39[0]`, amount: `${P1}f1_40[0]` },
  { name: `${P1}f1_41[0]`, amount: `${P1}f1_42[0]` },
  { name: `${P1}f1_43[0]`, amount: `${P1}f1_44[0]` },
  { name: `${P1}f1_45[0]`, amount: `${P1}f1_46[0]` },
  { name: `${P1}f1_47[0]`, amount: `${P1}f1_48[0]` },
  { name: `${P1}f1_49[0]`, amount: `${P1}f1_50[0]` },
  { name: `${P1}f1_51[0]`, amount: `${P1}f1_52[0]` },
  { name: `${P1}f1_53[0]`, amount: `${P1}f1_54[0]` },
  { name: `${P1}f1_55[0]`, amount: `${P1}f1_56[0]` },
  { name: `${P1}f1_57[0]`, amount: `${P1}f1_58[0]` },
  { name: `${P1}f1_59[0]`, amount: `${P1}f1_60[0]` },
  { name: `${P1}f1_61[0]`, amount: `${P1}f1_62[0]` },
] as const

export const SCHB_DIVIDEND_TOTALS = {
  line5: `${P1}f1_63[0]`,  // Subtotal of Part II dividend amounts
  line6: `${P1}f1_64[0]`,  // Total ordinary dividends (for Form 1040, line 3b)
}

// ── Part III: Foreign Accounts and Trusts (Lines 7a–8) ───────

export const SCHB_FOREIGN = {
  line7aYes:   `${P1}c1_1[0]`,   // 7a: Foreign accounts — Yes
  line7aNo:    `${P1}c1_1[1]`,   // 7a: Foreign accounts — No
  line7bYes:   `${P1}c1_2[0]`,   // 7b: Foreign trust — Yes
  line7bNo:    `${P1}c1_2[1]`,   // 7b: Foreign trust — No
  line7bCountry: `${P1}f1_65[0]`,  // 7b: Name of foreign country
  line8Yes:    `${P1}c1_3[0]`,   // 8: FBAR required — Yes
  line8No:     `${P1}c1_3[1]`,   // 8: FBAR required — No
  line8FBAR:   `${P1}f1_66[0]`,  // 8: FBAR filing reference
}
