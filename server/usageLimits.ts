import { createHmac } from 'node:crypto'
import { isIP } from 'node:net'
import type { IncomingMessage } from 'node:http'

export const usagePolicies = {
  'gallery-read': [[60, 60], [60, 1200]],
  'gallery-write': [[60, 10], [60, 120]],
  'gallery-publish': [[3600, 3], [86400, 10], [86400, 100]],
  'stats-read': [[60, 60], [60, 1200]],
  'stats-report': [[60, 12], [86400, 500]],
} as const
export type UsagePolicy = keyof typeof usagePolicies

export class UsageLimitError extends Error {
  retryAfter: number
  constructor(retryAfter: number) { super('Usage limit reached. Please try again later.'); this.retryAfter = retryAfter }
}

export function clientIdentity(request: IncomingMessage): string {
  // Vercel overwrites this header. Other hosts use the direct socket address.
  const forwarded = request.headers?.['x-forwarded-for']
  let address = process.env.VERCEL
    ? (typeof forwarded === 'string' ? forwarded.split(',')[0]!.trim() : '')
    : request.socket?.remoteAddress || ''
  address = address.replace(/^::ffff:(?=\d+\.)/i, '')
  if (isIP(address) === 6) {
    const canonical = new URL(`http://[${address}]`).hostname.slice(1, -1)
    const [left, right = ''] = canonical.split('::')
    const first = left ? left.split(':') : []
    const last = right ? right.split(':') : []
    const parts = canonical.includes('::') ? [...first, ...Array(8 - first.length - last.length).fill('0'), ...last] : first
    // Group IPv6 privacy addresses on the same /64 network.
    address = parts.slice(0, 4).map(part => part.padStart(4, '0')).join(':')
  } else if (!isIP(address)) address = 'unknown'
  return createHmac('sha256', process.env.GALLERY_SUPABASE_SERVICE_KEY || 'local-development')
    .update(address).digest('hex')
}

export function createUsageLimiter() {
  const counters = new Map<string, { count: number; expires: number }>()
  return async function consume(policy: UsagePolicy, subject = 'global') {
    const url = process.env.GALLERY_SUPABASE_URL
    const key = process.env.GALLERY_SUPABASE_SERVICE_KEY
    if (url && key) {
      const response = await fetch(`${url.replace(/\/$/, '')}/rest/v1/rpc/check_site_usage`, {
        method: 'POST',
        headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_policy: policy, p_subject: subject }),
        signal: AbortSignal.timeout(5000),
      })
      if (!response.ok) throw new Error('Usage protection unavailable')
      const result = await response.json() as { allowed?: boolean; retry_after?: number }
      if (typeof result.allowed !== 'boolean' || !Number.isInteger(result.retry_after) || result.retry_after! < 0) throw new Error('Invalid usage response')
      if (!result.allowed) throw new UsageLimitError(Math.max(1, result.retry_after!))
      return
    }
    // Never pretend that memory is a shared limiter on serverless production.
    if (process.env.NODE_ENV === 'production' || process.env.VERCEL || url || key) throw new Error('Shared usage protection is not configured')
    const now = Date.now()
    for (const [name, value] of counters) if (value.expires <= now) counters.delete(name)
    const rules = usagePolicies[policy].map(([seconds, limit], index, all) => {
      const global = policy === 'stats-report' || index === all.length - 1
      const name = `${process.env.GALLERY_LOCAL_DIR || ''}:${policy}:${global ? 'global' : subject}:${seconds}`
      const entry = counters.get(name) || { count: 0, expires: (Math.floor(now / (seconds * 1000)) + 1) * seconds * 1000 }
      return { name, entry, limit }
    })
    const wait = Math.max(0, ...rules.filter(rule => rule.entry.count >= rule.limit).map(rule => Math.ceil((rule.entry.expires - now) / 1000)))
    if (wait) throw new UsageLimitError(wait)
    if (counters.size + rules.length > 10000) throw new UsageLimitError(60)
    for (const { name, entry } of rules) { entry.count++; counters.set(name, entry) }
  }
}

export const consumeUsage = createUsageLimiter()
