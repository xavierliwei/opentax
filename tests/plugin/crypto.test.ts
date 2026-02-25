import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, readFileSync, writeFileSync, statSync, existsSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { randomBytes } from 'node:crypto'
import Database from 'better-sqlite3'
import {
  encrypt,
  decrypt,
  getOrCreateKey,
  isPlaintext,
  isEncrypted,
  encryptSensitiveFields,
  decryptSensitiveFields,
} from '../../openclaw-plugin/utils/crypto.ts'
import { emptyTaxReturn } from '../../src/model/types.ts'
import type { TaxReturn } from '../../src/model/types.ts'
import { TaxService } from '../../openclaw-plugin/service/TaxService.ts'

// ── Helpers ──────────────────────────────────────────────────────

let workspace: string

beforeEach(() => {
  workspace = mkdtempSync(join(tmpdir(), 'opentax-crypto-test-'))
})

afterEach(() => {
  rmSync(workspace, { recursive: true, force: true })
})

function makeKey(): Buffer {
  return randomBytes(32)
}

function makeTaxReturnWithPII(): TaxReturn {
  const tr = emptyTaxReturn(2025)
  tr.taxpayer = {
    firstName: 'John',
    lastName: 'Doe',
    ssn: '123456789',
    address: { street: '123 Main St', city: 'Springfield', state: 'IL', zip: '62701' },
  }
  tr.spouse = {
    firstName: 'Jane',
    lastName: 'Doe',
    ssn: '987654321',
    address: { street: '123 Main St', city: 'Springfield', state: 'IL', zip: '62701' },
  }
  tr.dependents = [
    { firstName: 'Kid', lastName: 'Doe', ssn: '111223333', relationship: 'son', monthsLived: 12, dateOfBirth: '2015-05-10' },
    { firstName: 'Baby', lastName: 'Doe', ssn: '444556666', relationship: 'daughter', monthsLived: 12, dateOfBirth: '2020-01-15' },
  ]
  tr.w2s = [
    {
      id: 'w2-1',
      employerEin: '12-3456789',
      employerName: 'Acme Corp',
      box1: 5000000, box2: 800000, box3: 5000000, box4: 310000,
      box5: 5000000, box6: 72500, box7: 0, box8: 0, box10: 0, box11: 0,
      box12: [], box13StatutoryEmployee: false, box13RetirementPlan: false,
      box13ThirdPartySickPay: false, box14: '',
    },
    {
      id: 'w2-2',
      employerEin: '98-7654321',
      employerName: 'Beta Inc',
      box1: 3000000, box2: 500000, box3: 3000000, box4: 186000,
      box5: 3000000, box6: 43500, box7: 0, box8: 0, box10: 0, box11: 0,
      box12: [], box13StatutoryEmployee: false, box13RetirementPlan: false,
      box13ThirdPartySickPay: false, box14: '',
    },
  ]
  tr.scheduleK1s = [
    {
      id: 'k1-1',
      entityType: 'partnership',
      entityName: 'XYZ Partners',
      entityEin: '55-1234567',
      ordinaryIncome: 100000,
      rentalIncome: 0,
      interestIncome: 0,
      dividendIncome: 0,
      shortTermCapitalGain: 0,
      longTermCapitalGain: 0,
      section199AQBI: 0,
      distributions: 0,
    },
  ]
  return tr
}

// ── Tests ────────────────────────────────────────────────────────

describe('crypto utilities', () => {
  describe('encrypt / decrypt roundtrip', () => {
    it('encrypts and decrypts a simple string', () => {
      const key = makeKey()
      const plaintext = '123456789'
      const encrypted = encrypt(plaintext, key)
      expect(encrypted).not.toBe(plaintext)
      expect(encrypted.split(':')).toHaveLength(3)
      const decrypted = decrypt(encrypted, key)
      expect(decrypted).toBe(plaintext)
    })

    it('handles short plaintext (1 char)', () => {
      const key = makeKey()
      const plaintext = 'A'
      const encrypted = encrypt(plaintext, key)
      expect(decrypt(encrypted, key)).toBe(plaintext)
    })

    it('handles medium plaintext (SSN format)', () => {
      const key = makeKey()
      const plaintext = '999887777'
      const encrypted = encrypt(plaintext, key)
      expect(decrypt(encrypted, key)).toBe(plaintext)
    })

    it('handles longer plaintext (EIN with dash)', () => {
      const key = makeKey()
      const plaintext = '12-3456789'
      const encrypted = encrypt(plaintext, key)
      expect(decrypt(encrypted, key)).toBe(plaintext)
    })

    it('handles unicode plaintext', () => {
      const key = makeKey()
      const plaintext = 'Hello World'
      const encrypted = encrypt(plaintext, key)
      expect(decrypt(encrypted, key)).toBe(plaintext)
    })

    it('produces different ciphertexts for the same plaintext (random IV)', () => {
      const key = makeKey()
      const plaintext = '123456789'
      const e1 = encrypt(plaintext, key)
      const e2 = encrypt(plaintext, key)
      expect(e1).not.toBe(e2) // different IVs
      expect(decrypt(e1, key)).toBe(plaintext)
      expect(decrypt(e2, key)).toBe(plaintext)
    })

    it('fails to decrypt with wrong key', () => {
      const key1 = makeKey()
      const key2 = makeKey()
      const encrypted = encrypt('123456789', key1)
      expect(() => decrypt(encrypted, key2)).toThrow()
    })
  })

  describe('tampered ciphertext detection (auth tag verification)', () => {
    it('detects tampered ciphertext', () => {
      const key = makeKey()
      const encrypted = encrypt('123456789', key)
      const parts = encrypted.split(':')
      // Tamper with the ciphertext portion
      const tampered = Buffer.from(parts[1], 'base64')
      tampered[0] ^= 0xff // flip bits
      const tamperedStr = `${parts[0]}:${tampered.toString('base64')}:${parts[2]}`
      expect(() => decrypt(tamperedStr, key)).toThrow()
    })

    it('detects tampered auth tag', () => {
      const key = makeKey()
      const encrypted = encrypt('123456789', key)
      const parts = encrypted.split(':')
      // Tamper with the auth tag
      const tampered = Buffer.from(parts[2], 'base64')
      tampered[0] ^= 0xff
      const tamperedStr = `${parts[0]}:${parts[1]}:${tampered.toString('base64')}`
      expect(() => decrypt(tamperedStr, key)).toThrow()
    })

    it('rejects invalid format (missing parts)', () => {
      const key = makeKey()
      expect(() => decrypt('onlyonepart', key)).toThrow('Invalid encrypted format')
      expect(() => decrypt('two:parts', key)).toThrow('Invalid encrypted format')
    })
  })

  describe('getOrCreateKey', () => {
    it('generates a new key on first call', () => {
      const key = getOrCreateKey(workspace)
      expect(key).toBeInstanceOf(Buffer)
      expect(key.length).toBe(32) // 256 bits
    })

    it('returns the same key on subsequent calls', () => {
      const key1 = getOrCreateKey(workspace)
      const key2 = getOrCreateKey(workspace)
      expect(key1.equals(key2)).toBe(true)
    })

    it('creates key file with restricted permissions (0o600)', () => {
      getOrCreateKey(workspace)
      const keyPath = join(workspace, '.opentax-key')
      expect(existsSync(keyPath)).toBe(true)
      const stats = statSync(keyPath)
      // Check owner-only read/write (0o600 = 384 decimal, masked by umask)
      const mode = stats.mode & 0o777
      expect(mode).toBe(0o600)
    })

    it('stores key as hex string', () => {
      const key = getOrCreateKey(workspace)
      const keyPath = join(workspace, '.opentax-key')
      const hex = readFileSync(keyPath, 'utf-8').trim()
      expect(hex).toMatch(/^[0-9a-f]{64}$/)
      expect(Buffer.from(hex, 'hex').equals(key)).toBe(true)
    })
  })

  describe('isPlaintext / isEncrypted', () => {
    it('detects 9-digit SSN as plaintext', () => {
      expect(isPlaintext('123456789')).toBe(true)
    })

    it('detects EIN format as plaintext', () => {
      expect(isPlaintext('12-3456789')).toBe(true)
    })

    it('does not treat empty string as plaintext', () => {
      expect(isPlaintext('')).toBe(false)
    })

    it('does not treat encrypted value as plaintext', () => {
      const key = makeKey()
      const enc = encrypt('123456789', key)
      expect(isPlaintext(enc)).toBe(false)
    })

    it('detects encrypted format', () => {
      const key = makeKey()
      const enc = encrypt('123456789', key)
      expect(isEncrypted(enc)).toBe(true)
    })

    it('does not treat SSN as encrypted', () => {
      // A 9-digit SSN doesn't have the colon-separated format
      expect(isEncrypted('123456789')).toBe(false)
    })

    it('does not treat empty string as encrypted', () => {
      expect(isEncrypted('')).toBe(false)
    })
  })

  describe('encryptSensitiveFields / decryptSensitiveFields roundtrip', () => {
    it('encrypts and decrypts all sensitive fields on a TaxReturn', () => {
      const key = makeKey()
      const original = makeTaxReturnWithPII()

      const encrypted = encryptSensitiveFields(original, key)

      // Verify sensitive fields are encrypted (not plaintext)
      expect(encrypted.taxpayer.ssn).not.toBe('123456789')
      expect(isEncrypted(encrypted.taxpayer.ssn)).toBe(true)
      expect(encrypted.spouse!.ssn).not.toBe('987654321')
      expect(isEncrypted(encrypted.spouse!.ssn)).toBe(true)
      expect(encrypted.dependents[0].ssn).not.toBe('111223333')
      expect(encrypted.dependents[1].ssn).not.toBe('444556666')
      expect(encrypted.w2s[0].employerEin).not.toBe('12-3456789')
      expect(encrypted.w2s[1].employerEin).not.toBe('98-7654321')
      expect(encrypted.scheduleK1s[0].entityEin).not.toBe('55-1234567')

      // Verify non-sensitive fields are unchanged
      expect(encrypted.taxpayer.firstName).toBe('John')
      expect(encrypted.taxpayer.lastName).toBe('Doe')
      expect(encrypted.w2s[0].employerName).toBe('Acme Corp')
      expect(encrypted.w2s[0].box1).toBe(5000000)

      // Decrypt and verify roundtrip
      const decrypted = decryptSensitiveFields(encrypted, key)
      expect(decrypted.taxpayer.ssn).toBe('123456789')
      expect(decrypted.spouse!.ssn).toBe('987654321')
      expect(decrypted.dependents[0].ssn).toBe('111223333')
      expect(decrypted.dependents[1].ssn).toBe('444556666')
      expect(decrypted.w2s[0].employerEin).toBe('12-3456789')
      expect(decrypted.w2s[1].employerEin).toBe('98-7654321')
      expect(decrypted.scheduleK1s[0].entityEin).toBe('55-1234567')
    })

    it('does not mutate the original TaxReturn', () => {
      const key = makeKey()
      const original = makeTaxReturnWithPII()
      const originalSsn = original.taxpayer.ssn

      encryptSensitiveFields(original, key)

      expect(original.taxpayer.ssn).toBe(originalSsn)
    })

    it('handles empty SSNs/EINs (skips encryption)', () => {
      const key = makeKey()
      const tr = emptyTaxReturn(2025)
      // taxpayer.ssn is '' by default
      const encrypted = encryptSensitiveFields(tr, key)
      expect(encrypted.taxpayer.ssn).toBe('')
      const decrypted = decryptSensitiveFields(encrypted, key)
      expect(decrypted.taxpayer.ssn).toBe('')
    })

    it('handles TaxReturn with no spouse, no dependents, no W-2s, no K-1s', () => {
      const key = makeKey()
      const tr = emptyTaxReturn(2025)
      tr.taxpayer.ssn = '123456789'

      const encrypted = encryptSensitiveFields(tr, key)
      expect(isEncrypted(encrypted.taxpayer.ssn)).toBe(true)
      expect(encrypted.spouse).toBeUndefined()
      expect(encrypted.dependents).toHaveLength(0)
      expect(encrypted.w2s).toHaveLength(0)
      expect(encrypted.scheduleK1s).toHaveLength(0)

      const decrypted = decryptSensitiveFields(encrypted, key)
      expect(decrypted.taxpayer.ssn).toBe('123456789')
    })
  })

  describe('plaintext migration (detect + decrypt passthrough)', () => {
    it('decryptSensitiveFields passes through plaintext SSNs unchanged', () => {
      const key = makeKey()
      const tr = makeTaxReturnWithPII()
      // tr has plaintext SSNs — decryptSensitiveFields should return them as-is
      const decrypted = decryptSensitiveFields(tr, key)
      expect(decrypted.taxpayer.ssn).toBe('123456789')
      expect(decrypted.spouse!.ssn).toBe('987654321')
      expect(decrypted.dependents[0].ssn).toBe('111223333')
      expect(decrypted.w2s[0].employerEin).toBe('12-3456789')
      expect(decrypted.scheduleK1s[0].entityEin).toBe('55-1234567')
    })

    it('decryptSensitiveFields handles mix of encrypted and plaintext fields', () => {
      const key = makeKey()
      const tr = makeTaxReturnWithPII()
      // Encrypt only the taxpayer SSN, leave others as plaintext
      tr.taxpayer = { ...tr.taxpayer, ssn: encrypt('123456789', key) }

      const decrypted = decryptSensitiveFields(tr, key)
      expect(decrypted.taxpayer.ssn).toBe('123456789')
      expect(decrypted.spouse!.ssn).toBe('987654321') // plaintext passthrough
      expect(decrypted.w2s[0].employerEin).toBe('12-3456789') // plaintext passthrough
    })
  })

  describe('TaxService integration', () => {
    it('stores encrypted SSNs/EINs in SQLite, decrypts on reload', () => {
      const svc1 = new TaxService(workspace)
      svc1.setTaxpayer({ firstName: 'John', lastName: 'Doe', ssn: '123456789' })
      svc1.addW2({
        id: 'w2-1',
        employerEin: '12-3456789',
        employerName: 'Acme Corp',
        box1: 5000000, box2: 800000, box3: 5000000, box4: 310000,
        box5: 5000000, box6: 72500, box7: 0, box8: 0, box10: 0, box11: 0,
        box12: [], box13StatutoryEmployee: false, box13RetirementPlan: false,
        box13ThirdPartySickPay: false, box14: '',
      })
      svc1.persistNow()

      // Verify the DB has encrypted values (not plaintext)
      const db = new Database(join(workspace, 'opentax.db'), { readonly: true })
      const row = db.prepare('SELECT data FROM tax_returns WHERE id = ?').get('current') as { data: string }
      db.close()
      const stored = JSON.parse(row.data)
      expect(stored.taxpayer.ssn).not.toBe('123456789')
      expect(isEncrypted(stored.taxpayer.ssn)).toBe(true)
      expect(stored.w2s[0].employerEin).not.toBe('12-3456789')
      expect(isEncrypted(stored.w2s[0].employerEin)).toBe(true)

      // Reload and verify in-memory values are plaintext
      const svc2 = new TaxService(workspace)
      expect(svc2.taxReturn.taxpayer.ssn).toBe('123456789')
      expect(svc2.taxReturn.w2s[0].employerEin).toBe('12-3456789')
    })

    it('in-memory TaxReturn always has plaintext values', () => {
      const svc = new TaxService(workspace)
      svc.setTaxpayer({ ssn: '999887777' })
      // After mutation, in-memory should be plaintext
      expect(svc.taxReturn.taxpayer.ssn).toBe('999887777')
      expect(isPlaintext(svc.taxReturn.taxpayer.ssn)).toBe(true)
    })

    it('handles legacy JSON migration with encryption', () => {
      // Write a legacy JSON file with plaintext SSN
      const tr = emptyTaxReturn(2025)
      tr.taxpayer.ssn = '123456789'
      tr.filingStatus = 'single'
      writeFileSync(join(workspace, 'opentax-state.json'), JSON.stringify(tr))

      // TaxService should migrate, encrypt in DB, keep plaintext in memory
      const svc = new TaxService(workspace)
      expect(svc.taxReturn.taxpayer.ssn).toBe('123456789')

      // Check DB has encrypted value
      const db = new Database(join(workspace, 'opentax.db'), { readonly: true })
      const row = db.prepare('SELECT data FROM tax_returns WHERE id = ?').get('current') as { data: string }
      db.close()
      const stored = JSON.parse(row.data)
      expect(stored.taxpayer.ssn).not.toBe('123456789')
      expect(isEncrypted(stored.taxpayer.ssn)).toBe(true)
    })
  })
})
