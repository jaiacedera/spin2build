<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import AppHeader from './AppHeader.vue'
import AppFooter from './AppFooter.vue'
import AppIcon from './AppIcon.vue'
import GalleryCard from './GalleryCard.vue'
import GallerySubmission from './GallerySubmission.vue'
import MyBuilds from './MyBuilds.vue'
import type { Build } from '../lib/myBuilds'
import { fetchGallery } from '../lib/gallery'
import type { GalleryProject } from '../types/gallery'
import '../gallery.css'

defineProps<{ originalType: string; originalTopic: string }>()
defineEmits<{ about: [] }>()
const projects = ref<GalleryProject[]>([])
const filters = ['All', 'From Spin2Build', 'Original Ideas', 'Featured', 'Newest'] as const
const route = ref(window.location.hash)
const myBuilds = computed(() => route.value.startsWith('#gallery/my-builds'))
const buildTab = computed<Build['status']>(() => route.value.endsWith('/completed') ? 'completed' : route.value.endsWith('/in-progress') ? 'in-progress' : 'draft')
function syncRoute() { route.value = window.location.hash }
function openCommunity() { window.location.hash = 'gallery' }
function setBuildTab(status: Build['status']) { window.location.hash = `gallery/my-builds/${status === 'draft' ? 'drafts' : status}` }
const filter = ref<typeof filters[number]>('All')
const search = ref('')
const loading = ref(true)
const error = ref('')
const submission = ref<InstanceType<typeof GallerySubmission>>()
const selected = ref<GalleryProject>()
const detail = ref<HTMLDialogElement>()
let controller: AbortController | undefined
const visible = computed(() => projects.value.filter(project => {
  if (project.status !== 'approved') return false
  if (filter.value === 'From Spin2Build' && project.source !== 'spin2build') return false
  if (filter.value === 'Original Ideas' && project.source !== 'original') return false
  if (filter.value === 'Featured' && !project.featured) return false
  const text = [project.projectName, project.description, project.projectType, project.topic, project.builderName, project.location, ...project.techStack].join(' ').toLowerCase()
  return text.includes(search.value.trim().toLowerCase())
}).sort((a, b) => b.createdAt.localeCompare(a.createdAt)))
async function refresh() {
  controller?.abort()
  const request = new AbortController()
  controller = request
  loading.value = true
  error.value = ''
  try { projects.value = await fetchGallery(request.signal) }
  catch (cause) { if (!request.signal.aborted) error.value = (cause as Error).message }
  finally { if (!request.signal.aborted) loading.value = false }
}
function openProject(project: GalleryProject) { selected.value = project; detail.value?.showModal(); detail.value?.scrollTo({ top: 0 }) }
watch(myBuilds, active => { if (!active) void refresh() })
onMounted(() => { window.addEventListener('hashchange', syncRoute); if (!myBuilds.value) void refresh() })
onBeforeUnmount(() => { controller?.abort(); window.removeEventListener('hashchange', syncRoute) })
</script>

<template>
  <div class="community-gallery">
    <AppHeader gallery :spinning="false" @open="page => { if (page === 'about') $emit('about'); else openCommunity() }" @submit="submission?.open()" />
    <main id="gallery-main">
      <section v-if="!myBuilds" class="gallery-hero" aria-labelledby="gallery-title">
        <div><p class="eyebrow">THE COMMUNITY GALLERY / OPEN TO THE WORLD</p><h1 id="gallery-title">real ideas.<br>real projects.</h1></div>
        <div class="gallery-hero-copy"><p>A public gallery of projects shared by curious builders.<br>Some started with a Spin2Build challenge.<br>Others started with an original idea.</p><p class="gallery-open-note">Open to everyone. No sign in required.</p></div>
      </section>
      <nav class="gallery-views" aria-label="Gallery views"><a href="#gallery" :aria-current="!myBuilds ? 'page' : undefined">Community</a><a href="#gallery/my-builds/drafts" :aria-current="myBuilds ? 'page' : undefined">My Builds</a></nav>
      <MyBuilds v-if="myBuilds" :tab="buildTab" @tab="setBuildTab" @submit="build => submission?.open(build)" />
      <section v-else class="gallery-collection" aria-label="Community projects" :aria-busy="loading">
        <div class="gallery-toolbar"><div class="gallery-filters" aria-label="Filter projects"><button v-for="item in filters" :key="item" :aria-pressed="filter === item" @click="filter = item">{{ item }}</button></div><label class="gallery-search"><span class="visually-hidden">Search projects</span><input v-model="search" type="search" placeholder="Search projects..." /></label></div>
        <div class="gallery-count"><span role="status">{{ loading ? 'Loading projects…' : `${visible.length} ${visible.length === 1 ? 'project' : 'projects'}` }}</span><span>NEWEST FIRST</span></div>
        <div v-if="error" class="gallery-empty" role="alert"><h2>We couldn’t load the gallery.</h2><p>{{ error }}</p><button class="gallery-primary" @click="refresh">Try Again <AppIcon name="refresh" /></button></div>
        <div v-else-if="loading" class="gallery-empty"><p>Finding what people are building…</p></div>
        <div v-else-if="!visible.length" class="gallery-empty"><span class="eyebrow">{{ projects.length ? 'KEEP EXPLORING' : 'THE NEXT PROJECT COULD BE YOURS' }}</span><h2>{{ projects.length ? 'No projects found.' : 'Every community starts with one build.' }}</h2><p>{{ projects.length ? 'Try a different search or filter.' : 'Share something you made. Reviewed projects will appear here.' }}</p><button v-if="projects.length" class="gallery-primary" @click="search = ''; filter = 'All'">Clear Filters <AppIcon /></button><button v-else class="gallery-primary" @click="submission?.open()">+ Submit Your Build</button></div>
        <div v-else class="gallery-grid"><GalleryCard v-for="project in visible" :key="project.id" :project="project" @open="openProject" /></div>
      </section>
      <section v-if="!myBuilds" class="gallery-invitation"><div><span class="eyebrow">BUILT SOMETHING?</span><h2>Give your idea a place in the world.</h2></div><button class="gallery-primary" @click="submission?.open()">+ Submit Your Build</button></section>
    </main>
    <AppFooter />
    <GallerySubmission ref="submission" :original-type="originalType" :original-topic="originalTopic" @submitted="refresh" />
    <dialog ref="detail" class="info-dialog gallery-modal" aria-labelledby="project-detail-heading" @click="event => { if (event.target === detail) detail?.close() }"><div class="gallery-modal-content"><div class="dialog-top"><span id="project-detail-heading" class="eyebrow">COMMUNITY BUILD</span><button class="circle-button" aria-label="Close project" @click="detail?.close()"><AppIcon name="close" /></button></div><GalleryCard v-if="selected" :project="selected" detail /></div></dialog>
  </div>
</template>
