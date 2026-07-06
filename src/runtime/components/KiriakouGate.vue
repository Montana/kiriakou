<script setup lang="ts">
import { computed, ref, watch } from '#imports'
import { useKiriakou } from '../composables/useKiriakou'

const props = withDefaults(defineProps<{ open?: boolean }>(), { open: false })
const emit = defineEmits<{
  'update:open': [boolean]
  passed: [number]
  failed: [number]
}>()

const k = useKiriakou()

// Local answer state per task type.
const sliderValue = ref(50)
const progress = ref(0)

// When the host opens the gate, fetch a fresh challenge.
watch(
  () => props.open,
  (isOpen) => {
    if (isOpen && k.state.value === 'idle') {
      sliderValue.value = 50
      progress.value = 0
      k.begin()
    }
  },
  { immediate: true },
)

// Surface terminal states to the host and auto-close on success.
watch(k.state, (s) => {
  if (s === 'passed') {
    emit('passed', k.result.value?.score ?? 1)
    setTimeout(close, 700)
  } else if (s === 'failed') {
    emit('failed', k.result.value?.score ?? 0)
  }
})

const task = computed(() => k.challenge.value?.task ?? null)
const dots = computed(() => {
  const count = Number(task.value?.params.count ?? 0)
  // Deterministic-ish scatter so positions don't jump between renders.
  return Array.from({ length: count }, (_, i) => ({
    n: i + 1,
    left: 12 + ((i * 37) % 76),
    top: 14 + ((i * 53) % 68),
  }))
})

function tapDot(n: number) {
  if (n === progress.value + 1) {
    progress.value = n
    if (progress.value === Number(task.value?.params.count ?? -1)) {
      k.submit(progress.value)
    }
  } else {
    progress.value = 0 // wrong order — restart the sequence
  }
}

function submitSlider() {
  k.submit(Math.round(sliderValue.value))
}

function retry() {
  k.reset()
  sliderValue.value = 50
  progress.value = 0
  k.begin()
}

function close() {
  emit('update:open', false)
  k.reset()
}

const busy = computed(() => ['loading', 'verifying'].includes(k.state.value))
</script>

<template>
  <div v-if="open" class="kir-backdrop" role="dialog" aria-modal="true" aria-labelledby="kir-title">
    <div class="kir-card">
      <p class="kir-eyebrow">KIRIAKOU · HUMANITY CHECK</p>
      <h2 id="kir-title" class="kir-title">Confirm it's you at the controls</h2>
      <p class="kir-sub">
        Your second factor checked out. This last step confirms a person — not an automated
        session — is driving.
      </p>

      <!-- Loading -->
      <div v-if="k.state.value === 'loading'" class="kir-body kir-center">
        <span class="kir-spinner" aria-hidden="true" />
        <span class="kir-muted">Preparing a check…</span>
      </div>

      <!-- Challenge: slider -->
      <div v-else-if="k.state.value === 'challenging' && task?.kind === 'slider'" class="kir-body">
        <p class="kir-prompt">{{ task.prompt }}</p>
        <div class="kir-readout">
          <span class="kir-now">{{ Math.round(sliderValue) }}</span>
          <span class="kir-target">target {{ task.params.target }}</span>
        </div>
        <input
          v-model.number="sliderValue"
          class="kir-slider"
          type="range"
          min="0"
          max="100"
          :aria-label="task.prompt"
        />
        <button class="kir-btn" @click="submitSlider">Verify</button>
      </div>

      <!-- Challenge: sequence -->
      <div v-else-if="k.state.value === 'challenging' && task?.kind === 'sequence'" class="kir-body">
        <p class="kir-prompt">{{ task.prompt }}</p>
        <div class="kir-field">
          <button
            v-for="d in dots"
            :key="d.n"
            class="kir-dot"
            :class="{ 'kir-dot--done': d.n <= progress }"
            :style="{ left: d.left + '%', top: d.top + '%' }"
            :aria-label="`Number ${d.n}`"
            @click="tapDot(d.n)"
          >
            {{ d.n }}
          </button>
        </div>
        <p class="kir-muted kir-progress">{{ progress }} / {{ task.params.count }}</p>
      </div>

      <!-- Verifying -->
      <div v-else-if="k.state.value === 'verifying'" class="kir-body kir-center">
        <span class="kir-spinner" aria-hidden="true" />
        <span class="kir-muted">Checking the signals…</span>
      </div>

      <!-- Passed -->
      <div v-else-if="k.state.value === 'passed'" class="kir-body kir-center">
        <span class="kir-check" aria-hidden="true">✓</span>
        <span class="kir-ok">Verified — you're clear.</span>
      </div>

      <!-- Failed -->
      <div v-else-if="k.state.value === 'failed'" class="kir-body kir-center">
        <span class="kir-cross" aria-hidden="true">!</span>
        <span class="kir-fail">That didn't look human enough. Give it another go.</span>
        <button class="kir-btn kir-btn--ghost" @click="retry">Try again</button>
      </div>

      <!-- Error -->
      <div v-else-if="k.state.value === 'error'" class="kir-body kir-center">
        <span class="kir-fail">{{ k.error.value }}</span>
        <button class="kir-btn kir-btn--ghost" @click="retry">Retry</button>
      </div>

      <p v-if="!busy" class="kir-footnote">No tracking cookies. Only interaction shape is scored.</p>
    </div>
  </div>
</template>

<style scoped>
.kir-backdrop {
  position: fixed;
  inset: 0;
  display: grid;
  place-items: center;
  background: color-mix(in srgb, #0b1020 78%, transparent);
  backdrop-filter: blur(4px);
  z-index: 2147483000;
  padding: 1rem;
}
.kir-card {
  width: min(420px, 100%);
  background: #ffffff;
  color: #0f172a;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  padding: 1.6rem 1.6rem 1.2rem;
  box-shadow: 0 24px 60px -20px rgba(15, 23, 42, 0.45);
  font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
}
.kir-eyebrow {
  margin: 0 0 0.6rem;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.66rem;
  letter-spacing: 0.18em;
  color: #6366f1;
}
.kir-title {
  margin: 0 0 0.35rem;
  font-size: 1.22rem;
  font-weight: 640;
  letter-spacing: -0.01em;
}
.kir-sub {
  margin: 0 0 1.1rem;
  font-size: 0.86rem;
  line-height: 1.45;
  color: #64748b;
}
.kir-body {
  min-height: 132px;
}
.kir-center {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.7rem;
  text-align: center;
}
.kir-prompt {
  margin: 0 0 0.8rem;
  font-weight: 560;
  font-size: 0.95rem;
}
.kir-readout {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 0.5rem;
}
.kir-now {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 2rem;
  font-weight: 620;
  color: #4f46e5;
}
.kir-target {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.72rem;
  letter-spacing: 0.08em;
  color: #94a3b8;
}
.kir-slider {
  width: 100%;
  accent-color: #4f46e5;
  margin-bottom: 1.1rem;
}
.kir-field {
  position: relative;
  height: 150px;
  border: 1px dashed #cbd5e1;
  border-radius: 12px;
  background: #f8fafc;
  margin-bottom: 0.6rem;
}
.kir-dot {
  position: absolute;
  width: 40px;
  height: 40px;
  transform: translate(-50%, -50%);
  border-radius: 999px;
  border: 1px solid #c7d2fe;
  background: #eef2ff;
  color: #4338ca;
  font-weight: 640;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  cursor: pointer;
  transition: transform 0.12s ease, background 0.12s ease;
}
.kir-dot:hover {
  transform: translate(-50%, -50%) scale(1.06);
}
.kir-dot--done {
  background: #4f46e5;
  border-color: #4f46e5;
  color: #fff;
}
.kir-progress {
  text-align: center;
}
.kir-btn {
  width: 100%;
  border: none;
  border-radius: 10px;
  background: #4f46e5;
  color: #fff;
  font-size: 0.92rem;
  font-weight: 600;
  padding: 0.72rem 1rem;
  cursor: pointer;
  transition: background 0.15s ease;
}
.kir-btn:hover {
  background: #4338ca;
}
.kir-btn--ghost {
  width: auto;
  background: transparent;
  color: #4f46e5;
  border: 1px solid #c7d2fe;
  padding: 0.5rem 1rem;
}
.kir-btn--ghost:hover {
  background: #eef2ff;
}
.kir-muted {
  color: #64748b;
  font-size: 0.85rem;
}
.kir-ok,
.kir-check {
  color: #059669;
}
.kir-check {
  font-size: 2rem;
  line-height: 1;
}
.kir-fail,
.kir-cross {
  color: #dc2626;
  font-size: 0.9rem;
}
.kir-cross {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border-radius: 999px;
  border: 2px solid #dc2626;
  font-size: 1.3rem;
  font-weight: 700;
}
.kir-footnote {
  margin: 1rem 0 0;
  font-size: 0.72rem;
  color: #94a3b8;
  text-align: center;
}
.kir-spinner {
  width: 26px;
  height: 26px;
  border-radius: 999px;
  border: 3px solid #e2e8f0;
  border-top-color: #4f46e5;
  animation: kir-spin 0.8s linear infinite;
}
@keyframes kir-spin {
  to {
    transform: rotate(360deg);
  }
}
@media (prefers-reduced-motion: reduce) {
  .kir-spinner {
    animation-duration: 2s;
  }
  .kir-dot {
    transition: none;
  }
}
:focus-visible {
  outline: 2px solid #4f46e5;
  outline-offset: 2px;
}
</style>
