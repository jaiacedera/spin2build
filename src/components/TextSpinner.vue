<script setup lang="ts">
import { computed, toRef } from 'vue'
import { useSpinner } from '../composables/useSpinner'
import AppIcon from './AppIcon.vue'

const props = defineProps<{ items: string[]; modelValue: number; label: string; number: string; disabled?: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [value: number] }>()
const { position, moving, wrap, step, spin } = useSpinner(toRef(props, 'modelValue'), () => props.items.length, value => emit('update:modelValue', value))
const rows = computed(() => {
  const center = Math.floor(position.value)
  return Array.from({ length: 7 }, (_, index) => {
    const absolute = center + index - 3
    const distance = absolute - position.value
    const proximity = Math.max(0, 1 - Math.abs(distance))
    const text = props.items[wrap(absolute)] ?? ''
    return {
      key: absolute, text,
      style: {
        transform: `translateY(calc(${distance} * var(--row-height))) scale(${0.67 + proximity * 0.33})`,
        opacity: Math.abs(distance) > 2.5 ? 0 : 0.17 + Math.max(0, 2 - Math.abs(distance)) * 0.1 + proximity * 0.63,
        fontSize: `min(${Math.min(10.8, 137 / (Math.max(text.length, 10) * (0.67 + proximity * 0.33)))}cqw, 16cqh)`,
        fontWeight: 450 + Math.round(proximity * 150),
      },
    }
  })
})
function move(direction: number) { if (!props.disabled) step(direction) }
let wheelTime = 0
function onWheel(event: WheelEvent) {
  if (Math.abs(event.deltaY) < 5 || performance.now() - wheelTime < 260) return
  wheelTime = performance.now()
  move(event.deltaY > 0 ? 1 : -1)
}
let touchStart = 0
function onTouchStart(event: TouchEvent) { touchStart = event.touches[0]?.clientY ?? 0 }
function onTouchEnd(event: TouchEvent) {
  const delta = touchStart - (event.changedTouches[0]?.clientY ?? touchStart)
  if (Math.abs(delta) > 30) move(delta > 0 ? 1 : -1)
}
defineExpose({ spin, next: () => move(1), previous: () => move(-1) })
</script>

<template>
  <section class="text-spinner" :aria-labelledby="`label-${number}`">
    <div class="section-label"><span class="section-number">{{ number }}</span><h2 :id="`label-${number}`">{{ label }}</h2><span class="horizontal-rule" /><span class="item-count">/ {{ String(items.length).padStart(2, '0') }}</span></div>
    <div class="picker" :class="{ 'is-moving': moving }" role="spinbutton" :tabindex="disabled ? -1 : 0" :aria-label="label" :aria-valuemin="1" :aria-valuemax="items.length" :aria-valuenow="modelValue + 1" :aria-valuetext="items[modelValue]" :aria-disabled="disabled" :aria-busy="moving" :aria-describedby="`hint-${number}`" @keydown.up.prevent="move(-1)" @keydown.down.prevent="move(1)" @wheel.prevent="onWheel" @touchstart.passive="onTouchStart" @touchend.passive="onTouchEnd">
      <div class="picker-viewport" aria-hidden="true"><div v-for="row in rows" :key="row.key" class="picker-item" :style="row.style">{{ row.text }}</div></div>
      <button class="picker-arrow previous" :aria-label="`Previous ${label.toLowerCase()}`" :disabled="disabled || moving" @click="move(-1)"><AppIcon /></button>
      <button class="picker-arrow next" :aria-label="`Next ${label.toLowerCase()}`" :disabled="disabled || moving" @click="move(1)"><AppIcon /></button>
    </div>
    <p :id="`hint-${number}`" class="picker-hint">scroll to explore <span>·</span> use ↑ ↓ keys</p>
  </section>
</template>
