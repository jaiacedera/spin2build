import type { GalleryProject } from '../src/types/gallery.ts'

export class SubmissionError extends Error {}

export function validateSubmission(input: unknown): GalleryProject {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new SubmissionError('Invalid submission.')
  const value = input as Record<string, unknown>
  function field(name: string, max: number, required = true): string {
    const raw = value[name]
    if (!required && (raw === undefined || raw === '')) return ''
    if (typeof raw !== 'string' || raw.trim().length > max || (required && !raw.trim())) {
      throw new SubmissionError(`Please check ${name} (maximum ${max} characters).`)
    }
    return raw.trim()
  }
  function link(name: string): string {
    const raw = field(name, 500, false)
    if (!raw) return ''
    try {
      const url = new URL(raw)
      if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new Error()
      if (name === 'githubUrl' && url.hostname !== 'github.com' && url.hostname !== 'www.github.com') throw new Error()
      return url.href
    } catch { throw new SubmissionError(`Please enter a valid ${name === 'githubUrl' ? 'GitHub' : 'HTTP or HTTPS'} URL.`) }
  }
  const id = field('id', 36)
  if (!/^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i.test(id)) throw new SubmissionError('Invalid submission ID.')
  if (value.source !== 'spin2build' && value.source !== 'original') throw new SubmissionError('Choose a project source.')
  if (value.buildStatus !== 'completed' && value.buildStatus !== 'in-progress') throw new SubmissionError('Choose a build status.')
  if (!Array.isArray(value.techStack) || value.techStack.length < 1 || value.techStack.length > 12 ||
    value.techStack.some(tag => typeof tag !== 'string' || !tag.trim() || tag.trim().length > 40)) {
    throw new SubmissionError('Add between 1 and 12 technologies, up to 40 characters each.')
  }
  const screenshotUrl = field('screenshotUrl', 1_450_000)
  const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(screenshotUrl)
  if (!match) throw new SubmissionError('Upload a PNG, JPEG, or WebP screenshot.')
  const image = Buffer.from(match[2]!, 'base64')
  const validImage = match[1] === 'png' ? image.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))
    : match[1] === 'jpeg' ? image[0] === 255 && image[1] === 216 && image[2] === 255
    : image.toString('ascii', 0, 4) === 'RIFF' && image.toString('ascii', 8, 12) === 'WEBP'
  if (!validImage || image.length > 1_048_576) throw new SubmissionError('Screenshot must be a valid image under 1 MB.')
  return {
    id, source: value.source, projectName: field('projectName', 80), description: field('description', 240),
    projectType: field('projectType', 80), topic: field('topic', 80),
    techStack: [...new Set((value.techStack as string[]).map(tag => tag.trim()))],
    builderName: field('builderName', 80), location: field('location', 80, false),
    githubUrl: link('githubUrl'), liveDemoUrl: link('liveDemoUrl'), screenshotUrl,
    problemSolved: field('problemSolved', 1500, false), learned: field('learned', 1500, false),
    ...(value.source === 'spin2build' ? { originalProjectType: field('originalProjectType', 80), originalTopic: field('originalTopic', 80) } : {}),
    buildStatus: value.buildStatus, status: 'pending', featured: false, createdAt: new Date().toISOString(),
  }
}
