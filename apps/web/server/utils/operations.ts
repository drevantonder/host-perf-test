import { benchmarks, benchmarkResults } from '../database/schema'
import { eq, and } from 'drizzle-orm'
import { H3Event } from 'h3';

export const insertBenchmark = async (
  event: H3Event,
  data: {
    id: string
    status: string
    regions: string[]
    runs: number
    label?: string | null
  }
) => {
  const db = useDb(event)
  await db.insert(benchmarks).values({
    id: data.id,
    status: data.status,
    regions: JSON.stringify(data.regions),
    runs: data.runs,
    label: data.label ?? null,
  })
}

export const updateBenchmarkStatus = async (
  event: H3Event,
  id: string,
  status: string,
  completedAt?: string | null
) => {
  const db = useDb(event)
  await db
    .update(benchmarks)
    .set({ status, completedAt: completedAt ?? null })
    .where(eq(benchmarks.id, id))
}

export const insertBenchmarkResult = async (
  event: H3Event,
  data: {
    benchmarkId: string
    region: string
    result?: unknown
    error?: string | null
    status?: string | null
    progress?: number | null
  }
) => {
  const db = useDb(event)
  await db.insert(benchmarkResults).values({
    benchmarkId: data.benchmarkId,
    region: data.region,
    result: data.result ? JSON.stringify(data.result) : null,
    error: data.error ?? null,
    status: data.status ?? null,
    progress: data.progress ?? null,
  })
}

export const updateBenchmarkResult = async (
  event: H3Event,
  benchmarkId: string,
  region: string,
  data: {
    result?: unknown
    error?: string | null
    status?: string | null
    progress?: number | null
  }
) => {
  const db = useDb(event)
  await db
    .update(benchmarkResults)
    .set({
      ...(data.result !== undefined ? { result: data.result ? JSON.stringify(data.result) : null } : {}),
      ...(data.error !== undefined ? { error: data.error } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
      ...(data.progress !== undefined ? { progress: data.progress } : {}),
    })
    .where(and(eq(benchmarkResults.benchmarkId, benchmarkId), eq(benchmarkResults.region, region)))
}
