/**
 * Schedule E (Supplemental Income and Loss) Part I — PDF field name mapping.
 *
 * Field names discovered from IRS f1040se.pdf (2025) using pdf-lib enumeration.
 * 2 pages. Part I (rental real estate) on page 1; Parts II–V on page 2.
 * Only Part I is filled; Parts II–V are out of scope.
 *
 * Prefix: "topmostSubform[0].Page1[0]."
 * Up to 3 properties (A, B, C) per page.
 */

const P1 = 'topmostSubform[0].Page1[0].'

// ── Header ────────────────────────────────────────────────────

export const SCHE_HEADER = {
  name: `${P1}f1_1[0]`,
  ssn:  `${P1}f1_2[0]`,
}

// ── 1099 filing questions (checkboxes) ────────────────────────

export const SCHE_1099 = {
  aYes: `${P1}c1_1[0]`,
  aNo:  `${P1}c1_1[1]`,
  bYes: `${P1}c1_2[0]`,
  bNo:  `${P1}c1_2[1]`,
}

// ── Per-property fields (3 columns: A, B, C) ──────────────────

/** Line 1a — physical address of each property */
export const SCHE_ADDRESS = [
  `${P1}Table_Line1a[0].RowA[0].f1_3[0]`,
  `${P1}Table_Line1a[0].RowB[0].f1_4[0]`,
  `${P1}Table_Line1a[0].RowC[0].f1_5[0]`,
]

/** Line 1b — type of property (IRS code 1–8) */
export const SCHE_TYPE = [
  `${P1}Table_Line1b[0].RowA[0].f1_6[0]`,
  `${P1}Table_Line1b[0].RowB[0].f1_7[0]`,
  `${P1}Table_Line1b[0].RowC[0].f1_8[0]`,
]

/** "Other (describe)" text for property type 8 */
export const SCHE_TYPE_OTHER_DESC = `${P1}f1_15[0]`

/** Line 2 — Fair rental days / personal use days / QJV checkbox */
export const SCHE_DAYS = [
  { fair: `${P1}Table_Line2[0].RowA[0].f1_9[0]`,  personal: `${P1}Table_Line2[0].RowA[0].f1_10[0]`, qjv: `${P1}Table_Line2[0].RowA[0].c1_3[0]` },
  { fair: `${P1}Table_Line2[0].RowB[0].f1_11[0]`, personal: `${P1}Table_Line2[0].RowB[0].f1_12[0]`, qjv: `${P1}Table_Line2[0].RowB[0].c1_4[0]` },
  { fair: `${P1}Table_Line2[0].RowC[0].f1_13[0]`, personal: `${P1}Table_Line2[0].RowC[0].f1_14[0]`, qjv: `${P1}Table_Line2[0].RowC[0].c1_5[0]` },
]

/**
 * Income and expense lines per property.
 * Each array has 3 elements [A, B, C].
 *
 * Line 19 (Other) has an extra description field before the 3 amount columns.
 */
const TI = `${P1}Table_Income[0].`
const TE = `${P1}Table_Expenses[0].`

export const SCHE_INCOME = {
  line3:  [`${TI}Line3[0].f1_16[0]`,  `${TI}Line3[0].f1_17[0]`,  `${TI}Line3[0].f1_18[0]`],   // Rents received
  line4:  [`${TI}Line4[0].f1_19[0]`,  `${TI}Line4[0].f1_20[0]`,  `${TI}Line4[0].f1_21[0]`],   // Royalties received
}

export const SCHE_EXPENSES = {
  line5:  [`${TE}Line5[0].f1_22[0]`,  `${TE}Line5[0].f1_23[0]`,  `${TE}Line5[0].f1_24[0]`],   // Advertising
  line6:  [`${TE}Line6[0].f1_25[0]`,  `${TE}Line6[0].f1_26[0]`,  `${TE}Line6[0].f1_27[0]`],   // Auto and travel
  line7:  [`${TE}Line7[0].f1_28[0]`,  `${TE}Line7[0].f1_29[0]`,  `${TE}Line7[0].f1_30[0]`],   // Cleaning
  line8:  [`${TE}Line8[0].f1_31[0]`,  `${TE}Line8[0].f1_32[0]`,  `${TE}Line8[0].f1_33[0]`],   // Commissions
  line9:  [`${TE}Line9[0].f1_34[0]`,  `${TE}Line9[0].f1_35[0]`,  `${TE}Line9[0].f1_36[0]`],   // Insurance
  line10: [`${TE}Line10[0].f1_37[0]`, `${TE}Line10[0].f1_38[0]`, `${TE}Line10[0].f1_39[0]`],  // Legal
  line11: [`${TE}Line11[0].f1_40[0]`, `${TE}Line11[0].f1_41[0]`, `${TE}Line11[0].f1_42[0]`],  // Management
  line12: [`${TE}Line12[0].f1_43[0]`, `${TE}Line12[0].f1_44[0]`, `${TE}Line12[0].f1_45[0]`],  // Mortgage interest
  line13: [`${TE}Line13[0].f1_46[0]`, `${TE}Line13[0].f1_47[0]`, `${TE}Line13[0].f1_48[0]`],  // Other interest
  line14: [`${TE}Line14[0].f1_49[0]`, `${TE}Line14[0].f1_50[0]`, `${TE}Line14[0].f1_51[0]`],  // Repairs
  line15: [`${TE}Line15[0].f1_52[0]`, `${TE}Line15[0].f1_53[0]`, `${TE}Line15[0].f1_54[0]`],  // Supplies
  line16: [`${TE}Line16[0].f1_55[0]`, `${TE}Line16[0].f1_56[0]`, `${TE}Line16[0].f1_57[0]`],  // Taxes
  line17: [`${TE}Line17[0].f1_58[0]`, `${TE}Line17[0].f1_59[0]`, `${TE}Line17[0].f1_60[0]`],  // Utilities
  line18: [`${TE}Line18[0].f1_61[0]`, `${TE}Line18[0].f1_62[0]`, `${TE}Line18[0].f1_63[0]`],  // Depreciation
  line19desc: `${TE}Line19[0].f1_64[0]`,                                                       // Other — description
  line19: [`${TE}Line19[0].f1_65[0]`, `${TE}Line19[0].f1_66[0]`, `${TE}Line19[0].f1_67[0]`],  // Other — amounts
  line20: [`${TE}Line20[0].f1_68[0]`, `${TE}Line20[0].f1_69[0]`, `${TE}Line20[0].f1_70[0]`],  // Total expenses
  line21: [`${TE}Line21[0].f1_71[0]`, `${TE}Line21[0].f1_72[0]`, `${TE}Line21[0].f1_73[0]`],  // Net income/loss
  line22: [`${TE}Line22[0].f1_74[0]`, `${TE}Line22[0].f1_75[0]`, `${TE}Line22[0].f1_76[0]`],  // Deductible loss (Form 8582)
}

// ── Summary lines (Part I totals) ─────────────────────────────

export const SCHE_SUMMARY = {
  line23a: `${P1}f1_77[0]`,   // Total rents (all line 3 amounts)
  line23b: `${P1}f1_78[0]`,   // Total royalties (all line 4 amounts)
  line23c: `${P1}f1_79[0]`,   // Total mortgage interest (all line 12 amounts)
  line23d: `${P1}f1_80[0]`,   // Total depreciation (all line 18 amounts)
  line23e: `${P1}f1_81[0]`,   // Total expenses (all line 20 amounts)
  line24:  `${P1}f1_82[0]`,   // Income (positive amounts from line 21)
  line25:  `${P1}f1_83[0]`,   // Losses (from line 21 + line 22)
  line26:  `${P1}f1_84[0]`,   // Total rental real estate and royalty income or (loss)
}
