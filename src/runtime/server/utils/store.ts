/**
 * Single-use nonce store to stop a solved challenge from being replayed.
 *
 * This default is an in-process Map — fine for a single instance or dev. For
 * multi-instance deployments, replace the three functions below with a shared
 * store (Redis, Cloudflare KV, Nitro's `useStorage()`, etc.). The interface is
 * intentionally tiny so swapping is a small change.
 */
const seen = new Map<string, number>() // nonce -> expiry (ms epoch)

function sweep() {
  const now = Date.now()
  for (const [nonce, exp] of seen) if (exp <= now) seen.delete(nonce)
}

/** Register a nonce as issued. */
export function remember(nonce: string, ttlMs: number) {
  sweep()
  seen.set(nonce, Date.now() + ttlMs)
}

/**
 * Atomically consume a nonce. Returns true if it was valid and unused; false
 * if it was never issued, already used, or expired.
 */
export function consume(nonce: string): boolean {
  sweep()
  const exp = seen.get(nonce)
  if (exp === undefined || exp <= Date.now()) return false
  seen.delete(nonce) // one-time use
  return true
}
