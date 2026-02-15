/**
 * Form 1040 PDF field name mapping.
 *
 * Field names discovered from IRS f1040.pdf (2025) using pdf-lib enumeration.
 * Prefix: Page 1 = "topmostSubform[0].Page1[0].", Page 2 = "topmostSubform[0].Page2[0]."
 */

const P1 = 'topmostSubform[0].Page1[0].'
const P1A = `${P1}Address_ReadOrder[0].`
const P2 = 'topmostSubform[0].Page2[0].'

// ── Header fields ────────────────────────────────────────────

export const F1040_HEADER = {
  firstName:       `${P1}f1_14[0]`,
  lastName:        `${P1}f1_15[0]`,
  ssn:             `${P1}f1_16[0]`,
  spouseFirstName: `${P1}f1_17[0]`,
  spouseLastName:  `${P1}f1_18[0]`,
  spouseSSN:       `${P1}f1_19[0]`,
  street:          `${P1A}f1_20[0]`,
  apartment:       `${P1A}f1_21[0]`,
  city:            `${P1A}f1_22[0]`,
  state:           `${P1A}f1_23[0]`,
  zip:             `${P1A}f1_24[0]`,
}

// ── Filing status checkboxes ─────────────────────────────────

export const F1040_FILING_STATUS = {
  single: `${P1}c1_5[0]`,
  mfj:    `${P1}c1_6[0]`,
  mfs:    `${P1}c1_7[0]`,
  hoh:    `${P1}Checkbox_ReadOrder[0].c1_8[0]`,
  qw:     `${P1}Checkbox_ReadOrder[0].c1_8[1]`,
}

// ── Page 1: Income lines ─────────────────────────────────────

export const F1040_INCOME = {
  line1a: `${P1}f1_47[0]`,  // Wages
  line1z: `${P1}f1_57[0]`,  // Sum of 1a–1i
  line2a: `${P1}f1_58[0]`,  // Tax-exempt interest
  line2b: `${P1}f1_59[0]`,  // Taxable interest
  line3a: `${P1}f1_60[0]`,  // Qualified dividends
  line3b: `${P1}f1_61[0]`,  // Ordinary dividends
  line4a: `${P1}f1_62[0]`,  // IRA distributions
  line4b: `${P1}f1_63[0]`,  // Taxable IRA
  line5a: `${P1}f1_65[0]`,  // Pensions
  line5b: `${P1}f1_66[0]`,  // Taxable pensions
  line6a: `${P1}f1_68[0]`,  // Social Security
  line6b: `${P1}f1_69[0]`,  // Taxable SS
  line7a: `${P1}f1_70[0]`,  // Capital gain/loss
  line8:  `${P1}f1_72[0]`,  // Other income
  line9:  `${P1}f1_73[0]`,  // Total income
  line10: `${P1}f1_74[0]`,  // Adjustments
  line11a:`${P1}f1_75[0]`,  // AGI
}

// ── Page 2: Tax, credits, payments ───────────────────────────

export const F1040_PAGE2 = {
  line11b: `${P2}f2_01[0]`,  // AGI (repeated)
  line12e: `${P2}f2_02[0]`,  // Standard/itemized deduction
  line13a: `${P2}f2_03[0]`,  // QBI deduction
  line13b: `${P2}f2_04[0]`,  // Additional deductions
  line14:  `${P2}f2_05[0]`,  // Total deductions
  line15:  `${P2}f2_06[0]`,  // Taxable income
  line16:  `${P2}f2_08[0]`,  // Tax
  line17:  `${P2}f2_09[0]`,  // Schedule 2 line 3
  line18:  `${P2}f2_10[0]`,  // Lines 16+17
  line19:  `${P2}f2_11[0]`,  // Child tax credit
  line22:  `${P2}f2_14[0]`,  // Line 18 - line 21
  line24:  `${P2}f2_16[0]`,  // Total tax
  line25a: `${P2}f2_17[0]`,  // W-2 withholding
  line25b: `${P2}f2_18[0]`,  // 1099 withholding
  line25d: `${P2}f2_20[0]`,  // Total withholding
  line33:  `${P2}f2_29[0]`,  // Total payments
  line34:  `${P2}f2_30[0]`,  // Overpaid
  line35a: `${P2}f2_31[0]`,  // Refund amount
  line37:  `${P2}f2_35[0]`,  // Amount you owe
}
