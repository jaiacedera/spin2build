<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import AppIcon from './AppIcon.vue'
import { advanceBuild, readBuilds, toggleBuildFeature, type Build } from '../lib/myBuilds'

const props = defineProps<{ tab: Build['status'] }>()
const emit = defineEmits<{ tab: [status: Build['status']]; submit: [build: Build] }>()
const builds = ref<Build[]>([])
const error = ref('')
const notice = ref('')
const tabs = [{ status: 'draft', label: 'Drafts' }, { status: 'in-progress', label: 'In Progress' }, { status: 'completed', label: 'Completed' }] as const
const visible = computed(() => builds.value.filter(build => build.status === props.tab))
function refresh() {
  try { builds.value = readBuilds(); error.value = '' }
  catch { error.value = 'Your saved builds could not be loaded. Check browser storage and try again. Existing data has been left intact.' }
}
function advance(build: Build, status: Build['status']) {
  try {
    builds.value = advanceBuild(build.id, status)
    error.value = ''
    notice.value = status === 'in-progress' ? 'Moved to In Progress.' : 'Moved to Completed. Ready to share with the community.'
    emit('tab', status)
  } catch { error.value = 'The change could not be saved. Refresh My Builds and try again.' }
}
function toggle(build: Build, feature: string, event: Event) {
  try { builds.value = toggleBuildFeature(build.id, feature); error.value = '' }
  catch {
    (event.target as HTMLInputElement).checked = build.completedFeatures.includes(feature)
    error.value = 'Checklist progress could not be saved. Please try again.'
  }
}
function onStorage(event: StorageEvent) { if (!event.key || event.key === 'spin2build.build-history.v1') refresh() }
onMounted(() => { refresh(); window.addEventListener('storage', onStorage) })
onBeforeUnmount(() => window.removeEventListener('storage', onStorage))
</script>

<template>
  <section class="my-builds" aria-labelledby="my-builds-heading">
    <div class="my-builds-heading"><div><h2 id="my-builds-heading">Your next idea starts here.</h2><p>Saved on this device.</p></div><a class="text-button" href="#home">Find another direction <AppIcon /></a></div>
    <nav class="my-build-tabs" aria-label="My Builds status"><button v-for="item in tabs" :key="item.status" :aria-pressed="tab === item.status" @click="notice = ''; $emit('tab', item.status)">{{ item.label }} <span>{{ builds.filter(build => build.status === item.status).length }}</span></button></nav>
    <p v-if="notice" class="my-build-notice" role="status">{{ notice }}</p>
    <div v-if="error" class="gallery-empty" role="alert"><p>{{ error }}</p><button class="gallery-primary" @click="refresh">Try Again <AppIcon name="refresh" /></button></div>
    <div v-else-if="!visible.length" class="gallery-empty"><span class="eyebrow">{{ tabs.find(item => item.status === tab)?.label }}</span><h2>{{ tab === 'draft' ? 'Make room for your next idea.' : tab === 'in-progress' ? 'Ready when you are.' : 'Good things take a little building.' }}</h2><p>{{ tab === 'draft' ? 'Accept a Spin2Build challenge to save it here.' : tab === 'in-progress' ? 'Choose a draft and select Start Building.' : 'Mark an in-progress build complete to find it here.' }}</p><a v-if="tab === 'draft'" class="gallery-primary" href="#home">Keep Spinning <AppIcon /></a><button v-else class="gallery-primary" @click="$emit('tab', tab === 'completed' ? 'in-progress' : 'draft')">{{ tab === 'completed' ? 'View In Progress' : 'View Drafts' }}<AppIcon /></button></div>
    <div v-else class="my-build-grid">
      <article v-for="build in visible" :key="build.id" class="my-build" :data-build-id="build.id">
        <div class="my-build-meta"><span class="eyebrow">{{ tabs.find(item => item.status === build.status)?.label }}</span><time :datetime="build.acceptedAt">{{ new Date(build.acceptedAt).toLocaleDateString() }}</time></div>
        <h3>{{ build.projectType }} <span>×</span> {{ build.topic }}</h3><p class="my-build-concept">{{ build.concept }}</p>
        <ul class="gallery-tags" aria-label="Suggested tech stack"><li v-for="tag in build.techStack" :key="tag">{{ tag }}</li></ul>
        <details class="my-build-details"><summary>Challenge details</summary><dl><dt>WHO IT’S FOR</dt><dd>{{ build.audience }}</dd><dt>CORE LOOP</dt><dd>{{ build.coreLoop }}</dd><dt>{{ tab === 'draft' ? 'SUGGESTED FEATURES' : 'BUILD CHECKLIST' }}</dt><dd><ul v-if="tab === 'draft'"><li v-for="feature in build.features" :key="feature">{{ feature }}</li></ul><div v-else class="my-build-checklist"><label v-for="feature in build.features" :key="feature"><input type="checkbox" :checked="build.completedFeatures.includes(feature)" :disabled="tab === 'completed'" @change="toggle(build, feature, $event)">{{ feature }}</label><p>{{ build.completedFeatures.length }} / {{ build.features.length }} features checked</p></div></dd><dt>EXTRA CHALLENGE · OPTIONAL</dt><dd>{{ build.extraChallenge }}</dd></dl></details>
        <div class="my-build-actions"><button v-if="tab === 'draft'" class="gallery-primary" @click="advance(build, 'in-progress')">Start Building <AppIcon /></button><button v-else-if="tab === 'in-progress'" class="gallery-primary" @click="advance(build, 'completed')">Mark Complete <AppIcon name="check" /></button><button v-else class="gallery-primary" @click="$emit('submit', build)">Submit to Community Gallery <AppIcon /></button></div>
      </article>
    </div>
  </section>
</template>
