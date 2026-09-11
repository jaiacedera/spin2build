<script setup lang="ts">
withDefaults(defineProps<{ name?: 'arrow' | 'refresh' | 'file' | 'copy' | 'close' | 'check' }>(), { name: 'arrow' })
</script>

<template>
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path v-if="name === 'arrow'" d="M3 12h18m-8-8 8 8-8 8" />
    <path v-else-if="name === 'refresh'" d="M20 8a8 8 0 1 0 .4 7M20 3v5h-5" />
    <path v-else-if="name === 'file'" d="M14 2H5a1 1 0 0 0-1 1v18a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V8l-6-6Zm0 0v6h6M9 18h3" />
    <path v-else-if="name === 'copy'" d="M8 8h12v13H8zM16 8V3H3v13h5" />
    <path v-else-if="name === 'check'" d="m5 12 4 4L19 6" />
    <path v-else d="m6 6 12 12M6 18 18 6" />
  </svg>
</template>
