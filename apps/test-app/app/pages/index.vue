<script setup lang="ts">
  const { data: posts } = useFetch('/api/posts') 
</script>

<template>
  <div>
    <h1>Hello World</h1>
    <div v-for="post in posts" :key="post.id">
      <h2>{{ post.title }}</h2>
      <p>{{ post.description }}</p>
    </div>
  </div>
</template>
