import type { GalleryProject } from './gallery.ts'

export const galleryFilters = ['All', 'From Spin2Build', 'Original Ideas', 'Featured', 'Newest'] as const
export type GalleryFilter = typeof galleryFilters[number]
export interface GalleryQuery { page: number; search: string; filter: GalleryFilter }
export interface GalleryPageResult { projects: GalleryProject[]; hasMore: boolean }
