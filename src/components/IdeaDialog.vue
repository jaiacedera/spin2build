<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import AppIcon from './AppIcon.vue'
import type { Direction } from '../data/ideas'
import { readBuildHistory, saveBuild, type Build } from '../lib/buildHistory'

const props = defineProps<{ idea: Direction | null }>()
defineEmits<{ regenerate: [] }>()
const dialog = ref<HTMLDialogElement>()
const heading = ref<HTMLHeadingElement>()
const view = ref<'direction' | 'challenge' | 'history'>('direction')
const activeBuild = ref<Build | null>(null)
const history = ref<Build[]>([])
const error = ref('')
const current = computed(() => view.value === 'challenge' ? activeBuild.value : props.idea)

watch(() => props.idea, async idea => {
  view.value = 'direction'
  error.value = ''
  await nextTick()
  if (idea) {
    if (!dialog.value?.open) dialog.value?.showModal()
  } else dialog.value?.close()
}, { flush: 'post' })

async function focusHeading() {
  await nextTick()
  heading.value?.focus()
  dialog.value?.scrollTo({ top: 0 })
}

function accept() {
  if (!props.idea) return
  try {
    const build: Build = readBuildHistory().find(entry => entry.id === props.idea?.id)
      ?? { ...props.idea, acceptedAt: new Date().toISOString(), completedFeatures: [] }
    history.value = saveBuild(build)
    activeBuild.value = build
    view.value = 'challenge'
    error.value = ''
    void focusHeading()
  } catch {
    error.value = 'Could not save your challenge. Check that browser storage is available, then try again.'
  }
}

function toggleFeature(feature: string) {
  if (!activeBuild.value) return
  const build = activeBuild.value
  const updated = { ...build, completedFeatures: build.completedFeatures.includes(feature)
    ? build.completedFeatures.filter(item => item !== feature) : [...build.completedFeatures, feature] }
  try {
    history.value = saveBuild(updated)
    activeBuild.value = updated
    error.value = ''
  } catch { error.value = 'Progress could not be saved. Please try again.' }
}

function openHistory() {
  try {
    history.value = readBuildHistory()
    view.value = 'history'
    error.value = ''
    void focusHeading()
  } catch { error.value = 'Build History could not be loaded. Your saved data has been left intact.' }
}

function resume(build: Build) {
  activeBuild.value = build
  view.value = 'challenge'
  void focusHeading()
}
</script>

<template>
  <dialog ref="dialog" class="info-dialog direction-dialog" aria-labelledby="direction-heading"
    @click="event => { if (event.target === dialog) dialog?.close() }">
    <div class="direction-content">
      <div class="dialog-top">
        <span class="eyebrow">{{ view === 'direction' ? 'A POSSIBLE DIRECTION' : view === 'challenge' ? 'YOUR BUILD CHALLENGE' : 'YOUR SAVED DIRECTIONS' }}</span>
        <button class="circle-button" aria-label="Close idea" @click="dialog?.close()"><AppIcon name="close" /></button>
      </div>
      <h2 id="direction-heading" ref="heading" tabindex="-1">
        <template v-if="view === 'history'">Build History</template>
        <template v-else>{{ current?.projectType }} <span class="multiply">×</span> {{ current?.topic }}</template>
      </h2>
      <p class="direction-intro">{{ view === 'direction' ? 'An idea to help you get started. Make it your own.' : view === 'challenge' ? 'Saved to Build History. Start with the core loop, then build one feature at a time.' : 'Saved in this browser. Pick a challenge to continue building.' }}</p>

      <div v-if="view === 'history'" class="build-history">
        <p v-if="!history.length">No accepted challenges yet.</p>
        <button v-for="build in history" :key="build.id" class="history-entry" @click="resume(build)">
          <span><strong>{{ build.projectType }} × {{ build.topic }}</strong><span>{{ build.concept }}</span><small>{{ build.completedFeatures.length }} / {{ build.features.length }} features · {{ new Date(build.acceptedAt).toLocaleDateString() }}</small></span><AppIcon />
        </button>
      </div>
      <dl v-else-if="current" class="direction-sections">
        <div><dt><span>01</span>THE IDEA</dt><dd aria-live="polite" aria-atomic="true">{{ current.concept }}</dd></div>
        <div><dt><span>02</span>WHO IT’S FOR</dt><dd>{{ current.audience }}</dd></div>
        <div><dt><span>03</span>CORE LOOP</dt><dd>{{ current.coreLoop }}</dd></div>
        <div><dt><span>04</span>{{ view === 'challenge' ? 'BUILD CHECKLIST' : 'SUGGESTED FEATURES' }}</dt><dd>
          <ul v-if="view === 'direction'" class="feature-list"><li v-for="feature in current.features" :key="feature">{{ feature }}</li></ul>
          <div v-else class="build-checklist"><label v-for="feature in current.features" :key="feature"><input type="checkbox" :checked="activeBuild?.completedFeatures.includes(feature)" @change="toggleFeature(feature)">{{ feature }}</label>
            <p role="status">{{ activeBuild?.completedFeatures.length === current.features.length ? 'All features complete. Your first version is ready to try!' : `${activeBuild?.completedFeatures.length} / ${current.features.length} features complete` }}</p>
          </div>
        </dd></div>
        <div><dt><span>05</span>POSSIBLE TECH STACK</dt><dd><ul class="stack-tags"><li v-for="tag in current.techStack" :key="tag">{{ tag }}</li></ul></dd></div>
        <div><dt><span>06</span>EXTRA CHALLENGE</dt><dd><span class="optional-label">Optional</span>{{ current.extraChallenge }}</dd></div>
      </dl>
      <p v-if="error" class="direction-error" role="alert">{{ error }}</p>
      <div class="direction-actions">
        <template v-if="view === 'direction'">
          <button class="direction-secondary" @click="$emit('regenerate')">Another Direction <AppIcon name="refresh" /></button>
          <button class="direction-primary" @click="accept">Accept Challenge <AppIcon /></button>
        </template>
        <template v-else>
          <button class="direction-secondary" @click="view = 'direction'; focusHeading()">Back to Direction</button>
          <button v-if="view === 'challenge'" class="direction-primary" @click="dialog?.close()">Keep Building <AppIcon /></button>
        </template>
      </div>
      <button v-if="view !== 'history'" class="history-link" @click="openHistory">Build History</button>
    </div>
  </dialog>
</template>

<style scoped>
.direction-dialog { width:min(860px, calc(100% - 32px)); max-height:calc(100dvh - 32px); overflow-y:auto; overscroll-behavior:contain; background:#000; border:1px solid #383838; border-radius:5px; box-shadow:none; }
.direction-dialog::backdrop { background:rgb(0 0 0 / .7); }
.direction-content { padding:clamp(16px, 2.3dvh, 24px) 42px 16px; }
.dialog-top { margin-bottom:clamp(10px, 1.8dvh, 24px); }
.eyebrow { color:#c7c7c7; }
.direction-dialog h2 { font-size:clamp(28px, 3.2vw, 44px); line-height:1.18; margin-bottom:12px; overflow-wrap:anywhere; }
.direction-dialog .direction-intro { color:#c6c6c6; margin:0; font-size:16px; }
.direction-sections { border-top:1px solid #292929; margin:clamp(16px, 2.5dvh, 30px) 0 0; padding-top:clamp(16px, 2.3dvh, 28px); display:grid; gap:clamp(12px, 1.8dvh, 24px); }
.direction-sections > div { display:grid; grid-template-columns:210px minmax(0, 1fr); gap:24px; }
dt { display:flex; gap:26px; padding-top:3px; font-size:11px; line-height:1.6; letter-spacing:1.2px; }
dt > span { color:#bdbdbd; font-variant-numeric:tabular-nums; }
dd { margin:0; color:#d3d3d3; font-size:14px; line-height:1.55; overflow-wrap:anywhere; }
.feature-list { margin:0; padding-left:18px; }
.feature-list li + li { margin-top:3px; }
.stack-tags { display:flex; flex-wrap:wrap; gap:8px; list-style:none; padding:0; margin:0; }
.stack-tags li { border:1px solid #3b3b3b; border-radius:999px; padding:5px 14px; font-size:12px; }
.optional-label { color:#999; font-size:11px; margin-right:8px; }
.direction-actions { display:flex; align-items:center; justify-content:space-between; gap:20px; margin-top:clamp(16px, 2.5dvh, 32px); padding-top:clamp(12px, 1.8dvh, 22px); border-top:1px solid #292929; }
.direction-actions button { display:inline-flex; align-items:center; justify-content:center; gap:14px; min-height:52px; font-size:14px; }
.direction-primary { background:#fff; color:#000; border:1px solid #fff; border-radius:5px; padding:12px 26px; }
.direction-primary:not(:disabled):hover { color:#000; background:#ddd; }
.direction-actions svg { width:20px; height:20px; }
.history-link { display:block; margin-top:4px; min-height:32px; font-size:11px; color:#999; }
.history-entry { width:100%; display:flex; align-items:center; gap:24px; text-align:left; border-top:1px solid #292929; padding:22px 0; }
.history-entry > span { flex:1; }
.history-entry strong, .history-entry span span, .history-entry small { display:block; line-height:1.5; }
.history-entry span span { font-size:14px; margin:8px 0; color:#bbb; }
.history-entry small { color:#999; }
.build-history { margin-top:28px; }
.build-checklist { display:grid; gap:10px; }
.build-checklist label { display:flex; align-items:center; gap:10px; min-height:32px; cursor:pointer; }
.build-checklist input { accent-color:#fff; width:16px; height:16px; flex-shrink:0; }
.direction-dialog .build-checklist p, .direction-dialog .direction-error { font-size:12px; margin-top:8px; }
@media (min-width:601px) and (max-height:850px) {
  .direction-dialog h2 { font-size:36px; margin-bottom:8px; }
  .feature-list { display:grid; grid-template-columns:repeat(2, minmax(0, 1fr)); column-gap:24px; row-gap:4px; }
  .feature-list li + li { margin-top:0; }
  .build-checklist { gap:4px; }
  .build-checklist label { min-height:24px; }
  .direction-actions button { min-height:46px; }
}
@media (max-width:600px) {
  .direction-content { padding:20px 22px; }
  .dialog-top { margin-bottom:22px; }
  .direction-sections { gap:24px; margin-top:24px; padding-top:24px; }
  .direction-sections > div { grid-template-columns:minmax(0, 1fr); gap:9px; }
  dt { gap:16px; }
  .direction-actions { gap:10px; flex-wrap:wrap; }
  .direction-actions button { flex:1 1 190px; }
  .direction-primary { padding-inline:14px; }
}
</style>
