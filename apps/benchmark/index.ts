import { chromium } from "playwright";
// Minimal ambient declarations to avoid Node types dependency
// (CI uses tsx to run this file directly.)
declare var process: any;
declare var require: any;

type Metrics = { ttfb: number; ttlb: number };

type PerUrlSummary = {
  url: string;
  ttfb: { p50: number; p75: number; p95: number; max: number };
  ttlb: { p50: number; p75: number; p95: number; max: number };
};

type OverallByHost = { host: string; ttlbP50: number }[];

type BenchmarkJson = {
  meta: {
    timestamp: string;
    commit: string | null;
    label: string | null;
    runs: number;
  };
  inputs: { urls: string[] };
  results: Record<string, Metrics[]>;
  perUrlSummary: PerUrlSummary[];
  overallByHost: OverallByHost;
};

function parseArgs(argv: string[]) {
  const args: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith("--")) {
      args[key] = next;
      i++;
    } else {
      args[key] = true;
    }
  }
  return args as {
    urls?: string;
    runs?: string;
    label?: string;
    out?: string;
    json?: boolean | string;
  };
}

async function measureRun(url: string): Promise<Metrics> {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const client = await page.context().newCDPSession(page);

  await client.send("Network.enable");

  return new Promise<Metrics>(async (resolve) => {
    let startTime = 0;
    let ttfb = 0;
    let ttlb = 0;
    let mainRequestId: string | null = null;

    client.on("Network.requestWillBeSent", (params) => {
      if (params.type === "Document" && mainRequestId === null) {
        mainRequestId = params.requestId;
        startTime = params.timestamp * 1000; // seconds → ms
      }
    });

    client.on("Network.responseReceived", (params) => {
      if (params.requestId === mainRequestId && startTime > 0) {
        ttfb = params.timestamp * 1000 - startTime;
      }
    });

    client.on("Network.loadingFinished", (params) => {
      if (params.requestId === mainRequestId && startTime > 0) {
        ttlb = params.timestamp * 1000 - startTime;
        resolve({ ttfb, ttlb });
      }
    });

    await page.goto(url, { waitUntil: "load" });
    await browser.close();
  });
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[idx];
}

async function benchmark(urls: string[], runs = 5, log = true) {
  const resultsMap: Record<string, Metrics[]> = {};
  for (const u of urls) resultsMap[u] = [];

  for (let i = 0; i < runs; i++) {
    if (log) console.log(`\nRun ${i + 1}/${runs}`);
    const runEntries: { url: string; r: Metrics }[] = [];

    for (const url of urls) {
      const r = await measureRun(url);
      resultsMap[url].push(r);
      runEntries.push({ url, r });
      if (log)
        console.log(
          `  ${url} → TTFB ${r.ttfb.toFixed(2)}ms, TTLB ${r.ttlb.toFixed(2)}ms`
        );
    }

    if (log && urls.length >= 2) {
      const ttfbSorted = [...runEntries].sort((a, b) => a.r.ttfb - b.r.ttfb);
      const ttlbSorted = [...runEntries].sort((a, b) => a.r.ttlb - b.r.ttlb);
      const bestTtfb = ttfbSorted[0];
      const bestTtlb = ttlbSorted[0];
      const fmtDelta = (v: number, best: number) => {
        const d = v - best;
        const pct = best > 0 ? (d / best) * 100 : 0;
        return `+${d.toFixed(2)}ms (+${pct.toFixed(1)}%)`;
      };

      const ttfbOthers = ttfbSorted
        .slice(1)
        .map((e) => `${e.url} ${fmtDelta(e.r.ttfb, bestTtfb.r.ttfb)}`)
        .join(", ");
      const ttlbOthers = ttlbSorted
        .slice(1)
        .map((e) => `${e.url} ${fmtDelta(e.r.ttlb, bestTtlb.r.ttlb)}`)
        .join(", ");

      console.log(
        `  Best TTFB: ${bestTtfb.url} (${bestTtfb.r.ttfb.toFixed(2)}ms)` +
          (ttfbOthers ? ` | Others: ${ttfbOthers}` : "")
      );
      console.log(
        `  Best TTLB: ${bestTtlb.url} (${bestTtlb.r.ttlb.toFixed(2)}ms)` +
          (ttlbOthers ? ` | Others: ${ttlbOthers}` : "")
      );
    }
  }

  if (log) {
    for (const url of urls) {
      const results = resultsMap[url];
      const ttfbVals = results.map((r) => r.ttfb);
      const ttlbVals = results.map((r) => r.ttlb);

      console.log(`\nSummary for ${url}`);
      console.log(`  p50 TTFB: ${percentile(ttfbVals, 50).toFixed(2)} ms`);
      console.log(`  p75 TTFB: ${percentile(ttfbVals, 75).toFixed(2)} ms`);
      console.log(`  p95 TTFB: ${percentile(ttfbVals, 95).toFixed(2)} ms`);
      console.log(`  max TTFB: ${Math.max(...ttfbVals).toFixed(2)} ms`);

      console.log(`  p50 TTLB: ${percentile(ttlbVals, 50).toFixed(2)} ms`);
      console.log(`  p75 TTLB: ${percentile(ttlbVals, 75).toFixed(2)} ms`);
      console.log(`  p95 TTLB: ${percentile(ttlbVals, 95).toFixed(2)} ms`);
      console.log(`  max TTLB: ${Math.max(...ttlbVals).toFixed(2)} ms`);
      console.log("-----");
    }
  }

  const stat = (arr: number[], p: number) => percentile(arr, p);

  // per-url summaries
  const perUrlSummary: PerUrlSummary[] = urls.map((url) => {
    const ttfbVals = resultsMap[url].map((r) => r.ttfb);
    const ttlbVals = resultsMap[url].map((r) => r.ttlb);
    return {
      url,
      ttfb: {
        p50: stat(ttfbVals, 50),
        p75: stat(ttfbVals, 75),
        p95: stat(ttfbVals, 95),
        max: Math.max(...ttfbVals),
      },
      ttlb: {
        p50: stat(ttlbVals, 50),
        p75: stat(ttlbVals, 75),
        p95: stat(ttlbVals, 95),
        max: Math.max(...ttlbVals),
      },
    };
  });

  // overall by host (TTLB p50 across all paths)
  const byHost: Record<string, number[]> = {};
  for (const u of urls) {
    let host = u;
    try {
      host = new URL(u).host;
    } catch {}
    const ttlbVals = resultsMap[u].map((r) => r.ttlb);
    if (!byHost[host]) byHost[host] = [];
    byHost[host].push(...ttlbVals);
  }
  const overallByHost: OverallByHost = Object.entries(byHost).map(
    ([host, vals]) => ({ host, ttlbP50: stat(vals, 50) })
  );

  if (log && urls.length >= 2) {
    const headers = ["Metric", ...overallByHost.map((e) => e.host)];
    const overallRow = [
      "Overall TTLB p50",
      ...overallByHost.map((e) => `${e.ttlbP50.toFixed(2)} ms`),
    ];

    const oTable = [headers, overallRow];
    const oWidths = headers.map((_, i) => Math.max(...oTable.map((r) => r[i].length)));
    const fmtORow = (r: string[]) => r.map((c, i) => c.padEnd(oWidths[i], " ")).join(" | ");
    const oSep = oWidths.map((w) => "-".repeat(w)).join("-+-");

    console.log("\nOverall across all paths (lower is faster)");
    console.log(fmtORow(headers));
    console.log(oSep);
    console.log(fmtORow(overallRow));

    const bestOverall = overallByHost.reduce((a, b) => (a.ttlbP50 <= b.ttlbP50 ? a : b));
    const worstOverall = overallByHost.reduce((a, b) => (a.ttlbP50 >= b.ttlbP50 ? a : b));
    if (
      isFinite(bestOverall.ttlbP50) &&
      isFinite(worstOverall.ttlbP50) &&
      bestOverall.ttlbP50 > 0
    ) {
      const factor = worstOverall.ttlbP50 / bestOverall.ttlbP50;
      console.log(
        `\n${bestOverall.host} is ${factor.toFixed(
          2
        )}x faster than ${worstOverall.host} (based on Overall TTLB p50 across all paths).`
      );
    }

    console.log("=====\n");
  }

  return { resultsMap, perUrlSummary, overallByHost };
}

async function main() {
  const extra = (process.env.EXTRA_ARGS || "").trim();
  const argv = process.argv.slice(2).concat(
    extra ? extra.split(/[ \n\t]+/).filter(Boolean) : []
  );
  const args = parseArgs(argv);

  const defaultUrls = [
    "https://host-perf-test-test-app.vercel.app/",
    "https://host-perf-test-test-app.vercel.app/nano-jsx",
    "https://host-perf-test-test-app.vercel.app/neon-db",
    "https://host-perf-test-test-app.vercel.app/multiple-requests",
    "https://host-perf-test.drevan.workers.dev/",
    "https://host-perf-test.drevan.workers.dev/nano-jsx",
    "https://host-perf-test.drevan.workers.dev/neon-db",
    "https://host-perf-test.drevan.workers.dev/multiple-requests",
  ];

  const urls = (args.urls
    ? String(args.urls)
        .split(/[ ,\n\t]+/)
        .filter(Boolean)
    : defaultUrls);

  const runs = args.runs ? Math.max(1, Number(args.runs)) : 10;
  const label = (args.label as string) || process.env.FLY_REGION || null;
  const wantJson = Boolean(args.json);
  const outPath = (args.out as string) || "";

  const { resultsMap, perUrlSummary, overallByHost } = await benchmark(
    urls,
    runs,
    !wantJson // disable logs if printing JSON
  );

  if (wantJson || outPath) {
    const json: BenchmarkJson = {
      meta: {
        timestamp: new Date().toISOString(),
        commit: process.env.GITHUB_SHA || null,
        label,
        runs,
      },
      inputs: { urls },
      results: resultsMap,
      perUrlSummary,
      overallByHost,
    };

    const payload = JSON.stringify(json, null, 2);

    if (outPath) {
      try {
        // Use dynamic require to avoid TypeScript node type dependency
        const fs = require("fs");
        fs.writeFileSync(outPath, payload, "utf8");
      } catch (e) {
        console.error("Failed to write file:", e);
      }
    }
    if (wantJson) {
      // print ONLY JSON when --json is passed
      console.log(payload);
    }
  }
}

main().catch((err) => {
  console.error(err?.stack || String(err));
  process.exit(1);
});
