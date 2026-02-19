/**
 * Form 8863 (Education Credits) PDF field name mapping.
 *
 * Field names discovered from IRS f8863.pdf (2025) using pdf-lib enumeration.
 * 77 fields, 2 pages.
 * Page 1 prefix: "topmostSubform[0].Page1[0]."
 * Page 2 prefix: "topmostSubform[0].Page2[0]."
 */

const P1 = 'topmostSubform[0].Page1[0].'
const P2 = 'topmostSubform[0].Page2[0].'

// ── Header ────────────────────────────────────────────────────

export const F8863_HEADER = {
  name: `${P1}f1_1[0]`,
  ssn1: `${P1}SocialSecurity[0].f1_2[0]`,
  ssn2: `${P1}SocialSecurity[0].f1_3[0]`,
  ssn3: `${P1}SocialSecurity[0].f1_4[0]`,
}

// ── Part I — Refundable American Opportunity Credit ──────────

export const F8863_PART1 = {
  line1:  `${P1}f1_5[0]`,   // Tentative AOTC (from Part III)
  line2:  `${P1}f1_6[0]`,   // Sum of Part III students
  line3:  `${P1}f1_7[0]`,   // Tentative credit (40% of line 1)
  line4:  `${P1}f1_8[0]`,   // Refundable AOTC → Form 1040 Line 29
  line5:  `${P1}f1_9[0]`,   // Subtract line 4 from line 1
}

// ── Part II — Nonrefundable Education Credits ────────────────

export const F8863_PART2 = {
  line9:  `${P1}f1_10[0]`,  // AOTC from Part III (nonrefundable portion)
  line10: `${P1}f1_11[0]`,  // Related field
  line12: `${P1}f1_12[0]`,  // After limitation
  line13: `${P1}f1_13[0]`,  // Tax liability
  line14: `${P1}f1_14[0]`,  // Credits
  line15: `${P1}f1_15[0]`,  // Net tax
  line16: `${P1}f1_16[0]`,  // LLC qualified expenses (up to $10,000)
  line17: `${P1}f1_17[0]`,  // 20% of line 16 (LLC raw credit)
  line18: `${P1}f1_18[0]`,  // Enter smaller of line 12 or line 17
  line19: `${P1}f1_19[0]`,  // Total education credits → Schedule 3 Line 3
  line20: `${P1}f1_20[0]`,  // Phase-out MAGI
  line21: `${P1}f1_21[0]`,  // Phase-out threshold
  line22: `${P1}f1_22[0]`,  // Line 22 (amount)
  line23: `${P1}f1_23[0]`,  // Line 23 (adjacent)
  line24: `${P1}f1_24[0]`,  // LLC after phase-out
  line25: `${P1}f1_25[0]`,  // Total nonrefundable education credits
}

// ── Part III — Student Information (Page 2, two student slots) ─

export const F8863_PAGE2_HEADER = {
  name: `${P2}f2_1[0]`,
  ssn1: `${P2}SSN[0].f2_2[0]`,
  ssn2: `${P2}SSN[0].f2_3[0]`,
  ssn3: `${P2}SSN[0].f2_4[0]`,
}

export const F8863_STUDENT_A = {
  name:          `${P2}Line22a[0].f2_9[0]`,   // Student name
  ssn:           `${P2}Line22a[0].f2_10[0]`,  // Student SSN
  expenses:      `${P2}Line22a[0].f2_11[0]`,  // Adjusted qualified expenses
  subtractLine2: `${P2}Line22a[0].f2_12[0]`,  // Subtract $2,000
  multiply:      `${P2}Line22a[0].f2_13[0]`,  // Multiply by 25%
  addLine:       `${P2}Line22a[0].f2_14[0]`,  // Add amounts
  tentativeAOTC: `${P2}Line22a[0].f2_15[0]`,  // Per-student tentative AOTC
  // Additional fields for detail
  f2_16:         `${P2}Line22a[0].f2_16[0]`,
  f2_17:         `${P2}Line22a[0].f2_17[0]`,
  f2_18:         `${P2}Line22a[0].f2_18[0]`,
  f2_19:         `${P2}Line22a[0].f2_19[0]`,
}

export const F8863_STUDENT_B = {
  name:          `${P2}Line22b[0].f2_20[0]`,
  ssn:           `${P2}Line22b[0].f2_21[0]`,
  expenses:      `${P2}Line22b[0].f2_22[0]`,
  subtractLine2: `${P2}Line22b[0].f2_23[0]`,
  multiply:      `${P2}Line22b[0].f2_24[0]`,
  addLine:       `${P2}Line22b[0].f2_25[0]`,
  tentativeAOTC: `${P2}Line22b[0].f2_26[0]`,
  f2_27:         `${P2}Line22b[0].f2_27[0]`,
  f2_28:         `${P2}Line22b[0].f2_28[0]`,
  f2_29:         `${P2}Line22b[0].f2_29[0]`,
  f2_30:         `${P2}Line22b[0].f2_30[0]`,
}

// Bottom of Page 2: AOTC summary
export const F8863_PART3_TOTALS = {
  line31: `${P2}f2_31[0]`,  // Total tentative AOTC (sum of students)
  line32: `${P2}f2_32[0]`,  // Phase-out computation
  line33: `${P2}f2_33[0]`,  // Phase-out
  line34: `${P2}f2_34[0]`,  // Final AOTC
  line35: `${P2}f2_35[0]`,  // Enter on Part I, line 1
}
