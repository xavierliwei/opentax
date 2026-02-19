/**
 * Schedule 2 (Additional Taxes) PDF field name mapping.
 *
 * Field names discovered from IRS f1040s2.pdf (2025) using pdf-lib enumeration.
 * 63 fields, 2 pages.
 * Page 1 prefix: "form1[0].Page1[0]."
 * Page 2 prefix: "form1[0].Page2[0]."
 */

const P1 = 'form1[0].Page1[0].'
const P2 = 'form1[0].Page2[0].'

// ── Header ────────────────────────────────────────────────────

export const SCH2_HEADER = {
  name: `${P1}f1_01[0]`,
  ssn:  `${P1}f1_02[0]`,
}

// ── Part I — Tax (Lines 1–4) → Form 1040 Line 17 ─────────────

export const SCH2_PART1 = {
  line1:  `${P1}Line1a_ReadOrder[0].f1_03[0]`,  // AMT (Form 6251)
  line1b: `${P1}f1_04[0]`,  // Excess advance PTC repayment
  line1c: `${P1}f1_05[0]`,  // Tax on distributions from section 529
  line1d: `${P1}f1_06[0]`,  // Tax on modified endowment contracts
  line1e: `${P1}f1_07[0]`,  // Tax on early distributions (line 1e)
  line1f: `${P1}f1_08[0]`,  // Tax on non-effectively connected income
  line2:  `${P1}f1_10[0]`,  // Excess advance PTC repayment
  line3:  `${P1}f1_11[0]`,  // Add lines 1 through 2
  line4:  `${P1}f1_15[0]`,  // Total Part I → Form 1040 Line 17
}

// ── Part II — Other Taxes (Lines 6–21) → Form 1040 Line 23 ──

export const SCH2_PART2 = {
  line6:  `${P1}f1_16[0]`,  // Self-employment tax (Schedule SE)
  line7:  `${P1}f1_17[0]`,  // Social security and Medicare on unreported tips
  line8:  `${P1}f1_19[0]`,  // Additional tax on HSA distributions (Form 8889)
  line9:  `${P1}f1_20[0]`,  // Additional tax on Archer MSA distributions
  line10: `${P1}f1_21[0]`,  // Recapture of various credits
  line11: `${P1}f1_22[0]`,  // Schedule H (household employment taxes)
  line12: `${P1}f1_23[0]`,  // First-time homebuyer credit repayment
  line13: `${P1}f1_24[0]`,  // Section 965 net tax liability installment
  line14: `${P1}f1_25[0]`,  // Uncollected social security and Medicare
  line15: `${P1}f1_26[0]`,  // Tax on excess accumulations
  line16: `${P1}f1_27[0]`,  // Net tax liability under section 965
  line18: `${P2}f2_21[0]`,  // Total additional taxes (sum of Line 17 items)
  line21: `${P2}f2_24[0]`,  // Total Part II → Form 1040 Line 23
}
