import { defineEventHandler, readBody, setCookie, createError, useRuntimeConfig } from '#imports'
import { sign, verify } from '../utils/token'
import { consume } from '../utils/store'
import { verifyPow } from '../utils/pow'
import { scoreHumanity } from '../utils/score'
import type { KiriakouSignals, KiriakouTask, KiriakouVerifyResult } from '../../types'

interface VerifyBody {
  token: string
  signals: KiriakouSignals
}

interface ChallengePayload {
  nonce: string
  task: KiriakouTask
  powBits: number
  issuedAt: number
  ttl: number
}

/**
 * POST {apiPrefix}/verify
 *
 * Receives the signed challenge token plus the raw signals collected while the
 * human completed it. The server re-derives the expected answer from the signed
 * token, checks the proof-of-work, scores the signals, and — only on success —
 * mints a short-lived signed humanity token (also set as an httpOnly cookie).
 */
export default defineEventHandler(async (event): Promise<KiriakouVerifyResult> => {
  const cfg = useRuntimeConfig().kiriakou as {
    threshold: number
    humanityTtl: number
  }

  const body = await readBody<VerifyBody>(event)
  if (!body?.token || !body?.signals) {
    throw createError({ statusCode: 400, statusMessage: 'token and signals are required' })
  }

  // 1) Token must be authentic (correct HMAC) and unexpired.
  const payload = verify<ChallengePayload>(body.token)
  if (!payload) {
    throw createError({ statusCode: 400, statusMessage: 'invalid challenge token' })
  }
  if (Date.now() > payload.issuedAt + payload.ttl) {
    throw createError({ statusCode: 400, statusMessage: 'challenge expired' })
  }

  // 2) Nonce must be valid and previously unused (replay protection).
  if (!consume(payload.nonce)) {
    throw createError({ statusCode: 409, statusMessage: 'challenge already used or unknown' })
  }

  // 3) Proof-of-work verified against the *server's* nonce, not client claims.
  const powOk = verifyPow(payload.nonce, body.signals.powNonce, payload.powBits)

  // 4) Score. The expected answer comes from the signed task, never the body.
  const { score, reasons } = scoreHumanity({
    signals: body.signals,
    task: payload.task,
    powOk,
  })

  const ok = score >= cfg.threshold
  const result: KiriakouVerifyResult = { ok, score, threshold: cfg.threshold, reasons }

  if (ok) {
    const expiresAt = Date.now() + cfg.humanityTtl * 1000
    const humanityToken = sign({ kind: 'kiriakou-human', score, expiresAt })
    result.humanityToken = humanityToken
    result.expiresAt = expiresAt

    setCookie(event, 'kiriakou_human', humanityToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: cfg.humanityTtl,
      path: '/',
    })
  }

  return result
})
