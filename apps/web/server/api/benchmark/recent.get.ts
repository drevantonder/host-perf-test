export default defineEventHandler(async (event) => {
  const db = event.context.cloudflare?.env?.DB
  if (!db) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Database not available'
    })
  }

  const query = getQuery(event)
  const limit = parseInt(query.limit as string) || 10

  // Get recent benchmarks with their result counts
  const benchmarksResult = await db.prepare(`
    SELECT 
      b.id,
      b.status,
      b.regions,
      b.runs,
      b.label,
      b.created_at,
      COUNT(br.id) as result_count
    FROM benchmarks b
    LEFT JOIN benchmark_results br ON b.id = br.benchmark_id
    GROUP BY b.id
    ORDER BY b.created_at DESC
    LIMIT ?
  `).bind(limit).all()

  const benchmarks = (benchmarksResult.results as any[] || []).map(row => ({
    id: row.id,
    status: row.status,
    regions: JSON.parse(row.regions),
    runs: row.runs,
    label: row.label,
    created_at: row.created_at,
    result_count: row.result_count
  }))

  return benchmarks
})