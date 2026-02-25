/**
 * Field-level encryption for sensitive PII (SSNs, EINs) stored in SQLite.
 *
 * Uses AES-256-GCM via Node.js built-in `crypto` module.
 * The encryption key is auto-generated on first run and stored at
 * `<workspace>/.opentax-key` with owner-only permissions (0o600).
 *
 * Encrypted values are encoded as `<iv>:<ciphertext>:<authTag>` in base64.
 */

import { randomBytes, createCipheriv, createDecipheriv } from 'node:crypto'
import { readFileSync, writeFileSync, existsSync, chmodSync } from 'node:fs'
import { join } from 'node:path'
import type { TaxReturn } from '../../src/model/types.ts'

const ALGORITHM = 'aes-256-gcm'
const IV_BYTES = 12 // 96-bit IV recommended for GCM
const KEY_BYTES = 32 // 256-bit key
const KEY_FILENAME = '.opentax-key'

/**
 * Encrypt a plaintext string using AES-256-GCM.
 * Returns `<iv>:<ciphertext>:<authTag>` with each segment base64-encoded.
 */
export function encrypt(plaintext: string, key: Buffer): string {
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return `${iv.toString('base64')}:${encrypted.toString('base64')}:${authTag.toString('base64')}`
}

/**
 * Decrypt an `iv:ciphertext:authTag` string produced by `encrypt()`.
 * Throws if the auth tag verification fails (tampered ciphertext).
 */
export function decrypt(encrypted: string, key: Buffer): string {
  const parts = encrypted.split(':')
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted format: expected iv:ciphertext:authTag')
  }
  const [ivB64, ciphertextB64, authTagB64] = parts
  const iv = Buffer.from(ivB64, 'base64')
  const ciphertext = Buffer.from(ciphertextB64, 'base64')
  const authTag = Buffer.from(authTagB64, 'base64')

  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()])
  return decrypted.toString('utf8')
}

/**
 * Load the encryption key from `<workspace>/.opentax-key`, or generate
 * a new 256-bit random key and persist it with 0o600 permissions.
 */
export function getOrCreateKey(workspace: string): Buffer {
  const keyPath = join(workspace, KEY_FILENAME)
  if (existsSync(keyPath)) {
    const hex = readFileSync(keyPath, 'utf-8').trim()
    return Buffer.from(hex, 'hex')
  }
  const key = randomBytes(KEY_BYTES)
  writeFileSync(keyPath, key.toString('hex'), { mode: 0o600 })
  // Ensure permissions are set even if the file already existed with different perms
  chmodSync(keyPath, 0o600)
  return key
}

// ── Sensitive field helpers ────────────────────────────────────────

/**
 * Detect whether a value is plaintext (unencrypted).
 * Plaintext SSNs are 9 digits; plaintext EINs match XX-XXXXXXX.
 * Encrypted values use the `iv:ciphertext:authTag` format (three base64 segments).
 */
export function isPlaintext(value: string): boolean {
  if (!value) return false
  // SSN: exactly 9 digits
  if (/^\d{9}$/.test(value)) return true
  // EIN: XX-XXXXXXX
  if (/^\d{2}-\d{7}$/.test(value)) return true
  return false
}

/**
 * Check whether a value looks like an encrypted token (iv:ciphertext:authTag).
 */
export function isEncrypted(value: string): boolean {
  if (!value) return false
  const parts = value.split(':')
  return parts.length === 3 && parts.every((p) => p.length > 0)
}

/**
 * Encrypt a single field value if it is non-empty.
 * Empty strings are returned as-is (no point encrypting empty values).
 */
function encryptField(value: string, key: Buffer): string {
  if (!value) return value
  return encrypt(value, key)
}

/**
 * Decrypt a single field value. If the value looks like plaintext
 * (migration case), return it unchanged. Empty strings pass through.
 */
function decryptField(value: string, key: Buffer): string {
  if (!value) return value
  if (isPlaintext(value)) return value // migration: already plaintext
  if (!isEncrypted(value)) return value // safety: don't decrypt unknown formats
  return decrypt(value, key)
}

/**
 * Create a shallow copy of a TaxReturn with all sensitive fields encrypted.
 * Does not mutate the input.
 */
export function encryptSensitiveFields(tr: TaxReturn, key: Buffer): TaxReturn {
  const result = { ...tr }

  // taxpayer.ssn
  result.taxpayer = { ...tr.taxpayer, ssn: encryptField(tr.taxpayer.ssn, key) }

  // spouse.ssn
  if (tr.spouse) {
    result.spouse = { ...tr.spouse, ssn: encryptField(tr.spouse.ssn, key) }
  }

  // dependents[].ssn
  if (tr.dependents.length > 0) {
    result.dependents = tr.dependents.map((d) => ({ ...d, ssn: encryptField(d.ssn, key) }))
  }

  // w2s[].employerEin
  if (tr.w2s.length > 0) {
    result.w2s = tr.w2s.map((w) => ({ ...w, employerEin: encryptField(w.employerEin, key) }))
  }

  // scheduleK1s[].entityEin
  if (tr.scheduleK1s.length > 0) {
    result.scheduleK1s = tr.scheduleK1s.map((k) => ({
      ...k,
      entityEin: encryptField(k.entityEin, key),
    }))
  }

  return result
}

/**
 * Create a shallow copy of a TaxReturn with all sensitive fields decrypted.
 * Handles migration: if a field is plaintext, it passes through unchanged.
 * Does not mutate the input.
 */
export function decryptSensitiveFields(tr: TaxReturn, key: Buffer): TaxReturn {
  const result = { ...tr }

  // taxpayer.ssn
  result.taxpayer = { ...tr.taxpayer, ssn: decryptField(tr.taxpayer.ssn, key) }

  // spouse.ssn
  if (tr.spouse) {
    result.spouse = { ...tr.spouse, ssn: decryptField(tr.spouse.ssn, key) }
  }

  // dependents[].ssn
  if (tr.dependents.length > 0) {
    result.dependents = tr.dependents.map((d) => ({ ...d, ssn: decryptField(d.ssn, key) }))
  }

  // w2s[].employerEin
  if (tr.w2s.length > 0) {
    result.w2s = tr.w2s.map((w) => ({ ...w, employerEin: decryptField(w.employerEin, key) }))
  }

  // scheduleK1s[].entityEin
  if (tr.scheduleK1s.length > 0) {
    result.scheduleK1s = tr.scheduleK1s.map((k) => ({
      ...k,
      entityEin: decryptField(k.entityEin, key),
    }))
  }

  return result
}
