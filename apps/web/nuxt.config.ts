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
    githubToken: '',
    githubOwner: '',
    githubRepo: '',
    public: {
      siteUrl: process.env.NUXT_PUBLIC_SITE_URL,
    }
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
  },

  vite: {
    server: {
      allowedHosts: [
        'recommendable-versie-recapitulatory.ngrok-free.dev'
      ]
    }
  }
})
