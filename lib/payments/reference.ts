import { randomBytes } from "node:crypto"

// Unambiguous alphabet (no 0/O/1/I) — customers type this into bank transfer notes.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"

export function generateReferenceCode(): string {
  const bytes = randomBytes(8)
  let code = ""
  for (const b of bytes) code += ALPHABET[b % ALPHABET.length]
  return `HYS-${code}`
}
