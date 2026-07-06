export default defineNuxtConfig({
  modules: ['../src/module'],
  kiriakou: {
    // Tune these to your risk tolerance.
    threshold: 0.6,
    powBits: 12,
    humanityTtl: 900,
  },
  // Set KIRIAKOU_SECRET in your real environment (.env), not here.
  devtools: { enabled: true },
})
