<script setup lang="ts">
import type { GalleryProject } from '../types/gallery'
import AppIcon from './AppIcon.vue'
defineProps<{ project: GalleryProject; detail?: boolean; preview?: boolean }>()
defineEmits<{ open: [project: GalleryProject] }>()
</script>

<template>
  <article class="gallery-project" :class="{ 'project-detail': detail }">
    <button v-if="!detail && !preview" class="project-image-link" :aria-label="`View ${project.projectName}`" @click="$emit('open', project)">
      <img :src="project.screenshotUrl" :alt="`${project.projectName} screenshot`" loading="lazy" width="800" height="500" />
      <span class="image-open"><AppIcon /></span>
    </button>
    <img v-else class="project-image" :src="project.screenshotUrl" :alt="`${project.projectName} screenshot`" width="800" height="500" />
    <div class="project-source"><span>{{ project.source === 'spin2build' ? 'SPUN ON SPIN2BUILD' : 'ORIGINAL IDEA' }}</span><span v-if="project.featured">FEATURED</span></div>
    <h3><button v-if="!detail && !preview" @click="$emit('open', project)">{{ project.projectName }}</button><template v-else>{{ project.projectName }}</template></h3>
    <p class="gallery-description">{{ project.description }}</p>
    <p class="project-category">{{ project.projectType }} <span>×</span> {{ project.topic }}<span v-if="project.buildStatus === 'in-progress'" class="progress-badge">In progress</span></p>
    <ul class="gallery-tags" aria-label="Tech stack"><li v-for="tag in project.techStack" :key="tag">{{ tag }}</li></ul>
    <div class="project-byline"><span>by <strong>{{ project.builderName }}</strong></span><span v-if="project.location">{{ project.location }}</span></div>
    <div v-if="project.githubUrl || project.liveDemoUrl" class="project-links">
      <a v-if="project.githubUrl" :href="project.githubUrl" target="_blank" rel="noopener noreferrer">GitHub <span aria-hidden="true">↗</span></a>
      <a v-if="project.liveDemoUrl" :href="project.liveDemoUrl" target="_blank" rel="noopener noreferrer">Live demo <span aria-hidden="true">↗</span></a>
    </div>
    <div v-if="detail" class="project-story">
      <section v-if="project.source === 'spin2build'"><h4>THE ORIGINAL SPIN</h4><p>{{ project.originalProjectType }} × {{ project.originalTopic }}</p></section>
      <section v-if="project.problemSolved"><h4>THE PROBLEM IT SOLVES</h4><p>{{ project.problemSolved }}</p></section>
      <section v-if="project.learned"><h4>WHAT THE BUILDER LEARNED</h4><p>{{ project.learned }}</p></section>
    </div>
  </article>
</template>
