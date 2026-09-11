<script setup lang="ts">
import AppIcon from './AppIcon.vue'
defineProps<{ spinning: boolean }>()
defineEmits<{ spin: []; open: [page: 'about' | 'gallery'] }>()
</script>

<template>
  <header class="header">
    <a class="wordmark" href="#home" aria-label="spin2build home">spin2build</a>
    <p class="brand-note">random<br>ideas<br>real projects</p>
    <nav aria-label="Main navigation">
      <a href="#home">home</a>
      <button @click="$emit('open', 'about')">about</button>
      <button @click="$emit('open', 'gallery')">gallery</button>
      <button class="circle-button" aria-label="Spin a new project" :disabled="spinning" @click="$emit('spin')"><AppIcon /></button>
    </nav>
  </header>
</template>
