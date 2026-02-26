/**
 * Idaho Form 40 constants (Tax Year 2025)
 *
 * NOTE: monetary values are represented in cents.
 */

const c = (dollars: number): number => Math.round(dollars * 100)

/** ID flat income tax rate (2025) — 5.695% */
export const ID_FLAT_TAX_RATE = 0.05695

/**
 * Idaho grocery credit (refundable):
 * - $100 per person (taxpayer, spouse, dependents)
 * - $120 per person aged 65 or older
 */
export const ID_GROCERY_CREDIT_STANDARD = c(100)
export const ID_GROCERY_CREDIT_AGE_65 = c(120)

/**
 * Idaho child tax credit (2025):
 * - $205 per qualifying child
 */
export const ID_CHILD_TAX_CREDIT_PER_CHILD = c(205)

/**
 * Idaho Social Security exemption AGI thresholds:
 * - Single: $75,000
 * - MFJ: $100,000
 */
export const ID_SS_AGI_THRESHOLD_SINGLE = c(75000)
export const ID_SS_AGI_THRESHOLD_MFJ = c(100000)

/**
 * Idaho Social Security exemption maximum amounts:
 * - Single: $34,332
 * - MFJ: $68,664
 */
export const ID_SS_EXEMPTION_MAX_SINGLE = c(34332)
export const ID_SS_EXEMPTION_MAX_MFJ = c(68664)
