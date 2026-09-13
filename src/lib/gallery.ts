import type { GalleryProject, GallerySubmission } from '../types/gallery'

export async function fetchGallery(signal?: AbortSignal): Promise<GalleryProject[]> {
  const response = await fetch('/api/gallery', { signal })
  if (!response.ok) throw new Error('The gallery could not be loaded. Please try again.')
  const data = await response.json() as { projects: GalleryProject[] }
  return data.projects.filter(project => project.status === 'approved').sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export async function submitGallery(project: GallerySubmission): Promise<void> {
  const response = await fetch('/api/gallery', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(project),
    signal: AbortSignal.timeout(30000),
  })
  const result = await response.json() as { error?: string; status?: string }
  if (!response.ok || result.status !== 'pending') throw new Error(result.error ?? 'Submission could not be saved. Please try again.')
}
