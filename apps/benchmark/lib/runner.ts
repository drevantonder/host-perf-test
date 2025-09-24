import { chromium } from "playwright";

export type Metrics = { ttfb: number; ttlb: number };

export type PerUrlSummary = {
  url: string;
  ttfb: { p50: number; p75: number; p95: number; max: number };
  ttlb: { p50: number; p75: number; p95: number; max: number };
};

export type OverallByHost = { host: string; ttfbP50: number; ttlbP50: number }[];

export type BenchmarkResult = {
  resultsMap: Record<string, Metrics[]>;
  perUrlSummary: PerUrlSummary[];
  overallByHost: OverallByHost;
};

export async function measureRun(url: string): Promise<Metrics> {
  const browser = await chromium.launch({
    headless: true,
    args: ["--disable-dev-shm-usage"],
  });

  const page = await browser.newPage();
  const client = await page.context().newCDPSession(page);
  await client.send("Network.enable");

  return await new Promise<Metrics>((resolve, reject) => {
    let startTime = 0;
    let ttfb = 0;
    let ttlb = 0;
    let mainRequestId: string | null = null;

    const finish = async (err?: Error) => {
      try {
        await browser.close();
      } catch {}
      if (err) reject(err);
      else resolve({ ttfb, ttlb });
    };

    const timer = setTimeout(() => {
      finish(new Error(`Timeout navigating to ${url}`));
    }, 15000);

    client.on("Network.requestWillBeSent", (params) => {
      if (params.type === "Document" && mainRequestId === null) {
        mainRequestId = params.requestId;
        startTime = params.timestamp * 1000;
      }
    });

    client.on("Network.responseReceived", (params) => {
      if (params.requestId === mainRequestId && startTime > 0) {
        ttfb = params.timestamp * 1000 - startTime;
      }
    });

    client.on("Network.loadingFinished", (params) => {
      if (params.requestId === mainRequestId && startTime > 0) {
        clearTimeout(timer);
        ttlb = params.timestamp * 1000 - startTime;
        finish();
      }
    });

    client.on("Network.loadingFailed", (params) => {
      if (params.requestId === mainRequestId) {
        clearTimeout(timer);
        finish(new Error(`Loading failed for ${url}: ${params.errorText || "unknown error"}`));
      }
    });

    page.setDefaultNavigationTimeout(14000);
    page.goto(url, { waitUntil: "load", timeout: 14000 }).catch((err) => {
      clearTimeout(timer);
      finish(err);
    });
  });
}

export function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[idx];
}

export async function benchmark(urls: string[], runs = 5, log = true): Promise<BenchmarkResult> {
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
        console.log(`  ${url} → TTFB ${r.ttfb.toFixed(2)}ms, TTLB ${r.ttlb.toFixed(2)}ms`);
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

  const byHost: Record<string, { ttfb: number[]; ttlb: number[] }> = {};
  for (const u of urls) {
    let host = u;
    try {
      host = new URL(u).host;
    } catch {}
    const ttfbVals = resultsMap[u].map((r) => r.ttfb);
    const ttlbVals = resultsMap[u].map((r) => r.ttlb);
    if (!byHost[host]) byHost[host] = { ttfb: [], ttlb: [] };
    byHost[host].ttfb.push(...ttfbVals);
    byHost[host].ttlb.push(...ttlbVals);
  }
  const overallByHost: OverallByHost = Object.entries(byHost).map(([host, vals]) => ({
    host,
    ttfbP50: stat(vals.ttfb, 50),
    ttlbP50: stat(vals.ttlb, 50),
  }));

  return { resultsMap, perUrlSummary, overallByHost };
}
