// Replace this with table schema
import { pgTable, serial, text, integer, jsonb, timestamp } from 'drizzle-orm/pg-core';

export const benchmarks = pgTable('benchmarks', {
  id: serial('id').primaryKey(),
  benchmarkId: text('benchmark_id').notNull(),
  region: text('region').notNull(),
  runs: integer('runs').notNull(),
  label: text('label').notNull(),
  results: jsonb('results').notNull(),
  meta: jsonb('meta'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export type Benchmark = typeof benchmarks.$inferSelect;
export type NewBenchmark = typeof benchmarks.$inferInsert;
