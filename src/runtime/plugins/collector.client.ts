import { Collector } from '../collector'
import { defineNuxtPlugin } from '#imports'

/**
 * Installs the passive signal collector as early as possible so that by the
 * time a challenge is issued, there is already some natural interaction history
 * to draw on. Provided as `$kiriakouCollector`.
 */
export default defineNuxtPlugin((nuxtApp) => {
  const collector = new Collector()
  collector.start()
  nuxtApp.provide('kiriakouCollector', collector)
})
