/**
 * One-time script to discover PDF form field names in IRS templates.
 * Run: npx tsx scripts/enumerate-pdf-fields.ts
 */
import { readFileSync } from 'fs'
import { join } from 'path'
import { PDFDocument } from 'pdf-lib'

const FORMS_DIR = join(import.meta.dirname, '..', 'public', 'forms')

const files = [
  'f1040.pdf',
  'f1040sa.pdf',
  'f1040sb.pdf',
  'f1040sd.pdf',
  'f8949.pdf',
  'state/CA/f540.pdf',
]

async function enumerateFields(filename: string) {
  const bytes = readFileSync(join(FORMS_DIR, filename))
  const pdfDoc = await PDFDocument.load(bytes, { ignoreEncryption: true })

  const form = pdfDoc.getForm()

  // Strip XFA if present to access AcroForm fields
  try {
    form.deleteXFA()
  } catch {
    // No XFA — that's fine
  }

  const fields = form.getFields()

  console.log(`\n${'═'.repeat(80)}`)
  console.log(`${filename} — ${fields.length} fields, ${pdfDoc.getPageCount()} pages`)
  console.log('═'.repeat(80))

  for (const field of fields) {
    const name = field.getName()
    const type = field.constructor.name
    let value = ''

    if (type === 'PDFTextField') {
      try {
        value = (field as any).getText() || ''
      } catch { /* ignore */ }
    } else if (type === 'PDFCheckBox') {
      try {
        value = (field as any).isChecked() ? '[checked]' : '[unchecked]'
      } catch { /* ignore */ }
    } else if (type === 'PDFRadioGroup') {
      try {
        value = `options: ${(field as any).getOptions?.()?.join(', ') || '?'}`
      } catch { /* ignore */ }
    } else if (type === 'PDFDropdown') {
      try {
        value = `options: ${(field as any).getOptions?.()?.join(', ') || '?'}`
      } catch { /* ignore */ }
    }

    console.log(`  ${type.padEnd(18)} ${name.padEnd(50)} ${value}`)
  }
}

async function main() {
  for (const file of files) {
    await enumerateFields(file)
  }
}

main().catch(console.error)
