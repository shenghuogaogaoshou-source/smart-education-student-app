export type WorkSource = 'brain-film' | 'creative-module' | 'external-upload'
export type WorkStatus = 'draft' | 'reviewing' | 'published' | 'private'
export type PreviewKind = 'image' | 'video' | 'audio' | 'text' | 'pdf' | 'generic'

export type WorkComment = {
  id: string
  authorId: string
  authorName: string
  text: string
  createdAt: string
}

export type WorkRecord = {
  id: string
  ownerId: string
  source: WorkSource
  sourceDraftId?: string
  title: string
  description: string
  aiTools: string[]
  status: WorkStatus
  assetId: string
  fileName: string
  mimeType: string
  byteSize: number
  previewKind: PreviewKind
  createdAt: string
  updatedAt: string
  publishedAt?: string
  likes: number
  favorites: number
  likedBy: string[]
  favoritedBy: string[]
  comments: WorkComment[]
  reviewMessage?: string
}

export type SaveWorkDraftInput = {
  source: WorkSource
  sourceDraftId?: string
  title: string
  description: string
  aiTools: string[]
  fileName: string
  blob: Blob
}

export type WorkUpdatePatch = Partial<Pick<
  WorkRecord,
  | 'title'
  | 'description'
  | 'aiTools'
  | 'reviewMessage'
  | 'publishedAt'
  | 'likes'
  | 'favorites'
  | 'likedBy'
  | 'favoritedBy'
  | 'comments'
>>

export interface WorkRepository {
  list(accountId: string): Promise<WorkRecord[]>
  get(accountId: string, workId: string): Promise<WorkRecord | undefined>
  getAsset(accountId: string, assetId: string): Promise<Blob | undefined>
  saveDraft(accountId: string, input: SaveWorkDraftInput): Promise<WorkRecord>
  update(accountId: string, workId: string, patch: WorkUpdatePatch): Promise<WorkRecord>
  setStatus(accountId: string, workId: string, status: WorkStatus): Promise<WorkRecord>
  delete(accountId: string, workId: string): Promise<void>
}

export class WorkStorageError extends Error {
  constructor(public readonly code: 'quota-exceeded' | 'storage-unavailable', options?: ErrorOptions) {
    super(code, options)
    this.name = 'WorkStorageError'
  }
}
