<script setup lang="ts">
import { ref } from '#imports'

// Pretend the user has already passed password + 2FA.
const twoFaDone = ref(true)
const gateOpen = ref(false)
const verified = ref(false)
const lastScore = ref<number | null>(null)
const actionResult = ref<string | null>(null)

function startCheck() {
  verified.value = false
  actionResult.value = null
  gateOpen.value = true
}

function onPassed(score: number) {
  verified.value = true
  lastScore.value = score
}

function onFailed(score: number) {
  lastScore.value = score
}

// Example: a sensitive action guarded by the server (returns 428 if not human).
async function doSensitiveThing() {
  try {
    const res = await $fetch<{ ok: boolean }>('/api/demo/transfer', { method: 'POST' })
    actionResult.value = res.ok ? 'Transfer authorised ✓' : 'Blocked'
  } catch (e: any) {
    if (e?.statusCode === 428) {
      actionResult.value = 'Server requires humanity — launching check…'
      startCheck()
    } else {
      actionResult.value = 'Error: ' + (e?.message ?? 'unknown')
    }
  }
}
</script>

<template>
  <main class="demo">
    <h1>Kiriakou demo</h1>
    <p class="lead">Password ✓ &nbsp; 2FA {{ twoFaDone ? 'done' : 'pending' }}</p>

    <section class="panel">
      <p>
        2FA proves possession of a factor. Kiriakou adds a final check that a
        <strong>human</strong> is at the controls before high-risk actions.
      </p>

      <div class="row">
        <button class="primary" @click="startCheck">Run humanity check</button>
        <button class="secondary" @click="doSensitiveThing">Attempt guarded action</button>
      </div>

      <p v-if="verified" class="ok">
        Verified as human (score {{ lastScore?.toFixed(2) }}). Humanity token issued for 15 min.
      </p>
      <p v-else-if="lastScore !== null" class="bad">
        Last score {{ lastScore.toFixed(2) }} — not verified yet.
      </p>
      <p v-if="actionResult" class="note">{{ actionResult }}</p>
    </section>

    <KiriakouGate v-model:open="gateOpen" @passed="onPassed" @failed="onFailed" />
  </main>
</template>

<style scoped>
.demo {
  max-width: 560px;
  margin: 6vh auto;
  padding: 0 1.2rem;
  font-family: ui-sans-serif, system-ui, sans-serif;
  color: #0f172a;
}
h1 {
  font-size: 1.8rem;
  letter-spacing: -0.02em;
}
.lead {
  font-family: ui-monospace, monospace;
  color: #6366f1;
  font-size: 0.85rem;
}
.panel {
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  padding: 1.4rem;
  line-height: 1.5;
}
.row {
  display: flex;
  gap: 0.6rem;
  margin: 1rem 0;
  flex-wrap: wrap;
}
button {
  border-radius: 10px;
  padding: 0.6rem 1rem;
  font-weight: 600;
  cursor: pointer;
  border: 1px solid transparent;
}
.primary {
  background: #4f46e5;
  color: #fff;
}
.secondary {
  background: #fff;
  color: #4f46e5;
  border-color: #c7d2fe;
}
.ok {
  color: #059669;
}
.bad {
  color: #dc2626;
}
.note {
  color: #64748b;
  font-size: 0.9rem;
}
</style>
