<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { normalizeDemoUrl } from '../lib/demoUrl'

const props = defineProps<{ url?: string; name: string; interactive?: boolean }>()
const viewport = ref<HTMLElement>()
const width = ref(0)
const inView = ref(false)
const pageVisible = ref(document.visibilityState === 'visible')
function syncVisibility() { pageVisible.value = document.visibilityState === 'visible' }
let observer: ResizeObserver | undefined
let visibilityObserver: IntersectionObserver | undefined
const demoUrl = computed(() => {
  try { return normalizeDemoUrl(props.url || '') } catch { return '' }
})
// Our own site is a valid demo too. Stop nested previews so a demo pointing
// back to the gallery cannot create an endless tree of embedded galleries.
const isEmbedded = window.self !== window.top
const embedUrl = computed(() => isEmbedded ? '' : demoUrl.value)
onMounted(() => {
  document.addEventListener('visibilitychange', syncVisibility)
  observer = new ResizeObserver(entries => { width.value = entries[0]?.contentRect.width || 0 })
  if (viewport.value) observer.observe(viewport.value)
  visibilityObserver = new IntersectionObserver(entries => { inView.value = entries[0]?.isIntersecting || false })
  if (viewport.value) visibilityObserver.observe(viewport.value)
})
onBeforeUnmount(() => { observer?.disconnect(); visibilityObserver?.disconnect(); document.removeEventListener('visibilitychange', syncVisibility) })
</script>

<template>
  <div class="live-demo-preview">
    <div ref="viewport" class="live-demo-viewport" :class="{ 'live-demo-interactive': interactive }">
      <iframe
        v-if="embedUrl && width && inView && pageVisible" :key="embedUrl" :src="embedUrl" :title="`${name} live landing page`"
        class="live-demo-frame" width="1280" height="800" loading="lazy"
        sandbox="allow-scripts allow-same-origin" referrerpolicy="no-referrer"
        :tabindex="interactive ? 0 : -1" :inert="!interactive"
        :style="{ transform: `scale(${width / 1280})` }"
      />
      <p v-if="!embedUrl" class="live-demo-unavailable">{{ demoUrl ? 'Open the live demo to view this page.' : 'No embeddable live demo available.' }}</p>
      <slot />
    </div>
    <p v-if="demoUrl" class="live-demo-note"><a :href="demoUrl" target="_blank" rel="noopener noreferrer">Open live demo ↗</a></p>
  </div>
</template>
