<template>
  <div class="min-h-screen bg-gray-50">
    <UPage>
      <UPageHeader
        title="Hosting Performance Benchmark"
        description="Compare performance across different hosting providers and regions"
        :links="pageLinks"
      />

      <UPageBody>
        <UPageGrid>
          <!-- Benchmark Trigger -->
          <div class="lg:col-span-4">
            <BenchmarkTrigger
              @benchmark-started="onBenchmarkStarted"
              @view-results="onViewResults"
            />
          </div>

          <!-- Recent Benchmarks -->
          <div class="lg:col-span-8">
            <UCard>
              <template #header>
                <div class="flex items-center justify-between">
                  <h3 class="text-lg font-semibold">Recent Benchmarks</h3>
                  <UButton
                    size="sm"
                    variant="ghost"
                    @click="loadRecentBenchmarks"
                  >
                    Refresh
                  </UButton>
                </div>
              </template>

              <div v-if="recentBenchmarksLoading" class="flex items-center justify-center p-4">
                <UProgress />
              </div>

              <div v-else-if="recentBenchmarks.length === 0" class="text-center p-4 text-gray-500">
                No recent benchmarks found
              </div>

              <div v-else class="space-y-2">
                <div
                  v-for="benchmark in recentBenchmarks"
                  :key="benchmark.id"
                  class="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 cursor-pointer"
                  @click="selectBenchmark(benchmark.id)"
                >
                  <div class="flex items-center gap-3">
                    <UBadge
                      :color="getStatusColor(benchmark.status)"
                      variant="subtle"
                    >
                      {{ benchmark.status }}
                    </UBadge>
                    <div>
                      <div class="font-medium">{{ benchmark.label }}</div>
                      <div class="text-sm text-gray-600">
                        {{ benchmark.regions.length }} regions × {{ benchmark.runs }} runs
                      </div>
                    </div>
                  </div>
                  <div class="text-sm text-gray-500">
                    {{ formatDate(benchmark.created_at) }}
                  </div>
                </div>
              </div>
            </UCard>
          </div>
        </UPageGrid>

        <!-- Results Section -->
        <UPageSection v-if="selectedBenchmarkId" class="mt-8">
          <BenchmarkResults :benchmark-id="selectedBenchmarkId" />
        </UPageSection>

        <!-- Getting Started Guide -->
        <UPageSection v-if="!selectedBenchmarkId" class="mt-8">
          <UCard>
            <template #header>
              <h3 class="text-lg font-semibold">How to Use</h3>
            </template>
            
            <div class="prose prose-sm max-w-none">
              <ol class="space-y-2">
                <li><strong>Select regions:</strong> Choose which geographic regions to test (IAD, LHR, SYD)</li>
                <li><strong>Set run count:</strong> Specify how many requests to make per region (default: 10)</li>
                <li><strong>Add label:</strong> Give your benchmark a descriptive name</li>
                <li><strong>Run benchmark:</strong> Click the button and wait for results</li>
                <li><strong>View analysis:</strong> See performance comparisons across providers and regions</li>
              </ol>
            </div>
          </UCard>
        </UPageSection>
      </UPageBody>
    </UPage>
  </div>
</template>

<script setup lang="ts">
const pageLinks = [
  { label: 'GitHub', to: 'https://github.com/sst/opencode', target: '_blank' },
  { label: 'Documentation', to: '/docs', target: '_blank' }
]

const route = useRoute()
const router = useRouter()

const selectedBenchmarkId = ref<string | null>(null)
const recentBenchmarks = ref<any[]>([])
const recentBenchmarksLoading = ref(false)

function onBenchmarkStarted(benchmarkId: string) {
  // Auto-select the new benchmark
  selectedBenchmarkId.value = benchmarkId
  loadRecentBenchmarks()
}

function onViewResults(benchmarkId: string) {
  selectedBenchmarkId.value = benchmarkId
}

function selectBenchmark(benchmarkId: string) {
  selectedBenchmarkId.value = benchmarkId
  // Update URL without page reload
  router.replace({ query: { ...route.query, benchmark: benchmarkId } })
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'running': return 'blue'
    case 'completed': return 'green'
    case 'partial': return 'yellow'
    case 'failed': return 'red'
    default: return 'gray'
  }
}

function formatDate(dateString: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(dateString))
}

async function loadRecentBenchmarks() {
  recentBenchmarksLoading.value = true
  
  try {
    const benchmarks = await $fetch('/api/benchmark/recent')
    recentBenchmarks.value = benchmarks
  } catch (error) {
    console.error('Failed to load recent benchmarks:', error)
  } finally {
    recentBenchmarksLoading.value = false
  }
}

onMounted(() => {
  // Check if there's a benchmark ID in the URL
  const benchmarkId = route.query.benchmark as string
  if (benchmarkId) {
    selectedBenchmarkId.value = benchmarkId
  }
  loadRecentBenchmarks()
})
</script>