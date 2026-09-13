import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { usagePolicies } from '../server/usageLimits.ts'

test('PostgreSQL migration enforces shared quotas, denies anonymous access and bounds gallery results', async t => {
  const db = new PGlite()
  t.after(() => db.close())
  await db.exec('create role anon; create role authenticated; create role service_role bypassrls;')
  await db.exec(await readFile(new URL('../server/gallery-schema.sql', import.meta.url), 'utf8'))
  const migration = await readFile(new URL('../server/site-usage.sql', import.meta.url), 'utf8')
  await db.exec(migration)
  await db.exec(migration) // Rerunning does not reset counters or edited limits.
  for (const [policy, rules] of Object.entries(usagePolicies)) {
    const stored = await db.query('select window_seconds, max_requests from public.site_usage_policies where policy=$1 order by scope, window_seconds', [policy])
    assert.deepEqual(stored.rows.map(row => [row.window_seconds, row.max_requests]).sort(), rules.map(rule => [...rule]).sort())
  }
  const consume = async subject => (await db.query('select public.check_site_usage($1,$2) as result', ['gallery-publish', subject])).rows[0].result
  const concurrent = await Promise.all(Array.from({ length: 15 }, () => consume('one-client')))
  assert.equal(concurrent.filter(result => result.allowed).length, 3)
  assert.ok(concurrent.filter(result => !result.allowed).every(result => result.retry_after > 0))
  const counters = await db.query("select requests from public.site_usage_counters where policy='gallery-publish'")
  assert.ok(counters.rows.every(row => row.requests === 3), 'denials must not consume other buckets')
  await db.exec("update public.site_usage_policies set max_requests=4 where policy='gallery-publish' and scope='global'")
  await db.exec(migration)
  assert.equal((await consume('second-client')).allowed, true)
  assert.equal((await consume('third-client')).allowed, false)
  await db.exec("update public.site_usage_counters set expires_at=now()-interval '1 day',window_start=now()-interval '2 days'")
  assert.equal((await consume('one-client')).allowed, true)
  await assert.rejects(db.query('select public.check_site_usage($1,$2)', ['bad-policy', 'x']), /Invalid usage/)
  await db.exec('set role anon')
  await assert.rejects(db.query("select public.check_site_usage('gallery-publish','x')"), /permission denied/)
  await assert.rejects(db.query('select * from public.site_usage_counters'), /permission denied/)
  await assert.rejects(db.query('select * from public.gallery_page()'), /permission denied/)
  await db.exec('reset role')
  await db.exec('set role service_role')
  assert.equal((await db.query("select public.check_site_usage('gallery-read','server-client') as result")).rows[0].result.allowed, true)
  assert.equal((await db.query('select * from public.gallery_page()')).rows.length, 0)
  await db.exec('reset role')

  await db.exec(`insert into public.gallery_projects (id, status, created_at, project)
    select ('00000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid, 'approved', now() - n * interval '1 minute',
      jsonb_build_object('projectName','Build '||n,'source','original','featured',n=26,'screenshotUrl',repeat('x',10000)) from generate_series(1,30) n;`)
  const first = await db.query('select * from public.gallery_page(0)')
  assert.equal(first.rows.length, 25)
  assert.ok(first.rows.every(row => !('screenshotUrl' in row.project)))
  const second = await db.query('select * from public.gallery_page(1)')
  assert.equal(second.rows.length, 6)
  assert.equal(second.rows[0].project.projectName, 'Build 25')
  assert.equal((await db.query("select * from public.gallery_page(0, 'Build 29')")).rows.length, 1)
  assert.equal((await db.query("select * from public.gallery_page(0, '%')")).rows.length, 0)
  assert.equal((await db.query("select * from public.gallery_page(0, '', 'Featured')")).rows[0].project.projectName, 'Build 26')
  await assert.rejects(db.query('select * from public.gallery_page(1001)'), /Invalid gallery/)
})
