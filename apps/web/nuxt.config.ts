// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-09-25',
  devtools: { enabled: true },

  modules: [
    '@nuxt/content',
    '@nuxt/image',
    '@nuxt/scripts',
    '@nuxt/ui'
  ],

  css: ['~/assets/css/main.css'],

  runtimeConfig: {
    benchmarkRunnerHost: '',
    benchToken: '',
    flyApiToken: '',
  },

  nitro: {
    preset: 'cloudflare-module',
    cloudflare: {
      deployConfig: true,
    },
  },

  content: {
    database: {
      type: 'd1',
      bindingName: 'DB'
    }
  }
})
