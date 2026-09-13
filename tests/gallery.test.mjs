import assert from 'node:assert/strict'
import { test } from 'node:test'
import { randomUUID } from 'node:crypto'
import { mkdtemp, readFile, readdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import handler from '../api/gallery.ts'
import { validateSubmission } from '../server/galleryValidation.ts'

const submission = (overrides = {}) => ({ id: randomUUID(), source: 'original', projectName: 'A quiet workspace', description: 'A place to focus.', projectType: 'Website', topic: 'Productivity', techStack: ['Vue', 'TypeScript'], builderName: 'Curious Builder', liveDemoUrl: 'https://demo.example.com/', buildStatus: 'completed', ...overrides })
async function invoke(method, body, headers = { 'content-type': 'application/json' }, url = '/api/gallery') {
  const response = { statusCode: 0, headers: {}, setHeader(key, value) { this.headers[key] = value }, end(value) { this.body = JSON.parse(value) } }
  await handler({ method, body, headers, url }, response)
  return response
}
async function localStore(t) {
  const directory = await mkdtemp(join(tmpdir(), 's2b-gallery-'))
  const previous = { GALLERY_LOCAL_DIR: process.env.GALLERY_LOCAL_DIR, GALLERY_SUPABASE_URL: process.env.GALLERY_SUPABASE_URL }
  process.env.GALLERY_LOCAL_DIR = directory
  delete process.env.GALLERY_SUPABASE_URL
  t.after(async () => { for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete process.env[key]; else process.env[key] = value }; await rm(directory, { recursive: true }) })
  return directory
}

test('anonymous submissions publish immediately with server-controlled fields and survive duplicate retries', async t => {
  const directory = await localStore(t)
  const input = submission({ status: 'pending', featured: true, createdAt: '2000-01-01' })
  assert.equal((await invoke('POST', input)).statusCode, 201)
  const stored = JSON.parse(await readFile(join(directory, `${input.id}.json`), 'utf8'))
  assert.equal(stored.status, 'approved')
  assert.equal(stored.featured, false)
  assert.notEqual(stored.createdAt, input.createdAt)
  assert.deepEqual((await invoke('GET')).body.projects.map(project => project.id), [input.id])
  await invoke('POST', { ...input, projectName: 'Overwrite attempt' })
  assert.equal((await readdir(directory)).length, 1)
  assert.equal(JSON.parse(await readFile(join(directory, `${input.id}.json`), 'utf8')).projectName, input.projectName)
})

test('public API returns only approved submissions newest first, with no public moderation endpoint', async t => {
  const directory = await localStore(t)
  for (const [status, createdAt] of [['pending', '2026-09-12'], ['rejected', '2026-09-11'], ['approved', '2026-09-09'], ['approved', '2026-09-10']]) {
    const project = { ...validateSubmission(submission()), status, createdAt }
    await writeFile(join(directory, `${project.id}.json`), JSON.stringify(project))
  }
  const response = await invoke('GET')
  assert.equal(response.statusCode, 200)
  assert.deepEqual(response.body.projects.map(project => project.createdAt), ['2026-09-10', '2026-09-09'])
  assert.equal((await invoke('PATCH', { status: 'approved' })).statusCode, 405)
})

test('validation rejects missing requirements, unsafe URLs and incomplete original spins', () => {
  for (const field of ['projectName', 'description', 'projectType', 'topic', 'builderName', 'liveDemoUrl']) assert.throws(() => validateSubmission(submission({ [field]: '' })))
  assert.throws(() => validateSubmission(submission({ liveDemoUrl: 'javascript:alert(1)' })))
  assert.throws(() => validateSubmission(submission({ githubUrl: 'https://example.com' })))
  for (const liveDemoUrl of ['http://example.com', 'data:text/html,hello', 'https://user:password@example.com']) {
    assert.throws(() => validateSubmission(submission({ liveDemoUrl })))
  }
  const project = validateSubmission(submission({ screenshotUrl: 'legacy image' }))
  assert.equal(project.liveDemoUrl, 'https://demo.example.com/')
  assert.equal('screenshotUrl' in project, false)
  assert.throws(() => validateSubmission(submission({ source: 'spin2build' })))
  assert.throws(() => validateSubmission(submission({ techStack: [] })))
  assert.throws(() => validateSubmission(submission({ id: '../anything' })))
  const spun = validateSubmission(submission({ source: 'spin2build', originalProjectType: 'AI Tool', originalTopic: 'Music' }))
  assert.equal(spun.originalProjectType, 'AI Tool')
  assert.equal(spun.originalTopic, 'Music')
  assert.equal(validateSubmission(submission({ source: 'original', originalTopic: 'Stale spin' })).originalTopic, undefined)
})

test('API rejects malformed requests and reports persistence failure rather than success', async t => {
  await localStore(t)
  assert.equal((await invoke('POST', '{invalid')).statusCode, 400)
  assert.equal((await invoke('POST', submission(), { 'content-type': 'text/plain' })).statusCode, 415)
  assert.equal((await invoke('POST', submission({ screenshotUrl: 'x'.repeat(1_500_001) }))).statusCode, 400)
  process.env.GALLERY_SUPABASE_URL = 'https://test.supabase.co'
  const previous = process.env.GALLERY_SUPABASE_SERVICE_KEY
  process.env.GALLERY_SUPABASE_SERVICE_KEY = 'test-server-key'
  t.after(() => { if (previous === undefined) delete process.env.GALLERY_SUPABASE_SERVICE_KEY; else process.env.GALLERY_SUPABASE_SERVICE_KEY = previous })
  t.mock.method(globalThis, 'fetch', async () => new Response('unavailable', { status: 503 }))
  assert.equal((await invoke('POST', submission())).statusCode, 503)
})

test('database adapter queries approved rows and publishes with server-only credentials', async t => {
  await localStore(t)
  process.env.GALLERY_SUPABASE_URL = 'https://test.supabase.co'
  const previous = process.env.GALLERY_SUPABASE_SERVICE_KEY
  process.env.GALLERY_SUPABASE_SERVICE_KEY = 'test-server-key'
  t.after(() => { if (previous === undefined) delete process.env.GALLERY_SUPABASE_SERVICE_KEY; else process.env.GALLERY_SUPABASE_SERVICE_KEY = previous })
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    if (url.endsWith('/rpc/check_site_usage')) return Response.json({ allowed: true, retry_after: 0 })
    assert.equal(init.headers.apikey, 'test-server-key')
    if (url.includes('/gallery_projects?') && init.method === 'POST') {
      assert.equal(JSON.parse(init.body).status, 'approved')
      assert.equal(JSON.parse(init.body).project.status, 'approved')
      assert.match(init.headers.Prefer, /ignore-duplicates/)
      return Response.json([{ status: 'approved' }], { status: 201 })
    }
    assert.match(url, /rpc\/gallery_page$/)
    assert.deepEqual(JSON.parse(init.body), { p_page: 0, p_search: '', p_filter: 'All' })
    return Response.json([{ status: 'approved', created_at: '2026-09-12', project: validateSubmission(submission()) }])
  })
  assert.equal((await invoke('POST', submission())).statusCode, 201)
  assert.equal((await invoke('GET')).body.projects[0].status, 'approved')
})


test('retrying an existing hidden build does not republish it or report publication', async t => {
  const directory = await localStore(t)
  for (const status of ['pending', 'rejected']) {
    const input = submission()
    const existing = { ...validateSubmission(input), status }
    await writeFile(join(directory, input.id + '.json'), JSON.stringify(existing))
    const response = await invoke('POST', input)
    assert.equal(response.statusCode, 409)
    assert.match(response.body.error, /not published/)
    assert.equal(JSON.parse(await readFile(join(directory, input.id + '.json'), 'utf8')).status, status)
  }
  assert.deepEqual((await invoke('GET')).body.projects, [])
})

test('database duplicate retry returns the stored status without overwriting the row', async t => {
  await localStore(t)
  const previous = process.env.GALLERY_SUPABASE_SERVICE_KEY
  process.env.GALLERY_SUPABASE_URL = 'https://test.supabase.co'
  process.env.GALLERY_SUPABASE_SERVICE_KEY = 'test-server-key'
  t.after(() => { if (previous === undefined) delete process.env.GALLERY_SUPABASE_SERVICE_KEY; else process.env.GALLERY_SUPABASE_SERVICE_KEY = previous })
  let status = 'approved'
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    if (url.endsWith('/rpc/check_site_usage')) return Response.json({ allowed: true, retry_after: 0 })
    if (init.method === 'POST') {
      assert.match(init.headers.Prefer, /ignore-duplicates/)
      return Response.json([])
    }
    assert.match(url, /id=eq./)
    return Response.json([{ status }])
  })
  assert.equal((await invoke('POST', submission())).body.status, 'approved')
  status = 'rejected'
  assert.equal((await invoke('POST', submission())).statusCode, 409)
})

test('publication quota returns 429 with retry timing and does not save excess builds', async t => {
  const directory = await localStore(t)
  for (let i = 0; i < 3; i++) assert.equal((await invoke('POST', submission())).statusCode, 201)
  const denied = await invoke('POST', submission())
  assert.equal(denied.statusCode, 429)
  assert.ok(Number(denied.headers['Retry-After']) > 0)
  assert.equal(denied.headers['Cache-Control'], 'no-store')
  assert.equal((await readdir(directory)).length, 3)
})

test('body limits count UTF-8 bytes and reject large declared bodies before storage', async t => {
  const directory = await localStore(t)
  assert.equal((await invoke('POST', submission(), { 'content-type': 'application/json', 'content-length': '32769' })).statusCode, 413)
  assert.equal((await invoke('POST', { ...submission(), extra: '😀'.repeat(9000) })).statusCode, 400)
  assert.equal((await readdir(directory)).length, 0)
})

test('gallery pages are bounded, searchable beyond the first page and cached only for ordinary reads', async t => {
  const directory = await localStore(t)
  for (let i = 1; i <= 30; i++) {
    const project = { ...validateSubmission(submission({ projectName: `Build ${i}` })), createdAt: new Date(Date.UTC(2026, 8, 13, 0, i)).toISOString() }
    await writeFile(join(directory, project.id + '.json'), JSON.stringify(project))
  }
  const first = await invoke('GET')
  assert.equal(first.body.projects.length, 24)
  assert.equal(first.body.hasMore, true)
  assert.match(first.headers['Cache-Control'], /s-maxage=30/)
  const second = await invoke('GET', undefined, {}, '/api/gallery?page=1')
  assert.equal(second.body.projects.length, 6)
  assert.equal(second.body.hasMore, false)
  assert.equal(new Set([...first.body.projects, ...second.body.projects].map(project => project.id)).size, 30)
  const search = await invoke('GET', undefined, {}, '/api/gallery?search=Build%201&fresh=1')
  assert.ok(search.body.projects.some(project => project.projectName === 'Build 1'))
  assert.equal(search.headers['Cache-Control'], 'no-store')
  for (const query of ['page=1001', 'page=-1', 'page=1&page=2', 'filter=Anything', 'random=1']) {
    assert.equal((await invoke('GET', undefined, {}, '/api/gallery?' + query)).statusCode, 400)
  }
})
