export default defineEventHandler(async (event) => {
  const { id } = getRouterParams(event)
  
  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Benchmark ID is required'
    })
  }

  const db = event.context.cloudflare?.env?.DB
  if (!db) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Database not available'
    })
  }

  // Get benchmark details
  const benchmarkResult = await db.prepare(`
    SELECT id, status, regions, runs, label, created_at, completed_at
    FROM benchmarks 
    WHERE id = ?
  `).bind(id).first()

  if (!benchmarkResult) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Benchmark not found'
    })
  }

  // Get all results for this benchmark
  const resultsResult = await db.prepare(`
    SELECT region, result, error, created_at
    FROM benchmark_results 
    WHERE benchmark_id = ?
    ORDER BY created_at ASC
  `).bind(id).all()

  const results = resultsResult.results as any[] || []

  return {
    benchmarkId: benchmarkResult.id,
    status: benchmarkResult.status,
    regions: JSON.parse(benchmarkResult.regions as string),
    runs: benchmarkResult.runs,
    label: benchmarkResult.label,
    createdAt: benchmarkResult.created_at,
    completedAt: benchmarkResult.completed_at,
    results: results.map((r: any) => ({
      region: r.region,
      success: !r.error,
      result: r.result ? JSON.parse(r.result as string) : null,
      error: r.error,
      createdAt: r.created_at
    }))
  }
})