import { sqliteTable, integer, text } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export interface Metrics {
  ttfb: number;
  ttlb: number;
}

export interface BenchmarkResults {
  [url: string]: Metrics[];
}

export interface BenchmarkMeta {
  timestamp: string;
  commit: string | null;
  label: string | null;
  runs: number;
  region?: string | null;
}

export const benchmarks = sqliteTable('benchmarks', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  benchmarkId: text('benchmark_id').notNull(),
  region: text('region').notNull(),
  runs: integer('runs').notNull(),
  label: text('label').notNull(),
  results: text('results', { mode: 'json' }).$type<BenchmarkResults>().notNull(),
  meta: text('meta', { mode: 'json' }).$type<BenchmarkMeta>(),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export type Benchmark = typeof benchmarks.$inferSelect;
export type NewBenchmark = typeof benchmarks.$inferInsert;
