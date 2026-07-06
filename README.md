# kiriakou

Post-2FA humanity verification for **Halo Archives*.

Two-factor authentication proves *possession of a factor*. It does not prove a **human** is driving the session right now — hijacked sessions, replayed tokens, and headless automation all survive 2FA. `kiriakou` runs *after* login and scores whether the live session is a person, then mints a short-lived
"humanity" token you can require on high-risk actions.

It combines three independent signals, all scored **server-side** so a client
can't just claim it passed:

1. **Passive behavioural signals** — pointer path curvature and velocity
   variance, keystroke rhythm, reaction latency.
2. **A tiny interactive challenge** — a slider or tap-in-order task (accessible,
   keyboard-operable). The real value is *how* it's completed, not the answer.
3. **Proof-of-work** — a small, tunable CPU cost that raises the price of
   high-volume automated abuse without inconveniencing a human.


## Install

Copy this module into your project (or publish it privately), then:

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ['kiriakou'],
  kiriakou: {
    threshold: 0.6,     // score in [0,1] required to pass
    powBits: 12,        // proof-of-work difficulty (leading zero bits)
    humanityTtl: 900,   // humanity token lifetime, seconds
    challengeTtl: 120,  // challenge lifetime, seconds
  },
})
```

Set a strong secret in your environment — **required for production**:

```bash
# .env
KIRIAKOU_SECRET="<random 32+ character string>"
```

Without it, tokens are signed with an insecure default and the module warns at
startup.

## Client usage

Drop the gate anywhere and open it after 2FA succeeds:

```vue
<script setup lang="ts">
const open = ref(false)
function afterTwoFactor() {
  open.value = true // launch the humanity check
}
</script>

<template>
  <KiriakouGate
    v-model:open="open"
    @passed="(score) => console.log('human', score)"
    @failed="(score) => console.log('nope', score)"
  />
</template>
```

Prefer to drive it yourself? Use the composable:

```ts
const k = useKiriakou()
await k.begin()        // fetch challenge, start PoW + timing window
// ...user completes the task...
await k.submit(answer) // score + issue humanity token
k.state.value          // 'passed' | 'failed' | ...
```

## Protecting a sensitive action (server)

`assertHuman` is auto-imported into your server routes. It reads the humanity
token from the httpOnly cookie or an `x-kiriakou-token` header and throws
**428 Precondition Required** if it's missing or expired:

```ts
// server/api/transfer.post.ts
export default defineEventHandler((event) => {
  assertHuman(event)          // 428 if not a verified human
  // ...perform the sensitive operation...
  return { ok: true }
})
```

On the client, catch the 428 and launch the gate:

```ts
try {
  await $fetch('/api/transfer', { method: 'POST' })
} catch (e) {
  if (e?.statusCode === 428) open.value = true
}
```

## How scoring works

`verify` re-derives the expected answer from the **signed** challenge token (never from the request body), verifies the proof-of-work against the server's
nonce, then runs a transparent weighted score:

| Signal        | Weight | What it catches                              |
| ------------- | ------ | -------------------------------------------- |
| webdriver     | 0.20   | `navigator.webdriver` automation flag        |
| environment   | 0.15   | headless UAs, empty languages, degenerate DOM |
| pointer       | 0.20   | teleporting / constant-velocity cursors      |
| keystroke     | 0.10   | perfectly regular typing rhythm              |
| latency       | 0.10   | sub-human reaction times                     |
| challenge     | 0.15   | whether the task was actually completed      |
| proof-of-work | 0.10   | raises per-attempt cost                       |

The full per-signal breakdown is returned in `result.reasons` for auditing and
tuning. Adjust `threshold` to trade off friction against security.

## Replay & tamper protection

- Challenges are HMAC-signed and single-use (nonce consumed on verify).
- The humanity token is HMAC-signed with an expiry and set httpOnly.
- The in-process nonce store (`runtime/server/utils/store.ts`) is fine for a
  single instance; swap it for Redis / Nitro `useStorage()` for multi-instance
  deployments — the interface is two functions.

## Privacy

Only aggregate interaction *shape* is sent to the server (path length, variance, timing distributions). No keys pressed and no raw coordinate stream leave the browser. No third-party tracking.

## Files

```
src/
  module.ts                       Nuxt module wiring
  runtime/
    types.ts                      shared types
    collector.ts                  passive signal collector (browser)
    pow-client.ts                 Web Crypto proof-of-work solver
    composables/useKiriakou.ts    client orchestration
    components/KiriakouGate.vue   challenge UI
    plugins/collector.client.ts   installs the collector
    server/
      api/challenge.get.ts        issues a signed challenge
      api/verify.post.ts          scores signals, issues humanity token
      utils/token.ts              HMAC sign/verify
      utils/store.ts              single-use nonce store
      utils/pow.ts                proof-of-work verifier
      utils/score.ts              scoring engine
      utils/guard.ts              assertHuman / getHumanity
playground/                       runnable example
```
## Author
Michael Mendy.
