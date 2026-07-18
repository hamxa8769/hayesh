import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

/**
 * Field-level encryption for sensitive Postgres columns (bank account
 * numbers, IBANs) that the schema comments claim are "encrypted at app
 * layer" but, until this module existed, never actually were.
 *
 * AES-256-GCM (authenticated encryption) via Node's built-in `crypto`.
 * Never aes-256-cbc (no integrity check) and never the deprecated
 * `createCipher` (derives a weak key from a passphrase with no salt).
 *
 * The `server-only` npm package is NOT installed in this project (it is
 * not present in package.json/package-lock.json/node_modules, and adding
 * it would require an `npm install` this change is not permitted to run).
 * Instead we use the same manual runtime guard already established in
 * lib/supabase/admin.ts: throw if this module is ever evaluated in a
 * browser context. This still guarantees FIELD_ENCRYPTION_KEY (read only
 * inside loadKey(), below) can never be read from client code — Node's
 * `crypto` module additionally does not bundle for the browser, so a
 * client import would fail at build time regardless.
 */

if (typeof window !== 'undefined') {
  throw new Error('lib/crypto/field-encryption.ts must never be imported client-side')
}

const ALGORITHM = 'aes-256-gcm'
const KEY_BYTES = 32
const IV_BYTES = 12
const CIPHERTEXT_PREFIX = 'v1:'

/**
 * Reads and validates FIELD_ENCRYPTION_KEY from the environment.
 *
 * Validation happens here (inside the function), NOT at module top-level,
 * so importing this file never throws for routes/pages that don't touch
 * encrypted fields and haven't configured the key yet — only callers that
 * actually invoke encryptField/decryptField pay for the check.
 */
function loadKey(): Buffer {
  const raw = process.env.FIELD_ENCRYPTION_KEY
  if (!raw) {
    throw new Error(
      'FIELD_ENCRYPTION_KEY is not set. Generate one with `openssl rand -base64 32` ' +
        'and add it to your server environment (never NEXT_PUBLIC_-prefixed).'
    )
  }

  const key = raw.includes('/') || raw.includes('+') || raw.endsWith('=') || !/^[0-9a-fA-F]+$/.test(raw)
    ? Buffer.from(raw, 'base64')
    : Buffer.from(raw, 'hex')

  if (key.length !== KEY_BYTES) {
    throw new Error(
      `FIELD_ENCRYPTION_KEY must decode to exactly ${KEY_BYTES} bytes (got ${key.length}). ` +
        'Generate a valid key with `openssl rand -base64 32`.'
    )
  }

  return key
}

/**
 * Encrypts a plaintext string into a self-describing ciphertext string:
 *   v1:<iv_base64>:<authTag_base64>:<ciphertext_base64>
 * A fresh random 12-byte IV is generated per call — never reused.
 */
export function encryptField(plain: string): string {
  const key = loadKey()
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()

  return `${CIPHERTEXT_PREFIX}${iv.toString('base64')}:${authTag.toString('base64')}:${ciphertext.toString('base64')}`
}

/**
 * Returns true if `value` matches the v1 ciphertext format produced by
 * encryptField. Used to distinguish encrypted rows from legacy plaintext
 * rows written before this module existed.
 */
export function isEncrypted(value: string): boolean {
  if (!value.startsWith(CIPHERTEXT_PREFIX)) return false
  const parts = value.slice(CIPHERTEXT_PREFIX.length).split(':')
  return parts.length === 3 && parts.every((part) => part.length > 0)
}

/**
 * Decrypts a ciphertext string produced by encryptField.
 *
 * IMPORTANT: rows written before this encryption layer existed are stored
 * as raw plaintext (no "v1:" prefix). Rather than throwing on those legacy
 * rows — which would break the admin payments page for every pre-existing
 * payout — this function detects the non-ciphertext shape via isEncrypted()
 * and returns the value unchanged. No backfill/migration of existing rows
 * is required for the app to keep working; legacy rows simply pass through
 * as-is until they are naturally replaced by new encrypted writes.
 */
export function decryptField(payload: string): string {
  if (!isEncrypted(payload)) {
    return payload
  }

  const key = loadKey()
  const [, ivB64, authTagB64, ciphertextB64] = payload.split(':')
  const iv = Buffer.from(ivB64, 'base64')
  const authTag = Buffer.from(authTagB64, 'base64')
  const ciphertext = Buffer.from(ciphertextB64, 'base64')

  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)
  const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()])
  return plain.toString('utf8')
}

/**
 * Masks an account number/IBAN for display, showing only the last 4
 * characters: "1234567890" -> "••••7890". Used anywhere the full value
 * should never be rendered (e.g. client-facing admin UI).
 */
export function maskAccountNumber(value: string): string {
  const trimmed = value.trim()
  if (trimmed.length <= 4) {
    return '••••'
  }
  return `••••${trimmed.slice(-4)}`
}
