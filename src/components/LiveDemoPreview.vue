<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { normalizeDemoUrl } from '../lib/demoUrl'

const props = defineProps<{ url?: string; name: string; interactive?: boolean }>()
const viewport = ref<HTMLElement>()
const width = ref(0)
let observer: ResizeObserver | undefined
const demoUrl = computed(() => {
  try { return normalizeDemoUrl(props.url || '') } catch { return '' }
})
// Keep script-enabled frames on a different origin from the gallery.
const embedUrl = computed(() => demoUrl.value && new URL(demoUrl.value).origin !== window.location.origin ? demoUrl.value : '')
onMounted(() => {
  observer = new ResizeObserver(entries => { width.value = entries[0]?.contentRect.width || 0 })
  if (viewport.value) observer.observe(viewport.value)
})
onBeforeUnmount(() => observer?.disconnect())
</script>

<template>
  <div class="live-demo-preview">
    <div ref="viewport" class="live-demo-viewport" :class="{ 'live-demo-interactive': interactive }">
      <iframe
        v-if="embedUrl && width" :key="embedUrl" :src="embedUrl" :title="`${name} live landing page`"
        class="live-demo-frame" width="1280" height="800" loading="lazy"
        sandbox="allow-scripts allow-same-origin" referrerpolicy="no-referrer"
        :tabindex="interactive ? 0 : -1" :inert="!interactive"
        :style="{ transform: `scale(${width / 1280})` }"
      />
      <p v-if="!embedUrl" class="live-demo-unavailable">{{ demoUrl ? 'Open the live demo to view this page.' : 'No embeddable live demo available.' }}</p>
      <slot />
    </div>
    <p v-if="demoUrl" class="live-demo-note">Preview unavailable? <a :href="demoUrl" target="_blank" rel="noopener noreferrer">Open live demo ↗</a></p>
  </div>
</template>
