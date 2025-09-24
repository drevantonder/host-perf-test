-- Benchmark tracking tables
CREATE TABLE IF NOT EXISTS benchmarks (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL, -- 'running', 'completed', 'partial', 'failed'
  regions TEXT NOT NULL, -- JSON array of regions
  runs INTEGER NOT NULL,
  label TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME
);

CREATE TABLE IF NOT EXISTS benchmark_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  benchmark_id TEXT NOT NULL,
  region TEXT NOT NULL,
  result TEXT, -- JSON benchmark result
  error TEXT,
  status TEXT, -- 'pending', 'warming', 'running', 'completed', 'failed', 'scaling_down'
  progress INTEGER, -- 0-100 progress indicator
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (benchmark_id) REFERENCES benchmarks(id)
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_benchmark_results_benchmark_id ON benchmark_results(benchmark_id);
CREATE INDEX IF NOT EXISTS idx_benchmark_results_region ON benchmark_results(region);
CREATE INDEX IF NOT EXISTS idx_benchmark_results_status ON benchmark_results(status);
CREATE INDEX IF NOT EXISTS idx_benchmarks_status ON benchmarks(status);