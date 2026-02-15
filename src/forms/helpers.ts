/**
 * Formatting utilities for IRS PDF form filling.
 *
 * All inputs are in integer cents. Outputs are formatted strings
 * ready to be inserted into PDF text fields.
 */

import { PDFForm } from 'pdf-lib'

// ── Dollar formatting ────────────────────────────────────────

/**
 * Format cents as whole dollars for IRS form fields.
 * Negative amounts use parentheses per IRS convention.
 *
 *   formatDollars(7500000)  → "75,000"
 *   formatDollars(0)        → "0"
 *   formatDollars(-300000)  → "(3,000)"
 */
export function formatDollars(amountCents: number): string {
  const wholeDollars = Math.trunc(amountCents / 100)
  if (wholeDollars < 0) {
    return `(${Math.abs(wholeDollars).toLocaleString('en-US')})`
  }
  return wholeDollars.toLocaleString('en-US')
}

/**
 * Format cents as dollars and cents (for Form 8949 transaction rows).
 *
 *   formatDollarsAndCents(7500050)  → "75,000.50"
 *   formatDollarsAndCents(0)        → "0.00"
 *   formatDollarsAndCents(-300025)  → "(3,000.25)"
 */
export function formatDollarsAndCents(amountCents: number): string {
  const abs = Math.abs(amountCents)
  const dollars = Math.trunc(abs / 100)
  const cents = abs % 100
  const formatted = `${dollars.toLocaleString('en-US')}.${String(cents).padStart(2, '0')}`
  if (amountCents < 0) return `(${formatted})`
  return formatted
}

// ── SSN / Date formatting ────────────────────────────────────

/** Format SSN as XXX-XX-XXXX. Input: 9 digits, no dashes. */
export function formatSSN(ssn: string): string {
  const digits = ssn.replace(/\D/g, '')
  return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5, 9)}`
}

/** Format ISO date (YYYY-MM-DD) as MM/DD/YYYY. */
export function formatDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-')
  return `${m}/${d}/${y}`
}

/** Format ISO date as MM/DD/YY (short form for Form 8949). */
export function formatDateShort(isoDate: string | null): string {
  if (!isoDate) return 'Various'
  const [y, m, d] = isoDate.split('-')
  return `${m}/${d}/${y.slice(2)}`
}

// ── PDF field helpers ────────────────────────────────────────

/**
 * Set a PDF text field, silently skipping if the field doesn't exist.
 * This prevents crashes when field names change between form versions.
 */
export function setTextField(form: PDFForm, fieldName: string, value: string): void {
  try {
    const field = form.getTextField(fieldName)
    field.setText(value)
  } catch {
    // Field not found — skip silently
  }
}

/**
 * Set a PDF text field to a formatted dollar amount (whole dollars).
 * Skips if amount is zero to keep the form clean.
 */
export function setDollarField(form: PDFForm, fieldName: string, amountCents: number): void {
  if (amountCents === 0) return
  setTextField(form, fieldName, formatDollars(amountCents))
}

/**
 * Set a PDF text field to a formatted dollar+cents amount.
 */
export function setDollarCentsField(form: PDFForm, fieldName: string, amountCents: number): void {
  if (amountCents === 0) return
  setTextField(form, fieldName, formatDollarsAndCents(amountCents))
}

/**
 * Check a PDF checkbox, silently skipping if it doesn't exist.
 */
export function checkBox(form: PDFForm, fieldName: string): void {
  try {
    const field = form.getCheckBox(fieldName)
    field.check()
  } catch {
    // Field not found — skip silently
  }
}

// ── Filing status label ──────────────────────────────────────

const FILING_STATUS_LABELS: Record<string, string> = {
  single: 'Single',
  mfj: 'Married Filing Jointly',
  mfs: 'Married Filing Separately',
  hoh: 'Head of Household',
  qw: 'Qualifying Surviving Spouse',
}

export function filingStatusLabel(status: string): string {
  return FILING_STATUS_LABELS[status] ?? status
}
