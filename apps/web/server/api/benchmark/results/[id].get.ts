import { eq, asc } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const { id } = getRouterParams(event)
  
  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Benchmark ID is required'
    })
  }

  const db = useDb(event)

  // Get benchmark details
  const benchmarkResult = await db.query.benchmarks.findFirst({
    where: eq(tables.benchmarks.id, id)
  })

  if (!benchmarkResult) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Benchmark not found'
    })
  }

  // Get all results for this benchmark with enhanced status info
  const results = await db.query.benchmarkResults.findMany({
    where: eq(tables.benchmarkResults.benchmarkId, id),
    orderBy: asc(tables.benchmarkResults.createdAt)
  })

  const regions = JSON.parse(benchmarkResult.regions)

  return {
    benchmarkId: benchmarkResult.id,
    status: benchmarkResult.status,
    regions,
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
