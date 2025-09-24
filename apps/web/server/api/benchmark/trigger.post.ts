import { H3Event } from 'h3'

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

  // Check if Fly API token is configured for scaling
  const flyApiToken = config.flyApiToken
  const flyAppName = 'host-perf-test' // Default app name
  
  let flyClient: FlyMachinesClient | null = null
  if (flyApiToken) {
    flyClient = new FlyMachinesClient(flyApiToken, flyAppName)
  }

  // Generate unique benchmark ID
  const benchmarkId = `bench_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`
  
  // Initialize benchmark run in database
  await insertBenchmark(event, {
    id: benchmarkId,
    status: 'running',
    regions,
    runs,
    label
  })

  // Start benchmark runs for each region
  const runPromises = regions.map(async (region: string) => {
    try {
      // If Fly client is available, warm up the machine in this region
      if (flyClient) {
        try {
          // Update status to warming up
          await insertBenchmarkResult(event, {
            benchmarkId,
            region,
            result: {},
            error: 'Warming up machine...',
            status: 'warming',
            progress: 10
          })
          
          await flyClient.warmUpMachine(region)
          
          // Update status to warmed up
          await updateBenchmarkResult(event, benchmarkId, region, {
            status: 'running',
            progress: 20,
            error: null,
          })
        } catch (warmupError) {
          console.error(`Failed to warm up machine in region ${region}:`, warmupError)
          // Update status to failed warmup
          await updateBenchmarkResult(event, benchmarkId, region, {
            error: `Failed to warm up: ${(warmupError as Error).message}`,
            status: 'failed'
          })
          // Continue with benchmark even if warmup fails
        }
      } else {
        // No Fly client, just mark as running
        await insertBenchmarkResult(event, {
          benchmarkId,
          region,
          result: {},
          status: 'running',
          progress: 0
        })
      }

      // Run benchmark with retry logic (mimicking GitHub Actions workflow)
      const result = await runBenchmarkWithRetry(
        event,
        config.benchmarkRunnerHost,
        region,
        runs,
        label,
        benchToken,
        benchmarkId
      )
      
      // Store result in database
      await updateBenchmarkResult(event, benchmarkId, region, {
        result,
        status: 'completed',
        progress: 100,
        error: null
      })

      // If Fly client is available, scale down the machine
      if (flyClient) {
        try {
          await flyClient.scaleDownMachine(region)
        } catch (scaleDownError) {
          console.warn(`Failed to scale down machine in region ${region}:`, scaleDownError)
          // Don't fail the benchmark for scale down issues
        }
      }

      return { region, success: true, result }
    } catch (error) {
      console.error(`Benchmark failed for region ${region}:`, error)
      
      await updateBenchmarkResult(event, benchmarkId, region, {
        error: (error as Error).message,
        status: 'failed'
      })
      
      // If Fly client is available, try to scale down even on error
      if (flyClient) {
        try {
          await flyClient.scaleDownMachine(region)
        } catch (scaleDownError) {
          console.warn(`Failed to scale down machine in region ${region} after error:`, scaleDownError)
        }
      }
      
      return { region, success: false, error: (error as Error).message }
    }
  })

  // Don't wait for completion - return immediately with benchmark ID
  // Client can poll for status
  Promise.all(runPromises).then(async (results) => {
    const allCompleted = results.every(r => r.success || r.error)
    const status = allCompleted ? 'completed' : 'partial'
    
    await updateBenchmarkStatus(event, benchmarkId, status, new Date().toISOString())
  })

  return {
    benchmarkId,
    status: 'running',
    regions,
    runs,
    message: 'Benchmark started. Poll /api/benchmark/status for updates.'
  }
})

// Run benchmark with retry logic (mimicking GitHub Actions workflow)
async function runBenchmarkWithRetry(
  event: H3Event,
  host: string,
  region: string,
  runs: number,
  label: string,
  token: string,
  benchmarkId: string
): Promise<any> {
  const maxRetries = 20
  const baseDelay = 5000 // 5 seconds
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(`https://${host}/run?runs=${runs}&label=${label}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'fly-prefer-region': region,
        },
        // 2 minute timeout
        signal: AbortSignal.timeout(120000)
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      return await response.json()
      
    } catch (error) {
      console.warn(`Benchmark attempt ${attempt} failed for region ${region}:`, error)
      
      await updateBenchmarkResult(event, benchmarkId, region, {
        error: `Attempt ${attempt} failed: ${(error as Error).message}`,
        status: 'running'
      })
      
      if (attempt === maxRetries) {
        throw new Error(`Benchmark failed after ${maxRetries} attempts: ${(error as Error).message}`)
      }
      
      // Exponential backoff: 5s, 10s, 20s, 40s...
      const delay = baseDelay * Math.pow(2, attempt - 1)
      console.log(`Waiting ${delay}ms before retry ${attempt + 1} for region ${region}`)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
  
  throw new Error(`Benchmark failed after ${maxRetries} attempts`)
}
