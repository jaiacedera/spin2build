import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createRenderer, h } from 'vue'
import { useSiteStats } from '../src/composables/useSiteStats.ts'

const flush = () => new Promise(resolve => setImmediate(resolve))
const response = (totalSpins, totalVisits = 2) => Response.json({ totalSpins, totalVisits })

function mountStats(t) {
  const page = new EventTarget()
  page.visibilityState = 'visible'
  const windowEvents = new EventTarget()
  const restoreGlobals = []
  for (const [key, value] of Object.entries({ document: page, window: windowEvents })) {
    const previous = Object.getOwnPropertyDescriptor(globalThis, key)
    Object.defineProperty(globalThis, key, { configurable: true, value })
    restoreGlobals.push(() => {
      if (previous) Object.defineProperty(globalThis, key, previous)
      else delete globalThis[key]
    })
  }
  // Vue's custom renderer exercises real mount/unmount hooks without a DOM dependency.
  const renderer = createRenderer({
    createElement: () => ({}), createText: () => ({}), createComment: () => ({}),
    insert() {}, remove() {}, setText() {}, setElementText() {}, patchProp() {},
    parentNode: () => null, nextSibling: () => null,
  })
  let stats
  const app = renderer.createApp({ setup() { stats = useSiteStats(); return () => h('div') } })
  app.mount({})
  let mounted = true
  const unmount = () => { if (mounted) { mounted = false; app.unmount() } }
  t.after(() => { unmount(); restoreGlobals.forEach(restore => restore()) })
  return { stats, page, windowEvents, unmount }
}

test('refreshes on a timer and tab return, retains data on failure, and stops on unmount', async t => {
  t.mock.timers.enable({ apis: ['setInterval', 'Date'], now: 1000000 })
  let total = 1
  let failed = false
  const fetch = t.mock.method(globalThis, 'fetch', async () => failed
    ? new Response('unavailable', { status: 503 }) : response(total))
  const { stats, page, windowEvents, unmount } = mountStats(t)
  await flush()
  assert.equal(stats.totalSpins.value, 1)
  total = 4
  t.mock.timers.tick(300_000)
  await flush()
  assert.equal(stats.totalSpins.value, 4)
  page.visibilityState = 'hidden'
  t.mock.timers.tick(300_000)
  await flush()
  assert.equal(fetch.mock.callCount(), 2)
  total = 5
  page.visibilityState = 'visible'
  page.dispatchEvent(new Event('visibilitychange'))
  windowEvents.dispatchEvent(new Event('focus'))
  await flush()
  assert.equal(stats.totalSpins.value, 5)
  assert.equal(fetch.mock.callCount(), 3, 'focus must not duplicate an in-flight refresh')
  failed = true
  t.mock.timers.tick(300_000)
  await flush()
  await stats.refresh()
  assert.equal(stats.totalSpins.value, 5)
  failed = false
  total = 0
  t.mock.timers.tick(60_000)
  await stats.refresh()
  assert.equal(stats.totalSpins.value, 0, 'a confirmed zero must display correctly')
  unmount()
  t.mock.timers.tick(120_000)
  windowEvents.dispatchEvent(new Event('focus'))
  page.dispatchEvent(new Event('visibilitychange'))
  await stats.refresh()
  assert.equal(fetch.mock.callCount(), 5)
})

test('recovers from an initial invalid report on a later refresh', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: 1000000 })
  let valid = false
  t.mock.method(globalThis, 'fetch', async () => valid ? response(3) : response(-1))
  const { stats } = mountStats(t)
  await flush()
  assert.equal(stats.totalSpins.value, null)
  assert.equal(stats.loading.value, false)
  valid = true
  t.mock.timers.tick(60_000)
  await stats.refresh()
  assert.equal(stats.totalSpins.value, 3)
})

test('aborts an in-flight request when the page is unmounted', async t => {
  let requestSignal
  t.mock.method(globalThis, 'fetch', (_, { signal }) => {
    requestSignal = signal
    return new Promise((_, reject) => signal.addEventListener('abort', () => reject(new Error('Aborted'))))
  })
  const { stats, unmount } = mountStats(t)
  unmount()
  await flush()
  assert.equal(requestSignal.aborted, true)
  assert.equal(stats.totalSpins.value, null)
})

test('rapid refreshes and focus events respect the cooldown and Retry-After', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: 1000000 })
  const fetch = t.mock.method(globalThis, 'fetch', async () => new Response('', { status: 429, headers: { 'Retry-After': '600' } }))
  const { stats, windowEvents } = mountStats(t)
  await flush()
  for (let i = 0; i < 20; i++) { await stats.refresh(); windowEvents.dispatchEvent(new Event('focus')) }
  assert.equal(fetch.mock.callCount(), 1)
  t.mock.timers.tick(599000)
  await stats.refresh()
  assert.equal(fetch.mock.callCount(), 1)
  t.mock.timers.tick(1000)
  await stats.refresh()
  assert.equal(fetch.mock.callCount(), 2)
})
