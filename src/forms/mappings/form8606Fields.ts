/**
 * Form 8606 (Nondeductible IRAs) PDF field name mapping.
 *
 * Field names from IRS f8606.pdf (2025).
 * Page 1 prefix: "topmostSubform[0].Page1[0]."
 *
 * Note: Field names are provisional — they may need to be updated
 * when the actual 2025 PDF is available. The filler uses setTextField
 * which silently skips missing fields.
 */

const P1 = 'topmostSubform[0].Page1[0].'

// ── Header ────────────────────────────────────────────────────

export const F8606_HEADER = {
  name: `${P1}f1_1[0]`,
  ssn:  `${P1}f1_2[0]`,
}

// ── Part I — Nondeductible Contributions to Traditional IRAs ──

export const F8606_PART1 = {
  line1:  `${P1}f1_3[0]`,   // Nondeductible contributions for 2025
  line2:  `${P1}f1_4[0]`,   // Total basis in traditional IRAs (prior years)
  line3:  `${P1}f1_5[0]`,   // Add lines 1 and 2
  line4:  `${P1}f1_6[0]`,   // Contributions withdrawn
  line5:  `${P1}f1_7[0]`,   // Subtract line 4 from line 3
  line6:  `${P1}f1_8[0]`,   // Value of all traditional/SEP/SIMPLE IRAs at Dec 31
  line7:  `${P1}f1_9[0]`,   // Distributions from traditional/SEP/SIMPLE IRAs
  line8:  `${P1}f1_10[0]`,  // Net amount converted to Roth
  line9:  `${P1}f1_11[0]`,  // Add lines 6, 7, and 8
  line10: `${P1}f1_12[0]`,  // Divide line 5 by line 9 (decimal, 3 places)
  line11: `${P1}f1_13[0]`,  // Multiply line 8 by line 10 (nontaxable conversion)
  line12: `${P1}f1_14[0]`,  // Multiply line 7 by line 10 (nontaxable distributions)
  line13: `${P1}f1_15[0]`,  // Add lines 11 and 12
  line14: `${P1}f1_16[0]`,  // Total basis remaining (line 3 minus line 13)
}

// ── Part II — Conversions from Traditional to Roth ──────────

export const F8606_PART2 = {
  line16: `${P1}f1_17[0]`,  // Amount converted (if converted from SIMPLE after 2 yrs)
  line17: `${P1}f1_18[0]`,  // Nontaxable portion of conversion (from line 11)
  line18: `${P1}f1_19[0]`,  // Taxable amount (line 16 minus line 17)
}
