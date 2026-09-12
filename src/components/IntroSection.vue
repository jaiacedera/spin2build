<script setup lang="ts">
import AppIcon from './AppIcon.vue'
withDefaults(defineProps<{
  spinning: boolean
  totalSpins?: number | null
  totalVisits?: number | null
  statsLoading?: boolean
}>(), { totalSpins: null, totalVisits: null, statsLoading: false })
defineEmits<{ spin: [] }>()
const numberFormat = new Intl.NumberFormat('en-US')
const formatTotal = (total: number | null) => total === null ? '—' : numberFormat.format(total)
</script>

<template>
  <section class="intro" aria-labelledby="intro-heading">
    <div class="intro-marker"><span class="section-number">01</span><span class="vertical-rule" /></div>
    <h1 id="intro-heading">stuck<br>on what<br>to build?</h1>
    <p class="intro-copy">Two spins.<br>Infinite possibilities.<br>A simple project idea generator<br class="desktop-break"> for developers, creators, and<br class="desktop-break"> curious minds.</p>
    <button class="spin-link" :disabled="spinning" @click="$emit('spin')">{{ spinning ? 'spinning' : 'spin now' }}<AppIcon :name="spinning ? 'refresh' : 'arrow'" :class="{ rotating: spinning }" /></button>
    <dl class="intro-stats" aria-label="Website statistics. Counts may be delayed." title="Counts may be delayed while new activity is processed." :aria-busy="statsLoading">
      <div>
        <dt>SPINS GENERATED</dt>
        <dd :aria-label="totalSpins === null ? 'Not available' : undefined">{{ formatTotal(totalSpins) }}</dd>
      </div>
      <div>
        <dt>WEBSITE VISITS</dt>
        <dd :aria-label="totalVisits === null ? 'Not available' : undefined">{{ formatTotal(totalVisits) }}</dd>
      </div>
    </dl>
  </section>
</template>

<style scoped>
.intro-stats {
  display: grid;
  gap: 14px;
  margin: 18px 0 0;
  text-align: left;
}

.intro-stats > div {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.intro-stats dt {
  color: #8c8c8c;
  font-size: 9px;
  line-height: 1.3;
  letter-spacing: 1.5px;
}

.intro-stats dd {
  order: -1;
  margin: 0;
  color: #fff;
  font-size: 24px;
  font-weight: 500;
  line-height: 1;
  letter-spacing: -0.5px;
  font-variant-numeric: tabular-nums;
}

@media (max-width: 900px) {
  .intro-stats {
    grid-column: 1 / -1;
    grid-row: 4;
    display: flex;
    flex-wrap: wrap;
    gap: 12px 28px;
    margin-top: 10px;
  }

  .intro-stats dd {
    font-size: 20px;
  }

  .intro-stats dt {
    font-size: 8px;
    letter-spacing: 1px;
  }
}

@media (max-width: 600px) and (max-height: 700px) {
  .intro-stats {
    grid-row: 2;
  }
}
</style>
