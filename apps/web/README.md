# Web (Nuxt + Cloudflare)

This app serves the public site with an interactive benchmark interface and exposes a GitHub Environment Protection webhook to gate benchmark runs without consuming GitHub Actions minutes.

## Features

### 🚀 Interactive Benchmark Interface
- **Trigger benchmarks** directly from the web interface
- **Real-time progress tracking** with live updates
- **Multi-region support** (IAD, LHR, SYD)
- **Configurable run parameters** (regions, run count, labels)
- **Visual results analysis** with tables, charts, and summaries

### 📊 Results Analysis
- **TL;DR summary** with winner identification
- **Regional comparisons** across all tested regions
- **Provider performance** breakdown (Workers, Vercel, Netlify)
- **Detailed statistics** (P50, P75, P95 percentiles)
- **Export functionality** for raw and aggregated data

### 🗄️ Data Persistence
- **D1 database** for storing benchmark history
- **Benchmark tracking** with status and progress
- **Result aggregation** and analysis
- **Historical comparison** capabilities

## Cloudflare Runtime
- Nitro preset: Cloudflare Workers (`nitro.preset = 'cloudflare'`)
- No native modules.
- D1 binding `DB` for benchmark data persistence.

## Environment Variables (NUXT_*)
Nuxt runtimeConfig is populated from environment variables prefixed with `NUXT_`.
Set these in the Cloudflare dashboard (Variables/Secrets) or via `wrangler secret put`:
- `NUXT_BENCHMARK_RUNNER_HOST` → e.g. `host-perf-test.fly.dev`
- `NUXT_BENCH_TOKEN` → Authentication token for benchmark runner
- `NUXT_FLY_API_TOKEN` → Fly.io API token for scaling operations

## API Endpoints

### Benchmark Management
- `POST /api/benchmark/trigger` - Start new benchmark run
- `GET /api/benchmark/status` - Check benchmark status and progress
- `GET /api/benchmark/results/:id` - Get specific benchmark results
- `POST /api/benchmark/aggregate` - Analyze and aggregate results
- `GET /api/benchmark/recent` - List recent benchmarks

### GitHub Integration
- `POST /api/gh/env-hook` - Environment protection webhook

## Database Schema

The app uses D1 database with the following tables:

```sql
-- Benchmark tracking
CREATE TABLE benchmarks (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL,
  regions TEXT NOT NULL,
  runs INTEGER NOT NULL,
  label TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME
);

-- Benchmark results
CREATE TABLE benchmark_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  benchmark_id TEXT NOT NULL,
  region TEXT NOT NULL,
  result TEXT,
  error TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (benchmark_id) REFERENCES benchmarks(id)
);
```

## Usage

1. **Access the homepage** to see the benchmark interface
2. **Select regions** you want to test (IAD, LHR, SYD)
3. **Configure run parameters** (number of runs, label)
4. **Click "Run Benchmark"** to start the test
5. **Monitor progress** in real-time
6. **View results** with detailed analysis and comparisons
7. **Export data** for further analysis or reporting

## Components

### BenchmarkTrigger.vue
Interactive form for triggering benchmarks with real-time status updates.

### BenchmarkResults.vue
Results display component with tables, summaries, and export functionality.

### Nuxt UI Integration
Leverages Nuxt UI components for consistent, polished interface:
- `UCard` - Content containers
- `UButton` - Interactive controls
- `UTable` - Data display
- `UBadge` - Status indicators
- `UProgress` - Progress tracking
- `UCollapsible` - Expandable sections

