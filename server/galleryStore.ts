import { link, mkdir, readFile, readdir, unlink, writeFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { resolve, join } from 'node:path'
import type { GalleryProject } from '../src/types/gallery.ts'

function localDirectory() {
  if (process.env.GALLERY_LOCAL_DIR) return resolve(process.env.GALLERY_LOCAL_DIR)
  if (process.env.NODE_ENV === 'production' || process.env.VERCEL) throw new Error('Gallery storage is not configured')
  return resolve('.gallery-data.local')
}

async function database(path: string, init?: RequestInit) {
  const url = process.env.GALLERY_SUPABASE_URL
  const key = process.env.GALLERY_SUPABASE_SERVICE_KEY
  if (!url || !key) throw new Error('Gallery database is not configured')
  const response = await fetch(`${url.replace(/\/$/, '')}/rest/v1/gallery_projects${path}`, {
    ...init,
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...init?.headers },
    signal: AbortSignal.timeout(15000),
  })
  if (!response.ok) throw new Error('Gallery database request failed')
  return response
}

export async function listApproved(): Promise<GalleryProject[]> {
  let projects: GalleryProject[]
  if (process.env.GALLERY_SUPABASE_URL) {
    // Page through the public collection so database response limits don't silently hide builds.
    projects = []
    for (let offset = 0; ; offset += 100) {
      const response = await database(`?status=eq.approved&select=project,status,created_at&order=created_at.desc,id.desc&limit=100&offset=${offset}`)
      const rows = await response.json() as { project: GalleryProject; status: GalleryProject['status']; created_at: string }[]
      projects.push(...rows.map(row => ({ ...row.project, status: row.status, createdAt: row.created_at })))
      if (rows.length < 100) break
    }
  } else {
    const directory = localDirectory()
    await mkdir(directory, { recursive: true })
    const names = (await readdir(directory)).filter(name => /^[\da-f-]{36}\.json$/i.test(name))
    projects = await Promise.all(names.map(async name => JSON.parse(await readFile(join(directory, name), 'utf8')) as GalleryProject))
  }
  return projects.filter(project => project.status === 'approved').sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export async function insertPublished(project: GalleryProject): Promise<GalleryProject['status']> {
  if (process.env.GALLERY_SUPABASE_URL) {
    const response = await database('?on_conflict=id&select=status', {
      method: 'POST', headers: { Prefer: 'resolution=ignore-duplicates,return=representation' },
      body: JSON.stringify({ id: project.id, status: 'approved', created_at: project.createdAt, project }),
    })
    let rows = await response.json() as { status: GalleryProject['status'] }[]
    if (!rows.length) {
      const existing = await database(`?id=eq.${encodeURIComponent(project.id)}&select=status`)
      rows = await existing.json() as typeof rows
    }
    if (!rows[0] || !['approved', 'pending', 'rejected'].includes(rows[0].status)) throw new Error('Submission status unavailable')
    return rows[0].status
  }
  const directory = localDirectory()
  await mkdir(directory, { recursive: true })
  const temporary = join(directory, `${randomUUID()}.tmp`)
  await writeFile(temporary, JSON.stringify(project, null, 2), { flag: 'wx' })
  try {
    // Publish the complete file atomically, without replacing an existing submission.
    await link(temporary, join(directory, `${project.id}.json`))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
    const existing = JSON.parse(await readFile(join(directory, `${project.id}.json`), 'utf8')) as GalleryProject
    return existing.status
  } finally { await unlink(temporary) }
  return project.status
}
