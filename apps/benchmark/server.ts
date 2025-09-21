// Minimal ambient declarations
// (CI uses tsx to run this file directly.)
declare var process: any;

import { createServer, ServerResponse } from "node:http";
import { URL } from "node:url";
import { benchmark } from "./lib/runner";

const PORT = Number(process.env.PORT || 8080);
const TOKEN = (process.env.BENCH_TOKEN || "").trim();

function ok(res: ServerResponse, obj: any) {
  const payload = JSON.stringify(obj, null, 2);
  res.statusCode = 200;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(payload);
}

function bad(res: ServerResponse, code: number, msg: string) {
  res.statusCode = code;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(JSON.stringify({ error: msg }));
}

function parseUrls(s: string | null | undefined): string[] {
  if (!s) return [];
  return s
    .split(/[ ,\n\t]+/)
    .map((x) => x.trim())
    .filter(Boolean);
}

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

const server = createServer(async (req, res) => {
  const u = new URL(req.url || "", `http://x`);
  const path = u.pathname;

  // health
  if (req.method === "GET" && path === "/healthz") {
    const region = process.env.FLY_REGION || null;
    return ok(res, { status: "ok", region });
  }

  // run
  if ((req.method === "GET" || req.method === "POST") && path === "/run") {
    if (TOKEN) {
      const auth = String(req.headers["authorization"] || "");
      if (!auth.startsWith("Bearer ") || auth.slice(7).trim() !== TOKEN) {
        return bad(res, 401, "unauthorized");
      }
    }

    const params = u.searchParams;
    const runs = Math.max(1, Number(params.get("runs") || "10"));
    const label = params.get("label") || process.env.FLY_REGION || null;
    let urls = parseUrls(params.get("urls"));
    if (!urls.length) urls = defaultUrls;

    try {
      const { resultsMap, perUrlSummary, overallByHost } = await benchmark(
        urls,
        runs
      );
      return ok(res, {
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
      });
    } catch (e: any) {
      return bad(res, 500, String(e?.stack || e));
    }
  }

  // not found
  bad(res, 404, "not found");
});

server.listen(PORT, () => {
  console.log(`benchmark server listening on :${PORT}`);
});
