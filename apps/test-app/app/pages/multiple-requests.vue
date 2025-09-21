
<script setup lang="ts">
  const { data: posts } = useFetch('/api/posts') 
  
  const { data: results } = useFetch('/api/results') 
</script>

<template>
  <div>
    <h1>Hello World</h1>
    <div v-for="post in posts" :key="post.id">
      <h2>{{ post.title }}</h2>
      <p>{{ post.description }}</p>
    </div>
    
    <div v-for="result in results" :key="result.id">
      <h2>{{ result.time }}</h2>
      <p>{{ result.score }}</p>
    </div>
  </div>
</template>
