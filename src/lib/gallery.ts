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

export async function readScreenshot(file: File): Promise<string> {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 1_048_576) {
    throw new Error('Choose a PNG, JPG, or WebP image under 1 MB.')
  }
  const data = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('The screenshot could not be read.'))
    reader.readAsDataURL(file)
  })
  const image = new Image()
  image.src = data
  try { await image.decode() } catch { throw new Error('This image could not be opened. Choose another screenshot.') }
  if (!image.naturalWidth || !image.naturalHeight) throw new Error('Choose a valid screenshot.')
  return data
}
