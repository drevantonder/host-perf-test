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

  // TODO: Do something with returned data

  return {
    success: true,
    message: 'Results received and processed',
    benchmarkId
  }
})
