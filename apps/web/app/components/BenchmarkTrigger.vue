<template>
  <UCard>
    <template #header>
      <div class="flex items-center justify-between">
        <h3 class="text-lg font-semibold">Benchmark Controls</h3>
        <UBadge 
          v-if="lastBenchmark" 
          :color="statusColor" 
          variant="subtle"
        >
          {{ lastBenchmark.status }}
        </UBadge>
      </div>
    </template>

    <UForm :state="formState" class="space-y-4" @submit="triggerBenchmark">
      <UFormField label="Regions" name="regions">
        <USelectMenu
          v-model="formState.regions"
          :options="availableRegions"
          multiple
          placeholder="Select regions"
        />
      </UFormField>

      <UFormField label="Number of runs" name="runs">
        <UInputNumber
          v-model="formState.runs"
          :min="1"
          :max="100"
          placeholder="10"
        />
      </UFormField>

      <UFormField label="Label" name="label">
        <UInput
          v-model="formState.label"
          placeholder="web-triggered"
        />
      </UFormField>

      <div class="flex items-center gap-2">
        <UButton
          type="submit"
          :loading="isRunning"
          :disabled="isRunning || !formState.regions.length"
          color="primary"
        >
          {{ isRunning ? 'Running...' : 'Run Benchmark' }}
        </UButton>
        
        <UButton
          v-if="lastBenchmark"
          variant="ghost"
          @click="viewResults"
        >
          View Results
        </UButton>
      </div>

      <UProgress v-if="isRunning" :value="progress" />
      
      <div v-if="statusMessage" class="text-sm text-gray-600">
        {{ statusMessage }}
      </div>
    </UForm>
  </UCard>
</template>

<script setup lang="ts">
const emit = defineEmits<{
  benchmarkStarted: [benchmarkId: string]
  viewResults: [benchmarkId: string]
}>()

const { success, error, warning } = useNotification()

const availableRegions = [
  { label: 'IAD (Washington, DC)', value: 'iad' },
  { label: 'LHR (London)', value: 'lhr' },
  { label: 'SYD (Sydney)', value: 'syd' }
]

const formState = reactive({
  regions: ['iad', 'lhr', 'syd'],
  runs: 10,
  label: 'web-triggered'
})

const isRunning = ref(false)
const progress = ref(0)
const statusMessage = ref('')
const lastBenchmark = ref<any>(null)
const pollingInterval = ref<NodeJS.Timeout | null>(null)

const statusColor = computed(() => {
  if (!lastBenchmark.value) return 'gray'
  switch (lastBenchmark.value.status) {
    case 'running': return 'blue'
    case 'completed': return 'green'
    case 'partial': return 'yellow'
    case 'failed': return 'red'
    default: return 'gray'
  }
})

async function triggerBenchmark() {
  isRunning.value = true
  progress.value = 0
  statusMessage.value = 'Starting benchmark runs...'
  
  try {
    const response = await $fetch('/api/benchmark/trigger', {
      method: 'POST',
      body: formState
    })
    
    lastBenchmark.value = response
    emit('benchmarkStarted', response.benchmarkId)
    
    // Start polling for status
    startPolling(response.benchmarkId)
    
  } catch (error) {
    console.error('Failed to trigger benchmark:', error)
    statusMessage.value = 'Failed to start benchmark'
    isRunning.value = false
  }
}

function startPolling(benchmarkId: string) {
  pollingInterval.value = setInterval(async () => {
    try {
      const status = await $fetch('/api/benchmark/status', {
        query: { benchmarkId }
      })
      
      lastBenchmark.value = status
      progress.value = status.progress
      
      if (status.status === 'running') {
        statusMessage.value = `Running: ${status.completedRegions}/${status.totalRegions} regions completed`
      } else {
        statusMessage.value = `Benchmark ${status.status}`
        stopPolling()
        isRunning.value = false
        
        if (status.status === 'completed') {
          success('Benchmark completed successfully!')
        } else if (status.status === 'partial') {
          warning('Benchmark completed with some failures')
        } else if (status.status === 'failed') {
          error('Benchmark failed')
        }
      }
    } catch (error) {
      console.error('Failed to poll status:', error)
      stopPolling()
      isRunning.value = false
    }
  }, 2000) // Poll every 2 seconds
}

function stopPolling() {
  if (pollingInterval.value) {
    clearInterval(pollingInterval.value)
    pollingInterval.value = null
  }
}

function viewResults() {
  if (lastBenchmark.value) {
    emit('viewResults', lastBenchmark.value.benchmarkId)
  }
}

onUnmounted(() => {
  stopPolling()
})
</script>