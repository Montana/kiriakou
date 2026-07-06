import { defineEventHandler, useRuntimeConfig } from '#imports'
import { sign, newNonce } from '../utils/token'
import { remember } from '../utils/store'
import type { KiriakouChallenge, KiriakouTask } from '../../types'

/**
 * GET {apiPrefix}/challenge
 *
 * Issues a fresh, single-use, signed challenge. The signed `token` binds the
 * task and its expected answer so the client cannot tamper with what will be
 * checked at verify time. The answer targets themselves are not secret — the
 * security comes from *how* a human performs the interaction, not from hiding
 * the target.
 */
export default defineEventHandler((): KiriakouChallenge => {
  const cfg = useRuntimeConfig().kiriakou as {
    challengeTtl: number
    powBits: number
  }

  const nonce = newNonce()
  const ttl = cfg.challengeTtl * 1000
  const issuedAt = Date.now()

  const task = buildTask()

  // Remember the nonce so a solved challenge can be used exactly once.
  remember(nonce, ttl)

  const token = sign({
    nonce,
    task,
    powBits: cfg.powBits,
    issuedAt,
    ttl,
  })

  return { token, nonce, task, powBits: cfg.powBits, issuedAt, ttl }
})

/** Randomly pick one of the small accessible interactive tasks. */
function buildTask(): KiriakouTask {
  if (Math.random() < 0.5) {
    const target = 20 + Math.floor(Math.random() * 60) // 20..79
    return {
      kind: 'slider',
      prompt: `Drag the slider to ${target}.`,
      params: { target, tolerance: 4 },
    }
  }
  // sequence: show N labelled dots, ask the user to click them in order; we
  // check the index of the final expected click.
  const count = 3 + Math.floor(Math.random() * 2) // 3 or 4
  return {
    kind: 'sequence',
    prompt: `Tap the numbers in order, 1 through ${count}.`,
    params: { count, expected: count },
  }
}
