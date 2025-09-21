// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['@nuxt/image', '@nuxt/scripts', '@nuxt/ui'],

  nitro: {
    cloudflare: {
      deployConfig: true,
      nodeCompat: true
    },
  },

  runtimeConfig: {
    neonUrl: process.env.NUXT_NEON_URL,
  }
})
