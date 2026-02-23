/**
 * Form 1116 (Foreign Tax Credit) PDF field name mapping.
 *
 * Field names correspond to the generated f1116.pdf template.
 * Form 1116 is a 2-page form. This mapping covers the passive category
 * income path (the common portfolio-income case).
 *
 * Page 1: Parts I–III (income, taxes paid, limitation computation)
 * Page 2: Part III continued + Part IV summary
 */

// ── Header ────────────────────────────────────────────────────

export const F1116_HEADER = {
  p1Name: 'f1116_p1_name',
  p1Ssn:  'f1116_p1_ssn',
  p2Name: 'f1116_p2_name',
  p2Ssn:  'f1116_p2_ssn',
}

// ── Category & Country ────────────────────────────────────────

export const F1116_INFO = {
  /** Country or U.S. possession (line g) */
  country: 'f1116_p1_country',
}

// ── Part I — Taxable Income from Sources Outside the U.S. ────

export const F1116_PART1 = {
  /** 1a: Foreign-source dividends */
  line1aDividends: 'f1116_p1_1a',
  /** 1a: Foreign-source interest */
  line1aInterest:  'f1116_p1_1a_int',
  /** 2: Total foreign-source gross income */
  line2:           'f1116_p1_2',
  /** 3a: Certain itemized deductions or standard deduction */
  line3a:          'f1116_p1_3a',
  /** 3e: Other deductions */
  line3e:          'f1116_p1_3e',
  /** 3f: Total deductions */
  line3f:          'f1116_p1_3f',
  /** 3g: Net foreign-source taxable income */
  line3g:          'f1116_p1_3g',
}

// ── Part II — Foreign Taxes Paid or Accrued ───────────────────

export const F1116_PART2 = {
  /** 8: Taxes withheld at source — dividends */
  line8Dividends: 'f1116_p1_8_div',
  /** 8: Taxes withheld at source — interest */
  line8Interest:  'f1116_p1_8_int',
  /** 9: Total foreign taxes paid */
  line9:          'f1116_p1_9',
  /** 10: Carryback or carryover (0 — not supported) */
  line10:         'f1116_p1_10',
  /** 11: Add lines 9 and 10 */
  line11:         'f1116_p1_11',
  /** 12: Reduction in foreign taxes */
  line12:         'f1116_p1_12',
  /** 13: Taxes reclassified under high tax kickout */
  line13:         'f1116_p1_13',
  /** 14: Combine lines 11, 12, and 13 — net creditable taxes */
  line14:         'f1116_p1_14',
}

// ── Part III — Figuring the Credit ────────────────────────────

export const F1116_PART3 = {
  /** 15: Net foreign-source taxable income (= Part I line 3g) */
  line15: 'f1116_p1_15',
  /** 16: Adjustments to line 15 */
  line16: 'f1116_p1_16',
  /** 17: Combine lines 15 and 16 */
  line17: 'f1116_p1_17',
  /** 18: Worldwide taxable income (Form 1040, line 15) */
  line18: 'f1116_p1_18',
  /** 19: Divide line 17 by line 18 (ratio, max 1.0) */
  line19: 'f1116_p1_19',
  /** 20: U.S. tax before credits (Form 1040, line 16) */
  line20: 'f1116_p1_20',
  /** 21: Multiply line 20 by line 19 (limitation amount) */
  line21: 'f1116_p1_21',

  // Page 2 fields
  /** 22: Smaller of line 14 or line 21 */
  line22: 'f1116_p2_22',
  /** 23: Reduction for other categories (0 — passive only) */
  line23: 'f1116_p2_23',
  /** 24: Combine lines 22 and 23 */
  line24: 'f1116_p2_24',
  /** 33: Credit for this category (smaller of line 24 or line 32) */
  line33: 'f1116_p2_33',
  /** 34: Excess credit (informational carryforward) */
  line34: 'f1116_p2_34',
}

// ── Part IV — Summary of Credits ──────────────────────────────

export const F1116_PART4 = {
  /** 35: Credit — Passive category income */
  line35: 'f1116_p2_35',
  /** 36: Credit — General category income (0 — not supported) */
  line36: 'f1116_p2_36',
  /** 37: Credit — Section 901(j) income (0 — not supported) */
  line37: 'f1116_p2_37',
  /** 38: Total foreign tax credit to Schedule 3, Line 1 */
  line38: 'f1116_p2_38',
}
