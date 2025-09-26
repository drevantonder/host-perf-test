<template>
  <div>
    <h1>Results</h1>

    <div>
      <label>Regions (space-separated)</label>
      <UInput v-model="regionsInput" placeholder="iad lhr syd" />
    </div>

    <div>
      <label>Runs</label>
      <UInput type="number" v-model.number="runs" min="1" />
    </div>

    <div>
      <label>Label</label>
      <UInput v-model="label" />
    </div>

    <div style="margin-top:8px">
      <UButton :disabled="loading" @click="trigger">
        {{ loading ? 'Starting…' : 'Start Benchmark' }}
      </UButton>
    </div>

    <div v-if="error" style="color:var(--danger, #c00); margin-top:8px">
      <strong>Error:</strong> {{ error }}
    </div>

    <pre v-if="result" style="margin-top:12px; white-space:pre-wrap;">
      {{ JSON.stringify(result, null, 2) }}
    </pre>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const regionsInput = ref('iad lhr syd')
const runs = ref(10)
const label = ref('web-triggered')
const loading = ref(false)
const result = ref<any>(null)
const error = ref('')

async function trigger() {
  loading.value = true
  error.value = ''
  result.value = null

  try {
    const regions = regionsInput.value.split(/\s+/).filter(Boolean)
    // Nuxt $fetch works in client-side; falls back to relative path
    const res = await $fetch('/api/benchmark/trigger', {
      method: 'POST',
      body: { regions, runs: runs.value, label: label.value }
    })
    result.value = res
  } catch (e: any) {
    // Pull meaningful message where available
    error.value = e?.data?.statusMessage || e?.message || String(e)
  } finally {
    loading.value = false
  }
}
</script>
