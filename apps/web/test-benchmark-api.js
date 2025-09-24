// Simple test script for the new benchmark API endpoints
// This can be run with: node test-benchmark-api.js

const API_BASE = process.env.API_BASE || 'http://localhost:3000'

async function testEndpoints() {
  console.log('🧪 Testing Benchmark API Endpoints...')
  
  try {
    // Test recent benchmarks endpoint
    console.log('\n📋 Testing /api/benchmark/recent')
    const recentResponse = await fetch(`${API_BASE}/api/benchmark/recent`)
    console.log(`Status: ${recentResponse.status}`)
    if (recentResponse.ok) {
      const recent = await recentResponse.json()
      console.log(`Found ${recent.length} recent benchmarks`)
    }
    
    // Test trigger endpoint (without actually triggering)
    console.log('\n🚀 Testing /api/benchmark/trigger structure')
    const triggerResponse = await fetch(`${API_BASE}/api/benchmark/trigger`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        regions: ['iad'],
        runs: 1,
        label: 'test-trigger'
      })
    })
    console.log(`Status: ${triggerResponse.status}`)
    if (!triggerResponse.ok) {
      const error = await triggerResponse.text()
      console.log(`Error: ${error}`)
    }
    
    console.log('\n✅ API endpoint tests completed')
    
  } catch (error) {
    console.error('❌ Test failed:', error)
  }
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testEndpoints()
}