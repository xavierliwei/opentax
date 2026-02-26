/**
 * Illinois IL-1040 constants (Tax Year 2025)
 *
 * NOTE: monetary values are represented in cents.
 */

const c = (dollars: number): number => Math.round(dollars * 100)

/** IL flat income tax rate (2025) */
export const IL_FLAT_TAX_RATE = 0.0495

/** IL personal exemption allowance per person (2025) */
export const IL_PERSONAL_EXEMPTION = c(2625)

/** IL Earned Income Credit: 20% of federal EITC (2025) */
export const IL_EIC_RATE = 0.20

/** IL property tax credit rate: 5% of property taxes paid */
export const IL_PROPERTY_TAX_CREDIT_RATE = 0.05

/** IL property tax credit max per person ($500 single / $250 each for joint) */
export const IL_PROPERTY_TAX_CREDIT_MAX_SINGLE = c(500)
export const IL_PROPERTY_TAX_CREDIT_MAX_PER_PERSON = c(250)

/** IL Child Tax Credit: $100 per qualifying child */
export const IL_CHILD_TAX_CREDIT_PER_CHILD = c(100)
