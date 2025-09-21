// Minimal ambient declarations to avoid Node types dependency
// (CI uses tsx to run this file directly.)
declare var process: any;
declare var require: any;

import { benchmark } from "./lib/runner";

type Metrics = { ttfb: number; ttlb: number };

type PerUrlSummary = {
  url: string;
  ttfb: { p50: number; p75: number; p95: number; max: number };
  ttlb: { p50: number; p75: number; p95: number; max: number };
};

type OverallByHost = { host: string; ttfbP50: number; ttlbP50: number }[];

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

async function main() {
  const extra = (process.env.EXTRA_ARGS || "").trim();
  const argv = process.argv.slice(2).concat(
    extra ? extra.split(/[ \n\t]+/).filter(Boolean) : []
  );
  const args = parseArgs(argv);

  const defaultUrls = [
    "https://host-perf-test-test-app.vercel.app/",
    "https://host-perf-test-test-app.vercel.app/api/posts",
    "https://host-perf-test-test-app.vercel.app/api/results",
    "https://host-perf-test-test-app.vercel.app/multiple-requests",
    "https://host-perf-test.drevan.workers.dev/",
    "https://host-perf-test.drevan.workers.dev/api/posts",
    "https://host-perf-test.drevan.workers.dev/api/results",
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
