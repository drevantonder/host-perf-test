import { defineNitroConfig } from "nitropack/config"

// https://nitro.build/config
export default defineNitroConfig({
  compatibilityDate: "2025-09-20",
  srcDir: "server",
  cloudflare: {
    deployConfig: true,
    nodeCompat: true
  }
});
