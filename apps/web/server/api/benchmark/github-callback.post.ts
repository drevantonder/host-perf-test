import { eq } from 'drizzle-orm'

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

  const db = useDb(event)

  // Verify benchmark exists
  const benchmark = await db.query.benchmarks.findFirst({
    where: eq(tables.benchmarks.id, benchmarkId)
  })

  if (!benchmark) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Benchmark not found'
    })
  }

  // Process results similar to the aggregate endpoint
  const items = body.items
    .filter((r: any) => r.success && r.result)
    .map((r: any) => r.result)

  // For now, we'll store the raw results and let the frontend aggregate them
  // In a production environment, you might want to do server-side aggregation
  
  // Update benchmark status to completed
  await db
    .update(tables.benchmarks)
    .set({ 
      status: 'completed', 
      completedAt: new Date().toISOString() 
    })
    .where(eq(tables.benchmarks.id, benchmarkId))

  // Store the raw results for later processing
  // We'll store the entire body as a JSON string in one of the regions
  if (items.length > 0) {
    await db
      .update(tables.benchmarkResults)
      .set({ 
        result: JSON.stringify(body),
        status: 'completed',
        progress: 100
      })
      .where(eq(tables.benchmarkResults.benchmarkId, benchmarkId))
      .limit(1)
  }

  return {
    success: true,
    message: 'Results received and processed',
    benchmarkId
  }
})