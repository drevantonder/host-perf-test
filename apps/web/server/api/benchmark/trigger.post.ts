import { GitHubClient } from '../../utils/github'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const body = await readBody(event)
  
  const { regions = ['iad', 'lhr', 'syd'], runs = 10, label = 'web-triggered' } = body
  
  // Check if GitHub configuration is available
  const githubToken = config.githubToken
  const githubOwner = config.githubOwner
  const githubRepo = config.githubRepo
  
  if (!githubToken || !githubOwner || !githubRepo) {
    throw createError({
      statusCode: 500,
      statusMessage: 'GitHub configuration not complete (token, owner, and repo required)'
    })
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

  // Initialize benchmark results for each region
  for (const region of regions) {
    await insertBenchmarkResult(event, {
      benchmarkId,
      region,
      result: {},
      status: 'pending',
      progress: 0
    })
  }

  try {
    // Create GitHub client
    const githubClient = new GitHubClient(githubToken, githubOwner, githubRepo)
    
    // Build callback URL
    const callbackUrl = `${config.public.siteUrl || 'http://localhost:3000'}/api/benchmark/github-callback?benchmarkId=${benchmarkId}`
    
    // Trigger GitHub workflow
    await githubClient.triggerWorkflow(
      'run-benchmarks.yml', 
      'main', 
      {
        regions: regions.join(' '),
        runs: runs.toString(),
        label: label,
        callback_url: callbackUrl
      }
    )
    
    return {
      benchmarkId,
      status: 'running',
      regions,
      runs,
      message: 'Benchmark started via GitHub Actions. Poll /api/benchmark/status for updates.'
    }
    
  } catch (error) {
    console.error('Failed to trigger GitHub workflow:', error)
    
    // Update benchmark status to failed
    await updateBenchmarkStatus(event, benchmarkId, 'failed', new Date().toISOString())
    
    throw createError({
      statusCode: 500,
      statusMessage: `Failed to trigger benchmark: ${(error as Error).message}`
    })
  }
})