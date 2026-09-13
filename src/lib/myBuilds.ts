import type { Direction } from '../data/ideas'

export interface Build extends Direction {
  status: 'draft' | 'in-progress' | 'completed'
  acceptedAt: string
  completedFeatures: string[]
}

const key = 'spin2build.build-history.v1'

function isBuild(value: unknown): value is Build {
  if (!value || typeof value !== 'object') return false
  const build = value as Record<string, unknown>
  return (build.status === undefined || ['draft', 'in-progress', 'completed'].includes(String(build.status))) && ['id', 'projectType', 'topic', 'concept', 'audience', 'coreLoop', 'extraChallenge', 'acceptedAt']
    .every(field => typeof build[field] === 'string') && Number.isInteger(build.variant) &&
    ['features', 'techStack', 'completedFeatures'].every(field =>
      Array.isArray(build[field]) && build[field].every(item => typeof item === 'string'))
}

export function readBuilds(storage: Pick<Storage, 'getItem'> = localStorage): Build[] {
  const raw = storage.getItem(key)
  if (!raw) return []
  const parsed: unknown = JSON.parse(raw)
  if (!Array.isArray(parsed) || !parsed.every(isBuild)) throw new Error('Invalid build history')
  // Keep the existing key and infer a status for older saves without losing progress.
  return parsed.map(build => ({ ...build, status: build.status ?? (build.completedFeatures.length
    ? build.features.every((feature: string) => build.completedFeatures.includes(feature)) ? 'completed' : 'in-progress'
    : 'draft') })).sort((a, b) => b.acceptedAt.localeCompare(a.acceptedAt))
}

export function saveBuild(build: Build, storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage): Build[] {
  const history = readBuilds(storage)
  const index = history.findIndex(entry => entry.id === build.id)
  if (index < 0) history.unshift(build)
  else history[index] = build
  storage.setItem(key, JSON.stringify(history))
  return history
}

export function saveDraft(direction: Direction, storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage): Build {
  const existing = readBuilds(storage).find(build => build.id === direction.id)
  if (existing) return existing
  const draft: Build = { ...direction, status: 'draft', acceptedAt: new Date().toISOString(), completedFeatures: [] }
  saveBuild(draft, storage)
  return draft
}

export function advanceBuild(id: string, status: Build['status'], storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage): Build[] {
  const build = readBuilds(storage).find(entry => entry.id === id)
  if (!build || !((build.status === 'draft' && status === 'in-progress') || (build.status === 'in-progress' && status === 'completed'))) {
    throw new Error('This build has changed. Refresh My Builds and try again.')
  }
  return saveBuild({ ...build, status }, storage)
}

export function toggleBuildFeature(id: string, feature: string, storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage): Build[] {
  const build = readBuilds(storage).find(entry => entry.id === id)
  if (!build || build.status !== 'in-progress' || !build.features.includes(feature)) throw new Error('Start this build before updating its checklist.')
  return saveBuild({ ...build, completedFeatures: build.completedFeatures.includes(feature)
    ? build.completedFeatures.filter(item => item !== feature) : [...build.completedFeatures, feature] }, storage)
}
