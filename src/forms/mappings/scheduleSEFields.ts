/**
 * Schedule SE (Self-Employment Tax) — PDF field name mapping.
 *
 * Field names match the synthetic f1040sse.pdf template generated from
 * IRS field naming conventions. Single page: Section A (Short Schedule SE).
 *
 * Prefix: "topmostSubform[0].Page1[0]."
 */

const P1 = 'topmostSubform[0].Page1[0].'

// ── Header ────────────────────────────────────────────────────

export const SCHSE_HEADER = {
  name: `${P1}f1_1[0]`,
  ssn:  `${P1}f1_2[0]`,
}

// ── Section A — Short Schedule SE ──────────────────────────────

export const SCHSE_LINES = {
  line1a:  `${P1}f1_3[0]`,   // Net farm profit (Schedule F) — zero for us
  line1b:  `${P1}f1_4[0]`,   // Net nonfarm SE income (optional)
  line2:   `${P1}f1_5[0]`,   // Combined net earnings from self-employment
  line3:   `${P1}f1_6[0]`,   // line 2 × 92.35%
  line4a:  `${P1}f1_7[0]`,   // SS taxable amount
  line4b:  `${P1}f1_8[0]`,   // SS tax: line 4a × 12.4%
  line5:   `${P1}f1_9[0]`,   // Medicare tax: line 3 × 2.9%
  line6:   `${P1}f1_10[0]`,  // Self-employment tax (to Schedule 2, Line 4)
  line12:  `${P1}f1_11[0]`,  // Deductible part of SE tax: line 6 × 50%
}
