/**
 * Fill every PDF field with its field name for visual mapping verification.
 * Run: npx tsx scripts/label-pdf-fields.ts
 * Outputs labeled PDFs to /tmp/labeled-*.pdf
 */
import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { PDFDocument } from 'pdf-lib'

const FORMS_DIR = join(import.meta.dirname, '..', 'public', 'forms')

async function labelFields(filename: string) {
  const bytes = readFileSync(join(FORMS_DIR, filename))
  const pdfDoc = await PDFDocument.load(bytes, { ignoreEncryption: true })
  const form = pdfDoc.getForm()
  try { form.deleteXFA() } catch { /* ok */ }

  for (const field of form.getFields()) {
    const name = field.getName()
    const type = field.constructor.name

    if (type === 'PDFTextField') {
      try {
        // Put a short label: just the field number part
        const short = name.replace(/.*\./g, '')
        ;(field as any).setText(short)
      } catch { /* ignore */ }
    } else if (type === 'PDFCheckBox') {
      // Don't check boxes — leave unchecked
    }
  }

  const outBytes = await pdfDoc.save()
  const outFile = `/tmp/labeled-${filename}`
  writeFileSync(outFile, outBytes)
  console.log(`Wrote ${outFile}`)
}

async function main() {
  for (const file of ['f1040.pdf', 'f1040sa.pdf', 'f1040sb.pdf', 'f1040sd.pdf', 'f8949.pdf']) {
    await labelFields(file)
  }
}

main().catch(console.error)
