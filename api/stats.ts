import type { IncomingMessage, ServerResponse } from 'node:http'
import { JWT } from 'google-auth-library'

type Report = {
  rowCount?: number
  rows?: { metricValues?: { value?: string }[] }[]
  metricHeaders?: { name?: string }[]
}
type SiteStats = { totalSpins: number; totalVisits: number }
let cached: { stats: SiteStats; expiresAt: number } | undefined
let pending: Promise<SiteStats> | undefined

function readTotal(report: Report | undefined, metric: string): number {
  if (!report || report.metricHeaders?.[0]?.name !== metric) {
    throw new Error('Invalid Analytics report')
  }
  if (!report.rows?.length) {
    if (report.rowCount) throw new Error('Missing Analytics rows')
    return 0
  }
  const value = report.rows[0]?.metricValues?.[0]?.value
  const total = Number(value)
  if (!value || !/^\d+$/.test(value) || !Number.isSafeInteger(total)) {
    throw new Error('Invalid Analytics total')
  }
  return total
}

async function loadStats(): Promise<SiteStats> {
  const propertyId = process.env.GA_PROPERTY_ID
  const email = process.env.GA_CLIENT_EMAIL
  const key = process.env.GA_PRIVATE_KEY?.replace(/\\n/g, '\n')
  if (!propertyId || !/^\d+$/.test(propertyId) || !email || !key) {
    throw new Error('Missing Analytics configuration')
  }
  const client = new JWT({
    email,
    key,
    scopes: ['https://www.googleapis.com/auth/analytics.readonly'],
  })
  // Query the property's full reporting history, including today's processed data.
  const dateRanges = [{ startDate: '2020-01-01', endDate: 'today' }]
  const { data } = await client.request<{ reports?: Report[] }>({
    url: `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:batchRunReports`,
    method: 'POST',
    timeout: 8000,
    retry: false,
    data: {
      requests: [
        {
          dateRanges,
          metrics: [{ name: 'eventCount' }],
          dimensionFilter: {
            filter: {
              fieldName: 'eventName',
              stringFilter: { matchType: 'EXACT', value: 'spin_generated', caseSensitive: true },
            },
          },
        },
        { dateRanges, metrics: [{ name: 'sessions' }] },
      ],
    },
  })
  return {
    totalSpins: readTotal(data.reports?.[0], 'eventCount'),
    totalVisits: readTotal(data.reports?.[1], 'sessions'),
  }
}

export default async function handler(request: IncomingMessage, response: ServerResponse) {
  response.setHeader('Content-Type', 'application/json; charset=utf-8')
  response.setHeader('Cache-Control', 'no-store')
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.setHeader('Allow', 'GET, HEAD')
    response.statusCode = 405
    response.end(JSON.stringify({ error: 'Method not allowed' }))
    return
  }
  try {
    if (!cached || cached.expiresAt <= Date.now()) {
      // Share an in-flight request to avoid duplicate reports on concurrent visits.
      pending ??= loadStats().then(stats => {
        cached = { stats, expiresAt: Date.now() + 300_000 }
        return stats
      }).finally(() => { pending = undefined })
      await pending
    }
    // Don't restart a full CDN cache window for an already-aged in-memory report.
    const remainingSeconds = Math.max(0, Math.floor((cached!.expiresAt - Date.now()) / 1000))
    response.setHeader('Cache-Control', `public, max-age=0, s-maxage=${remainingSeconds}`)
    response.statusCode = 200
    response.end(request.method === 'HEAD' ? undefined : JSON.stringify(cached!.stats))
  } catch {
    // Never expose credential details or Google's raw error responses publicly.
    response.statusCode = 503
    response.end(request.method === 'HEAD' ? undefined : JSON.stringify({ error: 'Statistics unavailable' }))
  }
}
