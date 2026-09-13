<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import AppHeader from './components/AppHeader.vue'
import IntroSection from './components/IntroSection.vue'
import TextSpinner from './components/TextSpinner.vue'
import ProjectResult from './components/ProjectResult.vue'
import AppFooter from './components/AppFooter.vue'
import AppIcon from './components/AppIcon.vue'
import GalleryPage from './components/GalleryPage.vue'
import { projectTypes } from './data/projectTypes'
import { topics } from './data/topics'
import { createIdea, typePhrase, type Direction } from './data/ideas'
import type { SpinnerHandle } from './types/spinner'
import { trackGeneratedSpin } from './lib/analytics'
import { useSiteStats } from './composables/useSiteStats'

const { totalSpins, totalVisits, loading: statsLoading } = useSiteStats()
const selectedProjectType = ref(2)
const selectedTopic = ref(topics.indexOf('Productivity'))
const isSpinning = ref(false)
const generatedIdea = ref<Direction | null>(null)
const copied = ref(false)
const copyError = ref('')
const typeSpinner = ref<SpinnerHandle>()
const topicSpinner = ref<SpinnerHandle>()
const currentProjectType = computed(() => projectTypes[selectedProjectType.value] ?? 'Website')
const currentTopic = computed(() => topics[selectedTopic.value] ?? 'Podcast')
const projectSentence = computed(() => `Build ${typePhrase(currentProjectType.value)} related to ${currentTopic.value.toLowerCase()}.`)
let copyTimer: ReturnType<typeof setTimeout>
let copyRequest = 0
let isActive = true
watch([selectedProjectType, selectedTopic], () => { generatedIdea.value = null; copied.value = false; copyError.value = ''; copyRequest++ })

async function spinBoth() {
  if (isSpinning.value || !typeSpinner.value || !topicSpinner.value) return
  isSpinning.value = true
  generatedIdea.value = null
  copied.value = false
  copyError.value = ''
  copyRequest++
  try {
    await Promise.all([
      typeSpinner.value.spin(Math.floor(Math.random() * projectTypes.length), 4000),
      topicSpinner.value.spin(Math.floor(Math.random() * topics.length), 4450),
    ])
    if (isActive) {
      trackGeneratedSpin(currentProjectType.value, currentTopic.value)
    }
  } finally { isSpinning.value = false }
}
async function copyIdea() {
  const request = ++copyRequest
  try {
    await navigator.clipboard.writeText(projectSentence.value)
    if (request !== copyRequest) return
    copied.value = true
    copyError.value = ''
    clearTimeout(copyTimer)
    copyTimer = setTimeout(() => { copied.value = false }, 2200)
  } catch {
    if (request === copyRequest) copyError.value = 'Copy unavailable. Select and copy the sentence above.'
  }
}
const panel = ref<'about' | 'gallery'>('about')
const dialog = ref<HTMLDialogElement>()
const isGallery = ref(/^#gallery(?:\/|$)/.test(window.location.hash))
function syncPage() { isGallery.value = /^#gallery(?:\/|$)/.test(window.location.hash); window.scrollTo(0, 0) }
window.addEventListener('hashchange', syncPage)
function openPanel(page: 'about' | 'gallery') {
  if (page === 'gallery') { window.location.hash = 'gallery'; return }
  panel.value = 'about'; dialog.value?.showModal()
}
onBeforeUnmount(() => { isActive = false; clearTimeout(copyTimer); copyRequest++; window.removeEventListener('hashchange', syncPage) })
</script>

<template>
  <div v-show="!isGallery" id="home" class="site-shell">
    <a class="skip-link" href="#generator">Skip to generator</a>
    <AppHeader :spinning="isSpinning" @spin="spinBoth" @open="openPanel" />
    <main id="generator" class="main-layout">
      <div class="background-words" aria-hidden="true"><span>IDEAS</span><span>BUILD</span><span>CREATE</span></div>
      <IntroSection :spinning="isSpinning" :total-spins="totalSpins" :total-visits="totalVisits" :stats-loading="statsLoading" @spin="spinBoth" />
      <div class="spinners">
        <TextSpinner ref="typeSpinner" v-model="selectedProjectType" :items="projectTypes" label="Project type" number="02" :disabled="isSpinning" />
        <TextSpinner ref="topicSpinner" v-model="selectedTopic" :items="topics" label="Topic" number="03" :disabled="isSpinning" />
      </div>
      <ProjectResult :type="currentProjectType" :topic="currentTopic" :sentence="projectSentence" :idea="generatedIdea" :spinning="isSpinning" :copied="copied" :copy-error="copyError" @spin="spinBoth" @copy="copyIdea" @generate="generatedIdea = createIdea(currentProjectType, currentTopic, generatedIdea)" />
      <div class="side-note" aria-hidden="true">IDEAS<br>TODAY<br>PROJECTS<br>TOMORROW</div>
    </main>
    <AppFooter />
  </div>
  <GalleryPage v-if="isGallery" :original-type="currentProjectType" :original-topic="currentTopic" @about="openPanel('about')" />
    <dialog ref="dialog" class="info-dialog" aria-labelledby="panel-heading" @click="event => { if (event.target === dialog) dialog?.close() }">
      <div class="dialog-content">
        <div class="dialog-top"><span class="eyebrow">spin2build / {{ panel }}</span><button class="circle-button" aria-label="Close panel" @click="dialog?.close()"><AppIcon name="close" /></button></div>
        <template v-if="panel === 'about'">
          <h2 id="panel-heading">About Spin2Build</h2>
          <div class="about-sections">
            <section>
              <h3>WHY I BUILT THIS</h3>
              <p>I wanted to stop asking, “What should I build next?”</p>
            </section>
            <section>
              <h3>THE IDEA</h3>
              <p>Two spins. One random combination. Then I figure out how to make it work.</p>
            </section>
            <section>
              <h3>THE CHALLENGE</h3>
              <p>Some ideas are obvious. Some make absolutely no sense at first. Those are usually the fun ones.</p>
            </section>
            <section>
              <h3>THE GOAL</h3>
              <p>Practice solving problems across different topics, industries, and types of software.</p>
            </section>
            <section>
              <h3>BUILT BY</h3>
              <p>Jai Acedera</p>
            </section>
          </div>
        </template>
      </div>
    </dialog>
</template>
