/**
 * Indiana IT-40 constants (Tax Year 2025)
 *
 * NOTE: monetary values are in integer cents.
 */

const c = (dollars: number): number => Math.round(dollars * 100)

/** Indiana flat state income tax rate (2025) */
export const IN_TAX_RATE = 0.0305

/**
 * Indiana personal exemptions (2025):
 * - $1,000 per taxpayer / spouse
 * - $1,500 per dependent
 * - Additional $1,000 for age 65+ (taxpayer or spouse)
 * - Additional $1,000 for blind (taxpayer or spouse)
 */
export const IN_PERSONAL_EXEMPTION = c(1000)
export const IN_DEPENDENT_EXEMPTION = c(1500)
export const IN_AGE65_EXEMPTION = c(1000)
export const IN_BLIND_EXEMPTION = c(1000)

/** Indiana EITC rate: 10% of federal EITC */
export const IN_EITC_RATE = 0.10

/** Indiana renter's deduction maximum ($3,000) */
export const IN_RENTER_DEDUCTION_MAX = c(3000)

/** Indiana 529 plan deduction maximum ($5,000 per contributor) */
export const IN_529_DEDUCTION_MAX = c(5000)

/** Unified tax credit for the elderly thresholds */
export const IN_ELDERLY_CREDIT_SINGLE = c(100)
export const IN_ELDERLY_CREDIT_MFJ = c(200)
export const IN_ELDERLY_CREDIT_AGI_LIMIT = c(10000)

/**
 * Indiana county tax rates.
 * Indiana has 92 counties, each with its own county income tax rate.
 * This is a stub for initial implementation; rates are set to 0.
 * In a full implementation, county codes and rates would be populated.
 */
export const IN_COUNTY_TAX_RATE_DEFAULT = 0
