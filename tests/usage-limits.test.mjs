import assert from 'node:assert/strict'
import { test } from 'node:test'
import { clientIdentity, createUsageLimiter, UsageLimitError } from '../server/usageLimits.ts'

function env(t, values) {
  for (const [key, value] of Object.entries(values)) {
    const previous = process.env[key]
    if (value === undefined) delete process.env[key]; else process.env[key] = value
    t.after(() => { if (previous === undefined) delete process.env[key]; else process.env[key] = previous })
  }
}
function local(t) { env(t, { GALLERY_SUPABASE_URL: undefined, GALLERY_SUPABASE_SERVICE_KEY: undefined, VERCEL: undefined, NODE_ENV: 'development' }) }

test('concurrent publication attempts are limited; fixed windows expire', async t => {
  local(t)
  let now = Date.UTC(2026, 8, 13, 0, 0, 0)
  t.mock.method(Date, 'now', () => now)
  const consume = createUsageLimiter()
  const attempts = await Promise.allSettled(Array.from({ length: 20 }, () => consume('gallery-publish', 'one-client')))
  assert.equal(attempts.filter(result => result.status === 'fulfilled').length, 3)
  assert.ok(attempts.filter(result => result.status === 'rejected').every(result => result.reason instanceof UsageLimitError && result.reason.retryAfter === 3600))
  now += 3600000
  await consume('gallery-publish', 'one-client')
})

test('daily client and global budgets survive hourly resets', async t => {
  local(t)
  let now = Date.UTC(2026, 8, 13, 0, 0, 0)
  t.mock.method(Date, 'now', () => now)
  const consume = createUsageLimiter()
  for (let i = 0; i < 10; i++) { await consume('gallery-publish', 'client'); now += 3600000 }
  await assert.rejects(consume('gallery-publish', 'client'), UsageLimitError)
  for (let i = 0; i < 90; i++) await consume('gallery-publish', 'other-' + i)
  await assert.rejects(consume('gallery-publish', 'another'), UsageLimitError)
})

test('only Vercel forwarding is trusted, identities are hashed and IPv6 /64 addresses share limits', t => {
  local(t)
  const request = address => ({ headers: { 'x-forwarded-for': address }, socket: { remoteAddress: '127.0.0.1' } })
  assert.equal(clientIdentity(request('1.2.3.4')), clientIdentity(request('5.6.7.8')))
  env(t, { VERCEL: '1', GALLERY_SUPABASE_SERVICE_KEY: 'server-secret' })
  assert.notEqual(clientIdentity(request('1.2.3.4')), clientIdentity(request('5.6.7.8')))
  assert.match(clientIdentity(request('1.2.3.4')), /^[a-f0-9]{64}$/)
  assert.equal(clientIdentity(request('2001:db8:abcd:1::1')), clientIdentity(request('2001:0db8:abcd:0001:ffff::2')))
  assert.equal(clientIdentity(request('::ffff:1.2.3.4')), clientIdentity(request('1.2.3.4')))
})

test('production fails closed without shared counters; remote denials keep Retry-After', async t => {
  local(t)
  env(t, { VERCEL: '1' })
  await assert.rejects(createUsageLimiter()('gallery-write', 'client'), /not configured/)
  env(t, { GALLERY_SUPABASE_URL: 'https://test.supabase.co', GALLERY_SUPABASE_SERVICE_KEY: 'secret' })
  const fetch = t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.match(url, /rpc\/check_site_usage$/)
    assert.deepEqual(JSON.parse(options.body), { p_policy: 'gallery-write', p_subject: 'client' })
    return Response.json({ allowed: false, retry_after: 42 })
  })
  await assert.rejects(createUsageLimiter()('gallery-write', 'client'), error => error instanceof UsageLimitError && error.retryAfter === 42)
  fetch.mock.mockImplementation(async () => Response.json({ allowed: true }))
  await assert.rejects(createUsageLimiter()('gallery-write', 'client'), /Invalid usage response/)
})
