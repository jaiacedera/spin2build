const measurementId = 'G-Z408WTQHSV'

type AnalyticsCommand =
  | ['js', Date]
  | ['config', string]
  | ['event', 'spin_generated', { project_type: string; topic: string }]

declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: (...command: AnalyticsCommand) => void
  }
}

export function initializeAnalytics() {
  // Keep local development activity out of the public site's reports.
  if (!import.meta.env.PROD || window.self !== window.top || document.getElementById('google-analytics')) return

  window.dataLayer = window.dataLayer || []
  window.gtag = function () {
    window.dataLayer?.push(arguments)
  }
  window.gtag('js', new Date())
  window.gtag('config', measurementId)

  const script = document.createElement('script')
  script.id = 'google-analytics'
  script.async = true
  script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`
  document.head.appendChild(script)
}

export function trackGeneratedSpin(projectType: string, topic: string) {
  if (!import.meta.env.PROD || window.self !== window.top) return

  try {
    window.gtag?.('event', 'spin_generated', { project_type: projectType, topic })
  } catch {
    // Tracking must never interrupt the generator if a browser blocks it.
  }
}
