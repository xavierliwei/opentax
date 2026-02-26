/**
 * Form 8995-A (Qualified Business Income Deduction — Above Threshold) PDF field mapping.
 *
 * Field names discovered from IRS f8995a.pdf (2025) using pdf-lib enumeration.
 * 111 fields total: 102 text fields, 9 checkboxes. 2 pages.
 * Prefix: "topmostSubform[0].Page{N}[0]."
 *
 * Form structure:
 *   Page 1: Header, Part I (business info, 3 rows), Part II (QBI computation, lines 2-16)
 *   Page 2: Part III (phased-in reduction, lines 17-26), Part IV (deduction, lines 27-40)
 */

const P1 = 'topmostSubform[0].Page1[0].'
const P2 = 'topmostSubform[0].Page2[0].'
const T1 = `${P1}Table_PartI[0].`
const T2 = `${P1}Table_PartII[0].`
const T3 = `${P2}Table_PartIII[0].`

// ── Header ────────────────────────────────────────────────────

export const F8995A_HEADER = {
  name:  `${P1}f1_01[0]`,   // Name(s) shown on return
  ssn:   `${P1}f1_02[0]`,   // Your taxpayer identification number
}

// ── Part I: Trade, Business, or Aggregation Information ──────
// 3 rows (A, B, C) with: name, specified service checkbox, aggregation checkbox, TIN, patron checkbox

export const F8995A_PART1 = {
  rowA_name:        `${T1}RowA[0].f1_03[0]`,   // Row A — business name
  rowA_specService: `${T1}RowA[0].c1_1[0]`,    // Row A — specified service checkbox
  rowA_aggregation: `${T1}RowA[0].c1_2[0]`,    // Row A — aggregation checkbox
  rowA_tin:         `${T1}RowA[0].f1_04[0]`,   // Row A — TIN
  rowA_patron:      `${T1}RowA[0].c1_3[0]`,    // Row A — patron checkbox

  rowB_name:        `${T1}RowB[0].f1_05[0]`,   // Row B — business name
  rowB_specService: `${T1}RowB[0].c1_4[0]`,    // Row B — specified service checkbox
  rowB_aggregation: `${T1}RowB[0].c1_5[0]`,    // Row B — aggregation checkbox
  rowB_tin:         `${T1}RowB[0].f1_06[0]`,   // Row B — TIN
  rowB_patron:      `${T1}RowB[0].c1_6[0]`,    // Row B — patron checkbox

  rowC_name:        `${T1}RowC[0].f1_07[0]`,   // Row C — business name
  rowC_specService: `${T1}RowC[0].c1_7[0]`,    // Row C — specified service checkbox
  rowC_aggregation: `${T1}RowC[0].c1_8[0]`,    // Row C — aggregation checkbox
  rowC_tin:         `${T1}RowC[0].f1_08[0]`,   // Row C — TIN
  rowC_patron:      `${T1}RowC[0].c1_9[0]`,    // Row C — patron checkbox
}

// ── Part II: Determine Your Adjusted QBI (Lines 2-16) ────────
// Each line has columns A, B, C (one per business)
// field naming: Row{N}[0].f1_{seq}[0]

export const F8995A_PART2 = {
  // Line 2: QBI from business
  line2_a:  `${T2}Row2[0].f1_09[0]`,
  line2_b:  `${T2}Row2[0].f1_10[0]`,
  line2_c:  `${T2}Row2[0].f1_11[0]`,

  // Line 3: 20% of QBI
  line3_a:  `${T2}Row3[0].f1_12[0]`,
  line3_b:  `${T2}Row3[0].f1_13[0]`,
  line3_c:  `${T2}Row3[0].f1_14[0]`,

  // Line 4: W-2 wages
  line4_a:  `${T2}Row4[0].f1_15[0]`,
  line4_b:  `${T2}Row4[0].f1_16[0]`,
  line4_c:  `${T2}Row4[0].f1_17[0]`,

  // Line 5: 50% of W-2 wages
  line5_a:  `${T2}Row5[0].f1_18[0]`,
  line5_b:  `${T2}Row5[0].f1_19[0]`,
  line5_c:  `${T2}Row5[0].f1_20[0]`,

  // Line 6: 25% of W-2 wages
  line6_a:  `${T2}Row6[0].f1_21[0]`,
  line6_b:  `${T2}Row6[0].f1_22[0]`,
  line6_c:  `${T2}Row6[0].f1_23[0]`,

  // Line 7: UBIA of qualified property
  line7_a:  `${T2}Row7[0].f1_24[0]`,
  line7_b:  `${T2}Row7[0].f1_25[0]`,
  line7_c:  `${T2}Row7[0].f1_26[0]`,

  // Line 8: 2.5% of UBIA
  line8_a:  `${T2}Row8[0].f1_27[0]`,
  line8_b:  `${T2}Row8[0].f1_28[0]`,
  line8_c:  `${T2}Row8[0].f1_29[0]`,

  // Line 9: Line 6 + Line 8
  line9_a:  `${T2}Row9[0].f1_30[0]`,
  line9_b:  `${T2}Row9[0].f1_31[0]`,
  line9_c:  `${T2}Row9[0].f1_32[0]`,

  // Line 10: Greater of line 5 or line 9
  line10_a: `${T2}Row10[0].f1_33[0]`,
  line10_b: `${T2}Row10[0].f1_34[0]`,
  line10_c: `${T2}Row10[0].f1_35[0]`,

  // Line 11: Smaller of line 3 or line 10
  line11_a: `${T2}Row11[0].f1_36[0]`,
  line11_b: `${T2}Row11[0].f1_37[0]`,
  line11_c: `${T2}Row11[0].f1_38[0]`,

  // Line 12: Phased-in reduction from Part III
  line12_a: `${T2}Row12[0].f1_39[0]`,
  line12_b: `${T2}Row12[0].f1_40[0]`,
  line12_c: `${T2}Row12[0].f1_41[0]`,

  // Line 13: Greater of line 11 or line 12
  line13_a: `${T2}Row13[0].f1_42[0]`,
  line13_b: `${T2}Row13[0].f1_43[0]`,
  line13_c: `${T2}Row13[0].f1_44[0]`,

  // Line 14: Patron reduction (not modeled)
  line14_a: `${T2}Row14[0].f1_45[0]`,
  line14_b: `${T2}Row14[0].f1_46[0]`,
  line14_c: `${T2}Row14[0].f1_47[0]`,

  // Line 15: QBI component (line 13 minus line 14)
  line15_a: `${T2}Row15[0].f1_48[0]`,
  line15_b: `${T2}Row15[0].f1_49[0]`,
  line15_c: `${T2}Row15[0].f1_50[0]`,

  // Line 16: Total QBI component (sum of line 15)
  line16_a: `${T2}Row16[0].f1_51[0]`,
  line16_b: `${T2}Row16[0].f1_52[0]`,
  line16_c: `${T2}Row16[0].f1_53[0]`,
}

// ── Part III: Phased-in Reduction (Lines 17-26) ──────────────
// Columns A, B, C for lines 17-19, 25-26
// Lines 20-24 are single-column (shared across all businesses)

export const F8995A_PART3 = {
  // Line 17: Enter amounts from line 3
  line17_a: `${T3}Row17[0].f2_01[0]`,
  line17_b: `${T3}Row17[0].f2_02[0]`,
  line17_c: `${T3}Row17[0].f2_03[0]`,

  // Line 18: Enter amounts from line 10
  line18_a: `${T3}Row18[0].f2_04[0]`,
  line18_b: `${T3}Row18[0].f2_05[0]`,
  line18_c: `${T3}Row18[0].f2_06[0]`,

  // Line 19: Line 17 minus line 18
  line19_a: `${T3}Row19[0].f2_07[0]`,
  line19_b: `${T3}Row19[0].f2_08[0]`,
  line19_c: `${T3}Row19[0].f2_09[0]`,

  // Line 20: Taxable income before QBI deduction (single value)
  line20:   `${T3}Row20[0].Ln20[0].f2_10[0]`,

  // Line 21: Threshold (single value)
  line21:   `${T3}Row21[0].Ln21[0].f2_14[0]`,

  // Line 22: Line 20 minus line 21 (single value)
  line22:   `${T3}Row22[0].Ln22[0].f2_18[0]`,

  // Line 23: Phase-in range (single value)
  line23:   `${T3}Row23[0].Ln23[0].f2_22[0]`,

  // Line 24: Phase-in percentage (single value)
  line24:   `${T3}Row24[0].Ln24[0].f2_26[0]`,

  // Line 25: Total phase-in reduction (line 19 × line 24)
  line25_a: `${T3}Row25[0].f2_30[0]`,
  line25_b: `${T3}Row25[0].f2_31[0]`,
  line25_c: `${T3}Row25[0].f2_32[0]`,

  // Line 26: QBI after phase-in reduction (line 17 minus line 25)
  line26_a: `${T3}Row26[0].f2_33[0]`,
  line26_b: `${T3}Row26[0].f2_34[0]`,
  line26_c: `${T3}Row26[0].f2_35[0]`,
}

// ── Part IV: Determine Your QBI Deduction (Lines 27-40) ──────

export const F8995A_PART4 = {
  line27: `${P2}f2_36[0]`,   // Line 27: Total QBI component (from line 16)
  line28: `${P2}f2_37[0]`,   // Line 28: REIT dividends / PTP income
  line29: `${P2}f2_38[0]`,   // Line 29: REIT/PTP loss carryforward
  line30: `${P2}f2_39[0]`,   // Line 30: Total REIT/PTP income
  line31: `${P2}f2_40[0]`,   // Line 31: REIT/PTP component (20%)
  line32: `${P2}f2_41[0]`,   // Line 32: QBI deduction before income limitation
  line33: `${P2}f2_42[0]`,   // Line 33: Taxable income before QBI deduction
  line34: `${P2}f2_43[0]`,   // Line 34: Net capital gain + qualified dividends
  line35: `${P2}f2_44[0]`,   // Line 35: Line 33 minus line 34
  line36: `${P2}f2_45[0]`,   // Line 36: Income limitation (20% of line 35)
  line37: `${P2}f2_46[0]`,   // Line 37: QBI deduction before DPAD
  line38: `${P2}f2_47[0]`,   // Line 38: DPAD (not modeled)
  line39: `${P2}f2_48[0]`,   // Line 39: Total QBI deduction
  line40: `${P2}f2_49[0]`,   // Line 40: REIT/PTP loss carryforward
}
