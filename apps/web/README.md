# Web (Nuxt + Cloudflare)

This app serves the public site and exposes a GitHub Environment Protection webhook to gate benchmark runs without consuming GitHub Actions minutes.

## Cloudflare Runtime
- Nitro preset: Cloudflare Workers (`nitro.preset = 'cloudflare'`)
- No native modules.
- Optional D1 binding `DB` for future persistence.

## Environment Variables (NUXT_*)
Nuxt runtimeConfig is populated from environment variables prefixed with `NUXT_`.
Set these in the Cloudflare dashboard (Variables/Secrets) or via `wrangler secret put`:
- `NUXT_BENCHMARK_RUNNER_HOST` → e.g. `host-perf-test.fly.dev`

