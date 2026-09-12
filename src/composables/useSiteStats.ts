import { onBeforeUnmount, onMounted, ref } from 'vue'

export function useSiteStats() {
  const totalSpins = ref<number | null>(null)
  const totalVisits = ref<number | null>(null)
  const loading = ref(true)
  const controller = new AbortController()

  onMounted(async () => {
    const timeout = setTimeout(() => controller.abort(), 10_000)
    try {
      const response = await fetch('/api/stats', { signal: controller.signal })
      if (!response.ok) throw new Error('Statistics unavailable')
      const stats = await response.json()
      if (!Number.isSafeInteger(stats.totalSpins) || stats.totalSpins < 0
        || !Number.isSafeInteger(stats.totalVisits) || stats.totalVisits < 0) {
        throw new Error('Invalid statistics')
      }
      totalSpins.value = stats.totalSpins
      totalVisits.value = stats.totalVisits
    } catch {
      // Keep unknown totals distinct from a confirmed count of zero.
    } finally {
      clearTimeout(timeout)
      loading.value = false
    }
  })

  onBeforeUnmount(() => controller.abort())
  return { totalSpins, totalVisits, loading }
}
