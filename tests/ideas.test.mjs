import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createIdea } from '../src/data/ideas.ts'
import { readBuilds, saveBuild, saveDraft, advanceBuild, toggleBuildFeature } from '../src/lib/myBuilds.ts'

test('regeneration preserves the pairing and changes the complete direction', () => {
  let previous = null
  for (let i = 0; i < 40; i++) {
    const idea = createIdea('AI Tool', 'Productivity Games', previous)
    assert.equal(idea.projectType, 'AI Tool')
    assert.equal(idea.topic, 'Productivity Games')
    assert.notEqual(idea.concept, previous?.concept)
    assert.notEqual(idea.coreLoop, previous?.coreLoop)
    assert.ok(idea.features.length >= 4 && idea.features.length <= 5)
    assert.ok(idea.techStack.includes('OpenAI API'))
    previous = idea
  }
})

test('acceptance stores the exact direction and progress updates without duplicate entries', () => {
  let raw = null
  const storage = { getItem: () => raw, setItem: (_, value) => { raw = value } }
  const direction = createIdea('Desktop App', 'Music', null)
  const build = { ...direction, status: 'draft', acceptedAt: new Date().toISOString(), completedFeatures: [] }
  saveBuild(build, storage)
  assert.deepEqual(readBuilds(storage), [build])
  const updated = { ...build, completedFeatures: [build.features[0]] }
  saveBuild(updated, storage)
  assert.deepEqual(readBuilds(storage), [updated])
  assert.deepEqual(direction.features, build.features)
})

test('invalid history and storage failures are surfaced without overwriting existing data', () => {
  let writes = 0
  const storage = { getItem: () => '{broken', setItem: () => { writes++ } }
  const build = { ...createIdea('Website', 'Books', null), status: 'draft', acceptedAt: new Date().toISOString(), completedFeatures: [] }
  assert.throws(() => saveBuild(build, storage))
  assert.equal(writes, 0)
  assert.throws(() => saveBuild(build, { getItem: () => null, setItem: () => { throw new Error('quota') } }))
})

test('new drafts move through in-progress and completed without duplicate acceptance or lost progress', () => {
  let raw = null
  const storage = { getItem: () => raw, setItem: (_, value) => { raw = value } }
  const idea = createIdea('Website', 'Music', null)
  const draft = saveDraft(idea, storage)
  assert.equal(draft.status, 'draft')
  assert.throws(() => advanceBuild(draft.id, 'completed', storage))
  assert.throws(() => toggleBuildFeature(draft.id, draft.features[0], storage))
  advanceBuild(draft.id, 'in-progress', storage)
  toggleBuildFeature(draft.id, draft.features[0], storage)
  assert.equal(readBuilds(storage)[0].completedFeatures.length, 1)
  advanceBuild(draft.id, 'completed', storage)
  assert.equal(saveDraft(idea, storage).status, 'completed')
  assert.equal(readBuilds(storage).length, 1)
  assert.equal(readBuilds(storage)[0].completedFeatures.length, 1)
  assert.throws(() => advanceBuild(draft.id, 'draft', storage))
})

test('legacy history migrates to local build statuses while preserving every challenge and checklist', () => {
  const idea = createIdea('Desktop App', 'Books', null)
  const legacy = [[], [idea.features[0]], idea.features].map((completedFeatures, index) => ({ ...idea, id: `legacy-${index}`, acceptedAt: `2026-09-${12-index}`, completedFeatures }))
  const raw = JSON.stringify(legacy)
  const migrated = readBuilds({ getItem: () => raw })
  assert.deepEqual(migrated.map(build => build.status), ['draft', 'in-progress', 'completed'])
  assert.deepEqual(migrated.map(build => build.completedFeatures), legacy.map(build => build.completedFeatures))
  assert.deepEqual(migrated.map(build => build.concept), legacy.map(build => build.concept))
})
