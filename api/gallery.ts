import type { IncomingMessage, ServerResponse } from 'node:http'
import { insertPublished, listApproved } from '../server/galleryStore.ts'
import { SubmissionError, validateSubmission } from '../server/galleryValidation.ts'
import { clientIdentity, consumeUsage, UsageLimitError } from '../server/usageLimits.ts'
import { galleryFilters, type GalleryFilter } from '../src/types/galleryPage.ts'

const maxBodyBytes = 32768

async function readBody(request: IncomingMessage & { body?: unknown }): Promise<unknown> {
  if (request.body !== undefined) {
    if (Buffer.byteLength(typeof request.body === 'string' ? request.body : JSON.stringify(request.body), 'utf8') > maxBodyBytes) throw new SubmissionError('Submission is too large (maximum 32 KB).')
    return typeof request.body === 'string' ? JSON.parse(request.body) : request.body
  }
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += buffer.length
    if (size > maxBodyBytes) throw new SubmissionError('Submission is too large (maximum 32 KB).')
    chunks.push(buffer)
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

export default async function handler(request: IncomingMessage, response: ServerResponse) {
  response.setHeader('Content-Type', 'application/json; charset=utf-8')
  response.setHeader('Cache-Control', 'no-store')
  response.setHeader('X-Content-Type-Options', 'nosniff')
  function send(status: number, body: unknown) { response.statusCode = status; response.end(JSON.stringify(body)) }
  if (request.method !== 'GET' && request.method !== 'POST') {
    response.setHeader('Allow', 'GET, POST')
    send(405, { error: 'Method not allowed.' }); return
  }
  try {
    if (request.method === 'GET') {
      const params = new URL(request.url || '/api/gallery', 'http://localhost').searchParams
      const page = params.get('page') || '0'
      const search = (params.get('search') || '').trim()
      const filter = (params.get('filter') || 'All') as GalleryFilter
      if ([...params.keys()].some(key => !['page', 'search', 'filter', 'fresh'].includes(key)) ||
        [...new Set(params.keys())].some(key => params.getAll(key).length !== 1) ||
        !/^(0|[1-9]\d{0,3})$/.test(page) || Number(page) > 1000 || search.length > 80 ||
        !galleryFilters.includes(filter) || (params.has('fresh') && params.get('fresh') !== '1')) {
        send(400, { error: 'Invalid gallery query.' }); return
      }
      await consumeUsage('gallery-read', clientIdentity(request))
      const projects = await listApproved({ page: Number(page), search, filter })
      if (!params.has('fresh')) response.setHeader('Cache-Control', 'public, max-age=0, s-maxage=30')
      send(200, { projects: projects.slice(0, 24), hasMore: projects.length > 24 && Number(page) < 1000 }); return
    }
    const length = request.headers['content-length']
    if (length && (!/^\d+$/.test(String(length)) || Number(length) > maxBodyBytes)) {
      send(413, { error: 'Submission is too large (maximum 32 KB).' }); return
    }
    if (!request.headers['content-type']?.startsWith('application/json')) {
      send(415, { error: 'Send the submission as JSON.' }); return
    }
    const identity = clientIdentity(request)
    await consumeUsage('gallery-write', identity)
    const project = validateSubmission(await readBody(request))
    await consumeUsage('gallery-publish', identity)
    const status = await insertPublished(project)
    if (status !== 'approved') {
      send(409, { error: 'This submission already exists but is not published. Please contact the site owner.' }); return
    }
    send(201, { id: project.id, status })
  } catch (error) {
    if (error instanceof UsageLimitError) {
      response.setHeader('Retry-After', String(error.retryAfter))
      send(429, { error: `Usage limit reached. Please try again in ${Math.ceil(error.retryAfter / 60)} minute(s).`, retryAfter: error.retryAfter })
    } else if (error instanceof SubmissionError || error instanceof SyntaxError) {
      send(400, { error: error instanceof SyntaxError ? 'Invalid JSON submission.' : error.message })
    } else {
      response.setHeader('Retry-After', '60')
      send(503, { error: 'The gallery is temporarily unavailable. Please try again shortly.' })
    }
  }
}
