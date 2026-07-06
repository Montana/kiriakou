import { getCookie, getHeader, createError, type H3Event } from 'h3'
import { verify } from './token'

interface HumanityPayload {
  kind: string
  score: number
  expiresAt: number
}

/**
 * Read and validate the humanity token from either the httpOnly cookie or an
 * `x-kiriakou-token` header (useful for API clients / SPAs). Returns the score
 * if valid and unexpired, otherwise null.
 */
export function getHumanity(event: H3Event): { score: number; expiresAt: number } | null {
  const token = getCookie(event, 'kiriakou_human') || getHeader(event, 'x-kiriakou-token')
  if (!token) return null
  const payload = verify<HumanityPayload>(token)
  if (!payload || payload.kind !== 'kiriakou-human') return null
  if (Date.now() > payload.expiresAt) return null
  return { score: payload.score, expiresAt: payload.expiresAt }
}

/**
 * Use inside any server route that must only run for a verified human. Throws
 * 428 (Precondition Required) so your client can react by launching the gate.
 *
 * @example
 * export default defineEventHandler((event) => {
 *   assertHuman(event)
 *   // ...sensitive action
 * })
 */
export function assertHuman(event: H3Event) {
  const h = getHumanity(event)
  if (!h) {
    throw createError({
      statusCode: 428,
      statusMessage: 'Human verification required',
      data: { kiriakou: 'required' },
    })
  }
  return h
}
