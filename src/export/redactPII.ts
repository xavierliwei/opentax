import type { TaxReturn } from '../model/types.ts'

/** Mask a 9-digit SSN: 123456789 → ***-**-6789 */
function maskSSN(ssn: string): string {
  if (!ssn || ssn.length < 4) return ssn
  return `***-**-${ssn.slice(-4)}`
}

/** Mask a TIN/EIN: XX-XXXXXXX → **-***XXXX (keep last 4) */
function maskTIN(tin: string): string {
  if (!tin || tin.length < 4) return tin
  return `**-***${tin.slice(-4)}`
}

/**
 * Returns a deep-cloned TaxReturn with SSNs, EINs, and TINs masked.
 * Addresses are left intact (they're needed for context) but SSNs/EINs
 * are replaced with masked versions showing only the last 4 digits.
 */
export function redactPII(taxReturn: TaxReturn): TaxReturn {
  const r: TaxReturn = JSON.parse(JSON.stringify(taxReturn))

  // Taxpayer & spouse SSNs
  r.taxpayer.ssn = maskSSN(r.taxpayer.ssn)
  if (r.spouse) {
    r.spouse.ssn = maskSSN(r.spouse.ssn)
  }

  // Dependent SSNs
  for (const dep of r.dependents) {
    dep.ssn = maskSSN(dep.ssn)
  }

  // Alimony payer SSN
  if (r.alimonyPayerSSN) {
    r.alimonyPayerSSN = maskSSN(r.alimonyPayerSSN)
  }

  // W-2 employer EINs
  for (const w2 of r.w2s) {
    w2.employerEin = maskTIN(w2.employerEin)
  }

  // 1099-B broker TINs
  for (const f of r.form1099Bs) {
    if (f.brokerTin) f.brokerTin = maskTIN(f.brokerTin)
  }

  // 1099-INT payer TINs
  for (const f of r.form1099INTs) {
    if (f.payerTin) f.payerTin = maskTIN(f.payerTin)
  }

  // 1099-DIV payer TINs
  for (const f of r.form1099DIVs) {
    if (f.payerTin) f.payerTin = maskTIN(f.payerTin)
  }

  // 1099-G payer TINs
  for (const f of r.form1099Gs) {
    if (f.payerTin) f.payerTin = maskTIN(f.payerTin)
  }

  // 1099-R payer TINs
  for (const f of r.form1099Rs) {
    if (f.payerTin) f.payerTin = maskTIN(f.payerTin)
  }

  // 1099-MISC payer TINs
  for (const f of r.form1099MISCs) {
    if (f.payerTin) f.payerTin = maskTIN(f.payerTin)
  }

  // 1099-NEC payer TINs (note: payerTIN with capital N)
  for (const f of r.form1099NECs) {
    if (f.payerTIN) f.payerTIN = maskTIN(f.payerTIN)
  }

  // Schedule C business EINs
  for (const biz of r.scheduleCBusinesses) {
    if (biz.businessEin) biz.businessEin = maskTIN(biz.businessEin)
  }

  // Schedule K-1 entity EINs
  for (const k1 of r.scheduleK1s) {
    if (k1.entityEin) k1.entityEin = maskTIN(k1.entityEin)
  }

  return r
}

/**
 * Scans a TaxReturn and returns a list of human-readable descriptions
 * of the sensitive fields present (for the warning dialog).
 */
export function detectSensitiveFields(taxReturn: TaxReturn): string[] {
  const fields: string[] = []

  if (taxReturn.taxpayer.ssn) fields.push('Taxpayer SSN')
  if (taxReturn.spouse?.ssn) fields.push('Spouse SSN')
  if (taxReturn.dependents.some((d) => d.ssn)) fields.push('Dependent SSN(s)')
  if (taxReturn.alimonyPayerSSN) fields.push('Alimony payer SSN')

  if (taxReturn.w2s.some((w) => w.employerEin)) fields.push('Employer EIN(s)')

  const has1099TIN =
    taxReturn.form1099Bs.some((f) => f.brokerTin) ||
    taxReturn.form1099INTs.some((f) => f.payerTin) ||
    taxReturn.form1099DIVs.some((f) => f.payerTin) ||
    taxReturn.form1099Gs.some((f) => f.payerTin) ||
    taxReturn.form1099Rs.some((f) => f.payerTin) ||
    taxReturn.form1099MISCs.some((f) => f.payerTin) ||
    taxReturn.form1099NECs.some((f) => f.payerTIN)
  if (has1099TIN) fields.push('Payer TIN(s) from 1099 forms')

  if (taxReturn.scheduleCBusinesses.some((b) => b.businessEin))
    fields.push('Business EIN(s)')
  if (taxReturn.scheduleK1s.some((k) => k.entityEin))
    fields.push('K-1 entity EIN(s)')

  if (taxReturn.taxpayer.address?.street) fields.push('Taxpayer address')
  if (taxReturn.spouse?.address?.street) fields.push('Spouse address')

  return fields
}
