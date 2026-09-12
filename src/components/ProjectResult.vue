<script setup lang="ts">
import IdeaDialog from './IdeaDialog.vue'
import type { Direction } from '../data/ideas'
import AppIcon from './AppIcon.vue'
defineProps<{ type: string; topic: string; sentence: string; idea: Direction | null; spinning: boolean; copied: boolean; copyError: string }>()
defineEmits<{ spin: []; copy: []; generate: [] }>()
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
    <IdeaDialog :idea="idea" @regenerate="$emit('generate')" />
  </section>
</template>
