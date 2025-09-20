import { chromium } from "playwright";

type Metrics = { ttfb: number; ttlb: number };

async function measureRun(url: string): Promise<Metrics> {
  const browser = await chromium.launch({ headless: false }); // set to true if you don’t want the browser to pop up
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

async function benchmark(urls: string[], runs = 5) {
  const resultsMap: Record<string, Metrics[]> = {};
  for (const u of urls) resultsMap[u] = [];

  for (let i = 0; i < runs; i++) {
    console.log(`\nRun ${i + 1}/${runs}`);
    const runEntries: { url: string; r: Metrics }[] = [];

    for (const url of urls) {
      const r = await measureRun(url);
      resultsMap[url].push(r);
      runEntries.push({ url, r });
      console.log(
        `  ${url} → TTFB ${r.ttfb.toFixed(2)}ms, TTLB ${r.ttlb.toFixed(2)}ms`
      );
    }

    if (urls.length >= 2) {
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

  if (urls.length >= 2) {
    const stat = (arr: number[], p: number) => percentile(arr, p);

    const metrics = [
      { label: "TTFB p50", get: (url: string) => stat(resultsMap[url].map((r) => r.ttfb), 50) },
      { label: "TTFB p95", get: (url: string) => stat(resultsMap[url].map((r) => r.ttfb), 95) },
      { label: "TTLB p50", get: (url: string) => stat(resultsMap[url].map((r) => r.ttlb), 50) },
      { label: "TTLB p95", get: (url: string) => stat(resultsMap[url].map((r) => r.ttlb), 95) },
    ];

    const hosts = urls.map((u) => {
      try {
        return new URL(u).host;
      } catch {
        return u;
      }
    });
    const headers = ["Metric", ...hosts];
    const rows: string[][] = [];

    for (const m of metrics) {
      const vals = urls.map((u) => ({ url: u, v: m.get(u) }));
      const bestVal = Math.min(...vals.map((x) => x.v));

      const cells: string[] = [m.label];
      for (const { url, v } of vals) {
        const base = `${v.toFixed(2)} ms`;
        if (v === bestVal) {
          cells.push(`${base} ← best`);
        } else {
          const diff = v - bestVal;
          const pct = bestVal > 0 ? (diff / bestVal) * 100 : 0;
          cells.push(`${base} (+${diff.toFixed(2)} ms, +${pct.toFixed(1)}%)`);
        }
      }
      rows.push(cells);
    }

    const table = [headers, ...rows];
    const colWidths = headers.map((_, i) => Math.max(...table.map((r) => r[i].length)));
    const fmtRow = (r: string[]) => r.map((c, i) => c.padEnd(colWidths[i], " ")).join(" | ");
    const sep = colWidths.map((w) => "-".repeat(w)).join("-+-");

    console.log("\nOverall comparison (lower is faster)");
    console.log(fmtRow(headers));
    console.log(sep);
    for (const r of rows) console.log(fmtRow(r));

    const primary = metrics[0];
    const primaryVals = urls.map((u, i) => ({
      url: u,
      host: headers[i + 1],
      v: primary.get(u),
    }));
    const best = primaryVals.reduce((a, b) => (a.v <= b.v ? a : b));
    const worst = primaryVals.reduce((a, b) => (a.v >= b.v ? a : b));
    if (best.v > 0 && isFinite(best.v) && isFinite(worst.v)) {
      const factor = worst.v / best.v;
      console.log(`\n${best.host} is ${factor.toFixed(2)}x faster than ${worst.host} (based on ${primary.label}).`);
    }

    console.log("=====\n");
  }
}

benchmark(["https://host-perf-test-test-app.vercel.app/", "https://host-perf-test.drevan.workers.dev/"], 5);

