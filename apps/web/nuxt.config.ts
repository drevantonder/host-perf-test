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
    preset: 'cloudflare'
  },

  routeRules: {
    '/api/gh/env-hook': { cache: false }
  }
})
