/**
 * Tests for state form compilation and the StateFormCompiler pipeline.
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { PDFDocument } from 'pdf-lib'
import { compileFilingPackage } from '../../src/forms/compiler'
import type { FormTemplates } from '../../src/forms/types'
import { simpleW2Return, makeW2 } from '../fixtures/returns'
import { cents } from '../../src/model/traced'
import { getStateFormCompiler } from '../../src/forms/stateFormRegistry'
import { caFormCompiler } from '../../src/forms/fillers/form540Filler'
import { maFormCompiler } from '../../src/forms/fillers/form1Filler'
import { computeAll } from '../../src/rules/engine'
import type { TaxReturn } from '../../src/model/types'
import { emptyTaxReturn } from '../../src/model/types'

// ── Load PDF templates once ──────────────────────────────────

let templates: FormTemplates

beforeAll(() => {
  const dir = join(__dirname, '../../public/forms')
  templates = {
    f1040: new Uint8Array(readFileSync(join(dir, 'f1040.pdf'))),
    f1040sa: new Uint8Array(readFileSync(join(dir, 'f1040sa.pdf'))),
    f1040sb: new Uint8Array(readFileSync(join(dir, 'f1040sb.pdf'))),
    f1040sd: new Uint8Array(readFileSync(join(dir, 'f1040sd.pdf'))),
    f8949: new Uint8Array(readFileSync(join(dir, 'f8949.pdf'))),
    f1040s1: new Uint8Array(readFileSync(join(dir, 'f1040s1.pdf'))),
    f1040s2: new Uint8Array(readFileSync(join(dir, 'f1040s2.pdf'))),
    f1040s3: new Uint8Array(readFileSync(join(dir, 'f1040s3.pdf'))),
    f8812: new Uint8Array(readFileSync(join(dir, 'f8812.pdf'))),
    f8863: new Uint8Array(readFileSync(join(dir, 'f8863.pdf'))),
    f6251: new Uint8Array(readFileSync(join(dir, 'f6251.pdf'))),
    f8889: new Uint8Array(readFileSync(join(dir, 'f8889.pdf'))),
    f1040se: new Uint8Array(readFileSync(join(dir, 'f1040se.pdf'))),
    f1116: new Uint8Array(readFileSync(join(dir, 'f1116.pdf'))),
  }
})

function makeCAReturn(): TaxReturn {
  return {
    ...emptyTaxReturn(2025),
    taxpayer: {
      firstName: 'Test',
      lastName: 'User',
      ssn: '123456789',
      dateOfBirth: '1990-01-01',
      address: { street: '123 Main St', city: 'San Jose', state: 'CA', zip: '95112' },
    },
    stateReturns: [{ stateCode: 'CA', residencyType: 'full-year' }],
    w2s: [
      makeW2({
        id: 'w2-1',
        employerName: 'Tech Corp',
        box1: cents(100000),
        box2: cents(15000),
        box15State: 'CA',
        box16StateWages: cents(100000),
        box17StateIncomeTax: cents(5000),
      }),
    ],
  }
}

function makeMAReturn(): TaxReturn {
  return {
    ...emptyTaxReturn(2025),
    taxpayer: {
      firstName: 'Mass',
      lastName: 'User',
      ssn: '123456789',
      dateOfBirth: '1990-01-01',
      address: { street: '88 Beacon St', city: 'Boston', state: 'MA', zip: '02108' },
    },
    stateReturns: [{ stateCode: 'MA', residencyType: 'full-year' }],
    w2s: [
      makeW2({
        id: 'w2-1',
        employerName: 'Bay State Corp',
        box1: cents(100000),
        box2: cents(15000),
        box15State: 'MA',
        box16StateWages: cents(100000),
        box17StateIncomeTax: cents(3500),
      }),
    ],
  }
}

// ── State Form Registry ──────────────────────────────────────

describe('State Form Registry', () => {
  it('CA compiler is registered', () => {
    const compiler = getStateFormCompiler('CA')
    expect(compiler).toBeDefined()
    expect(compiler!.stateCode).toBe('CA')
  })

  it('MA compiler is registered', () => {
    const compiler = getStateFormCompiler('MA')
    expect(compiler).toBeDefined()
    expect(compiler!.stateCode).toBe('MA')
  })

  it('unknown state returns undefined', () => {
    // @ts-expect-error — testing unknown state
    expect(getStateFormCompiler('XX')).toBeUndefined()
  })
})

// ── CA Form 540 Filler ──────────────────────────────────────

describe('CA Form 540 PDF generator', () => {
  it('generates a valid PDF', async () => {
    const tr = makeCAReturn()
    const result = computeAll(tr)
    const stateResult = result.stateResults[0]

    const compiled = await caFormCompiler.compile(
      tr,
      stateResult,
      { templates: new Map() },
    )

    expect(compiled.doc).toBeDefined()
    expect(compiled.doc.getPageCount()).toBe(1)
    expect(compiled.forms).toHaveLength(1)
    expect(compiled.forms[0].formId).toBe('CA Form 540')
    expect(compiled.forms[0].sequenceNumber).toBe('CA-01')
  })

  it('PDF bytes can be saved and reloaded', async () => {
    const tr = makeCAReturn()
    const result = computeAll(tr)
    const stateResult = result.stateResults[0]

    const compiled = await caFormCompiler.compile(
      tr,
      stateResult,
      { templates: new Map() },
    )

    const bytes = await compiled.doc.save()
    const reloaded = await PDFDocument.load(bytes)
    expect(reloaded.getPageCount()).toBe(1)
  })
})

describe('MA Form 1 PDF generator', () => {
  it('generates a valid PDF', async () => {
    const tr = makeMAReturn()
    const result = computeAll(tr)
    const stateResult = result.stateResults[0]

    const compiled = await maFormCompiler.compile(
      tr,
      stateResult,
      { templates: new Map() },
    )

    expect(compiled.doc).toBeDefined()
    expect(compiled.doc.getPageCount()).toBe(1)
    expect(compiled.forms).toHaveLength(1)
    expect(compiled.forms[0].formId).toBe('MA Form 1')
    expect(compiled.forms[0].sequenceNumber).toBe('MA-01')
  })
})

// ── Compiler integration with state forms ─────────────────────

describe('compileFilingPackage — state form integration', () => {
  it('federal-only return has no state packages', async () => {
    const tr = simpleW2Return()
    tr.taxpayer.firstName = 'Federal'
    tr.taxpayer.lastName = 'Only'
    tr.taxpayer.ssn = '111222333'

    const result = await compileFilingPackage(tr, templates)

    expect(result.statePackages).toHaveLength(0)
    // No state forms in formsIncluded
    expect(result.formsIncluded.every(f => !f.formId.startsWith('CA'))).toBe(true)
  })

  it('CA return includes CA Form 540 in combined PDF', async () => {
    const tr = makeCAReturn()

    const result = await compileFilingPackage(tr, templates)

    // Should have state packages
    expect(result.statePackages).toHaveLength(1)
    expect(result.statePackages[0].stateCode).toBe('CA')
    expect(result.statePackages[0].label).toBe('CA Form 540')
    expect(result.statePackages[0].pdfBytes.length).toBeGreaterThan(0)

    // CA Form 540 should be in formsIncluded
    const caForm = result.formsIncluded.find(f => f.formId === 'CA Form 540')
    expect(caForm).toBeDefined()
    expect(caForm!.pageCount).toBe(1)
  })

  it('MA return includes MA Form 1 in combined PDF', async () => {
    const tr = makeMAReturn()

    const result = await compileFilingPackage(tr, templates)

    expect(result.statePackages).toHaveLength(1)
    expect(result.statePackages[0].stateCode).toBe('MA')
    expect(result.statePackages[0].label).toBe('MA Form 1')
    expect(result.statePackages[0].pdfBytes.length).toBeGreaterThan(0)

    const maForm = result.formsIncluded.find(f => f.formId === 'MA Form 1')
    expect(maForm).toBeDefined()
    expect(maForm!.pageCount).toBe(1)
  })

  it('combined PDF has more pages when CA is selected', async () => {
    const fedOnly = simpleW2Return()
    fedOnly.taxpayer.firstName = 'Fed'
    fedOnly.taxpayer.lastName = 'Only'
    fedOnly.taxpayer.ssn = '111222333'

    const fedResult = await compileFilingPackage(fedOnly, templates)
    const fedDoc = await PDFDocument.load(fedResult.pdfBytes)
    const fedPages = fedDoc.getPageCount()

    const caReturn = makeCAReturn()
    const caResult = await compileFilingPackage(caReturn, templates)
    const caDoc = await PDFDocument.load(caResult.pdfBytes)
    const caPages = caDoc.getPageCount()

    // CA return should have at least 1 more page (the Form 540)
    expect(caPages).toBeGreaterThan(fedPages)
  })

  it('state package PDF can be loaded independently', async () => {
    const tr = makeCAReturn()
    const result = await compileFilingPackage(tr, templates)

    const statePkg = result.statePackages[0]
    const stateDoc = await PDFDocument.load(statePkg.pdfBytes)
    expect(stateDoc.getPageCount()).toBe(1)
  })

  it('state form sequence numbers sort after federal', async () => {
    const tr = makeCAReturn()
    const result = await compileFilingPackage(tr, templates)

    const federalForms = result.formsIncluded.filter(f => !f.sequenceNumber.startsWith('CA-'))
    const stateForms = result.formsIncluded.filter(f => f.sequenceNumber.startsWith('CA-'))

    // State forms should come after federal forms in the list
    if (stateForms.length > 0) {
      const lastFedIdx = result.formsIncluded.indexOf(federalForms[federalForms.length - 1])
      const firstStateIdx = result.formsIncluded.indexOf(stateForms[0])
      expect(firstStateIdx).toBeGreaterThan(lastFedIdx)
    }
  })
})

// ── Part-year CA Form 540NR ───────────────────────────────────

describe('compileFilingPackage — part-year CA (Form 540NR)', () => {
  function makePartYearCAReturn(): TaxReturn {
    return {
      ...emptyTaxReturn(2025),
      taxpayer: {
        firstName: 'Part',
        lastName: 'Year',
        ssn: '123456789',
        dateOfBirth: '1990-01-01',
        address: { street: '456 Oak Ave', city: 'Austin', state: 'TX', zip: '73301' },
      },
      stateReturns: [{
        stateCode: 'CA',
        residencyType: 'part-year',
        moveInDate: '2025-01-01',
        moveOutDate: '2025-06-30',
      }],
      w2s: [
        makeW2({
          id: 'w2-1',
          employerName: 'Tech Corp',
          box1: cents(100000),
          box2: cents(15000),
          box15State: 'CA',
          box16StateWages: cents(100000),
          box17StateIncomeTax: cents(5000),
        }),
      ],
    }
  }

  it('part-year CA return generates CA Form 540NR', async () => {
    const tr = makePartYearCAReturn()
    const result = computeAll(tr)
    const stateResult = result.stateResults[0]

    const compiled = await caFormCompiler.compile(
      tr,
      stateResult,
      { templates: new Map() },
    )

    expect(compiled.forms[0].formId).toBe('CA Form 540NR')
  })

  it('part-year CA return in filing package uses 540NR label', async () => {
    const tr = makePartYearCAReturn()
    const result = await compileFilingPackage(tr, templates)

    expect(result.statePackages).toHaveLength(1)
    expect(result.statePackages[0].label).toBe('CA Form 540NR')
  })

  it('full-year CA return uses CA Form 540 label', async () => {
    const tr = makeCAReturn()
    const result = await compileFilingPackage(tr, templates)

    expect(result.statePackages[0].label).toBe('CA Form 540')
  })
})
