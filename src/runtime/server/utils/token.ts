import { createHmac, timingSafeEqual, randomBytes } from 'node:crypto'

/**
 * Stateless signed tokens (HMAC-SHA256 over a JSON payload).
 *
 * The secret is read from KIRIAKOU_SECRET. Never ship a default secret to
 * production — the module warns loudly if one is missing.
 */
function secret(): string {
  const s = process.env.KIRIAKOU_SECRET
  if (!s || s.length < 16) {
    // eslint-disable-next-line no-console
    console.warn(
      '[kiriakou] KIRIAKOU_SECRET is missing or too short. Set a random 32+ char secret in your environment.',
    )
    return s || 'insecure-development-secret-change-me'
  }
  return s
}

function b64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromB64url(s: string): Buffer {
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64')
}

export function sign<T extends Record<string, unknown>>(payload: T): string {
  const body = b64url(Buffer.from(JSON.stringify(payload)))
  const mac = b64url(createHmac('sha256', secret()).update(body).digest())
  return `${body}.${mac}`
}

export function verify<T = Record<string, unknown>>(token: string): T | null {
  const parts = token.split('.')
  if (parts.length !== 2) return null
  const [body, mac] = parts
  const expected = b64url(createHmac('sha256', secret()).update(body).digest())
  const a = Buffer.from(mac)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  try {
    return JSON.parse(fromB64url(body).toString('utf8')) as T
  } catch {
    return null
  }
}

export function newNonce(): string {
  return b64url(randomBytes(18))
}
