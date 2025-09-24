# Web (Nuxt + Cloudflare)

This app serves the public site and exposes a GitHub Environment Protection webhook to gate benchmark runs without consuming GitHub Actions minutes.

## Cloudflare Runtime
- Nitro preset: Cloudflare Workers (`nitro.preset = 'cloudflare'`)
- No native modules. Using `jose` for GitHub App JWT.
- Optional D1 binding `DB` for future persistence.

## Environment Variables
Set via Cloudflare `wrangler.toml` or dashboard:
- `BENCHMARK_RUNNER_HOST` e.g. `host-perf-test.fly.dev`
- `GITHUB_APP_ID`
- `GITHUB_APP_PRIVATE_KEY` (PEM)
- `GITHUB_WEBHOOK_SECRET`
- `GITHUB_APP_INSTALLATION_ID` (fallback; webhook also provides `installation.id`)

## Webhook
- Endpoint: `POST /api/gh/env-hook`
- Verifies `x-hub-signature-256`
- Listens to `deployment_protection_rule` with `action=requested`
- Parses environment name (e.g. `benchmark-iad` → `iad`)
- Polls `https://$BENCHMARK_RUNNER_HOST/healthz` with `fly-prefer-region: <region>` up to 3 minutes
- Approves or rejects via GitHub callback

## Deploy
- Build: `pnpm --filter apps/web build`
- Deploy (Workers): `wrangler deploy`

Add to `wrangler.toml` (example):

```
name = "hosting-perf-web"
main = ".output/server/index.mjs"
compatibility_date = "2025-09-01"

[vars]
BENCHMARK_RUNNER_HOST = "host-perf-test.fly.dev"
GITHUB_APP_ID = "<app-id>"
GITHUB_WEBHOOK_SECRET = "<webhook-secret>"
GITHUB_APP_INSTALLATION_ID = "<installation-id>"

# [[d1_databases]]
# binding = "DB"
# database_name = "hosting-perf"
# database_id = "<your-d1-db-id>"
```

## GitHub Environments
- Create `benchmark-iad`, `benchmark-lhr`, `benchmark-syd`
- Add a Deployment protection rule that uses your GitHub App
- Set the App’s webhook URL to `https://<your-site>/api/gh/env-hook`
