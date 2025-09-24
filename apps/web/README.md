# Web (Nuxt + Cloudflare)

This app serves the public site and exposes a GitHub Environment Protection webhook to gate benchmark runs without consuming GitHub Actions minutes.

## Cloudflare Runtime
- Nitro preset: Cloudflare Workers (`nitro.preset = 'cloudflare'`)
- Entry: `.output/server/_worker.js` (wrangler `main` is set accordingly)
- No native modules. Using `jose` for GitHub App JWT.
- Optional D1 binding `DB` for future persistence.

## Environment Variables (NUXT_*)
Nuxt runtimeConfig is populated from environment variables prefixed with `NUXT_`.
Set these in the Cloudflare dashboard (Variables/Secrets) or via `wrangler secret put`:
- `NUXT_BENCHMARK_RUNNER_HOST` → e.g. `host-perf-test.fly.dev`
- `NUXT_GITHUB__APP_ID` → your GitHub App ID
- `NUXT_GITHUB__PRIVATE_KEY` → PEM content (multiline)
- `NUXT_GITHUB__WEBHOOK_SECRET` → webhook secret
- `NUXT_GITHUB__DEFAULT_INSTALLATION_ID` → optional fallback install ID

## Webhook
- Endpoint: `POST /api/gh/env-hook`
- Verifies `x-hub-signature-256`
- Listens to `deployment_protection_rule` with `action=requested`
- Parses environment name (e.g. `benchmark-iad` → `iad`)
- Polls `https://$NUXT_BENCHMARK_RUNNER_HOST/healthz` with `fly-prefer-region: <region>` up to 3 minutes
- Approves or rejects via the provided GitHub `deployment_callback_url`

## Deploy
- Install deps: `pnpm i` (repo root)
- Build: `pnpm --filter apps/web build`
- Deploy (Workers): `cd apps/web && wrangler deploy`
- Cloudflare Routes: map your domain to the Worker (e.g., `host-perf.andrevantonder.com/*`).

`wrangler.toml` (already present):
```
name = "hosting-perf-web"
main = ".output/server/_worker.js"
compatibility_date = "2025-09-01"
compatibility_flags = ["nodejs_compat"]

# [[d1_databases]]
# binding = "DB"
# database_name = "hosting-perf"
# database_id = "<your-d1-db-id>"
```

## GitHub Environments
- Create `benchmark-iad`, `benchmark-lhr`, `benchmark-syd`
- Add a Deployment protection rule that uses your GitHub App
- Set the App’s webhook URL to `https://<your-site>/api/gh/env-hook`
