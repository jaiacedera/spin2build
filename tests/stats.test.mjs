import assert from 'node:assert/strict'
import { test } from 'node:test'
import { randomUUID } from 'node:crypto'
import { JWT } from 'google-auth-library'

let moduleId = 0
async function freshHandler() {
  return (await import(`../api/stats.ts?test=${++moduleId}`)).default
}
async function invoke(handler, method = 'GET') {
  const headers = {}
  const response = {
    statusCode: 0,
    setHeader(name, value) { headers[name] = value },
    end(body) { this.body = body ? JSON.parse(body) : undefined },
  }
  await handler({ method }, response)
  return { ...response, headers }
}
function configure(t) {
  const values = { GALLERY_LOCAL_DIR: 'stats-test-' + randomUUID(), GA_PROPERTY_ID: '553743552', GA_CLIENT_EMAIL: 'test@example.com', GA_PRIVATE_KEY: 'test-key' }
  for (const [key, value] of Object.entries(values)) {
    const previous = process.env[key]
    process.env[key] = value
    t.after(() => { if (previous === undefined) delete process.env[key]; else process.env[key] = previous })
  }
}
function reports(spins, visits) {
  return { data: { reports: [
    { metricHeaders: [{ name: 'eventCount' }], rows: [{ metricValues: [{ value: spins }] }] },
    { metricHeaders: [{ name: 'sessions' }], rows: [{ metricValues: [{ value: visits }] }] },
  ] } }
}

test('rejects writes and missing credentials without querying Google', async t => {
  configure(t)
  delete process.env.GA_PRIVATE_KEY
  const request = t.mock.method(JWT.prototype, 'request', () => { throw new Error('Must not query') })
  const handler = await freshHandler()
  assert.equal((await invoke(handler, 'POST')).statusCode, 405)
  const result = await invoke(handler)
  assert.equal(result.statusCode, 503)
  assert.equal(result.headers['Cache-Control'], 'no-store')
  assert.deepEqual(result.body, { error: 'Statistics unavailable' })
  assert.equal(request.mock.callCount(), 0)
})

test('queries completed spins and sessions, shares requests, and caches results', async t => {
  configure(t)
  const request = t.mock.method(JWT.prototype, 'request', async options => {
    assert.match(options.url, /properties\/553743552:batchRunReports$/)
    const [spins, visits] = options.data.requests
    assert.equal(spins.dimensionFilter.filter.stringFilter.value, 'spin_generated')
    assert.deepEqual(spins.metrics, [{ name: 'eventCount' }])
    assert.deepEqual(visits.metrics, [{ name: 'sessions' }])
    assert.equal(visits.dimensionFilter, undefined)
    return reports('12482', '3741')
  })
  const handler = await freshHandler()
  const results = await Promise.all([invoke(handler), invoke(handler)])
  for (const result of results) {
    assert.equal(result.statusCode, 200)
    assert.deepEqual(result.body, { totalSpins: 12482, totalVisits: 3741 })
  }
  assert.equal((await invoke(handler, 'HEAD')).body, undefined)
  assert.equal(request.mock.callCount(), 1)
})

test('empty reports represent confirmed zero counts', async t => {
  configure(t)
  t.mock.method(JWT.prototype, 'request', async () => ({ data: { reports: [
    { metricHeaders: [{ name: 'eventCount' }] },
    { metricHeaders: [{ name: 'sessions' }], rows: [] },
  ] } }))
  assert.deepEqual((await invoke(await freshHandler())).body, { totalSpins: 0, totalVisits: 0 })
})

test('CDN caching uses the remaining report lifetime and expired reports are fetched again', async t => {
  configure(t)
  let now = 1_000_000
  t.mock.method(Date, 'now', () => now)
  const request = t.mock.method(JWT.prototype, 'request', async () => reports('1', '2'))
  const handler = await freshHandler()
  assert.equal((await invoke(handler)).headers['Cache-Control'], 'public, max-age=0, s-maxage=300')
  now += 240_000
  assert.equal((await invoke(handler)).headers['Cache-Control'], 'public, max-age=0, s-maxage=60')
  assert.equal(request.mock.callCount(), 1)
  now += 60_000
  await invoke(handler)
  assert.equal(request.mock.callCount(), 2)
})

test('failed and malformed reports never become fabricated zero totals or leak errors', async t => {
  configure(t)
  const responses = [
    () => { throw new Error('private credential details') },
    () => ({ data: {} }),
    () => reports('-1', '2'),
    () => reports('3', 'NaN'),
    () => reports('9007199254740992', '2'),
    () => reports('4', '7'),
  ]
  const request = t.mock.method(JWT.prototype, 'request', async () => responses.shift()())
  const handler = await freshHandler()
  for (let i = 0; i < 5; i++) {
    const result = await invoke(handler)
    assert.equal(result.statusCode, 503)
    assert.deepEqual(result.body, { error: 'Statistics unavailable' })
  }
  assert.deepEqual((await invoke(handler)).body, { totalSpins: 4, totalVisits: 7 })
  assert.equal(request.mock.callCount(), 6)
})


test('shared report budget blocks Google calls and returns Retry-After', async t => {
  configure(t)
  const previous = { GALLERY_SUPABASE_URL: process.env.GALLERY_SUPABASE_URL, GALLERY_SUPABASE_SERVICE_KEY: process.env.GALLERY_SUPABASE_SERVICE_KEY }
  process.env.GALLERY_SUPABASE_URL = 'https://test.supabase.co'
  process.env.GALLERY_SUPABASE_SERVICE_KEY = 'server-key'
  t.after(() => { for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete process.env[key]; else process.env[key] = value } })
  t.mock.method(globalThis, 'fetch', async (_, options) => {
    const report = JSON.parse(options.body).p_policy === 'stats-report'
    return Response.json({ allowed: !report, retry_after: report ? 600 : 0 })
  })
  const google = t.mock.method(JWT.prototype, 'request', async () => { throw new Error('Must not query') })
  const result = await invoke(await freshHandler())
  assert.equal(result.statusCode, 429)
  assert.equal(result.headers['Retry-After'], '600')
  assert.equal(google.mock.callCount(), 0)
})
