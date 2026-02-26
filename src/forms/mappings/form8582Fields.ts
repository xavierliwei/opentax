/**
 * Form 8582 (Passive Activity Loss Limitations) PDF field name mapping.
 *
 * Field names discovered from IRS f8582.pdf (2025) using pdf-lib enumeration.
 * 205 fields, 3 pages.
 * Page 1: Header + Part I (Lines 1–4) + Part II (Lines 5–10) + Part III (Lines 11–16)
 * Page 2: Worksheets 1–3 (Part IV: Activities)
 * Page 3: Worksheets 4–9 (allocation)
 *
 * We only fill Page 1 (the main form). Worksheets are informational.
 */

const P1 = 'topmostSubform[0].Page1[0].'

// ── Header ────────────────────────────────────────────────────

export const F8582_HEADER = {
  name: `${P1}f1_01[0]`,
  ssn:  `${P1}f1_02[0]`,
}

// ── Part I — 2025 Passive Activity Loss ───────────────────────
// Rental Activities With Active Participation (from Worksheet 1)

export const F8582_PART1 = {
  line1a: `${P1}f1_03[0]`,   // Activities with net loss (Worksheet 1, column a)
  line1b: `${P1}f1_04[0]`,   // Activities with net income (Worksheet 1, column b)
  line1c: `${P1}f1_05[0]`,   // Combine lines 1a and 1b
  line2a: `${P1}f1_06[0]`,   // Commercial revitalization deductions (Worksheet 2, column a) — N/A
  line2b: `${P1}f1_07[0]`,   // Commercial revitalization deductions (Worksheet 2, column b) — N/A
  line2c: `${P1}f1_08[0]`,   // Combine lines 2a and 2b — N/A
  line3:  `${P1}f1_09[0]`,   // Combine lines 1c and 2c
  line4:  `${P1}f1_10[0]`,   // If line 3 is a loss, enter as positive; otherwise 0
}

// ── Part II — Special Allowance for Rental Real Estate ─────────
// With Active Participation (Lines 5–10)

export const F8582_PART2 = {
  line5:  `${P1}f1_11[0]`,   // $150,000 ($75,000 if MFS and lived apart)
  line6:  `${P1}f1_12[0]`,   // Modified adjusted gross income (MAGI)
  line7:  `${P1}f1_13[0]`,   // Line 5 minus Line 6 (0 if negative)
  line8:  `${P1}f1_14[0]`,   // Multiply Line 7 by 50% (.50)
  line9:  `${P1}f1_15[0]`,   // $25,000 ($12,500 if MFS and lived apart)
  line10: `${P1}f1_16[0]`,   // Smaller of Line 8 or Line 9
}

// ── Part III — Total Allowed Losses (simplified — not all lines used)

export const F8582_PART3 = {
  line11: `${P1}f1_17[0]`,   // Line 1c loss + Line 2c loss (if any)
  line12: `${P1}f1_18[0]`,   // Enter amount from Line 10
  line16: `${P1}f1_19[0]`,   // Total allowed losses (add lines 10 and 14, etc.)
}
