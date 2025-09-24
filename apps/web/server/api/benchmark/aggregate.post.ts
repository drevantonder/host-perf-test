interface BenchmarkResult {
  meta?: {
    label?: string
  }
  results?: Record<string, Array<{
    ttfb?: number
    ttlb?: number
  }>>
}

interface ProviderStats {
  ttfb: number[]
  ttlb: number[]
}

interface TableData {
  [key: string]: {
    ttfbP50: number
    ttfbP75: number
    ttfbP95: number
    ttlbP50: number
    ttlbP75: number
    ttlbP95: number
  }
}

function percentile(values: number[], p: number): number {
  if (!values.length) return 0
  const s = [...values].sort((a, b) => a - b)
  const idx = Math.ceil((p / 100) * s.length) - 1
  return s[idx]
}

function providerKey(host: string): string {
  if (!host) return "unknown"
  if (host.endsWith(".workers.dev")) return "workers.dev"
  if (host.endsWith(".vercel.app")) return "vercel.app"
  if (host.endsWith(".netlify.app")) return "netlify.app"
  return host
}

function buildTableFromSeries(series: Record<string, ProviderStats>): TableData {
  const out: TableData = {}
  for (const key of Object.keys(series)) {
    const v = series[key]
    out[key] = {
      ttfbP50: percentile(v.ttfb, 50),
      ttfbP75: percentile(v.ttfb, 75),
      ttfbP95: percentile(v.ttfb, 95),
      ttlbP50: percentile(v.ttlb, 50),
      ttlbP75: percentile(v.ttlb, 75),
      ttlbP95: percentile(v.ttlb, 95)
    }
  }
  return out
}

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { benchmarkId, results } = body

  if (!results || !Array.isArray(results)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Results array is required'
    })
  }

  // Process results similar to aggregate.js
  const items: BenchmarkResult[] = results
    .filter(r => r.success && r.result)
    .map(r => r.result)

  // Initialize aggregation structures
  const regions = new Set<string>()
  const perRegionRouteHost: Record<string, Record<string, Record<string, ProviderStats>>> = {}
  const perRouteHost: Record<string, Record<string, ProviderStats>> = {}
  const overallHost: Record<string, ProviderStats> = {}
  const perRegionProvider: Record<string, Record<string, ProviderStats>> = {}
  const perRouteProvider: Record<string, Record<string, ProviderStats>> = {}
  const overallProvider: Record<string, ProviderStats> = {}

  const recognizedProviders = new Set(["workers.dev", "vercel.app", "netlify.app"])

  // Process all benchmark results
  for (const item of items) {
    const region = (item.meta && item.meta.label) || "unknown"
    regions.add(region)
    const benchmarkResults = item.results || {}
    
    for (const url in benchmarkResults) {
      let host = url
      let route = url
      try {
        const u = new URL(url)
        host = u.host
        route = u.pathname || "/"
      } catch {}
      
      const arr = benchmarkResults[url] || []
      
      // Initialize data structures
      perRegionRouteHost[region] = perRegionRouteHost[region] || {}
      perRegionRouteHost[region][route] = perRegionRouteHost[region][route] || {}
      const rrh = perRegionRouteHost[region][route][host] = perRegionRouteHost[region][route][host] || { ttfb: [], ttlb: [] }
      
      perRouteHost[route] = perRouteHost[route] || {}
      const prh = perRouteHost[route][host] = perRouteHost[route][host] || { ttfb: [], ttlb: [] }
      
      const oh = overallHost[host] = overallHost[host] || { ttfb: [], ttlb: [] }

      // Provider aggregations
      const prov = providerKey(host)
      perRegionProvider[region] = perRegionProvider[region] || {}
      const rprov = perRegionProvider[region][prov] = perRegionProvider[region][prov] || { ttfb: [], ttlb: [] }
      
      perRouteProvider[route] = perRouteProvider[route] || {}
      const pprov = perRouteProvider[route][prov] = perRouteProvider[route][prov] || { ttfb: [], ttlb: [] }
      
      const oprov = overallProvider[prov] = overallProvider[prov] || { ttfb: [], ttlb: [] }

      // Aggregate metrics
      for (const r of arr) {
        if (typeof r.ttfb === "number") {
          rrh.ttfb.push(r.ttfb)
          prh.ttfb.push(r.ttfb)
          oh.ttfb.push(r.ttfb)
          rprov.ttfb.push(r.ttfb)
          pprov.ttfb.push(r.ttfb)
          oprov.ttfb.push(r.ttfb)
        }
        if (typeof r.ttlb === "number") {
          rrh.ttlb.push(r.ttlb)
          prh.ttlb.push(r.ttlb)
          oh.ttlb.push(r.ttlb)
          rprov.ttlb.push(r.ttlb)
          pprov.ttlb.push(r.ttlb)
          oprov.ttlb.push(r.ttlb)
        }
      }
    }
  }

  // Build summary tables
  const overallProviderTableRaw = buildTableFromSeries(overallProvider)
  const overallProviderTable = Object.fromEntries(
    Object.entries(overallProviderTableRaw).filter(([k]) => recognizedProviders.has(k))
  )

  // Generate regional summary
  const regionalSummary: Record<string, TableData> = {}
  for (const region of Array.from(regions)) {
    const tableRaw = buildTableFromSeries(perRegionProvider[region] || {})
    regionalSummary[region] = Object.fromEntries(
      Object.entries(tableRaw).filter(([k]) => recognizedProviders.has(k))
    )
  }

  return {
    benchmarkId,
    summary: {
      overall: overallProviderTable,
      regional: regionalSummary,
      providers: Array.from(recognizedProviders),
      totalRegions: regions.size
    },
    rawData: {
      perRegionProvider,
      perRouteProvider,
      overallProvider,
      perRegionRouteHost,
      perRouteHost,
      overallHost
    }
  }
})