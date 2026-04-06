/**
 * Hawaii Form N-11 constants (Tax Year 2025)
 *
 * Sources:
 *   - Hawaii Department of Taxation Form N-11 Instructions
 *   - Hawaii Revised Statutes Chapter 235
 *
 * NOTE: All dollar amounts are in cents.
 *
 * SCAFFOLD DISCLOSURE: Bracket thresholds and deduction amounts are based on
 * 2024 HI tax law. Official 2025 values should be verified when HI DoTax
 * publishes final N-11 instructions.
 */

import type { FilingStatus } from '../../../model/types'

const c = (dollars: number): number => Math.round(dollars * 100)

/**
 * HI progressive income tax brackets (12 brackets — most of any state).
 *
 * Single:
 * 1.40% ($0–$2,400), 3.20% ($2,400–$4,800), 5.50% ($4,800–$9,600),
 * 6.40% ($9,600–$14,400), 6.80% ($14,400–$19,200), 7.20% ($19,200–$24,000),
 * 7.60% ($24,000–$36,000), 7.90% ($36,000–$48,000), 8.25% ($48,000–$150,000),
 * 9.00% ($150,000–$175,000), 10.00% ($175,000–$200,000), 11.00% ($200,000+)
 *
 * MFJ/QW brackets are doubled.
 */
export const HI_TAX_BRACKETS: Record<FilingStatus, { limit: number; rate: number }[]> = {
  single: [
    { limit: c(2400),    rate: 0.014 },
    { limit: c(4800),    rate: 0.032 },
    { limit: c(9600),    rate: 0.055 },
    { limit: c(14400),   rate: 0.064 },
    { limit: c(19200),   rate: 0.068 },
    { limit: c(24000),   rate: 0.072 },
    { limit: c(36000),   rate: 0.076 },
    { limit: c(48000),   rate: 0.079 },
    { limit: c(150000),  rate: 0.0825 },
    { limit: c(175000),  rate: 0.09 },
    { limit: c(200000),  rate: 0.10 },
    { limit: Infinity,   rate: 0.11 },
  ],
  mfj: [
    { limit: c(4800),    rate: 0.014 },
    { limit: c(9600),    rate: 0.032 },
    { limit: c(19200),   rate: 0.055 },
    { limit: c(28800),   rate: 0.064 },
    { limit: c(38400),   rate: 0.068 },
    { limit: c(48000),   rate: 0.072 },
    { limit: c(72000),   rate: 0.076 },
    { limit: c(96000),   rate: 0.079 },
    { limit: c(300000),  rate: 0.0825 },
    { limit: c(350000),  rate: 0.09 },
    { limit: c(400000),  rate: 0.10 },
    { limit: Infinity,   rate: 0.11 },
  ],
  hoh: [
    { limit: c(3600),    rate: 0.014 },
    { limit: c(7200),    rate: 0.032 },
    { limit: c(14400),   rate: 0.055 },
    { limit: c(21600),   rate: 0.064 },
    { limit: c(28800),   rate: 0.068 },
    { limit: c(36000),   rate: 0.072 },
    { limit: c(54000),   rate: 0.076 },
    { limit: c(72000),   rate: 0.079 },
    { limit: c(225000),  rate: 0.0825 },
    { limit: c(262500),  rate: 0.09 },
    { limit: c(300000),  rate: 0.10 },
    { limit: Infinity,   rate: 0.11 },
  ],
  mfs: [
    { limit: c(2400),    rate: 0.014 },
    { limit: c(4800),    rate: 0.032 },
    { limit: c(9600),    rate: 0.055 },
    { limit: c(14400),   rate: 0.064 },
    { limit: c(19200),   rate: 0.068 },
    { limit: c(24000),   rate: 0.072 },
    { limit: c(36000),   rate: 0.076 },
    { limit: c(48000),   rate: 0.079 },
    { limit: c(150000),  rate: 0.0825 },
    { limit: c(175000),  rate: 0.09 },
    { limit: c(200000),  rate: 0.10 },
    { limit: Infinity,   rate: 0.11 },
  ],
  qw: [
    { limit: c(4800),    rate: 0.014 },
    { limit: c(9600),    rate: 0.032 },
    { limit: c(19200),   rate: 0.055 },
    { limit: c(28800),   rate: 0.064 },
    { limit: c(38400),   rate: 0.068 },
    { limit: c(48000),   rate: 0.072 },
    { limit: c(72000),   rate: 0.076 },
    { limit: c(96000),   rate: 0.079 },
    { limit: c(300000),  rate: 0.0825 },
    { limit: c(350000),  rate: 0.09 },
    { limit: c(400000),  rate: 0.10 },
    { limit: Infinity,   rate: 0.11 },
  ],
}

/**
 * HI standard deduction — Hawaii uses its own amounts.
 */
export const HI_STANDARD_DEDUCTION: Record<FilingStatus, number> = {
  single: c(2200),
  mfj:    c(4400),
  mfs:    c(2200),
  hoh:    c(3212),
  qw:     c(4400),
}

/**
 * HI personal exemption — $1,144 per person.
 *
 * Applies to taxpayer, spouse (if MFJ), and each dependent.
 */
export const HI_PERSONAL_EXEMPTION = c(1144)

/**
 * HI EITC — 20% of federal EITC (nonrefundable).
 */
export const HI_EITC_RATE = 0.20

/**
 * HI Food/Excise Tax Credit — nonrefundable credit for low/moderate income.
 *
 * $110 per exemption for single filers with AGI <= $30,000.
 * $110 per exemption for MFJ filers with AGI <= $50,000.
 */
export const HI_FOOD_EXCISE_CREDIT_PER_EXEMPTION = c(110)
export const HI_FOOD_EXCISE_CREDIT_AGI_LIMIT: Record<FilingStatus, number> = {
  single: c(30000),
  mfj:    c(50000),
  mfs:    c(25000),
  hoh:    c(40000),
  qw:     c(50000),
}
