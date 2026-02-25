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
import { mdFormCompiler } from '../../src/forms/fillers/form502Filler'
import { njFormCompiler } from '../../src/forms/fillers/nj1040Filler'
import { paFormCompiler } from '../../src/forms/fillers/formPA40Filler'
import { dcFormCompiler } from '../../src/forms/fillers/formD40Filler'
import { ncFormCompiler } from '../../src/forms/fillers/formD400Filler'
import { nyFormCompiler } from '../../src/forms/fillers/formIT201Filler'
import { computeAll } from '../../src/rules/engine'
import type { TaxReturn } from '../../src/model/types'
import { emptyTaxReturn } from '../../src/model/types'
import { vaFormCompiler } from '../../src/forms/fillers/form760Filler'
import { ctFormCompiler } from '../../src/forms/fillers/formCT1040Filler'

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
    w2s: [makeW2({ id: 'w2-1', employerName: 'Tech Corp', box1: cents(100000), box2: cents(15000), box15State: 'CA', box16StateWages: cents(100000), box17StateIncomeTax: cents(5000) })],
  }
}

function makeMDReturn(): TaxReturn {
  return {
    ...emptyTaxReturn(2025),
    taxpayer: {
      firstName: 'Mary',
      lastName: 'Land',
      ssn: '123456789',
      dateOfBirth: '1990-01-01',
      address: { street: '1 Pratt St', city: 'Baltimore', state: 'MD', zip: '21201' },
    },
    stateReturns: [{ stateCode: 'MD', residencyType: 'full-year' }],
    w2s: [makeW2({ id: 'w2-1', employerName: 'Harbor Corp', box1: cents(90000), box2: cents(12000), box15State: 'MD', box16StateWages: cents(90000), box17StateIncomeTax: cents(3200) })],
  }
}

function makeGAReturn(): TaxReturn {
  return {
    ...emptyTaxReturn(2025),
    taxpayer: {
      firstName: 'Test',
      lastName: 'User',
      ssn: '123456789',
      dateOfBirth: '1990-01-01',
      address: { street: '123 Main St', city: 'Atlanta', state: 'GA', zip: '30301' },
    },
    stateReturns: [{ stateCode: 'GA', residencyType: 'full-year' }],
    w2s: [
      makeW2({
        id: 'w2-1',
        employerName: 'Tech Corp',
        box1: cents(100000),
        box2: cents(15000),
        box15State: 'GA',
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

function makeDCReturn(): TaxReturn {
  return {
    ...emptyTaxReturn(2025),
    taxpayer: {
      firstName: 'DC',
      lastName: 'User',
      ssn: '123456781',
      dateOfBirth: '1990-01-01',
      address: { street: '123 Main St', city: 'Washington', state: 'DC', zip: '20001' },
    },
    stateReturns: [{ stateCode: 'DC', residencyType: 'full-year' }],
    w2s: [
      makeW2({
        id: 'w2-1',
        employerName: 'District Co',
        box1: cents(90000),
        box2: cents(12000),
        box15State: 'DC',
        box16StateWages: cents(90000),
        box17StateIncomeTax: cents(3500),
      }),
    ],
  }
}

function makeNJReturn(): TaxReturn {
  return {
    ...emptyTaxReturn(2025),
    taxpayer: {
      firstName: 'Jersey',
      lastName: 'User',
      ssn: '987654321',
      dateOfBirth: '1990-01-01',
      address: { street: '77 Broad St', city: 'Newark', state: 'NJ', zip: '07102' },
    },
    stateReturns: [{ stateCode: 'NJ', residencyType: 'full-year' }],
    w2s: [
      makeW2({
        id: 'w2-1',
        employerName: 'Garden State Tech',
        box1: cents(100000),
        box2: cents(15000),
        box15State: 'NJ',
        box16StateWages: cents(100000),
        box17StateIncomeTax: cents(4500),
      }),
    ],
  }
}

function makeVAReturn(): TaxReturn {
  return {
    ...emptyTaxReturn(2025),
    taxpayer: {
      firstName: 'Test',
      lastName: 'Virginian',
      ssn: '987654321',
      dateOfBirth: '1990-01-01',
      address: { street: '123 Main St', city: 'Richmond', state: 'VA', zip: '23219' },
    },
    stateReturns: [{ stateCode: 'VA', residencyType: 'full-year' }],
    w2s: [
      makeW2({
        id: 'w2-1',
        employerName: 'Tech Corp',
        box1: cents(100000),
        box2: cents(15000),
        box15State: 'VA',
        box16StateWages: cents(100000),
        box17StateIncomeTax: cents(5000),
      }),
    ],
  }
}

function makePAReturn(): TaxReturn {
  return {
    ...emptyTaxReturn(2025),
    taxpayer: {
      firstName: 'Test',
      lastName: 'User',
      ssn: '123456789',
      dateOfBirth: '1990-01-01',
      address: { street: '123 Main St', city: 'Pittsburgh', state: 'PA', zip: '15222' },
    },
    stateReturns: [{ stateCode: 'PA', residencyType: 'full-year' }],
    w2s: [
      makeW2({
        id: 'w2-1',
        employerName: 'Tech Corp',
        box1: cents(100000),
        box2: cents(15000),
        box15State: 'PA',
        box16StateWages: cents(100000),
        box17StateIncomeTax: cents(2500),
      }),
    ],
  }
}

function makeCTReturn(): TaxReturn {
  return {
    ...emptyTaxReturn(2025),
    taxpayer: {
      firstName: 'CT',
      lastName: 'User',
      ssn: '123456789',
      dateOfBirth: '1990-01-01',
      address: { street: '100 Pearl St', city: 'Hartford', state: 'CT', zip: '06103' },
    },
    stateReturns: [{ stateCode: 'CT', residencyType: 'full-year' }],
    w2s: [
      makeW2({
        id: 'w2-1',
        employerName: 'CT Corp',
        box1: cents(100000),
        box2: cents(15000),
        box15State: 'CT',
        box16StateWages: cents(100000),
        box17StateIncomeTax: cents(4500),
      }),
    ],
  }
}

function makeNCReturn(): TaxReturn {
  return {
    ...emptyTaxReturn(2025),
    taxpayer: {
      firstName: 'Test',
      lastName: 'User',
      ssn: '123456789',
      dateOfBirth: '1990-01-01',
      address: { street: '123 Main St', city: 'Raleigh', state: 'NC', zip: '27601' },
    },
    stateReturns: [{ stateCode: 'NC', residencyType: 'full-year' }],
    w2s: [
      makeW2({
        id: 'w2-1',
        employerName: 'Tech Corp',
        box1: cents(100000),
        box2: cents(15000),
        box15State: 'NC',
        box16StateWages: cents(100000),
        box17StateIncomeTax: cents(3000),
      }),
    ],
  }
}

function makeNYReturn(): TaxReturn {
  return {
    ...emptyTaxReturn(2025),
    taxpayer: {
      firstName: 'Test',
      lastName: 'NewYorker',
      ssn: '123456789',
      dateOfBirth: '1990-01-01',
      address: { street: '350 5th Ave', city: 'New York', state: 'NY', zip: '10118' },
    },
    stateReturns: [{ stateCode: 'NY', residencyType: 'full-year' }],
    w2s: [
      makeW2({
        id: 'w2-1',
        employerName: 'Empire Corp',
        box1: cents(100000),
        box2: cents(15000),
        box15State: 'NY',
        box16StateWages: cents(100000),
        box17StateIncomeTax: cents(5000),
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

  it('GA compiler is registered', () => {
    const compiler = getStateFormCompiler('GA')
    expect(compiler).toBeDefined()
    expect(compiler!.stateCode).toBe('GA')
  })

  it('MA compiler is registered', () => {
    const compiler = getStateFormCompiler('MA')
    expect(compiler).toBeDefined()
    expect(compiler!.stateCode).toBe('MA')
  })

  it('MD compiler is registered', () => {
    const compiler = getStateFormCompiler('MD')
    expect(compiler).toBeDefined()
    expect(compiler!.stateCode).toBe('MD')
  })

  it('NJ compiler is registered', () => {
    const compiler = getStateFormCompiler('NJ')
    expect(compiler).toBeDefined()
    expect(compiler!.stateCode).toBe('NJ')
  })

  it('VA compiler is registered', () => {
    const compiler = getStateFormCompiler('VA')
    expect(compiler).toBeDefined()
    expect(compiler!.stateCode).toBe('VA')
  })

  it('PA compiler is registered', () => {
    const compiler = getStateFormCompiler('PA')
    expect(compiler).toBeDefined()
    expect(compiler!.stateCode).toBe('PA')
  })

  it('DC compiler is registered', () => {
    const compiler = getStateFormCompiler('DC')
    expect(compiler).toBeDefined()
    expect(compiler!.stateCode).toBe('DC')
  })

  it('NC compiler is registered', () => {
    const compiler = getStateFormCompiler('NC')
    expect(compiler).toBeDefined()
    expect(compiler!.stateCode).toBe('NC')
  })

  it('CT compiler is registered', () => {
    const compiler = getStateFormCompiler('CT')
    expect(compiler).toBeDefined()
    expect(compiler!.stateCode).toBe('CT')
  })

  it('NY compiler is registered', () => {
    const compiler = getStateFormCompiler('NY')
    expect(compiler).toBeDefined()
    expect(compiler!.stateCode).toBe('NY')
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

  it('PDF bytes can be saved and reloaded', async () => {
    const tr = makeMAReturn()
    const result = computeAll(tr)
    const stateResult = result.stateResults[0]

    const compiled = await maFormCompiler.compile(
      tr,
      stateResult,
      { templates: new Map() },
    )

    const bytes = await compiled.doc.save()
    const reloaded = await PDFDocument.load(bytes)
    expect(reloaded.getPageCount()).toBe(1)
  })

  it('part-year generates Form 1-NR/PY label', async () => {
    const tr: TaxReturn = {
      ...emptyTaxReturn(2025),
      taxpayer: {
        firstName: 'Part',
        lastName: 'Year',
        ssn: '123456789',
        dateOfBirth: '1990-01-01',
        address: { street: '88 Beacon St', city: 'Boston', state: 'MA', zip: '02108' },
      },
      stateReturns: [{
        stateCode: 'MA',
        residencyType: 'part-year',
        moveInDate: '2025-01-01',
        moveOutDate: '2025-06-30',
      }],
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

    const result = computeAll(tr)
    const stateResult = result.stateResults[0]

    const compiled = await maFormCompiler.compile(
      tr,
      stateResult,
      { templates: new Map() },
    )

    expect(compiled.forms[0].formId).toBe('MA Form 1-NR/PY')
  })
})

describe('PA-40 PDF generator', () => {
  it('generates a valid PDF', async () => {
    const tr = makePAReturn()
    const result = computeAll(tr)
    const stateResult = result.stateResults[0]

    const compiled = await paFormCompiler.compile(
      tr,
      stateResult,
      { templates: new Map() },
    )

    expect(compiled.doc).toBeDefined()
    expect(compiled.doc.getPageCount()).toBe(1)
    expect(compiled.forms).toHaveLength(1)
    expect(compiled.forms[0].formId).toBe('PA-40')
    expect(compiled.forms[0].sequenceNumber).toBe('PA-01')
  })
})

describe('MD Form 502 PDF generator', () => {
  it('generates a valid PDF', async () => {
    const tr = makeMDReturn()
    const result = computeAll(tr)
    const stateResult = result.stateResults[0]

    const compiled = await mdFormCompiler.compile(
      tr,
      stateResult,
      { templates: new Map() },
    )

    expect(compiled.doc).toBeDefined()
    expect(compiled.doc.getPageCount()).toBe(1)
    expect(compiled.forms).toHaveLength(1)
    expect(compiled.forms[0].formId).toBe('MD Form 502')
    expect(compiled.forms[0].sequenceNumber).toBe('MD-01')
  })
})

describe('NJ Form NJ-1040 PDF generator', () => {
  it('generates a valid PDF', async () => {
    const tr = makeNJReturn()
    const result = computeAll(tr)
    const stateResult = result.stateResults[0]

    const compiled = await njFormCompiler.compile(tr, stateResult, { templates: new Map() })

    expect(compiled.doc).toBeDefined()
    expect(compiled.doc.getPageCount()).toBe(1)
    expect(compiled.forms[0].formId).toBe('NJ Form NJ-1040')
    expect(compiled.forms[0].sequenceNumber).toBe('NJ-01')
  })

  it('PDF bytes can be saved and reloaded', async () => {
    const tr = makeNJReturn()
    const result = computeAll(tr)
    const stateResult = result.stateResults[0]

    const compiled = await njFormCompiler.compile(tr, stateResult, { templates: new Map() })

    const bytes = await compiled.doc.save()
    const reloaded = await PDFDocument.load(bytes)
    expect(reloaded.getPageCount()).toBe(1)
  })
})

describe('VA Form 760 PDF generator', () => {
  it('generates a valid PDF', async () => {
    const tr = makeVAReturn()
    const result = computeAll(tr)
    const stateResult = result.stateResults[0]

    const compiled = await vaFormCompiler.compile(
      tr,
      stateResult,
      { templates: new Map() },
    )

    expect(compiled.doc).toBeDefined()
    expect(compiled.doc.getPageCount()).toBe(1)
    expect(compiled.forms).toHaveLength(1)
    expect(compiled.forms[0].formId).toBe('VA Form 760')
    expect(compiled.forms[0].sequenceNumber).toBe('VA-01')
  })
})

describe('DC Form D-40 PDF generator', () => {
  it('generates a valid PDF', async () => {
    const tr = makeDCReturn()
    const result = computeAll(tr)
    const stateResult = result.stateResults[0]

    const compiled = await dcFormCompiler.compile(tr, stateResult, { templates: new Map() })

    expect(compiled.doc.getPageCount()).toBe(1)
    expect(compiled.forms[0].formId).toBe('DC Form D-40')
    expect(compiled.forms[0].sequenceNumber).toBe('DC-01')
  })
})

describe('CT Form CT-1040 PDF generator', () => {
  it('generates a valid PDF', async () => {
    const tr = makeCTReturn()
    const result = computeAll(tr)
    const stateResult = result.stateResults[0]

    const compiled = await ctFormCompiler.compile(tr, stateResult, { templates: new Map() })

    expect(compiled.doc).toBeDefined()
    expect(compiled.doc.getPageCount()).toBe(1)
    expect(compiled.forms).toHaveLength(1)
    expect(compiled.forms[0].formId).toBe('CT Form CT-1040')
    expect(compiled.forms[0].sequenceNumber).toBe('CT-01')
  })

  it('PDF bytes can be saved and reloaded', async () => {
    const tr = makeCTReturn()
    const result = computeAll(tr)
    const stateResult = result.stateResults[0]

    const compiled = await ctFormCompiler.compile(tr, stateResult, { templates: new Map() })

    const bytes = await compiled.doc.save()
    const reloaded = await PDFDocument.load(bytes)
    expect(reloaded.getPageCount()).toBe(1)
  })
})

describe('NC Form D-400 PDF generator', () => {
  it('generates a valid PDF', async () => {
    const tr = makeNCReturn()
    const result = computeAll(tr)
    const stateResult = result.stateResults[0]

    const compiled = await ncFormCompiler.compile(tr, stateResult, { templates: new Map() })
    expect(compiled.doc.getPageCount()).toBe(1)
    expect(compiled.forms[0].formId).toBe('NC Form D-400')
    expect(compiled.forms[0].sequenceNumber).toBe('NC-01')
  })
})

describe('NY Form IT-201 PDF generator', () => {
  it('generates a valid PDF', async () => {
    const tr = makeNYReturn()
    const result = computeAll(tr)
    const stateResult = result.stateResults[0]

    const compiled = await nyFormCompiler.compile(tr, stateResult, { templates: new Map() })

    expect(compiled.doc).toBeDefined()
    expect(compiled.doc.getPageCount()).toBe(1)
    expect(compiled.forms).toHaveLength(1)
    expect(compiled.forms[0].formId).toBe('NY Form IT-201')
    expect(compiled.forms[0].sequenceNumber).toBe('NY-01')
  })

  it('PDF bytes can be saved and reloaded', async () => {
    const tr = makeNYReturn()
    const result = computeAll(tr)
    const stateResult = result.stateResults[0]

    const compiled = await nyFormCompiler.compile(tr, stateResult, { templates: new Map() })

    const bytes = await compiled.doc.save()
    const reloaded = await PDFDocument.load(bytes)
    expect(reloaded.getPageCount()).toBe(1)
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

  it('GA return includes GA Form 500 in combined PDF', async () => {
    const tr = makeGAReturn()

    const result = await compileFilingPackage(tr, templates)

    expect(result.statePackages).toHaveLength(1)
    expect(result.statePackages[0].stateCode).toBe('GA')
    expect(result.statePackages[0].label).toBe('GA Form 500')

    const gaForm = result.formsIncluded.find(f => f.formId === 'GA Form 500')
    expect(gaForm).toBeDefined()
    expect(gaForm!.pageCount).toBe(1)
  })

  it('PA return includes PA-40 in combined PDF', async () => {
    const tr = makePAReturn()

    const result = await compileFilingPackage(tr, templates)

    expect(result.statePackages).toHaveLength(1)
    expect(result.statePackages[0].stateCode).toBe('PA')
    expect(result.statePackages[0].label).toBe('PA-40')
    expect(result.statePackages[0].pdfBytes.length).toBeGreaterThan(0)

    const paForm = result.formsIncluded.find(f => f.formId === 'PA-40')
    expect(paForm).toBeDefined()
    expect(paForm!.pageCount).toBe(1)
  })

  it('NC return includes NC Form D-400 in combined PDF', async () => {
    const tr = makeNCReturn()

    const result = await compileFilingPackage(tr, templates)

    expect(result.statePackages).toHaveLength(1)
    expect(result.statePackages[0].stateCode).toBe('NC')
    expect(result.statePackages[0].label).toBe('NC Form D-400')
    expect(result.statePackages[0].pdfBytes.length).toBeGreaterThan(0)

    const ncForm = result.formsIncluded.find(f => f.formId === 'NC Form D-400')
    expect(ncForm).toBeDefined()
    expect(ncForm!.pageCount).toBe(1)
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

  it('MD return includes MD Form 502 in combined PDF', async () => {
    const tr = makeMDReturn()

    const result = await compileFilingPackage(tr, templates)

    expect(result.statePackages).toHaveLength(1)
    expect(result.statePackages[0].stateCode).toBe('MD')
    expect(result.statePackages[0].label).toBe('MD Form 502')

    const mdForm = result.formsIncluded.find(f => f.formId === 'MD Form 502')
    expect(mdForm).toBeDefined()
    expect(mdForm!.pageCount).toBe(1)
  })

  it('NJ return includes NJ Form NJ-1040 in combined PDF', async () => {
    const tr = makeNJReturn()

    const result = await compileFilingPackage(tr, templates)

    expect(result.statePackages).toHaveLength(1)
    expect(result.statePackages[0].stateCode).toBe('NJ')
    expect(result.statePackages[0].label).toBe('NJ Form NJ-1040')

    const njForm = result.formsIncluded.find(f => f.formId === 'NJ Form NJ-1040')
    expect(njForm).toBeDefined()
    expect(njForm!.sequenceNumber).toBe('NJ-01')
  })

  it('VA return includes VA Form 760 in combined PDF', async () => {
    const tr = makeVAReturn()

    const result = await compileFilingPackage(tr, templates)

    expect(result.statePackages).toHaveLength(1)
    expect(result.statePackages[0].stateCode).toBe('VA')
    expect(result.statePackages[0].label).toBe('VA Form 760')
    expect(result.statePackages[0].pdfBytes.length).toBeGreaterThan(0)

    const vaForm = result.formsIncluded.find(f => f.formId === 'VA Form 760')
    expect(vaForm).toBeDefined()
    expect(vaForm!.pageCount).toBe(1)
  })

  it('CT return includes CT Form CT-1040 in combined PDF', async () => {
    const tr = makeCTReturn()

    const result = await compileFilingPackage(tr, templates)

    expect(result.statePackages).toHaveLength(1)
    expect(result.statePackages[0].stateCode).toBe('CT')
    expect(result.statePackages[0].label).toBe('CT Form CT-1040')
    expect(result.statePackages[0].pdfBytes.length).toBeGreaterThan(0)

    const ctForm = result.formsIncluded.find(f => f.formId === 'CT Form CT-1040')
    expect(ctForm).toBeDefined()
    expect(ctForm!.pageCount).toBe(1)
  })

  it('NY return includes NY Form IT-201 in combined PDF', async () => {
    const tr = makeNYReturn()

    const result = await compileFilingPackage(tr, templates)

    expect(result.statePackages).toHaveLength(1)
    expect(result.statePackages[0].stateCode).toBe('NY')
    expect(result.statePackages[0].label).toBe('NY Form IT-201')
    expect(result.statePackages[0].pdfBytes.length).toBeGreaterThan(0)

    const nyForm = result.formsIncluded.find(f => f.formId === 'NY Form IT-201')
    expect(nyForm).toBeDefined()
    expect(nyForm!.pageCount).toBe(1)
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
