/**
 * Form 8889 (Health Savings Accounts) PDF field name mapping.
 *
 * Field names discovered from IRS f8889.pdf (2025) using pdf-lib enumeration.
 * 27 fields, 1 page.
 * Prefix: "topmostSubform[0].Page1[0]."
 */

const P1 = 'topmostSubform[0].Page1[0].'

// ── Header ────────────────────────────────────────────────────

export const F8889_HEADER = {
  name:      `${P1}f1_1[0]`,
  ssn:       `${P1}f1_2[0]`,
  selfOnly:  `${P1}c1_1[0]`,   // Coverage type: Self-only
  family:    `${P1}c1_1[1]`,   // Coverage type: Family
}

// ── Part I — HSA Contributions and Deduction (Lines 2–13) ────

export const F8889_PART1 = {
  line2:  `${P1}f1_3[0]`,   // HSA contributions you made for 2025
  line3:  `${P1}f1_4[0]`,   // Employer contributions (W-2 Box 12, code W)
  line4:  `${P1}f1_5[0]`,   // Qualified HSA funding distribution
  line5:  `${P1}f1_6[0]`,   // Subtract line 4 from line 2
  line6:  `${P1}f1_7[0]`,   // HSA deduction limit (self-only or family)
  line7:  `${P1}f1_8[0]`,   // Additional contribution (age 55+), up to $1,000
  line8:  `${P1}f1_9[0]`,   // Add lines 6 and 7 (total limit)
  line9:  `${P1}f1_10[0]`,  // Employer contributions (from line 3)
  line10: `${P1}f1_11[0]`,  // Subtract line 9 from line 8 (max deductible)
  line11: `${P1}f1_12[0]`,  // Smaller of line 5 or line 10
  line12: `${P1}f1_13[0]`,  // Employer contributions not included in income
  line13: `${P1}f1_14[0]`,  // HSA deduction → Schedule 1, Line 13
}

// ── Part II — HSA Distributions (Lines 14a–16) ──────────────

export const F8889_PART2 = {
  line14a: `${P1}f1_15[0]`,  // Total distributions received
  line14b: `${P1}f1_16[0]`,  // Rollover contributions included
  line14c: `${P1}f1_17[0]`,  // Qualified medical expenses paid
  line15:  `${P1}f1_18[0]`,  // Taxable HSA distributions (14a - 14b - 14c)
  line16:  `${P1}f1_19[0]`,  // Exception applies? Penalty exempt?
}

// ── Part III — Additional Tax (Lines 17a–21) ─────────────────

export const F8889_PART3 = {
  line17a: `${P1}f1_20[0]`,  // Distribution penalty (20% of taxable)
  line17b: `${P1}f1_21[0]`,  // If not penalty-exempt
  line19:  `${P1}f1_22[0]`,  // Excess contributions
  line20:  `${P1}f1_23[0]`,  // Excess contribution penalty (6%)
  line21:  `${P1}f1_24[0]`,  // Total additional tax → Schedule 2, Part II
}
