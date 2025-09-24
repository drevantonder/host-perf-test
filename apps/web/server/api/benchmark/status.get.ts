import { eq, asc } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const { benchmarkId } = query
  
  if (!benchmarkId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'benchmarkId parameter is required'
    })
  }

  const db = useDb(event)

  // Get benchmark status
  const benchmarkResult = await db.query.benchmarks.findFirst({
    where: eq(tables.benchmarks.id, benchmarkId as string),
  })

  if (!benchmarkResult) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Benchmark not found'
    })
  }

  // Get all results for this benchmark with enhanced status info
  const results = await db.query.benchmarkResults.findMany({
    where: eq(tables.benchmarkResults.benchmarkId, benchmarkId as string),
    orderBy: asc(tables.benchmarkResults.createdAt)
  })

  const completedRegions = results.filter((r) => r.status === 'completed' || r.error).length
  const totalRegions = JSON.parse(benchmarkResult.regions)
  const progress = Math.round((completedRegions / totalRegions.length) * 100)

  return {
    benchmarkId: benchmarkResult.id,
    status: benchmarkResult.status,
    progress,
    completedRegions,
    totalRegions: totalRegions.length,
    regions: totalRegions,
    runs: benchmarkResult.runs,
    label: benchmarkResult.label,
    createdAt: benchmarkResult.createdAt,
    completedAt: benchmarkResult.completedAt,
    results: results.map((r) => ({
      region: r.region,
      success: !r.error && r.status === 'completed',
      status: r.status || 'unknown',
      progress: r.progress || 0,
      result: r.result ? JSON.parse(r.result) : null,
      error: r.error,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt
    }))
  }
})
