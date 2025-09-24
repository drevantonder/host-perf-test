export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const body = await readBody(event)
  
  const { regions = ['iad', 'lhr', 'syd'], runs = 10, label = 'web-triggered' } = body
  
  if (!config.benchmarkRunnerHost) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Benchmark runner host not configured'
    })
  }

  const benchToken = config.benchToken
  if (!benchToken) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Benchmark token not configured'
    })
  }

  // Generate unique benchmark ID
  const benchmarkId = `bench_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`
  
  // Initialize benchmark run in database
  const db = event.context.cloudflare?.env?.DB
  if (db) {
    await db.prepare(`
      INSERT INTO benchmarks (id, status, regions, runs, label, created_at)
      VALUES (?, 'running', ?, ?, ?, datetime('now'))
    `).bind(benchmarkId, JSON.stringify(regions), runs, label).run()
  }

  // Start benchmark runs for each region
  const runPromises = regions.map(async (region: string) => {
    try {
      const response = await fetch(`https://${config.benchmarkRunnerHost}/run?runs=${runs}&label=${region}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${benchToken}`,
          'fly-prefer-region': region,
        },
        // 2 minute timeout
        signal: AbortSignal.timeout(120000)
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const result = await response.json()
      
      // Store result in database
      if (db) {
        await db.prepare(`
          INSERT INTO benchmark_results (benchmark_id, region, result, created_at)
          VALUES (?, ?, ?, datetime('now'))
        `).bind(benchmarkId, region, JSON.stringify(result)).run()
      }

      return { region, success: true, result }
    } catch (error) {
      console.error(`Benchmark failed for region ${region}:`, error)
      
      if (db) {
        await db.prepare(`
          INSERT INTO benchmark_results (benchmark_id, region, result, error, created_at)
          VALUES (?, ?, ?, ?, datetime('now'))
        `).bind(benchmarkId, region, JSON.stringify({}), (error as Error).message).run()
      }
      
      return { region, success: false, error: (error as Error).message }
    }
  })

  // Don't wait for completion - return immediately with benchmark ID
  // Client can poll for status
  Promise.all(runPromises).then(async (results) => {
    const allCompleted = results.every(r => r.success || r.error)
    const status = allCompleted ? 'completed' : 'partial'
    
    if (db) {
      await db.prepare(`
        UPDATE benchmarks 
        SET status = ?, completed_at = datetime('now')
        WHERE id = ?
      `).bind(status, benchmarkId).run()
    }
  })

  return {
    benchmarkId,
    status: 'running',
    regions,
    runs,
    message: 'Benchmark started. Poll /api/benchmark/status for updates.'
  }
})