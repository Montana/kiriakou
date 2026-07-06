import { computed, useState, useNuxtApp, useRuntimeConfig } from '#imports'
import type { Collector } from '../collector'
import { solvePow } from '../pow-client'
import type { KiriakouChallenge, KiriakouVerifyResult } from '../types'

export type KiriakouState =
  | 'idle'
  | 'loading'
  | 'challenging'
  | 'verifying'
  | 'passed'
  | 'failed'
  | 'error'

interface KiriakouReactive {
  state: KiriakouState
  challenge: KiriakouChallenge | null
  result: KiriakouVerifyResult | null
  error: string | null
}

/**
 * Drives the post-2FA humanity check. Typical usage:
 *
 *   const k = useKiriakou()
 *   await k.begin()            // fetch challenge, start PoW + timing window
 *   // ...user completes the task in <KiriakouGate/>...
 *   await k.submit(answer)     // score + mint humanity token
 *   if (k.state.value === 'passed') proceed()
 */
export function useKiriakou() {
  const cfg = useRuntimeConfig().public.kiriakou as { apiPrefix: string }
  const store = useState<KiriakouReactive>('kiriakou', () => ({
    state: 'idle',
    challenge: null,
    result: null,
    error: null,
  }))

  // Proof-of-work runs concurrently while the human works on the task.
  let powPromise: Promise<string> | null = null
  let powController: AbortController | null = null

  function collector(): Collector {
    const { $kiriakouCollector } = useNuxtApp()
    return $kiriakouCollector as Collector
  }

  async function begin() {
    store.value.error = null
    store.value.result = null
    store.value.state = 'loading'
    try {
      const challenge = await $fetch<KiriakouChallenge>(`${cfg.apiPrefix}/challenge`)
      store.value.challenge = challenge
      collector().beginWindow()

      powController = new AbortController()
      powPromise = solvePow(challenge.nonce, challenge.powBits, powController.signal).catch(() => '')

      store.value.state = 'challenging'
    } catch (e) {
      store.value.state = 'error'
      store.value.error = (e as Error).message || 'failed to load challenge'
    }
  }

  async function submit(answer: number | null) {
    const challenge = store.value.challenge
    if (!challenge) return
    store.value.state = 'verifying'
    try {
      const powNonce = powPromise ? await powPromise : null
      const signals = await collector().snapshot({ challengeAnswer: answer, powNonce: powNonce || null })
      const result = await $fetch<KiriakouVerifyResult>(`${cfg.apiPrefix}/verify`, {
        method: 'POST',
        body: { token: challenge.token, signals },
      })
      store.value.result = result
      store.value.state = result.ok ? 'passed' : 'failed'
    } catch (e) {
      store.value.state = 'error'
      store.value.error = (e as Error).message || 'verification failed'
    }
  }

  function reset() {
    powController?.abort()
    powPromise = null
    store.value.state = 'idle'
    store.value.challenge = null
    store.value.result = null
    store.value.error = null
  }

  return {
    /** Reactive ref of the current phase. */
    state: computed(() => store.value.state),
    challenge: computed(() => store.value.challenge),
    result: computed(() => store.value.result),
    error: computed(() => store.value.error),
    begin,
    submit,
    reset,
  }
}
