export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const { benchmarkId } = query
  
  if (!benchmarkId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'benchmarkId parameter is required'
    })
  }

  const db = event.context.cloudflare?.env?.DB
  if (!db) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Database not available'
    })
  }

  // Get benchmark status
  const benchmarkResult = await db.prepare(`
    SELECT id, status, regions, runs, label, created_at, completed_at
    FROM benchmarks 
    WHERE id = ?
  `).bind(benchmarkId as string).first()

  if (!benchmarkResult) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Benchmark not found'
    })
  }

  // Get all results for this benchmark with enhanced status info
  const resultsResult = await db.prepare(`
    SELECT region, result, error, status, progress, created_at, updated_at
    FROM benchmark_results 
    WHERE benchmark_id = ?
    ORDER BY created_at ASC
  `).bind(benchmarkId as string).all()

  const results = resultsResult.results as any[] || []
  const completedRegions = results.filter((r: any) => r.status === 'completed' || r.error).length
  const totalRegions = JSON.parse(benchmarkResult.regions as string).length
  const progress = Math.round((completedRegions / totalRegions) * 100)

  return {
    benchmarkId: benchmarkResult.id,
    status: benchmarkResult.status,
    progress,
    completedRegions,
    totalRegions,
    regions: JSON.parse(benchmarkResult.regions as string),
    runs: benchmarkResult.runs,
    label: benchmarkResult.label,
    createdAt: benchmarkResult.created_at,
    completedAt: benchmarkResult.completed_at,
    results: results.map((r: any) => ({
      region: r.region,
      success: !r.error && r.status === 'completed',
      status: r.status || 'unknown',
      progress: r.progress || 0,
      result: r.result ? JSON.parse(r.result as string) : null,
      error: r.error,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    }))
  }
})