import { createHash } from 'node:crypto'

/**
 * Hashcash-style proof-of-work. The client must find a `nonce` such that
 * SHA-256(`${challengeNonce}:${nonce}`) has at least `bits` leading zero bits.
 * This adds a small, tunable CPU cost per verification attempt, which raises
 * the price of high-volume automated abuse without inconveniencing a human
 * (a browser solves 12–16 bits in well under a second).
 */
export function leadingZeroBits(hex: string): number {
  let bits = 0
  for (const ch of hex) {
    const nibble = parseInt(ch, 16)
    if (nibble === 0) {
      bits += 4
      continue
    }
    // count leading zeros within this nibble
    if (nibble < 2) bits += 3
    else if (nibble < 4) bits += 2
    else if (nibble < 8) bits += 1
    break
  }
  return bits
}

export function verifyPow(challengeNonce: string, powNonce: string | null, bits: number): boolean {
  if (!powNonce) return false
  const hex = createHash('sha256').update(`${challengeNonce}:${powNonce}`).digest('hex')
  return leadingZeroBits(hex) >= bits
}
