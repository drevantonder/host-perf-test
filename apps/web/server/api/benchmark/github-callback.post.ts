import { useDb } from '../../utils/db'
import { benchmarks } from '../../database/schema'

export default defineEventHandler(async (event) => {
  // Verify this is a POST request
  if (event.method !== 'POST') {
    throw createError({
      statusCode: 405,
      statusMessage: 'Method not allowed'
    })
  }

  // Read the JSON body
  const body = await readBody(event)

  // Validate body structure
  if (!body.items || !Array.isArray(body.items)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid body structure: expected items array'
    })
  }

  // Extract benchmark ID from query parameters or body
  const query = getQuery(event)
  const benchmarkId = query.benchmarkId as string || body.benchmarkId

  if (!benchmarkId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'benchmarkId is required'
    })
  }

  console.log(JSON.stringify(body))

    const db = useDb(event);

  try {
    for (const item of body.items) {
      await db.insert(benchmarks).values({
        benchmarkId,
        region: item.meta?.label || 'unknown',
        runs: item.meta?.runs || 10,
        label: item.meta?.label || 'default',
        results: item.results,
        meta: item.meta,
      });
    }
  } catch (error) {
    console.error('Failed to insert benchmarks:', error);
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to store results'
    });
  }

  return {
    success: true,
    message: 'Results received and processed',
    inserted: body.items.length,
    benchmarkId
  }
})
