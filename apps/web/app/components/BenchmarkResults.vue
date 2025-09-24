<template>
  <UCard>
    <template #header>
      <div class="flex items-center justify-between">
        <h3 class="text-lg font-semibold">Benchmark Results</h3>
        <div class="flex items-center gap-2">
          <UButton
            v-if="results"
            size="sm"
            variant="ghost"
            @click="exportResults"
          >
            Export JSON
          </UButton>
          <UBadge 
            v-if="lastUpdated" 
            color="gray" 
            variant="subtle"
            size="sm"
          >
            Updated: {{ formatTime(lastUpdated) }}
          </UBadge>
        </div>
      </div>
    </template>

    <div v-if="loading" class="flex items-center justify-center p-8">
      <UProgress />
      <p class="ml-2 text-sm text-gray-600">Analyzing results...</p>
    </div>

    <div v-else-if="error" class="text-center p-8">
      <UAlert 
        color="error" 
        title="Analysis Failed"
        :description="error"
      />
    </div>

    <div v-else-if="!results" class="text-center p-8 text-gray-500">
      No results available. Run a benchmark to see analysis.
    </div>

    <div v-else class="space-y-6">
      <!-- TL;DR Summary -->
      <UCard variant="subtle">
        <template #header>
          <h4 class="font-semibold">TL;DR Summary</h4>
        </template>
        
        <div v-if="tldrSummary" class="space-y-2">
          <div class="flex items-center gap-2">
            <span class="font-medium">Winner (TTFB p75):</span>
            <span class="font-semibold text-green-600">{{ tldrSummary.winner }}</span>
          </div>
          <div class="text-sm text-gray-600">
            {{ tldrSummary.summary }}
          </div>
        </div>
      </UCard>

      <!-- Regional Results -->
      <UCard>
        <template #header>
          <h4 class="font-semibold">Regional Results</h4>
        </template>
        
        <UTable 
          :rows="regionalTableRows" 
          :columns="regionalTableColumns"
        >
          <template #region-data="{ row }">
            <span class="font-medium">{{ row.region.toUpperCase() }}</span>
          </template>
          
          <template #winner-data="{ row }">
            <div class="flex items-center gap-2">
              <UIcon 
                v-if="getProviderIcon(row.winner)" 
                :name="getProviderIcon(row.winner)" 
                class="w-4 h-4"
              />
              <span>{{ row.winner }}</span>
            </div>
          </template>
          
          <template #runnerUp-data="{ row }">
            <div v-if="row.runnerUp" class="flex items-center gap-2">
              <UIcon 
                v-if="getProviderIcon(row.runnerUp)" 
                :name="getProviderIcon(row.runnerUp)" 
                class="w-4 h-4"
              />
              <span>{{ row.runnerUp }}</span>
            </div>
          </template>
        </UTable>
      </UCard>

      <!-- Detailed Provider Stats -->
      <UCollapsible title="Detailed Provider Statistics">
        <UCard>
          <UTable 
            :rows="providerTableRows" 
            :columns="providerTableColumns"
          >
            <template #provider-data="{ row }">
              <div class="flex items-center gap-2">
                <UIcon 
                  v-if="getProviderIcon(row.provider)" 
                  :name="getProviderIcon(row.provider)" 
                  class="w-4 h-4"
                />
                <span class="font-medium">{{ row.provider }}</span>
              </div>
            </template>
          </UTable>
        </UCard>
      </UCollapsible>

      <!-- Raw Results -->
      <UCollapsible title="Raw Benchmark Data">
        <UCard>
          <pre class="text-xs overflow-auto max-h-96">{{ JSON.stringify(rawResults, null, 2) }}</pre>
        </UCard>
      </UCollapsible>
    </div>
  </UCard>
</template>

<script setup lang="ts">
const props = defineProps<{
  benchmarkId: string
}>()

const loading = ref(false)
const error = ref('')
const results = ref<any>(null)
const lastUpdated = ref<Date | null>(null)
const rawResults = ref<any>(null)

const tldrSummary = computed(() => {
  if (!results.value?.summary?.overall) return null
  
  const overall = results.value.summary.overall
  const providers = Object.keys(overall)
  if (providers.length < 2) return null
  
  const sorted = providers.sort((a, b) => overall[a].ttfbP75 - overall[b].ttfbP75)
  const winner = sorted[0]
  const runnerUp = sorted[1]
  
  return {
    winner,
    summary: `${winner} (${overall[winner].ttfbP75.toFixed(1)}ms) vs ${runnerUp} (${overall[runnerUp].ttfbP75.toFixed(1)}ms)`
  }
})

const regionalTableColumns = [
  { key: 'region', label: 'Region' },
  { key: 'winner', label: 'Winner' },
  { key: 'winnerTTFB', label: 'TTFB p75 (ms)' },
  { key: 'runnerUp', label: 'Runner-up' },
  { key: 'runnerUpTTFB', label: 'TTFB p75 (ms)' }
]

const regionalTableRows = computed(() => {
  if (!results.value?.summary?.regional) return []
  
  return Object.entries(results.value.summary.regional).map(([region, data]: [string, any]) => {
    const providers = Object.keys(data).sort((a, b) => data[a].ttfbP75 - data[b].ttfbP75)
    const winner = providers[0]
    const runnerUp = providers[1]
    
    return {
      region,
      winner,
      winnerTTFB: data[winner].ttfbP75.toFixed(1),
      runnerUp: runnerUp || '',
      runnerUpTTFB: runnerUp ? data[runnerUp].ttfbP75.toFixed(1) : ''
    }
  })
})

const providerTableColumns = [
  { key: 'provider', label: 'Provider' },
  { key: 'ttfbP50', label: 'TTFB p50 (ms)' },
  { key: 'ttfbP75', label: 'TTFB p75 (ms)' },
  { key: 'ttfbP95', label: 'TTFB p95 (ms)' }
]

const providerTableRows = computed(() => {
  if (!results.value?.summary?.overall) return []
  
  return Object.entries(results.value.summary.overall).map(([provider, data]: [string, any]) => ({
    provider,
    ttfbP50: data.ttfbP50.toFixed(1),
    ttfbP75: data.ttfbP75.toFixed(1),
    ttfbP95: data.ttfbP95.toFixed(1)
  }))
})

function getProviderIcon(provider: string): string | null {
  const iconMap: Record<string, string> = {
    'workers.dev': 'i-logos-cloudflare',
    'vercel.app': 'i-logos-vercel',
    'netlify.app': 'i-logos-netlify'
  }
  return iconMap[provider] || null
}

function formatTime(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).format(date)
}

async function analyzeResults() {
  loading.value = true
  error.value = ''
  
  try {
    // First get the raw results
    const rawData = await $fetch(`/api/benchmark/results/${props.benchmarkId}`)
    rawResults.value = rawData
    
    // Then get aggregated analysis
    const analysis = await $fetch('/api/benchmark/aggregate', {
      method: 'POST',
      body: {
        benchmarkId: props.benchmarkId,
        results: rawData.results
      }
    })
    
    results.value = analysis
    lastUpdated.value = new Date()
    
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to analyze results'
  } finally {
    loading.value = false
  }
}

function exportResults() {
  if (!results.value) return
  
  const dataStr = JSON.stringify(results.value, null, 2)
  const dataBlob = new Blob([dataStr], { type: 'application/json' })
  const url = URL.createObjectURL(dataBlob)
  const link = document.createElement('a')
  link.href = url
  link.download = `benchmark-results-${props.benchmarkId}.json`
  link.click()
  URL.revokeObjectURL(url)
}

watch(() => props.benchmarkId, (newId) => {
  if (newId) {
    analyzeResults()
  }
}, { immediate: true })
</script>