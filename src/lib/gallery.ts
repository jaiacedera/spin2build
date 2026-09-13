import type { GallerySubmission } from '../types/gallery'
import type { GalleryPageResult, GalleryQuery } from '../types/galleryPage'

export async function fetchGallery(signal?: AbortSignal, query: GalleryQuery = { page: 0, search: '', filter: 'All' }, fresh = false): Promise<GalleryPageResult> {
  const params = new URLSearchParams()
  if (query.page) params.set('page', String(query.page))
  if (query.search) params.set('search', query.search)
  if (query.filter !== 'All') params.set('filter', query.filter)
  if (fresh) params.set('fresh', '1')
  const response = await fetch(`/api/gallery${params.size ? `?${params}` : ''}`, { signal })
  if (!response.ok) {
    if (response.status === 429) throw new Error('You’re loading the gallery too quickly. Please wait a minute and try again.')
    throw new Error('The gallery could not be loaded. Please try again.')
  }
  const data = await response.json() as GalleryPageResult
  return { projects: data.projects.filter(project => project.status === 'approved').slice(0, 24), hasMore: data.hasMore === true }
}

let submitAfter = 0

export async function submitGallery(project: GallerySubmission): Promise<void> {
  if (Date.now() < submitAfter) throw new Error(`Please wait ${Math.ceil((submitAfter - Date.now()) / 60000)} minute(s) before submitting again.`)
  const response = await fetch('/api/gallery', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(project),
    signal: AbortSignal.timeout(30000),
  })
  const result = await response.json() as { error?: string; status?: string }
  if (response.status === 429 || response.status === 503) {
    const seconds = Number(response.headers.get('Retry-After')) || 60
    submitAfter = Date.now() + Math.min(86400, Math.max(1, seconds)) * 1000
  }
  if (!response.ok || result.status !== 'approved') throw new Error(result.error ?? 'Submission could not be published. Please try again.')
}
