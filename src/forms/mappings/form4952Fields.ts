/**
 * Form 4952 (Investment Interest Expense Deduction) PDF field name mapping.
 *
 * Field names discovered from IRS f4952.pdf (2025) using pdf-lib enumeration.
 * 17 fields, 1 page.
 * Prefix: "topmostSubform[0].Page1[0]."
 */

const P1 = 'topmostSubform[0].Page1[0].'

// -- Header ---------------------------------------------------------------

export const F4952_HEADER = {
  name: `${P1}f1_01[0]`,
  ssn:  `${P1}f1_02[0]`,
}

// -- Part I -- Total Investment Interest Expense (Lines 1-3) ---------------

export const F4952_PART1 = {
  line1: `${P1}f1_03[0]`,   // Investment interest expense (current year)
  line2: `${P1}f1_04[0]`,   // Disallowed investment interest from prior year
  line3: `${P1}f1_05[0]`,   // Total investment interest (line 1 + line 2)
}

// -- Part II -- Net Investment Income (Lines 4a-4g) ------------------------

export const F4952_PART2 = {
  line4a: `${P1}Line4a_ReadOrder[0].f1_06[0]`,  // Gross income from property held for investment
  line4b: `${P1}f1_07[0]`,   // Qualified dividends included on line 4a
  line4c: `${P1}f1_08[0]`,   // Subtract line 4b from line 4a
  line4d: `${P1}f1_09[0]`,   // Net gain from disposition of investment property
  line4e: `${P1}f1_10[0]`,   // Net gain you elect to include
  line4f: `${P1}f1_11[0]`,   // Investment expenses
  line4g: `${P1}f1_12[0]`,   // Net investment income (line 4c + 4d - 4f)
}

// -- Part III -- Investment Interest Expense Deduction (Lines 5-9) ---------

export const F4952_PART3 = {
  line5: `${P1}f1_13[0]`,   // Smaller of line 3 or line 4g (disallowed portion deducted)
  line6: `${P1}f1_14[0]`,   // Capital gain and qualified dividend election
  line7: `${P1}f1_15[0]`,   // Add lines 5 and 6
  line8: `${P1}f1_16[0]`,   // Investment interest expense deduction → Schedule A line 9
  line9: `${P1}f1_17[0]`,   // Carryforward to next year
}
