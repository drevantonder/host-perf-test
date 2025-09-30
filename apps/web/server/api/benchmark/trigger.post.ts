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

  try {
    // Create GitHub client
    const githubClient = new GitHubClient(githubToken, githubOwner, githubRepo)

    // Build callback URL
    const { siteUrl } = useRuntimeConfig(event).public
    if (!siteUrl) throw new Error('Public site url is required for GitHub Action callback')

    // Use URL to safely join and append query params
    const callback = new URL('/api/benchmark/github-callback', siteUrl)
    callback.searchParams.set('benchmarkId', benchmarkId)
    const callbackUrl = callback.toString()

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
      message: 'Benchmark started via GitHub Actions.'
    }

  } catch (error) {
    console.error('Failed to trigger GitHub workflow:', error)

    throw createError({
      statusCode: 500,
      statusMessage: `Failed to trigger benchmark: ${(error as Error).message}`
    })
  }
})
