/**
 * Browser-side proof-of-work solver using the Web Crypto API. Finds a nonce so
 * that SHA-256(`${challengeNonce}:${nonce}`) has at least `bits` leading zero
 * bits. Yields to the event loop periodically so the UI stays responsive.
 */
export async function solvePow(challengeNonce: string, bits: number, signal?: AbortSignal): Promise<string> {
  const enc = new TextEncoder()
  let counter = 0
  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (signal?.aborted) throw new DOMException('aborted', 'AbortError')
    const candidate = counter.toString(36)
    const digest = await crypto.subtle.digest('SHA-256', enc.encode(`${challengeNonce}:${candidate}`))
    if (leadingZeroBits(new Uint8Array(digest)) >= bits) return candidate
    counter++
    if (counter % 500 === 0) await new Promise((r) => setTimeout(r, 0))
  }
}

function leadingZeroBits(bytes: Uint8Array): number {
  let bits = 0
  for (const byte of bytes) {
    if (byte === 0) {
      bits += 8
      continue
    }
    bits += Math.clz32(byte) - 24 // clz32 of an 8-bit value, offset for 32-bit int
    break
  }
  return bits
}
