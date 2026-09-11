<script setup lang="ts">
import { ref, watch } from 'vue'
import AppIcon from './AppIcon.vue'
const props = defineProps<{ type: string; topic: string; sentence: string; idea: string; spinning: boolean; copied: boolean; copyError: string }>()
defineEmits<{ spin: []; copy: []; generate: [] }>()
const ideaDialog = ref<HTMLDialogElement>()
watch(() => props.idea, idea => {
  if (idea) ideaDialog.value?.showModal()
  else ideaDialog.value?.close()
}, { flush: 'post' })
</script>

<template>
  <section class="project-result" aria-labelledby="result-label" :aria-busy="spinning">
    <div class="section-label"><span class="section-number">04</span><h2 id="result-label">Your project</h2><span class="horizontal-rule" /></div>
    <div class="result-body">
      <div class="result-copy" aria-live="polite" aria-atomic="true">
        <h3><AppIcon name="file" class="project-icon" /><span>{{ type }} <span class="multiply">×</span> {{ topic }}</span></h3>
        <p class="project-sentence">{{ sentence }}</p>
      </div>
      <button class="outline-button" :disabled="spinning" @click="$emit('spin')">{{ spinning ? 'Spinning…' : 'Generate Again' }}<AppIcon name="refresh" :class="{ rotating: spinning }" /></button>
    </div>
    <div class="result-actions">
      <button :disabled="spinning" @click="$emit('copy')"><AppIcon :name="copied ? 'check' : 'copy'" />{{ copied ? 'Copied!' : 'Copy Idea' }}</button>
      <span class="action-divider" />
      <button :disabled="spinning" @click="$emit('generate')">Generate Idea<AppIcon /></button>
      <span class="copy-status" role="status">{{ copied ? 'Idea copied to clipboard.' : copyError }}</span>
    </div>
    <dialog ref="ideaDialog" class="info-dialog idea-dialog" aria-labelledby="idea-heading" @click="event => { if (event.target === ideaDialog) ideaDialog?.close() }">
      <div class="dialog-content">
        <div class="dialog-top"><span class="eyebrow">A little direction</span><button class="circle-button" aria-label="Close idea" @click="ideaDialog?.close()"><AppIcon name="close" /></button></div>
        <h2 id="idea-heading">{{ type }} <span class="multiply">×</span> {{ topic }}</h2>
        <p class="expanded-idea" aria-live="polite">{{ idea }}</p>
        <p class="idea-footnote">Start small. Make it yours.</p>
        <button class="spin-link" :disabled="spinning" @click="$emit('generate')">another direction<AppIcon name="refresh" /></button>
      </div>
    </dialog>
  </section>
</template>
