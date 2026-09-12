import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createIdea } from '../src/data/ideas.ts'
import { readBuildHistory, saveBuild } from '../src/lib/buildHistory.ts'

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
  const build = { ...direction, acceptedAt: new Date().toISOString(), completedFeatures: [] }
  saveBuild(build, storage)
  assert.deepEqual(readBuildHistory(storage), [build])
  const updated = { ...build, completedFeatures: [build.features[0]] }
  saveBuild(updated, storage)
  assert.deepEqual(readBuildHistory(storage), [updated])
  assert.deepEqual(direction.features, build.features)
})

test('invalid history and storage failures are surfaced without overwriting existing data', () => {
  let writes = 0
  const storage = { getItem: () => '{broken', setItem: () => { writes++ } }
  const build = { ...createIdea('Website', 'Books', null), acceptedAt: new Date().toISOString(), completedFeatures: [] }
  assert.throws(() => saveBuild(build, storage))
  assert.equal(writes, 0)
  assert.throws(() => saveBuild(build, { getItem: () => null, setItem: () => { throw new Error('quota') } }))
})
