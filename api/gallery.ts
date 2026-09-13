import type { IncomingMessage, ServerResponse } from 'node:http'
import { insertPending, listApproved } from '../server/galleryStore.ts'
import { SubmissionError, validateSubmission } from '../server/galleryValidation.ts'

async function readBody(request: IncomingMessage & { body?: unknown }): Promise<unknown> {
  if (request.body !== undefined) {
    if (JSON.stringify(request.body).length > 1_500_000) throw new SubmissionError('Submission is too large.')
    return typeof request.body === 'string' ? JSON.parse(request.body) : request.body
  }
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += buffer.length
    if (size > 1_500_000) throw new SubmissionError('Submission is too large.')
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
    if (request.method === 'GET') { send(200, { projects: await listApproved() }); return }
    if (!request.headers['content-type']?.startsWith('application/json')) {
      send(415, { error: 'Send the submission as JSON.' }); return
    }
    const project = validateSubmission(await readBody(request))
    await insertPending(project)
    send(201, { id: project.id, status: 'pending' })
  } catch (error) {
    if (error instanceof SubmissionError || error instanceof SyntaxError) {
      send(400, { error: error instanceof SyntaxError ? 'Invalid JSON submission.' : error.message })
    } else send(503, { error: 'The gallery is temporarily unavailable. Please try again shortly.' })
  }
}
