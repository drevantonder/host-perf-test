import { drizzle } from 'drizzle-orm/d1';
import { H3Event } from 'h3';
import { D1Database } from '@cloudflare/workers-types';

import * as schema from '../database/schema'

export const tables = schema

export const useDb = (event: H3Event) => {
  const { cloudflare } = event.context

  if (!cloudflare.env.DB) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Database not available'
    })
  }

  return drizzle(cloudflare.env.DB as D1Database, { schema });
}

export type Benchmark = typeof schema.benchmarks.$inferSelect
export type BenchmarkResult = typeof schema.benchmarkResults.$inferSelect
