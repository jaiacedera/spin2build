import { onBeforeUnmount, onMounted, ref } from 'vue'

export function useSiteStats() {
  const totalSpins = ref<number | null>(null)
  const totalVisits = ref<number | null>(null)
  const loading = ref(true)
  let controller: AbortController | undefined
  let refreshTimer: ReturnType<typeof setInterval> | undefined
  let disposed = false

  async function refresh() {
    if (disposed || controller) return
    const request = new AbortController()
    controller = request
    const timeout = setTimeout(() => request.abort(), 10_000)
    try {
      const response = await fetch('/api/stats', { signal: request.signal })
      if (!response.ok) throw new Error('Statistics unavailable')
      const stats = await response.json()
      if (!Number.isSafeInteger(stats.totalSpins) || stats.totalSpins < 0
        || !Number.isSafeInteger(stats.totalVisits) || stats.totalVisits < 0) {
        throw new Error('Invalid statistics')
      }
      if (!disposed) {
        totalSpins.value = stats.totalSpins
        totalVisits.value = stats.totalVisits
      }
    } catch {
      // Preserve the last reported totals if a refresh fails.
    } finally {
      clearTimeout(timeout)
      controller = undefined
      loading.value = false
    }
  }

  function refreshWhenVisible() {
    if (document.visibilityState === 'visible') void refresh()
  }

  onMounted(() => {
    void refresh()
    refreshTimer = setInterval(refreshWhenVisible, 60_000)
    document.addEventListener('visibilitychange', refreshWhenVisible)
    window.addEventListener('focus', refreshWhenVisible)
  })

  onBeforeUnmount(() => {
    disposed = true
    controller?.abort()
    clearInterval(refreshTimer)
    document.removeEventListener('visibilitychange', refreshWhenVisible)
    window.removeEventListener('focus', refreshWhenVisible)
  })

  return { totalSpins, totalVisits, loading, refresh }
}
