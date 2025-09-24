import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'

export const benchmarks = sqliteTable('benchmarks', {
  id: text('id').primaryKey(),
  status: text('status').notNull(),
  regions: text('regions').notNull(),
  runs: integer('runs').notNull(),
  label: text('label'),
  createdAt: text('created_at').default(sql`(current_timestamp)`).notNull(),
  completedAt: text('completed_at'),
})

export const benchmarkResults = sqliteTable('benchmark_results', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  benchmarkId: text('benchmark_id').notNull(),
  region: text('region').notNull(),
  result: text('result'),
  error: text('error'),
  status: text('status'),
  progress: integer('progress'),
  createdAt: text('created_at').default(sql`(current_timestamp)`).notNull(),
  updatedAt: text('updated_at').default(sql`(current_timestamp)`).notNull(),
})
