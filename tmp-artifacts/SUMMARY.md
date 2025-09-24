## Benchmark Summary

### TL;DR
- Winner (TTFB p75): <img src="https://svgl.app/library/cloudflare-workers.svg" alt="workers.dev" width="16" height="16" style="vertical-align:middle; margin-right:4px;"> workers.dev — 100.00ms vs <img src="https://svgl.app/library/vercel_dark.svg" alt="vercel.app" width="16" height="16" style="vertical-align:middle; margin-right:4px;"> vercel.app 178.00ms (1.78x)
- Providers: <img src="https://svgl.app/library/cloudflare-workers.svg" alt="workers.dev" width="16" height="16" style="vertical-align:middle; margin-right:4px;"> workers.dev 100.00ms | <img src="https://svgl.app/library/vercel_dark.svg" alt="vercel.app" width="16" height="16" style="vertical-align:middle; margin-right:4px;"> vercel.app 178.00ms | <img src="https://svgl.app/library/netlify.svg" alt="netlify.app" width="16" height="16" style="vertical-align:middle; margin-right:4px;"> netlify.app 208.00ms

### Per Region Snapshot
| Region | Winner | TTFB p75 | Runner‑up | TTFB p75 | Factor |
|---|---|---:|---|---:|---:|
| iad | <img src="https://svgl.app/library/cloudflare-workers.svg" alt="workers.dev" width="16" height="16" style="vertical-align:middle; margin-right:4px;"> workers.dev | 98.00 | <img src="https://svgl.app/library/vercel_dark.svg" alt="vercel.app" width="16" height="16" style="vertical-align:middle; margin-right:4px;"> vercel.app | 130.00 | 1.33x |
| lhr | <img src="https://svgl.app/library/cloudflare-workers.svg" alt="workers.dev" width="16" height="16" style="vertical-align:middle; margin-right:4px;"> workers.dev | 90.00 | <img src="https://svgl.app/library/vercel_dark.svg" alt="vercel.app" width="16" height="16" style="vertical-align:middle; margin-right:4px;"> vercel.app | 140.00 | 1.56x |
| syd | <img src="https://svgl.app/library/cloudflare-workers.svg" alt="workers.dev" width="16" height="16" style="vertical-align:middle; margin-right:4px;"> workers.dev | 105.00 | <img src="https://svgl.app/library/vercel_dark.svg" alt="vercel.app" width="16" height="16" style="vertical-align:middle; margin-right:4px;"> vercel.app | 182.00 | 1.73x |

<details><summary>Provider Stats (TTFB p75)</summary>

| Provider | TTFB p50 | TTFB p75 | TTFB p95 |
|---|---:|---:|---:|
| <img src="https://svgl.app/library/cloudflare-workers.svg" alt="workers.dev" width="16" height="16" style="vertical-align:middle; margin-right:4px;"> workers.dev | 95.00 | 100.00 | 108.00 |
| <img src="https://svgl.app/library/vercel_dark.svg" alt="vercel.app" width="16" height="16" style="vertical-align:middle; margin-right:4px;"> vercel.app | 140.00 | 178.00 | 185.00 |
| <img src="https://svgl.app/library/netlify.svg" alt="netlify.app" width="16" height="16" style="vertical-align:middle; margin-right:4px;"> netlify.app | 168.00 | 208.00 | 215.00 |

</details>

### Aggregate Summary
Final Verdict (TTFB p75): workers.dev is 1.78x faster than vercel.app.
