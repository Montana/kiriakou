import {
  defineNuxtModule,
  createResolver,
  addServerHandler,
  addPlugin,
  addComponent,
  addImportsDir,
  addServerImportsDir,
} from '@nuxt/kit'
import { defu } from 'defu'
import type { KiriakouModuleOptions } from './runtime/types'

export type { KiriakouModuleOptions } from './runtime/types'

export default defineNuxtModule<KiriakouModuleOptions>({
  meta: {
    name: 'kiriakou',
    configKey: 'kiriakou',
    compatibility: { nuxt: '>=3.0.0' },
  },
  defaults: {
    apiPrefix: '/api/kiriakou',
    threshold: 0.6,
    humanityTtl: 900,
    challengeTtl: 120,
    powBits: 12,
    autoCollect: true,
  },
  setup(options, nuxt) {
    const resolver = createResolver(import.meta.url)

    // Expose config to server (private) and client (public) runtime.
    nuxt.options.runtimeConfig.kiriakou = defu(nuxt.options.runtimeConfig.kiriakou as object, {
      threshold: options.threshold,
      humanityTtl: options.humanityTtl,
      challengeTtl: options.challengeTtl,
      powBits: options.powBits,
    })
    nuxt.options.runtimeConfig.public.kiriakou = defu(
      nuxt.options.runtimeConfig.public.kiriakou as object,
      { apiPrefix: options.apiPrefix },
    )

    // API routes.
    addServerHandler({
      route: `${options.apiPrefix}/challenge`,
      method: 'get',
      handler: resolver.resolve('./runtime/server/api/challenge.get'),
    })
    addServerHandler({
      route: `${options.apiPrefix}/verify`,
      method: 'post',
      handler: resolver.resolve('./runtime/server/api/verify.post'),
    })

    // Auto-import the server guard helpers (assertHuman / getHumanity).
    addServerImportsDir(resolver.resolve('./runtime/server/utils'))

    // Client composable + component.
    addImportsDir(resolver.resolve('./runtime/composables'))
    addComponent({
      name: 'KiriakouGate',
      filePath: resolver.resolve('./runtime/components/KiriakouGate.vue'),
    })

    if (options.autoCollect) {
      addPlugin(resolver.resolve('./runtime/plugins/collector.client'))
    }

    if (!process.env.KIRIAKOU_SECRET) {
      // eslint-disable-next-line no-console
      console.warn(
        '\n[kiriakou] KIRIAKOU_SECRET is not set. Tokens are signed with an insecure default. ' +
          'Set a random 32+ character secret before deploying.\n',
      )
    }
  },
})
