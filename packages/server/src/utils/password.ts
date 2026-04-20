import crypto from "crypto";

// Ambiguous-looking characters removed: 0/O, 1/l/I.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";

/**
 * Generate a cryptographically random password of the given length.
 * Uses an unambiguous alphabet so humans can read/type the generated string.
 */
export function generateTempPassword(length: number = 12): string {
  const bytes = crypto.randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return out;
}
