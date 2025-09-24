import { desc, sql } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const limit = parseInt(query.limit as string) || 10

  const db = useDb(event)

  // Fetch recent benchmarks with result counts
  const recentBenchmarks = await db
    .select({
      id: tables.benchmarks.id,
      status: tables.benchmarks.status,
      regions: tables.benchmarks.regions,
      runs: tables.benchmarks.runs,
      label: tables.benchmarks.label,
      createdAt: tables.benchmarks.createdAt,
      resultCount: sql<number>`(SELECT COUNT(*) FROM benchmark_results br WHERE br.benchmark_id = ${tables.benchmarks.id})`
    })
    .from(tables.benchmarks)
    .orderBy(desc(tables.benchmarks.createdAt))
    .limit(limit)

  return recentBenchmarks.map((row) => ({
    id: row.id,
    status: row.status,
    regions: JSON.parse(row.regions),
    runs: row.runs,
    label: row.label,
    created_at: row.createdAt,
    result_count: row.resultCount
  }))
})
