import type { Direction } from '../data/ideas'

export interface Build extends Direction {
  acceptedAt: string
  completedFeatures: string[]
}

const key = 'spin2build.build-history.v1'

function isBuild(value: unknown): value is Build {
  if (!value || typeof value !== 'object') return false
  const build = value as Record<string, unknown>
  return ['id', 'projectType', 'topic', 'concept', 'audience', 'coreLoop', 'extraChallenge', 'acceptedAt']
    .every(field => typeof build[field] === 'string') && Number.isInteger(build.variant) &&
    ['features', 'techStack', 'completedFeatures'].every(field =>
      Array.isArray(build[field]) && build[field].every(item => typeof item === 'string'))
}

export function readBuildHistory(storage: Pick<Storage, 'getItem'> = localStorage): Build[] {
  const raw = storage.getItem(key)
  if (!raw) return []
  const parsed: unknown = JSON.parse(raw)
  if (!Array.isArray(parsed) || !parsed.every(isBuild)) throw new Error('Invalid build history')
  return parsed
}

export function saveBuild(build: Build, storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage): Build[] {
  const history = readBuildHistory(storage)
  const index = history.findIndex(entry => entry.id === build.id)
  if (index < 0) history.unshift(build)
  else history[index] = build
  storage.setItem(key, JSON.stringify(history))
  return history
}
