// Shared types used by both the client collector and the server scorer.

/** Raw behavioural + environmental signals gathered on the client after 2FA. */
export interface KiriakouSignals {
  /** navigator.webdriver — true is a very strong automation tell. */
  webdriver: boolean
  /** Number of distinct pointermove samples recorded during the window. */
  pointerSamples: number
  /** Total pointer path length in CSS pixels. */
  pointerPathLength: number
  /** Variance of pointer velocity between samples. Constant velocity ~= scripted. */
  pointerVelocityVariance: number
  /** Mean absolute turning angle between consecutive segments (radians). */
  pointerCurvature: number
  /** Inter-keystroke intervals (ms) captured during any typing. */
  keyIntervals: number[]
  /** ms between the challenge appearing and the first user interaction. */
  firstInteractionLatency: number
  /** Whether the interactive challenge was answered, and correctly. */
  challengeAnswer: number | null
  /** Solved proof-of-work nonce (string) for the issued challenge. */
  powNonce: string | null
  /** Coarse environment fingerprint used only for headless/inconsistency checks. */
  env: KiriakouEnv
}

export interface KiriakouEnv {
  userAgent: string
  languages: string[]
  hardwareConcurrency: number
  deviceMemory: number | null
  timezone: string
  screen: { w: number; h: number; dpr: number }
  touch: boolean
  /** Presence of properties commonly missing in headless/instrumented browsers. */
  hasChromeObject: boolean
  permissionsConsistent: boolean
}

/** The signed challenge handed to the client. */
export interface KiriakouChallenge {
  /** Opaque signed token binding this challenge to the session. */
  token: string
  /** Single-use id echoed back on verify. */
  nonce: string
  /** Interactive task the human must complete. */
  task: KiriakouTask
  /** Proof-of-work difficulty (leading zero bits required). */
  powBits: number
  /** Server time the challenge was issued (ms epoch). */
  issuedAt: number
  /** ms the client has to complete verification. */
  ttl: number
}

/** A small, accessible interactive task. Answer is checked server-side. */
export interface KiriakouTask {
  kind: 'slider' | 'sequence'
  prompt: string
  /** For 'slider': target value 0-100. For 'sequence': ordered targets. */
  params: Record<string, unknown>
}

export interface KiriakouVerifyResult {
  ok: boolean
  score: number
  threshold: number
  /** Per-signal breakdown, useful for tuning and audit logs. */
  reasons: { name: string; weight: number; contribution: number; note: string }[]
  /** Present only on success: signed humanity token + expiry. */
  humanityToken?: string
  expiresAt?: number
}

export interface KiriakouModuleOptions {
  /** Route prefix for the API. Default: '/api/kiriakou'. */
  apiPrefix: string
  /** Pass score in [0,1] required to be treated as human. Default: 0.6. */
  threshold: number
  /** Lifetime of an issued humanity token in seconds. Default: 900 (15 min). */
  humanityTtl: number
  /** Lifetime of a challenge before it expires, in seconds. Default: 120. */
  challengeTtl: number
  /** Proof-of-work difficulty in leading zero bits. Default: 12. */
  powBits: number
  /** Auto-register the client collector plugin. Default: true. */
  autoCollect: boolean
}
