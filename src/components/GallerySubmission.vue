<script setup lang="ts">
import { computed, nextTick, reactive, ref, watch } from 'vue'
import AppIcon from './AppIcon.vue'
import GalleryCard from './GalleryCard.vue'
import { projectTypes } from '../data/projectTypes'
import { readScreenshot, submitGallery } from '../lib/gallery'
import type { GalleryProject, GallerySource, GallerySubmission as Submission } from '../types/gallery'
import type { Build } from '../lib/myBuilds'

const props = defineProps<{ originalType: string; originalTopic: string }>()
const emit = defineEmits<{ submitted: [] }>()
const dialog = ref<HTMLDialogElement>()
const heading = ref<HTMLHeadingElement>()
const step = ref(1)
const error = ref('')
const saving = ref(false)
const readingImage = ref(false)
const screenshotName = ref('')
const previewMode = ref<'card' | 'detail'>('card')
const techText = ref('')
function blank(): Submission {
  return { id: crypto.randomUUID(), source: 'spin2build', projectName: '', description: '', projectType: '', topic: '', techStack: [], builderName: '', screenshotUrl: '', buildStatus: 'completed', location: '', githubUrl: '', liveDemoUrl: '', problemSolved: '', learned: '', originalProjectType: props.originalType, originalTopic: props.originalTopic }
}
const form = reactive(blank())
const preview = computed<GalleryProject>(() => ({ ...form, techStack: [...new Set(techText.value.split(',').map(tag => tag.trim()).filter(Boolean))], status: 'pending', featured: false, createdAt: '' }))
watch(step, async () => { await nextTick(); heading.value?.focus(); dialog.value?.scrollTo({ top: 0 }); error.value = '' })

function open(build?: Build) {
  if (build?.status === 'completed') {
    reset()
    Object.assign(form, { source: 'spin2build', projectName: `${build.projectType} × ${build.topic}`.slice(0, 80), description: build.concept.slice(0, 240), projectType: build.projectType, topic: build.topic, techStack: [...build.techStack], originalProjectType: build.projectType, originalTopic: build.topic, buildStatus: 'completed' })
    techText.value = build.techStack.join(', ')
    step.value = 2
  }
  dialog.value?.showModal()
}
defineExpose({ open })
function choose(source: GallerySource) {
  form.source = source
  if (source === 'spin2build' && !form.projectType) { form.projectType = props.originalType; form.topic = props.originalTopic }
  step.value = 2
}
async function upload(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  form.screenshotUrl = ''
  screenshotName.value = ''
  readingImage.value = true
  error.value = ''
  try { form.screenshotUrl = await readScreenshot(file); screenshotName.value = file.name }
  catch (cause) { error.value = (cause as Error).message; input.value = '' }
  finally { readingImage.value = false }
}
function showPreview() {
  if (!form.screenshotUrl) { error.value = 'Add a project screenshot before previewing.'; return }
  const tags = preview.value.techStack
  if (!tags.length || tags.length > 12 || tags.some(tag => tag.length > 40)) { error.value = 'Add 1–12 technologies, up to 40 characters each, separated by commas.'; return }
  for (const [key, label] of [['githubUrl', 'GitHub'], ['liveDemoUrl', 'Live Demo']] as const) {
    const raw = form[key]?.trim()
    if (!raw) continue
    try {
      const url = new URL(raw)
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || (key === 'githubUrl' && !['github.com', 'www.github.com'].includes(url.hostname))) throw new Error()
    } catch { error.value = `Enter a valid ${label} URL using https:// or http://.`; return }
  }
  form.techStack = [...new Set(tags)]
  previewMode.value = 'card'
  step.value = 3
}
async function submit() {
  if (saving.value) return
  saving.value = true
  error.value = ''
  try { await submitGallery({ ...form }); step.value = 4; emit('submitted') }
  catch (cause) { error.value = cause instanceof Error && cause.name !== 'TimeoutError' ? cause.message : 'The request timed out. Please try again; your preview is still here.' }
  finally { saving.value = false }
}
function reset() { Object.assign(form, blank()); techText.value = ''; screenshotName.value = ''; step.value = 1 }
</script>

<template>
  <dialog ref="dialog" class="info-dialog gallery-modal submission-modal" aria-labelledby="submission-heading" @cancel="event => { if (saving) event.preventDefault() }">
    <div class="gallery-modal-content">
      <div class="dialog-top"><span class="eyebrow">SHARE YOUR BUILD <span class="step-indicator">{{ String(step).padStart(2, '0') }} / 04</span></span><button class="circle-button" aria-label="Close submission" :disabled="saving" @click="dialog?.close()"><AppIcon name="close" /></button></div>
      <h2 id="submission-heading" ref="heading" tabindex="-1">{{ step === 1 ? 'How would you like to share your project?' : step === 2 ? 'Tell us about your build.' : step === 3 ? 'Preview Submission' : 'Your project was submitted.' }}</h2>
      <template v-if="step === 1">
        <p class="submission-intro">Every project has a starting point. What was yours?</p>
        <div class="source-options">
          <button @click="choose('spin2build')"><span class="eyebrow">01 / A RANDOM SPARK</span><strong>From Spin2Build</strong><span>A project that began with a Spin2Build challenge.</span><AppIcon /></button>
          <button @click="choose('original')"><span class="eyebrow">02 / YOUR OWN DIRECTION</span><strong>My Own Idea</strong><span>Something you imagined and brought to life.</span><AppIcon /></button>
        </div>
        <p class="submission-note">Open to everyone. No sign in required.</p>
      </template>
      <form v-else-if="step === 2" class="submission-form" @submit.prevent="showPreview">
        <p class="submission-intro">{{ form.source === 'spin2build' ? 'SPUN ON SPIN2BUILD' : 'ORIGINAL IDEA' }} <button type="button" class="text-button" @click="step = 1">Change</button></p>
        <p class="submission-note">Fields marked * are required. Your build will be reviewed before it appears in the gallery.</p>
        <div class="form-grid">
          <label class="full-field">Project Name *<input v-model.trim="form.projectName" name="projectName" required maxlength="80" placeholder="Give your build a name" /></label>
          <label class="full-field">Short Description *<textarea v-model.trim="form.description" name="description" required maxlength="240" rows="2" placeholder="What does your project do?" /><small>{{ form.description.length }} / 240</small></label>
          <label>Project Type *<input v-model.trim="form.projectType" name="projectType" list="gallery-project-types" required maxlength="80" placeholder="Website, mobile app…" /></label>
          <label>Topic / Category *<input v-model.trim="form.topic" name="topic" required maxlength="80" placeholder="Music, productivity, gardening…" /></label>
          <label class="full-field">Tech Stack *<input v-model="techText" name="techStack" required maxlength="490" placeholder="Vue, TypeScript, Supabase" /><small>Separate technologies with commas. Up to 12.</small></label>
          <label>Builder Name / Alias *<input v-model.trim="form.builderName" name="builderName" required maxlength="80" autocomplete="nickname" placeholder="What should we call you?" /></label>
          <label>Country / Location <span class="field-optional">Optional</span><input v-model.trim="form.location" name="location" maxlength="80" placeholder="Your corner of the world" /></label>
          <label class="full-field screenshot-field">Project Screenshot *<input type="file" name="screenshot" accept="image/png,image/jpeg,image/webp" :required="!form.screenshotUrl" :disabled="readingImage" @change="upload" /><small>{{ readingImage ? 'Reading screenshot…' : screenshotName || 'PNG, JPG, or WebP · up to 1 MB. Choose an image you have permission to share.' }}</small><img v-if="form.screenshotUrl" :src="form.screenshotUrl" alt="Your selected screenshot" /></label>
          <label>GitHub URL <span class="field-optional">Optional</span><input v-model.trim="form.githubUrl" name="githubUrl" type="url" maxlength="500" placeholder="https://github.com/…" /></label>
          <label>Live Demo URL <span class="field-optional">Optional</span><input v-model.trim="form.liveDemoUrl" name="liveDemoUrl" type="url" maxlength="500" placeholder="https://…" /></label>
          <label class="full-field">Build Status<select v-model="form.buildStatus" name="buildStatus"><option value="completed">Completed</option><option value="in-progress">In Progress</option></select></label>
          <template v-if="form.source === 'spin2build'">
            <p class="form-divider full-field">THE ORIGINAL SPIN</p>
            <label>Original Project Type *<input v-model.trim="form.originalProjectType" name="originalProjectType" list="gallery-project-types" required maxlength="80" /></label>
            <label>Original Topic *<input v-model.trim="form.originalTopic" name="originalTopic" required maxlength="80" /></label>
          </template>
          <label class="full-field">What problem does it solve? <span class="field-optional">Optional</span><textarea v-model.trim="form.problemSolved" name="problemSolved" maxlength="1500" rows="3" /></label>
          <label class="full-field">What did you learn? <span class="field-optional">Optional</span><textarea v-model.trim="form.learned" name="learned" maxlength="1500" rows="3" /></label>
        </div>
        <datalist id="gallery-project-types"><option v-for="type in projectTypes" :key="type" :value="type" /></datalist>
        <p v-if="error" class="gallery-error" role="alert">{{ error }}</p>
        <div class="submission-actions"><button type="button" class="text-button" @click="step = 1">Back</button><button class="gallery-primary" :disabled="readingImage">Preview Submission <AppIcon /></button></div>
      </form>
      <template v-else-if="step === 3">
        <p class="submission-intro">Here’s how your build will appear once approved.</p>
        <div class="preview-toggle" aria-label="Preview format"><button :aria-pressed="previewMode === 'card'" @click="previewMode = 'card'">Gallery card</button><button :aria-pressed="previewMode === 'detail'" @click="previewMode = 'detail'">Project detail</button></div>
        <div class="submission-preview" :class="{ 'card-preview': previewMode === 'card' }"><GalleryCard :project="preview" :detail="previewMode === 'detail'" preview /></div>
        <p class="submission-note">Submitted projects are reviewed before publishing. Your builder name and the details above will be public after approval.</p>
        <p v-if="error" class="gallery-error" role="alert">{{ error }}</p>
        <div class="submission-actions"><button class="text-button" :disabled="saving" @click="step = 2">Edit</button><button class="gallery-primary" :disabled="saving" @click="submit">{{ saving ? 'Submitting…' : 'Submit to Gallery' }}<AppIcon /></button></div>
      </template>
      <template v-else>
        <p class="submission-intro">Thanks for sharing your build with the Spin2Build community.</p>
        <p class="review-status" role="status"><AppIcon name="check" />Submitted for review.</p>
        <div class="submission-actions"><button class="text-button" @click="reset(); dialog?.close()">Back to Gallery</button><button class="gallery-primary" @click="reset">Submit Another Project <AppIcon /></button></div>
      </template>
    </div>
  </dialog>
</template>
