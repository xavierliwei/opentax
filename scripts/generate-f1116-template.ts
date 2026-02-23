/**
 * Generate a Form 1116 (Foreign Tax Credit) PDF template with fillable fields.
 *
 * This creates a minimal fillable PDF that mirrors the key fields of IRS Form 1116
 * (Passive Category Income) for the simplified portfolio-income path.
 *
 * Run: npx tsx scripts/generate-f1116-template.ts
 */

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

async function generate() {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold)
  const form = doc.getForm()

  // ── Page 1 ────────────────────────────────────────────────
  const page1 = doc.addPage([612, 792])
  const black = rgb(0, 0, 0)
  const gray = rgb(0.4, 0.4, 0.4)

  // Form title
  page1.drawText('Form 1116', { x: 50, y: 750, size: 14, font: fontBold, color: black })
  page1.drawText('Foreign Tax Credit', { x: 130, y: 750, size: 12, font, color: black })
  page1.drawText('(Individual, Estate, or Trust)', { x: 130, y: 736, size: 9, font, color: gray })
  page1.drawText('Department of the Treasury — Internal Revenue Service', { x: 50, y: 722, size: 8, font, color: gray })
  page1.drawText('OMB No. 1545-0121', { x: 460, y: 750, size: 8, font, color: gray })
  page1.drawText('2025', { x: 500, y: 736, size: 11, font: fontBold, color: black })
  page1.drawText('Attachment Sequence No. 19', { x: 420, y: 722, size: 8, font, color: gray })

  // Helper to add a labeled text field
  function addField(
    page: typeof page1,
    name: string,
    label: string,
    x: number, y: number,
    width: number, height: number,
    labelX?: number, labelY?: number,
  ) {
    page.drawText(label, {
      x: labelX ?? x,
      y: (labelY ?? y) + height + 2,
      size: 8,
      font,
      color: gray,
    })
    const field = form.createTextField(name)
    field.addToPage(page, { x, y, width, height, borderWidth: 0.5 })
  }

  // ── Header fields ──────────────────────────────────────────
  addField(page1, 'f1116_p1_name', 'Name(s) shown on return', 50, 690, 300, 16)
  addField(page1, 'f1116_p1_ssn', 'Identifying number', 400, 690, 160, 16)

  // Category checkbox area
  page1.drawText('Use a separate Form 1116 for each category of income listed below.', {
    x: 50, y: 678, size: 8, font, color: black,
  })
  page1.drawText('Category: e  Passive category income', {
    x: 50, y: 664, size: 9, font: fontBold, color: black,
  })

  // Country field
  addField(page1, 'f1116_p1_country', 'g  Country or U.S. possession', 50, 636, 200, 16)

  // ── Part I — Taxable Income from Sources Outside the U.S. ──
  page1.drawText('Part I', { x: 50, y: 618, size: 10, font: fontBold, color: black })
  page1.drawText('Taxable Income or Loss From Sources Outside the United States', {
    x: 95, y: 618, size: 9, font, color: black,
  })

  // Row headers (columns A through the total)
  page1.drawText('(For Category e)', { x: 50, y: 602, size: 8, font, color: gray })

  // Line 1a: Gross foreign-source income — dividends
  addField(page1, 'f1116_p1_1a', '1a  Dividends (foreign source)', 50, 572, 200, 16)

  // Line 1a interest
  addField(page1, 'f1116_p1_1a_int', '1a  Interest (foreign source)', 300, 572, 200, 16)

  // Line 2: Total foreign-source gross income
  addField(page1, 'f1116_p1_2', '2  Total foreign-source gross income', 350, 546, 200, 16)

  // Line 3a: Deductions — definitely allocable
  addField(page1, 'f1116_p1_3a', '3a  Certain itemized deductions or standard deduction', 50, 516, 200, 16)

  // Line 3e: Other deductions
  addField(page1, 'f1116_p1_3e', '3e  Other deductions', 300, 516, 200, 16)

  // Line 3f: Total deductions
  addField(page1, 'f1116_p1_3f', '3f  Total deductions', 350, 490, 200, 16)

  // Line 3g: Net foreign-source taxable income
  addField(page1, 'f1116_p1_3g', '3g  Net foreign-source taxable income', 350, 464, 200, 16)

  // ── Part II — Foreign Taxes Paid or Accrued ──────────────
  page1.drawText('Part II', { x: 50, y: 442, size: 10, font: fontBold, color: black })
  page1.drawText('Foreign Taxes Paid or Accrued', {
    x: 100, y: 442, size: 9, font, color: black,
  })

  // Line 8: Taxes withheld at source on dividends
  addField(page1, 'f1116_p1_8_div', '8  Taxes withheld — dividends', 50, 412, 200, 16)

  // Line 8: Taxes withheld at source on interest
  addField(page1, 'f1116_p1_8_int', '8  Taxes withheld — interest', 300, 412, 200, 16)

  // Line 9: Total foreign taxes paid
  addField(page1, 'f1116_p1_9', '9  Total foreign taxes paid (add lines 7 and 8)', 350, 386, 200, 16)

  // Line 10: Carry-back/carry-over
  addField(page1, 'f1116_p1_10', '10  Carryback or carryover', 350, 360, 200, 16)

  // Line 11: Total taxes (add lines 9 and 10)
  addField(page1, 'f1116_p1_11', '11  Add lines 9 and 10', 350, 334, 200, 16)

  // Line 12: Reduction in foreign taxes
  addField(page1, 'f1116_p1_12', '12  Reduction in foreign taxes', 350, 308, 200, 16)

  // Line 13: Taxes reclassified under high tax kickout
  addField(page1, 'f1116_p1_13', '13  Taxes reclassified under high tax kickout', 350, 282, 200, 16)

  // Line 14: Net foreign taxes
  addField(page1, 'f1116_p1_14', '14  Combine lines 11, 12, and 13', 350, 256, 200, 16)

  // ── Part III — Figuring the Credit ──────────────────────
  page1.drawText('Part III', { x: 50, y: 234, size: 10, font: fontBold, color: black })
  page1.drawText('Figuring the Credit', {
    x: 107, y: 234, size: 9, font, color: black,
  })

  // Line 15: Net foreign-source taxable income from Part I
  addField(page1, 'f1116_p1_15', '15  Enter amount from Part I, line 3g', 350, 208, 200, 16)

  // Line 16: Adjustments
  addField(page1, 'f1116_p1_16', '16  Adjustments to line 15', 350, 182, 200, 16)

  // Line 17: Combine lines 15 and 16
  addField(page1, 'f1116_p1_17', '17  Combine lines 15 and 16', 350, 156, 200, 16)

  // Line 18: Worldwide taxable income
  addField(page1, 'f1116_p1_18', '18  Enter amount from Form 1040, line 15', 350, 130, 200, 16)

  // Line 19: Divide line 17 by line 18 (ratio — not more than 1.0)
  addField(page1, 'f1116_p1_19', '19  Divide line 17 by line 18', 350, 104, 200, 16)

  // Line 20: U.S. tax — Form 1040, line 16
  addField(page1, 'f1116_p1_20', '20  Enter amount from Form 1040, line 16', 350, 78, 200, 16)

  // Line 21: Multiply line 20 by line 19 (limitation)
  addField(page1, 'f1116_p1_21', '21  Multiply line 20 by line 19 (limitation)', 350, 52, 200, 16)

  // ── Page 2 ────────────────────────────────────────────────
  const page2 = doc.addPage([612, 792])
  page2.drawText('Form 1116 (2025)', { x: 50, y: 760, size: 10, font: fontBold, color: black })
  page2.drawText('Page 2', { x: 500, y: 760, size: 10, font: fontBold, color: black })

  // Header fields page 2
  addField(page2, 'f1116_p2_name', 'Name(s)', 50, 730, 300, 16)
  addField(page2, 'f1116_p2_ssn', 'Identifying number', 400, 730, 160, 16)

  // Part III continued
  page2.drawText('Part III (continued)', { x: 50, y: 716, size: 10, font: fontBold, color: black })

  // Line 22: Enter the smaller of line 14 or line 21
  addField(page2, 'f1116_p2_22', '22  Enter the smaller of line 14 or line 21', 350, 690, 200, 16)

  // Line 23: Reduction for foreign tax credit from other categories
  addField(page2, 'f1116_p2_23', '23  Reduction for other categories', 350, 664, 200, 16)

  // Line 24: Combine lines 22 and 23
  addField(page2, 'f1116_p2_24', '24  Combine lines 22 and 23', 350, 638, 200, 16)

  // Line 25–33: Aggregate credits from all categories
  addField(page2, 'f1116_p2_33', '33  Enter the smaller of line 24 or line 32', 350, 612, 200, 16)

  // Line 34: Carryback/carryforward informational
  addField(page2, 'f1116_p2_34', '34  Excess credit this year (informational)', 350, 586, 200, 16)

  // ── Part IV — Summary of Credits ────────────────────────
  page2.drawText('Part IV', { x: 50, y: 564, size: 10, font: fontBold, color: black })
  page2.drawText('Summary of Credits From Separate Parts III', {
    x: 105, y: 564, size: 9, font, color: black,
  })

  // Line 35: Credit for passive category income
  addField(page2, 'f1116_p2_35', '35  Credit — Passive category income', 350, 538, 200, 16)

  // Line 36–38: Other categories
  addField(page2, 'f1116_p2_36', '36  Credit — General category income', 350, 512, 200, 16)
  addField(page2, 'f1116_p2_37', '37  Credit — Section 901(j) income', 350, 486, 200, 16)

  // Line 38: Total foreign tax credit -- Schedule 3, Line 1
  addField(page2, 'f1116_p2_38', '38  Total -- to Schedule 3, Line 1', 350, 460, 200, 16)

  // Unsupported scenarios note
  page2.drawText('Note: This form covers passive category income only (portfolio dividends/interest).', {
    x: 50, y: 430, size: 8, font, color: gray,
  })
  page2.drawText('General category income, carryback/carryforward, and AMT foreign tax credit', {
    x: 50, y: 418, size: 8, font, color: gray,
  })
  page2.drawText('are not supported in this version.', {
    x: 50, y: 406, size: 8, font, color: gray,
  })

  // Save
  const bytes = await doc.save()
  const outPath = join(__dirname, '../public/forms/f1116.pdf')
  writeFileSync(outPath, bytes)
  console.log(`Generated ${outPath} (${bytes.length} bytes)`)
}

generate().catch(console.error)
