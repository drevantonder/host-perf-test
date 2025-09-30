const fs = require("fs");
const path = require("path");

function percentile(values, p) {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * s.length) - 1;
  return s[idx];
}

const dir = "artifacts";
const files = fs.readdirSync(dir, { withFileTypes: true })
  .flatMap(d => d.isDirectory() ? fs.readdirSync(path.join(dir, d.name)).map(f => path.join(dir, d.name, f)) : [path.join(dir, d.name)])
  .filter(f => f.endsWith(".json"));
const items = files.map(f => JSON.parse(fs.readFileSync(f, "utf8")));
const benchmarkId = process.env.BENCHMARK_ID || `${Date.now()}`;
const combined = { items, benchmarkId };
fs.writeFileSync("combined.json", JSON.stringify(combined, null, 2));

const regions = new Set();
const perRegionRouteHost = {}; // region -> route -> host -> { ttfb:[], ttlb:[] }
const perRouteHost = {}; // route -> host -> { ttfb:[], ttlb:[] }
const overallHost = {}; // host -> { ttfb:[], ttlb:[] }
const perRegionProvider = {}; // region -> provider -> { ttfb:[], ttlb:[] }
const perRouteProvider = {};  // route -> provider -> { ttfb:[], ttlb:[] }
const overallProvider = {};   // provider -> { ttfb:[], ttlb:[] }

function providerKey(host) {
  if (!host) return "unknown";
  if (host.endsWith(".workers.dev")) return "workers.dev";
  if (host.endsWith(".vercel.app")) return "vercel.app";
  if (host.endsWith(".netlify.app")) return "netlify.app";
  return host; // fallback for any other domains
}
const recognizedProviders = new Set(["workers.dev", "vercel.app", "netlify.app"]);
const ICONS = {
  "workers.dev": "https://svgl.app/library/cloudflare-workers.svg",
  "vercel.app": "https://svgl.app/library/vercel_dark.svg",
  "netlify.app": "https://svgl.app/library/netlify.svg",
};
function iconHtml(provider, size = 16) {
  const src = ICONS[provider] || "";
  if (!src) return provider;
  return `<img src="${src}" alt="${provider}" width="${size}" height="${size}" style="vertical-align:middle; margin-right:4px;">`;
}
function labelWithIcon(p) { return `${iconHtml(p)} ${p}`; }

for (const it of items) {
  const region = (it.meta && it.meta.label) || "unknown";
  regions.add(region);
  const results = it.results || {};
  for (const url in results) {
    let host = url;
    let route = url;
    try {
      const u = new URL(url);
      host = u.host;
      route = u.pathname || "/";
    } catch { }
    const arr = results[url] || [];
    perRegionRouteHost[region] = perRegionRouteHost[region] || {};
    perRegionRouteHost[region][route] = perRegionRouteHost[region][route] || {};
    const rrh = perRegionRouteHost[region][route][host] = perRegionRouteHost[region][route][host] || { ttfb: [], ttlb: [] };
    perRouteHost[route] = perRouteHost[route] || {};
    const prh = perRouteHost[route][host] = perRouteHost[route][host] || { ttfb: [], ttlb: [] };
    const oh = overallHost[host] = overallHost[host] || { ttfb: [], ttlb: [] };

    // provider aggregations
    const prov = providerKey(host);
    perRegionProvider[region] = perRegionProvider[region] || {};
    const rprov = perRegionProvider[region][prov] = perRegionProvider[region][prov] || { ttfb: [], ttlb: [] };
    perRouteProvider[route] = perRouteProvider[route] || {};
    const pprov = perRouteProvider[route][prov] = perRouteProvider[route][prov] || { ttfb: [], ttlb: [] };
    const oprov = overallProvider[prov] = overallProvider[prov] || { ttfb: [], ttlb: [] };

    for (const r of arr) {
      if (typeof r.ttfb === "number") { rrh.ttfb.push(r.ttfb); prh.ttfb.push(r.ttfb); oh.ttfb.push(r.ttfb); rprov.ttfb.push(r.ttfb); pprov.ttfb.push(r.ttfb); oprov.ttfb.push(r.ttfb); }
      if (typeof r.ttlb === "number") { rrh.ttlb.push(r.ttlb); prh.ttlb.push(r.ttlb); oh.ttlb.push(r.ttlb); rprov.ttlb.push(r.ttlb); pprov.ttlb.push(r.ttlb); oprov.ttlb.push(r.ttlb); }
    }
  }
}

function fmtMs(v) { return v.toFixed(2); }
function deltasForBest(map, suffix = "P50") {
  const entries = Object.entries(map);
  if (!entries.length) return { bestTTFB: null, bestTTLB: null, rows: [] };
  const ttfbKey = `ttfb${suffix}`;
  const ttlbKey = `ttlb${suffix}`;
  const bestTTFB = entries.reduce((a, b) => (a && a[1][ttfbKey] <= b[1][ttfbKey]) ? a : b);
  const bestTTLB = entries.reduce((a, b) => (a && a[1][ttlbKey] <= b[1][ttlbKey]) ? a : b);
  const rows = entries.map(([host, v]) => {
    const ttfbDelta = v[ttfbKey] - bestTTFB[1][ttfbKey];
    const ttfbPct = bestTTFB[1][ttfbKey] > 0 ? (ttfbDelta / bestTTFB[1][ttfbKey]) * 100 : 0;
    const ttlbDelta = v[ttlbKey] - bestTTLB[1][ttlbKey];
    const ttlbPct = bestTTLB[1][ttlbKey] > 0 ? (ttlbDelta / bestTTLB[1][ttlbKey]) * 100 : 0;
    const ttfbRatio = bestTTFB[1][ttfbKey] > 0 ? v[ttfbKey] / bestTTFB[1][ttfbKey] : 1;
    const ttlbRatio = bestTTLB[1][ttlbKey] > 0 ? v[ttlbKey] / bestTTLB[1][ttlbKey] : 1;
    return {
      host,
      ...v,
      ttfbDelta, ttfbPct, ttfbRatio,
      ttlbDelta, ttlbPct, ttlbRatio,
      isBestTTFB: host === bestTTFB[0],
      isBestTTLB: host === bestTTLB[0]
    };
  });
  return { bestTTFB, bestTTLB, rows };
}
function buildTableFromSeries(series) {
  const out = {};
  for (const key of Object.keys(series)) {
    const v = series[key];
    out[key] = {
      ttfbP50: percentile(v.ttfb, 50),
      ttfbP75: percentile(v.ttfb, 75),
      ttfbP95: percentile(v.ttfb, 95),
      ttlbP50: percentile(v.ttlb, 50),
      ttlbP75: percentile(v.ttlb, 75),
      ttlbP95: percentile(v.ttlb, 95)
    };
  }
  return out;
}

const lines = [];
lines.push("## Benchmark Summary");
lines.push("");


// TL;DR using providers (TTFB p75 only)
lines.push("### TL;DR");
const overallProviderTableRaw = buildTableFromSeries(overallProvider);
const overallProviderTable = Object.fromEntries(Object.entries(overallProviderTableRaw).filter(([k]) => recognizedProviders.has(k)));
const { rows: overallProvRowsP75 } = deltasForBest(overallProviderTable, "P75");
if (overallProvRowsP75.length >= 2) {
  const bSorted = [...overallProvRowsP75].sort((a, b) => a.ttfbP75 - b.ttfbP75);
  const f = bSorted[0], s = bSorted[1];
  lines.push(`- Winner (TTFB p75): ${labelWithIcon(f.host)}`);
  const list = bSorted.map(r => `${labelWithIcon(r.host)} ${fmtMs(r.ttfbP75)}ms`).join(" | ");
  lines.push(`- ${list}`);
} else if (overallProvRowsP75.length === 1) {
  const f = overallProvRowsP75[0];
  lines.push(`- Result (TTFB p75): ${labelWithIcon(f.host)} — ${fmtMs(f.ttfbP75)}ms`);
} else {
  lines.push("- Not enough providers to compare.");
}
lines.push("");

// Per Region Snapshot (TTFB p75)
lines.push("### Per Region Snapshot");
lines.push("| Region | Winner | TTFB p75 | Runner‑up | TTFB p75 | Third | TTFB p75 |");
lines.push("|---|---|---:|---|---:|---|---:|");
for (const region of Array.from(regions).sort()) {
  const tableRaw = buildTableFromSeries(perRegionProvider[region] || {});
  const table = Object.fromEntries(Object.entries(tableRaw).filter(([k]) => recognizedProviders.has(k)));
  const { rows } = deltasForBest(table, "P75");
  if (rows.length >= 1) {
    const srt = [...rows].sort((a, b) => a.ttfbP75 - b.ttfbP75);
    const a = srt[0], b = srt[1], c = srt[2];
    const aHost = a ? labelWithIcon(a.host) : "—";
    const aVal = a ? fmtMs(a.ttfbP75) : "—";
    const bHost = b ? labelWithIcon(b.host) : "—";
    const bVal = b ? fmtMs(b.ttfbP75) : "—";
    const cHost = c ? labelWithIcon(c.host) : "—";
    const cVal = c ? fmtMs(c.ttfbP75) : "—";

    lines.push(`| ${region} | ${aHost} | ${aVal} | ${bHost} | ${bVal} | ${cHost} | ${cVal} |`);
  }
}
lines.push("");

// Provider Stats (TTFB-only, compact) in details
lines.push("<details><summary>Provider Stats (TTFB p75)</summary>");
lines.push("");
lines.push("| Provider | TTFB p50 | TTFB p75 | TTFB p95 |");
lines.push("|---|---:|---:|---:|");
for (const r of [...overallProvRowsP75].sort((a, b) => a.ttfbP75 - b.ttfbP75)) {
  lines.push(`| ${labelWithIcon(r.host)} | ${fmtMs(r.ttfbP50)} | ${fmtMs(r.ttfbP75)} | ${fmtMs(r.ttfbP95)} |`);
}
lines.push("");
lines.push("</details>");
lines.push("");

// Aggregate Summary (TTFB p75 only)
if (overallProvRowsP75.length >= 2) {
  const bSorted = [...overallProvRowsP75].sort((a, b) => a.ttfbP75 - b.ttfbP75);
  const f = bSorted[0], s = bSorted[1];
  lines.push("### Aggregate Summary");
  lines.push(`Final Verdict (TTFB p75): ${f.host} is ${(s.ttfbP75 / f.ttfbP75).toFixed(2)}x faster than ${s.host}.`);
  lines.push("");
}

// Detailed raw sections
lines.push("<details><summary>Details by Region and Route</summary>");
lines.push("");
for (const region of Array.from(regions).sort()) {
  lines.push(`### Region: ${region}`);
  const regionMap = perRegionRouteHost[region] || {};
  for (const route of Object.keys(regionMap)) {
    const byHost = regionMap[route];
    const table = {};
    for (const host of Object.keys(byHost)) {
      const v = byHost[host];
      table[host] = {
        ttfbP50: percentile(v.ttfb, 50),
        ttfbP75: percentile(v.ttfb, 75),
        ttfbP95: percentile(v.ttfb, 95),
        ttlbP50: percentile(v.ttlb, 50),
        ttlbP75: percentile(v.ttlb, 75),
        ttlbP95: percentile(v.ttlb, 95)
      };
    }
    const { rows } = deltasForBest(table);
    lines.push(`Route: ${route}`);
    lines.push("");
    lines.push("| Host | TTFB p50 | TTFB p75 | TTFB p95 | ΔTTFB | TTLB p50 | TTLB p75 | TTLB p95 | ΔTTLB |");
    lines.push("|---|---:|---:|---:|---:|---:|---:|---:|---:|");
    for (const r of rows.sort((a, b) => a.ttlbP50 - b.ttlbP50)) {
      const ttag = r.isBestTTFB ? " ← best" : "";
      const btag = r.isBestTTLB ? " ← best" : "";
      lines.push(`| ${r.host} | ${fmtMs(r.ttfbP50)}${ttag} | ${fmtMs(r.ttfbP75)} | ${fmtMs(r.ttfbP95)} | +${fmtMs(r.ttfbDelta)}ms (+${r.ttfbPct.toFixed(1)}%) | ${fmtMs(r.ttlbP50)}${btag} | ${fmtMs(r.ttlbP75)} | ${fmtMs(r.ttlbP95)} | +${fmtMs(r.ttlbDelta)}ms (+${r.ttlbPct.toFixed(1)}%) |`);
    }
    lines.push("");
  }
}
lines.push("</details>");
lines.push("");

lines.push("<details><summary>Per Route Across Regions (raw domains)</summary>");
lines.push("");
for (const route of Object.keys(perRouteHost)) {
  const byHost = perRouteHost[route];
  const table = {};
  for (const host of Object.keys(byHost)) {
    const v = byHost[host];
    table[host] = {
      ttfbP50: percentile(v.ttfb, 50),
      ttfbP75: percentile(v.ttfb, 75),
      ttfbP95: percentile(v.ttfb, 95),
      ttlbP50: percentile(v.ttlb, 50),
      ttlbP75: percentile(v.ttlb, 75),
      ttlbP95: percentile(v.ttlb, 95)
    };
  }
  const { rows } = deltasForBest(table);
  lines.push(`Route: ${route}`);
  lines.push("");
  lines.push("| Host | TTFB p50 | TTFB p75 | TTFB p95 | ΔTTFB | TTLB p50 | TTLB p75 | TTLB p95 | ΔTTLB |");
  lines.push("|---|---:|---:|---:|---:|---:|---:|---:|---:|");
  for (const r of rows.sort((a, b) => a.ttlbP50 - b.ttlbP50)) {
    lines.push(`| ${r.host} | ${fmtMs(r.ttfbP50)} | ${fmtMs(r.ttfbP75)} | ${fmtMs(r.ttfbP95)} | +${fmtMs(r.ttfbDelta)}ms (+${r.ttfbPct.toFixed(1)}%) | ${fmtMs(r.ttlbP50)} | ${fmtMs(r.ttlbP75)} | ${fmtMs(r.ttlbP95)} | +${fmtMs(r.ttlbDelta)}ms (+${r.ttlbPct.toFixed(1)}%) |`);
  }
  lines.push("");
}
lines.push("</details>");
lines.push("");

lines.push("<details><summary>Overall Across Domains (raw)</summary>");
lines.push("");
const overallTable = {};
for (const host of Object.keys(overallHost)) {
  const v = overallHost[host];
  overallTable[host] = {
    ttfbP50: percentile(v.ttfb, 50),
    ttfbP75: percentile(v.ttfb, 75),
    ttfbP95: percentile(v.ttfb, 95),
    ttlbP50: percentile(v.ttlb, 50),
    ttlbP75: percentile(v.ttlb, 75),
    ttlbP95: percentile(v.ttlb, 95)
  };
}
const { rows: overallRows } = deltasForBest(overallTable);
lines.push("| Host | TTFB p50 | TTFB p75 | TTFB p95 | ΔTTFB | TTLB p50 | TTLB p75 | TTLB p95 | ΔTTLB |");
lines.push("|---|---:|---:|---:|---:|---:|---:|---:|---:|");
for (const r of overallRows.sort((a, b) => a.ttlbP50 - b.ttlbP50)) {
  lines.push(`| ${r.host} | ${fmtMs(r.ttfbP50)} | ${fmtMs(r.ttfbP75)} | ${fmtMs(r.ttfbP95)} | +${fmtMs(r.ttfbDelta)}ms (+${r.ttfbPct.toFixed(1)}%) | ${fmtMs(r.ttlbP50)} | ${fmtMs(r.ttlbP75)} | ${fmtMs(r.ttlbP95)} | +${fmtMs(r.ttlbDelta)}ms (+${r.ttlbPct.toFixed(1)}%) |`);
}
lines.push("");
lines.push("</details>");

fs.writeFileSync("SUMMARY.md", lines.join("\n"));
