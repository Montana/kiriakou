import type { KiriakouSignals, KiriakouTask } from '../../types'

interface ScoreInput {
  signals: KiriakouSignals
  task: KiriakouTask
  powOk: boolean
}

interface Reason {
  name: string
  weight: number
  contribution: number
  note: string
}

/** Clamp helper. */
const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x)

/**
 * Compute a humanity score in [0,1] from raw signals. Everything the client
 * sends is treated as untrusted evidence: the *server* decides the score, so a
 * bot cannot simply POST `{ score: 1 }`.
 *
 * The score is a weighted average of independent sub-scores. Each sub-score is
 * in [0,1] where 1 = "looks human". Weights sum to 1.0. This is deliberately
 * transparent rather than a black box so you can audit and tune it.
 */
export function scoreHumanity(input: ScoreInput): { score: number; reasons: Reason[] } {
  const { signals: s, task, powOk } = input
  const reasons: Reason[] = []

  const add = (name: string, weight: number, sub: number, note: string) => {
    const contribution = weight * clamp01(sub)
    reasons.push({ name, weight, contribution, note })
  }

  // 1) Automation flags — a single hard tell dominates.
  add('webdriver', 0.2, s.webdriver ? 0 : 1, s.webdriver ? 'navigator.webdriver set' : 'no webdriver flag')

  // 2) Headless / environment consistency.
  const envScore = environmentScore(s)
  add('environment', 0.15, envScore.value, envScore.note)

  // 3) Pointer dynamics — humans produce curved, variable-velocity paths.
  const pointerScore = pointerHumanity(s)
  add('pointer', 0.2, pointerScore.value, pointerScore.note)

  // 4) Keystroke rhythm (only meaningful if the user typed).
  const keyScore = keystrokeHumanity(s.keyIntervals)
  add('keystroke', 0.1, keyScore.value, keyScore.note)

  // 5) Reaction latency — impossibly fast responses are scripted.
  const latencyScore = latencyHumanity(s.firstInteractionLatency)
  add('latency', 0.1, latencyScore.value, latencyScore.note)

  // 6) Interactive challenge correctness.
  const challengeScore = challengeCorrect(task, s.challengeAnswer)
  add('challenge', 0.15, challengeScore.value, challengeScore.note)

  // 7) Proof-of-work — presence raises the cost of brute-forcing this endpoint.
  add('proofOfWork', 0.1, powOk ? 1 : 0, powOk ? 'valid PoW' : 'missing/invalid PoW')

  const score = clamp01(reasons.reduce((acc, r) => acc + r.contribution, 0))
  return { score, reasons }
}

function environmentScore(s: KiriakouSignals): { value: number; note: string } {
  let v = 1
  const notes: string[] = []
  const env = s.env
  if (!env.languages?.length) {
    v -= 0.4
    notes.push('empty navigator.languages')
  }
  if (env.hardwareConcurrency === 0) {
    v -= 0.3
    notes.push('zero hardwareConcurrency')
  }
  if (/Headless/i.test(env.userAgent)) {
    v -= 0.6
    notes.push('headless UA')
  }
  if (!env.hasChromeObject && /Chrome/i.test(env.userAgent)) {
    v -= 0.2
    notes.push('Chrome UA without window.chrome')
  }
  if (!env.permissionsConsistent) {
    v -= 0.2
    notes.push('permissions API inconsistency')
  }
  if (env.screen.w === 0 || env.screen.h === 0) {
    v -= 0.3
    notes.push('degenerate screen size')
  }
  return { value: clamp01(v), note: notes.length ? notes.join(', ') : 'consistent environment' }
}

function pointerHumanity(s: KiriakouSignals): { value: number; note: string } {
  // A touch-only device may legitimately have few pointermove samples; don't
  // punish that as long as an interaction happened.
  if (s.env.touch && s.pointerSamples < 5) {
    return { value: 0.7, note: 'touch device, sparse pointer data' }
  }
  if (s.pointerSamples < 5) {
    return { value: 0.15, note: 'almost no pointer movement' }
  }
  // Real cursors curve and vary in speed. Zero variance/curvature ~= scripted.
  const varScore = clamp01(s.pointerVelocityVariance / 50) // saturates around human levels
  const curveScore = clamp01(s.pointerCurvature / 0.3)
  const value = clamp01(0.5 * varScore + 0.5 * curveScore)
  const note = `velVar=${s.pointerVelocityVariance.toFixed(1)}, curvature=${s.pointerCurvature.toFixed(3)}`
  return { value, note }
}

function keystrokeHumanity(intervals: number[]): { value: number; note: string } {
  if (!intervals.length) return { value: 0.6, note: 'no typing (neutral)' }
  if (intervals.length < 3) return { value: 0.5, note: 'too few keystrokes' }
  const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length
  const variance = intervals.reduce((a, b) => a + (b - mean) ** 2, 0) / intervals.length
  const std = Math.sqrt(variance)
  // Humans have irregular timing (coefficient of variation typically > 0.2).
  const cv = mean > 0 ? std / mean : 0
  const value = clamp01(cv / 0.35)
  return { value, note: `keystroke CV=${cv.toFixed(2)}` }
}

function latencyHumanity(ms: number): { value: number; note: string } {
  if (ms <= 0) return { value: 0.2, note: 'no measured reaction' }
  if (ms < 120) return { value: 0.1, note: `reaction ${ms}ms below human floor` }
  if (ms > 30000) return { value: 0.5, note: 'very slow reaction (neutral)' }
  return { value: 1, note: `plausible reaction ${ms}ms` }
}

function challengeCorrect(task: KiriakouTask, answer: number | null): { value: number; note: string } {
  if (answer === null) return { value: 0, note: 'challenge not answered' }
  if (task.kind === 'slider') {
    const target = Number(task.params.target ?? 50)
    const tolerance = Number(task.params.tolerance ?? 4)
    const ok = Math.abs(answer - target) <= tolerance
    return { value: ok ? 1 : 0, note: ok ? 'slider matched' : `off by ${Math.abs(answer - target)}` }
  }
  // 'sequence' encodes the expected index the user should have clicked last.
  const expected = Number(task.params.expected ?? -1)
  const ok = answer === expected
  return { value: ok ? 1 : 0, note: ok ? 'sequence correct' : 'sequence wrong' }
}
