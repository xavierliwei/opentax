/**
 * Colorado DR 0104 constants (Tax Year 2025)
 *
 * NOTE: monetary values are represented in cents.
 */

/** CO flat income tax rate (2025) — 4.40% */
export const CO_FLAT_TAX_RATE = 0.044

/** CO EITC rate — 38% of federal EITC */
export const CO_EITC_RATE = 0.38

/** CO Child Tax Credit rate — simplified at 20% of federal CTC for now */
export const CO_CTC_RATE = 0.20

/**
 * CO pension/annuity subtraction limits (2025):
 * - Age 65+: $24,000
 * - Age 55-64: $20,000
 * - Under 55: $0
 */
export const CO_PENSION_SUBTRACTION_65_PLUS = 24_000_00  // $24,000 in cents
export const CO_PENSION_SUBTRACTION_55_TO_64 = 20_000_00 // $20,000 in cents
