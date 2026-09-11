import { onBeforeUnmount, ref, watch, type Ref } from 'vue'

export function useSpinner(index: Ref<number>, count: () => number, select: (index: number) => void) {
  const position = ref(index.value)
  const moving = ref(false)
  let frame = 0
  let finish: (() => void) | undefined
  const wrap = (value: number) => ((value % count()) + count()) % count()
  const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

  watch(index, value => { if (!moving.value) position.value = value })

  function animate(destination: number, duration: number, slowFinish = false): Promise<void> {
    cancelAnimationFrame(frame)
    finish?.()
    moving.value = true
    const start = position.value
    const started = performance.now()
    const skipMotion = reduced()
    // Reserve the last 2.4 seconds for six readable steps, regardless of list length.
    // Both phases meet at the same velocity, so braking never snaps to a new speed.
    const brakingDuration = 2400
    const brakingDistance = 6
    const cruisingDuration = duration - brakingDuration
    const cruisingDistance = destination - start - brakingDistance
    const joinVelocity = 2 * brakingDistance / brakingDuration
    return new Promise(resolve => {
      finish = resolve
      function tick(now: number) {
        const elapsed = now - started
        const progress = skipMotion ? 1 : Math.min(elapsed / duration, 1)
        if (progress < 1) {
          if (slowFinish && elapsed < cruisingDuration) {
            const phase = elapsed / cruisingDuration
            const endSlope = joinVelocity * cruisingDuration / cruisingDistance
            position.value = start + cruisingDistance * ((2 - endSlope) * phase + (endSlope - 1) * phase * phase)
          } else if (slowFinish) {
            const phase = (elapsed - cruisingDuration) / brakingDuration
            position.value = destination - brakingDistance * Math.pow(1 - phase, 2)
          } else {
            position.value = start + (destination - start) * (1 - Math.pow(1 - progress, 3))
          }
          frame = requestAnimationFrame(tick)
        } else if (!skipMotion && elapsed < duration + 180) {
          position.value = destination + Math.sin((elapsed - duration) / 180 * Math.PI) * 0.055
          frame = requestAnimationFrame(tick)
        } else {
          position.value = wrap(destination)
          select(wrap(destination))
          moving.value = false
          finish = undefined
          resolve()
        }
      }
      frame = requestAnimationFrame(tick)
    })
  }

  function step(direction: number) {
    if (!moving.value) void animate(Math.round(position.value) + direction, 220)
  }

  function spin(target: number, duration = 4000) {
    const start = Math.round(position.value)
    const distance = wrap(target - wrap(start))
    const rounds = Math.max(1, Math.ceil(24 / count()))
    return animate(start + rounds * count() + distance, Math.max(3200, duration), true)
  }

  onBeforeUnmount(() => { cancelAnimationFrame(frame); finish?.() })
  return { position, moving, wrap, step, spin }
}
