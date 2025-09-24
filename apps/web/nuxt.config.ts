// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  modules: [
    '@nuxt/content',
    '@nuxt/image',
    '@nuxt/scripts',
    '@nuxt/ui'
  ],

  runtimeConfig: {
    benchmarkRunnerHost: '',
    github: {
      appId: '',
      webhookSecret: '',
      privateKey: '',
      defaultInstallationId: ''
    }
  },

  nitro: {
    preset: 'cloudflare',
    cloudflare: {
      deployConfig: true,
      wrangler: {
        d1_databases: [
          {
            binding: 'DB',
            database_name: 'host-perf-db',
            database_id: '7f4305a3-b96f-489c-8976-4a7e8458698d'
          }
        ]
      }
    },
  },

  routeRules: {
    '/api/gh/env-hook': { cache: false }
  }
})
