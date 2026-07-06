import type { KiriakouEnv, KiriakouSignals } from './types'

interface PointerSample {
  x: number
  y: number
  t: number
}

/**
 * Passively records pointer motion and keystroke rhythm in the browser, and
 * computes summary statistics on demand. Everything here is summary-level; no
 * raw content (keys pressed, exact coordinates over time) is sent to the server
 * — only aggregate shape/rhythm metrics.
 */
export class Collector {
  private pointers: PointerSample[] = []
  private keyTimes: number[] = []
  private lastKey = 0
  private windowStart = 0
  private firstInteraction = 0
  private started = false

  private onMove = (e: PointerEvent) => {
    // Cap the buffer so a long-lived page doesn't grow unbounded.
    if (this.pointers.length > 600) this.pointers.shift()
    this.pointers.push({ x: e.clientX, y: e.clientY, t: performance.now() })
    this.markInteraction()
  }

  private onKey = () => {
    const now = performance.now()
    if (this.lastKey) this.keyTimes.push(now - this.lastKey)
    this.lastKey = now
    if (this.keyTimes.length > 200) this.keyTimes.shift()
    this.markInteraction()
  }

  private markInteraction() {
    if (!this.firstInteraction && this.windowStart) {
      this.firstInteraction = performance.now() - this.windowStart
    }
  }

  /** Begin listening. Safe to call once at app start. */
  start() {
    if (this.started || typeof window === 'undefined') return
    this.started = true
    window.addEventListener('pointermove', this.onMove, { passive: true })
    window.addEventListener('keydown', this.onKey, { passive: true })
  }

  /**
   * Reset the interaction-timing window. Call this the moment a challenge is
   * shown so `firstInteractionLatency` measures reaction to *that* prompt.
   */
  beginWindow() {
    this.windowStart = performance.now()
    this.firstInteraction = 0
  }

  /** Compute the signal bundle to send to the server. */
  async snapshot(extra: { challengeAnswer: number | null; powNonce: string | null }): Promise<KiriakouSignals> {
    const { pathLength, velocityVariance, curvature } = this.pointerStats()
    return {
      webdriver: !!(navigator as unknown as { webdriver?: boolean }).webdriver,
      pointerSamples: this.pointers.length,
      pointerPathLength: pathLength,
      pointerVelocityVariance: velocityVariance,
      pointerCurvature: curvature,
      keyIntervals: [...this.keyTimes],
      firstInteractionLatency: Math.round(this.firstInteraction),
      challengeAnswer: extra.challengeAnswer,
      powNonce: extra.powNonce,
      env: this.env(),
    }
  }

  private pointerStats() {
    const p = this.pointers
    let pathLength = 0
    const velocities: number[] = []
    const angles: number[] = []
    for (let i = 1; i < p.length; i++) {
      const dx = p[i].x - p[i - 1].x
      const dy = p[i].y - p[i - 1].y
      const dt = Math.max(1, p[i].t - p[i - 1].t)
      const dist = Math.hypot(dx, dy)
      pathLength += dist
      velocities.push(dist / dt)
      if (i > 1) {
        const pdx = p[i - 1].x - p[i - 2].x
        const pdy = p[i - 1].y - p[i - 2].y
        const a1 = Math.atan2(dy, dx)
        const a2 = Math.atan2(pdy, pdx)
        let da = Math.abs(a1 - a2)
        if (da > Math.PI) da = 2 * Math.PI - da
        angles.push(da)
      }
    }
    return {
      pathLength,
      velocityVariance: variance(velocities) * 1000, // scale to a readable range
      curvature: mean(angles),
    }
  }

  private env(): KiriakouEnv {
    const nav = navigator as unknown as {
      languages?: string[]
      hardwareConcurrency?: number
      deviceMemory?: number
      maxTouchPoints?: number
    }
    return {
      userAgent: navigator.userAgent,
      languages: nav.languages ? [...nav.languages] : [],
      hardwareConcurrency: nav.hardwareConcurrency ?? 0,
      deviceMemory: nav.deviceMemory ?? null,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || '',
      screen: { w: window.screen.width, h: window.screen.height, dpr: window.devicePixelRatio || 1 },
      touch: (nav.maxTouchPoints ?? 0) > 0 || 'ontouchstart' in window,
      hasChromeObject: 'chrome' in window,
      permissionsConsistent: 'permissions' in navigator,
    }
  }
}

function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0
}

function variance(xs: number[]): number {
  if (xs.length < 2) return 0
  const m = mean(xs)
  return xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length
}
