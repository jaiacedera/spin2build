export type GallerySource = 'spin2build' | 'original'
export type GalleryStatus = 'pending' | 'approved' | 'rejected'

export interface GalleryProject {
  id: string
  source: GallerySource
  projectName: string
  description: string
  projectType: string
  topic: string
  techStack: string[]
  builderName: string
  location?: string
  githubUrl?: string
  liveDemoUrl?: string
  screenshotUrl: string
  problemSolved?: string
  learned?: string
  originalProjectType?: string
  originalTopic?: string
  buildStatus: 'completed' | 'in-progress'
  featured: boolean
  status: GalleryStatus
  createdAt: string
}

export type GallerySubmission = Omit<GalleryProject, 'status' | 'featured' | 'createdAt'>
