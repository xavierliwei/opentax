/**
 * Schedule D (Capital Gains and Losses) PDF field name mapping.
 *
 * Field names discovered from IRS f1040sd.pdf (2025) using pdf-lib enumeration.
 * 55 fields, 2 pages.
 * Page 1 prefix: "topmostSubform[0].Page1[0]."
 * Page 2 prefix: "topmostSubform[0].Page2[0]."
 */

const P1 = 'topmostSubform[0].Page1[0].'
const P2 = 'topmostSubform[0].Page2[0].'

// ── Header fields ────────────────────────────────────────────

export const SCHD_HEADER = {
  name: `${P1}f1_1[0]`,  // Name(s) shown on return
  ssn:  `${P1}f1_2[0]`,  // Your social security number
}

// ── Part I: Short-Term Capital Gains and Losses ──────────────
// Each row has: proceeds, cost basis, adjustments, gain/loss

/** Columns in a Form 8949 summary row on Schedule D */
interface GainLossRow {
  proceeds:    string
  basis:       string
  adjustments: string
  gainLoss:    string
}

/**
 * Part I — Short-Term rows (Lines 1a, 1b, 2, 3).
 * These correspond to Form 8949 Part I categories.
 */
export const SCHD_SHORT_TERM_TABLE: Record<string, GainLossRow> = {
  /** Line 1a: Totals from Form 8949, Box A (basis reported to IRS) */
  line1a: {
    proceeds:    `${P1}Table_PartI[0].Row1a[0].f1_3[0]`,
    basis:       `${P1}Table_PartI[0].Row1a[0].f1_4[0]`,
    adjustments: `${P1}Table_PartI[0].Row1a[0].f1_5[0]`,
    gainLoss:    `${P1}Table_PartI[0].Row1a[0].f1_6[0]`,
  },
  /** Line 1b: Totals from Form 8949, Box B (basis NOT reported to IRS) */
  line1b: {
    proceeds:    `${P1}Table_PartI[0].Row1b[0].f1_7[0]`,
    basis:       `${P1}Table_PartI[0].Row1b[0].f1_8[0]`,
    adjustments: `${P1}Table_PartI[0].Row1b[0].f1_9[0]`,
    gainLoss:    `${P1}Table_PartI[0].Row1b[0].f1_10[0]`,
  },
  /** Line 2: Totals from Form 8949, Box C (Form 1099-B not received) */
  line2: {
    proceeds:    `${P1}Table_PartI[0].Row2[0].f1_11[0]`,
    basis:       `${P1}Table_PartI[0].Row2[0].f1_12[0]`,
    adjustments: `${P1}Table_PartI[0].Row2[0].f1_13[0]`,
    gainLoss:    `${P1}Table_PartI[0].Row2[0].f1_14[0]`,
  },
  /** Line 3: Totals from Form 8949 combined (all short-term) */
  line3: {
    proceeds:    `${P1}Table_PartI[0].Row3[0].f1_15[0]`,
    basis:       `${P1}Table_PartI[0].Row3[0].f1_16[0]`,
    adjustments: `${P1}Table_PartI[0].Row3[0].f1_17[0]`,
    gainLoss:    `${P1}Table_PartI[0].Row3[0].f1_18[0]`,
  },
}

export const SCHD_SHORT_TERM = {
  line4: `${P1}f1_19[0]`,  // Short-term gain/loss from other forms/schedules
  line5: `${P1}f1_20[0]`,  // Net short-term gain/loss from partnerships, S corps, etc.
  line6: `${P1}f1_21[0]`,  // Short-term capital loss carryover
  line7: `${P1}f1_22[0]`,  // Net short-term capital gain or loss
}

// ── Part II: Long-Term Capital Gains and Losses ──────────────

/**
 * Part II — Long-Term rows (Lines 8a, 8b, 9, 10).
 * These correspond to Form 8949 Part II categories.
 */
export const SCHD_LONG_TERM_TABLE: Record<string, GainLossRow> = {
  /** Line 8a: Totals from Form 8949, Box D (basis reported to IRS) */
  line8a: {
    proceeds:    `${P1}Table_PartII[0].Row8a[0].f1_23[0]`,
    basis:       `${P1}Table_PartII[0].Row8a[0].f1_24[0]`,
    adjustments: `${P1}Table_PartII[0].Row8a[0].f1_25[0]`,
    gainLoss:    `${P1}Table_PartII[0].Row8a[0].f1_26[0]`,
  },
  /** Line 8b: Totals from Form 8949, Box E (basis NOT reported to IRS) */
  line8b: {
    proceeds:    `${P1}Table_PartII[0].Row8b[0].f1_27[0]`,
    basis:       `${P1}Table_PartII[0].Row8b[0].f1_28[0]`,
    adjustments: `${P1}Table_PartII[0].Row8b[0].f1_29[0]`,
    gainLoss:    `${P1}Table_PartII[0].Row8b[0].f1_30[0]`,
  },
  /** Line 9: Totals from Form 8949, Box F (Form 1099-B not received) */
  line9: {
    proceeds:    `${P1}Table_PartII[0].Row9[0].f1_31[0]`,
    basis:       `${P1}Table_PartII[0].Row9[0].f1_32[0]`,
    adjustments: `${P1}Table_PartII[0].Row9[0].f1_33[0]`,
    gainLoss:    `${P1}Table_PartII[0].Row9[0].f1_34[0]`,
  },
  /** Line 10: Totals from Form 8949 combined (all long-term) */
  line10: {
    proceeds:    `${P1}Table_PartII[0].Row10[0].f1_35[0]`,
    basis:       `${P1}Table_PartII[0].Row10[0].f1_36[0]`,
    adjustments: `${P1}Table_PartII[0].Row10[0].f1_37[0]`,
    gainLoss:    `${P1}Table_PartII[0].Row10[0].f1_38[0]`,
  },
}

export const SCHD_LONG_TERM = {
  line11: `${P1}f1_39[0]`,  // Long-term gain/loss from other forms/schedules
  line12: `${P1}f1_40[0]`,  // Net long-term gain/loss from partnerships, S corps, etc.
  line13: `${P1}f1_41[0]`,  // Capital gain distributions
  line14: `${P1}f1_42[0]`,  // Long-term capital loss carryover
  line15: `${P1}f1_43[0]`,  // Net long-term capital gain or loss
}

// ── Page 2: Summary and Tax Computation ──────────────────────

export const SCHD_SUMMARY = {
  line16:    `${P2}f2_1[0]`,   // Combine lines 7 and 15 (net gain/loss)
  line17Yes: `${P2}c2_1[0]`,   // Both lines 15 and 16 are gains — Yes
  line17No:  `${P2}c2_1[1]`,   // Both lines 15 and 16 are gains — No
  line18:    `${P2}f2_2[0]`,   // 28% rate gain (from worksheet)
  line19:    `${P2}f2_3[0]`,   // Unrecaptured Section 1250 gain
  line20Yes: `${P2}c2_2[0]`,   // Are lines 18 and 19 both zero — Yes
  line20No:  `${P2}c2_2[1]`,   // Are lines 18 and 19 both zero — No
  line21:    `${P2}f2_4[0]`,   // Amount for Form 1040, line 7 (if loss, use worksheet)
  line22Yes: `${P2}c2_3[0]`,   // Do you have qualified dividends on 1040 line 3a — Yes
  line22No:  `${P2}c2_3[1]`,   // Do you have qualified dividends on 1040 line 3a — No
}
