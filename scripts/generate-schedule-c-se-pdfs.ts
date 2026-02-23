/**
 * Generate synthetic fillable PDF templates for Schedule C and Schedule SE.
 *
 * These templates contain the correct field names that the fillers expect,
 * enabling end-to-end testing of the PDF filling pipeline.
 *
 * Run: npx tsx scripts/generate-schedule-c-se-pdfs.ts
 */

import { PDFDocument, PDFTextField } from 'pdf-lib'
import { writeFileSync } from 'fs'
import { join } from 'path'

const FORMS_DIR = join(import.meta.dirname, '..', 'public', 'forms')

// ── Schedule C field names ──────────────────────────────────────
// Follows IRS naming pattern: topmostSubform[0].Page1[0].f1_NN[0]

const SCHC_P1 = 'topmostSubform[0].Page1[0].'
const SCHC_P2 = 'topmostSubform[0].Page2[0].'

const SCHEDULE_C_FIELDS = [
  // Header
  `${SCHC_P1}f1_1[0]`,   // Name of proprietor
  `${SCHC_P1}f1_2[0]`,   // SSN
  // Lines A–F
  `${SCHC_P1}f1_3[0]`,   // Line A — principal business or profession
  `${SCHC_P1}f1_4[0]`,   // Line B — business code (6 digits)
  `${SCHC_P1}f1_5[0]`,   // Line C — business name
  `${SCHC_P1}f1_6[0]`,   // Line D — EIN
  `${SCHC_P1}f1_7[0]`,   // Line E — business address
  // Part I — Income
  `${SCHC_P1}f1_8[0]`,   // Line 1 — Gross receipts
  `${SCHC_P1}f1_9[0]`,   // Line 2 — Returns and allowances
  `${SCHC_P1}f1_10[0]`,  // Line 3 — Gross profit (line 1 minus line 2)
  `${SCHC_P1}f1_11[0]`,  // Line 4 — Cost of goods sold
  `${SCHC_P1}f1_12[0]`,  // Line 5 — Gross profit (line 3 minus line 4)
  `${SCHC_P1}f1_13[0]`,  // Line 6 — Other income
  `${SCHC_P1}f1_14[0]`,  // Line 7 — Gross income (line 5 + line 6)
  // Part II — Expenses
  `${SCHC_P1}f1_15[0]`,  // Line 8 — Advertising
  `${SCHC_P1}f1_16[0]`,  // Line 9 — Car and truck expenses
  `${SCHC_P1}f1_17[0]`,  // Line 10 — Commissions and fees
  `${SCHC_P1}f1_18[0]`,  // Line 11 — Contract labor
  `${SCHC_P1}f1_19[0]`,  // Line 12 — Depletion
  `${SCHC_P1}f1_20[0]`,  // Line 13 — Depreciation
  `${SCHC_P1}f1_21[0]`,  // Line 14 — Employee benefit programs
  `${SCHC_P1}f1_22[0]`,  // Line 15 — Insurance (other than health)
  `${SCHC_P1}f1_23[0]`,  // Line 16a — Mortgage interest (to banks)
  `${SCHC_P1}f1_24[0]`,  // Line 16b — Other interest
  `${SCHC_P1}f1_25[0]`,  // Line 17 — Legal and professional services
  `${SCHC_P1}f1_26[0]`,  // Line 18 — Office expense
  `${SCHC_P1}f1_27[0]`,  // Line 19 — Pension and profit-sharing plans
  `${SCHC_P1}f1_28[0]`,  // Line 20a — Rent: vehicles, machinery, equipment
  `${SCHC_P1}f1_29[0]`,  // Line 20b — Rent: other business property
  `${SCHC_P1}f1_30[0]`,  // Line 21 — Repairs and maintenance
  `${SCHC_P1}f1_31[0]`,  // Line 22 — Supplies
  `${SCHC_P1}f1_32[0]`,  // Line 23 — Taxes and licenses
  `${SCHC_P1}f1_33[0]`,  // Line 24a — Travel
  `${SCHC_P1}f1_34[0]`,  // Line 24b — Deductible meals
  `${SCHC_P1}f1_35[0]`,  // Line 25 — Utilities
  `${SCHC_P1}f1_36[0]`,  // Line 26 — Wages
  `${SCHC_P1}f1_37[0]`,  // Line 27a — Other expenses
  `${SCHC_P1}f1_38[0]`,  // Line 28 — Total expenses
  `${SCHC_P1}f1_39[0]`,  // Line 29 — Tentative profit (loss)
  `${SCHC_P1}f1_40[0]`,  // Line 30 — Business use of home
  `${SCHC_P1}f1_41[0]`,  // Line 31 — Net profit or (loss)
]

const SCHEDULE_C_CHECKBOXES = [
  `${SCHC_P1}c1_1[0]`,   // Line F — Accounting method: Cash
  `${SCHC_P1}c1_1[1]`,   // Line F — Accounting method: Accrual
  `${SCHC_P1}c1_2[0]`,   // Line G — Yes (materially participate)
  `${SCHC_P1}c1_2[1]`,   // Line G — No
  `${SCHC_P1}c1_3[0]`,   // Line 32a — All investment at risk: Yes
  `${SCHC_P1}c1_3[1]`,   // Line 32a — No
]

// ── Schedule SE field names ──────────────────────────────────────
const SCHSE_P1 = 'topmostSubform[0].Page1[0].'

const SCHEDULE_SE_FIELDS = [
  // Header
  `${SCHSE_P1}f1_1[0]`,  // Name
  `${SCHSE_P1}f1_2[0]`,  // SSN
  // Section A — Short Schedule SE
  `${SCHSE_P1}f1_3[0]`,  // Line 1a — Net farm profit (skip — zero for us)
  `${SCHSE_P1}f1_4[0]`,  // Line 1b — Net nonfarm SE income (skip — use line 2)
  `${SCHSE_P1}f1_5[0]`,  // Line 2 — Combined net earnings from SE
  `${SCHSE_P1}f1_6[0]`,  // Line 3 — line 2 × 92.35%
  `${SCHSE_P1}f1_7[0]`,  // Line 4a — SS taxable amount
  `${SCHSE_P1}f1_8[0]`,  // Line 4b — SS tax
  `${SCHSE_P1}f1_9[0]`,  // Line 5 — Medicare tax
  `${SCHSE_P1}f1_10[0]`, // Line 6 — Total SE tax (to Schedule 2, line 4)
  `${SCHSE_P1}f1_11[0]`, // Line 12 — Deductible part of SE tax (50%)
]

async function generateScheduleC(): Promise<void> {
  const pdfDoc = await PDFDocument.create()
  // Page 1 — income and expenses
  pdfDoc.addPage([612, 792])
  // Page 2 — Parts III-V (COGS, vehicle info, other expenses)
  pdfDoc.addPage([612, 792])

  const form = pdfDoc.getForm()

  for (const fieldName of SCHEDULE_C_FIELDS) {
    form.createTextField(fieldName)
  }

  for (const fieldName of SCHEDULE_C_CHECKBOXES) {
    form.createCheckBox(fieldName)
  }

  const pdfBytes = await pdfDoc.save()
  writeFileSync(join(FORMS_DIR, 'f1040sc.pdf'), pdfBytes)
  console.log(`Generated f1040sc.pdf (${SCHEDULE_C_FIELDS.length} text fields, ${SCHEDULE_C_CHECKBOXES.length} checkboxes)`)
}

async function generateScheduleSE(): Promise<void> {
  const pdfDoc = await PDFDocument.create()
  // Single page for Section A (short form)
  pdfDoc.addPage([612, 792])

  const form = pdfDoc.getForm()

  for (const fieldName of SCHEDULE_SE_FIELDS) {
    form.createTextField(fieldName)
  }

  const pdfBytes = await pdfDoc.save()
  writeFileSync(join(FORMS_DIR, 'f1040sse.pdf'), pdfBytes)
  console.log(`Generated f1040sse.pdf (${SCHEDULE_SE_FIELDS.length} text fields)`)
}

async function main() {
  await generateScheduleC()
  await generateScheduleSE()
  console.log('Done.')
}

main().catch(console.error)
