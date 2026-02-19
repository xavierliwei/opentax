/**
 * Schedule 3 (Additional Credits and Payments) PDF field name mapping.
 *
 * Field names discovered from IRS f1040s3.pdf (2025) using pdf-lib enumeration.
 * 37 fields, 1 page.
 * Prefix: "topmostSubform[0].Page1[0]."
 */

const P1 = 'topmostSubform[0].Page1[0].'

// ── Header ────────────────────────────────────────────────────

export const SCH3_HEADER = {
  name: `${P1}f1_01[0]`,
  ssn:  `${P1}f1_02[0]`,
}

// ── Part I — Nonrefundable Credits (Lines 1–8) ───────────────

export const SCH3_PART1 = {
  line1:  `${P1}f1_03[0]`,  // Foreign tax credit (Form 1116)
  line2:  `${P1}f1_04[0]`,  // Child and dependent care (Form 2441)
  line3:  `${P1}f1_05[0]`,  // Education credits (Form 8863, line 19)
  line4:  `${P1}f1_06[0]`,  // Retirement savings/saver's credit (Form 8880)
  line5a: `${P1}f1_07[0]`,  // Residential energy credit (Form 5695)
  line5b: `${P1}f1_08[0]`,  // EV credit
  line7:  `${P1}f1_24[0]`,  // Total other nonrefundable credits (from 6a–6z)
  line8:  `${P1}f1_25[0]`,  // Total nonrefundable credits → Form 1040 Line 20
}

// ── Part II — Other Payments and Refundable Credits ──────────

export const SCH3_PART2 = {
  line9:  `${P1}f1_26[0]`,  // Net premium tax credit (Form 8962)
  line10: `${P1}f1_27[0]`,  // Amount paid with request for extension
  line11: `${P1}f1_28[0]`,  // Excess social security tax withheld
  line12: `${P1}f1_29[0]`,  // Credits from Form 2439, 4136, 8885
  line14: `${P1}f1_36[0]`,  // Total other payments/credits
  line15: `${P1}f1_37[0]`,  // Total → Form 1040 Line 31
}
