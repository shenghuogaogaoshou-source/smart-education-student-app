import { detectPreviewKind } from './preview'
import {
  WorkStorageError,
  type SaveWorkDraftInput,
  type WorkRecord,
  type WorkRepository,
  type WorkStatus,
  type WorkUpdatePatch,
} from './types'

export { detectPreviewKind } from './preview'
export {
  WorkStorageError,
  type SaveWorkDraftInput,
  type WorkComment,
  type WorkRecord,
  type WorkRepository,
  type WorkSource,
  type WorkStatus,
  type WorkUpdatePatch,
} from './types'
export { createMemoryWorkRepository } from './memoryRepository'

type StoredAsset = {
  id: string
  ownerId: string
  data: ArrayBuffer
  mimeType: string
}

type RepositoryDependencies = {
  indexedDb?: IDBFactory
  now?: () => Date
  createId?: () => string
}

const DATABASE_VERSION = 1

function defaultId() {
  return globalThis.crypto?.randomUUID?.() ?? `work-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('indexeddb-request-failed'))
  })
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error ?? new Error('indexeddb-transaction-failed'))
    transaction.onabort = () => reject(transaction.error ?? new Error('indexeddb-transaction-aborted'))
  })
}

function storageError(error: unknown): WorkStorageError {
  if (error instanceof WorkStorageError) return error
  const name = error && typeof error === 'object' && 'name' in error ? String(error.name) : ''
  return new WorkStorageError(
    name === 'QuotaExceededError' ? 'quota-exceeded' : 'storage-unavailable',
    { cause: error },
  )
}

function cloneWork(work: WorkRecord): WorkRecord {
  return {
    ...work,
    creatorId: work.creatorId || work.ownerId,
    creatorName: work.creatorName || work.ownerId,
    aiTools: [...work.aiTools],
    likedBy: [...work.likedBy],
    favoritedBy: [...work.favoritedBy],
    comments: work.comments.map((comment) => ({ ...comment })),
  }
}

export function buildWorkRecord({
  accountId,
  input,
  existing,
  now,
  createId,
}: {
  accountId: string
  input: SaveWorkDraftInput
  existing?: WorkRecord
  now: string
  createId: () => string
}): WorkRecord {
  const workId = existing?.id ?? createId()
  return {
    id: workId,
    ownerId: accountId,
    creatorId: input.creatorId ?? existing?.creatorId ?? accountId,
    creatorName: input.creatorName ?? existing?.creatorName ?? accountId,
    source: input.source,
    sourceDraftId: input.sourceDraftId,
    title: input.title.trim(),
    description: input.description.trim(),
    aiTools: input.aiTools.map((tool) => tool.trim()).filter(Boolean),
    status: 'draft',
    assetId: existing?.assetId ?? createId(),
    fileName: input.fileName,
    mimeType: input.blob.type || '',
    byteSize: input.blob.size,
    previewKind: detectPreviewKind(input.blob.type || '', input.fileName),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    likes: existing?.likes ?? 0,
    favorites: existing?.favorites ?? 0,
    likedBy: existing?.likedBy ?? [],
    favoritedBy: existing?.favoritedBy ?? [],
    comments: existing?.comments ?? [],
  }
}

export function applyWorkPatch(work: WorkRecord, patch: WorkUpdatePatch, now: string): WorkRecord {
  const updated = {
    ...work,
    ...patch,
    aiTools: patch.aiTools ? [...patch.aiTools] : [...work.aiTools],
    likedBy: patch.likedBy ? [...patch.likedBy] : [...work.likedBy],
    favoritedBy: patch.favoritedBy ? [...patch.favoritedBy] : [...work.favoritedBy],
    comments: patch.comments ? patch.comments.map((comment) => ({ ...comment })) : work.comments.map((comment) => ({ ...comment })),
    updatedAt: now,
  }
  if (patch.likedBy) updated.likes = patch.likedBy.length
  if (patch.favoritedBy) updated.favorites = patch.favoritedBy.length
  return updated
}

export function applyWorkStatus(work: WorkRecord, status: WorkStatus, now: string): WorkRecord {
  return {
    ...cloneWork(work),
    status,
    updatedAt: now,
    publishedAt: status === 'published' ? now : undefined,
  }
}

function openDatabase(name: string, factory: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = factory.open(name, DATABASE_VERSION)
    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains('works')) {
        const works = database.createObjectStore('works', { keyPath: 'id' })
        works.createIndex('ownerId', 'ownerId', { unique: false })
      }
      if (!database.objectStoreNames.contains('assets')) {
        database.createObjectStore('assets', { keyPath: 'id' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('indexeddb-open-failed'))
  })
}

export function createIndexedDbWorkRepository(
  databaseName = 'zhiya-works',
  dependencies: RepositoryDependencies = {},
): WorkRepository {
  const factory = dependencies.indexedDb ?? globalThis.indexedDB
  const now = () => (dependencies.now?.() ?? new Date()).toISOString()
  const createId = dependencies.createId ?? defaultId
  if (!factory) throw new WorkStorageError('storage-unavailable')

  let databasePromise: Promise<IDBDatabase> | undefined
  const database = () => {
    databasePromise ??= openDatabase(databaseName, factory)
    return databasePromise
  }

  return {
    async list(accountId) {
      try {
        const db = await database()
        const transaction = db.transaction('works', 'readonly')
        const records = await requestResult(transaction.objectStore('works').getAll() as IDBRequest<WorkRecord[]>)
        return records
          .filter((record) => record.ownerId === accountId)
          .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
          .map(cloneWork)
      } catch (error) {
        throw storageError(error)
      }
    },

    async get(accountId, workId) {
      try {
        const db = await database()
        const transaction = db.transaction('works', 'readonly')
        const record = await requestResult(transaction.objectStore('works').get(workId) as IDBRequest<WorkRecord | undefined>)
        return record?.ownerId === accountId ? cloneWork(record) : undefined
      } catch (error) {
        throw storageError(error)
      }
    },

    async getAsset(accountId, assetId) {
      try {
        const db = await database()
        const transaction = db.transaction('assets', 'readonly')
        const asset = await requestResult(transaction.objectStore('assets').get(assetId) as IDBRequest<StoredAsset | undefined>)
        return asset?.ownerId === accountId
          ? new Blob([asset.data], { type: asset.mimeType })
          : undefined
      } catch (error) {
        throw storageError(error)
      }
    },

    async saveDraft(accountId, input) {
      try {
        const data = await input.blob.arrayBuffer()
        const db = await database()
        const transaction = db.transaction(['works', 'assets'], 'readwrite')
        const workStore = transaction.objectStore('works')
        const assetStore = transaction.objectStore('assets')
        const records = await requestResult(workStore.getAll() as IDBRequest<WorkRecord[]>)
        const existing = input.sourceDraftId
          ? records.find((record) => (
              record.ownerId === accountId
              && record.source === input.source
              && record.sourceDraftId === input.sourceDraftId
            ))
          : undefined
        const record = buildWorkRecord({ accountId, input, existing, now: now(), createId })
        workStore.put(record)
        assetStore.put({
          id: record.assetId,
          ownerId: accountId,
          data,
          mimeType: input.blob.type || '',
        } satisfies StoredAsset)
        await transactionDone(transaction)
        return cloneWork(record)
      } catch (error) {
        throw storageError(error)
      }
    },

    async update(accountId, workId, patch) {
      try {
        const db = await database()
        const transaction = db.transaction('works', 'readwrite')
        const store = transaction.objectStore('works')
        const record = await requestResult(store.get(workId) as IDBRequest<WorkRecord | undefined>)
        if (!record || record.ownerId !== accountId) throw new Error('work-not-found')
        const updated = applyWorkPatch(record, patch, now())
        store.put(updated)
        await transactionDone(transaction)
        return cloneWork(updated)
      } catch (error) {
        throw storageError(error)
      }
    },

    async setStatus(accountId, workId, status) {
      try {
        const db = await database()
        const transaction = db.transaction('works', 'readwrite')
        const store = transaction.objectStore('works')
        const record = await requestResult(store.get(workId) as IDBRequest<WorkRecord | undefined>)
        if (!record || record.ownerId !== accountId) throw new Error('work-not-found')
        const updated = applyWorkStatus(record, status, now())
        store.put(updated)
        await transactionDone(transaction)
        return cloneWork(updated)
      } catch (error) {
        throw storageError(error)
      }
    },

    async delete(accountId, workId) {
      try {
        const db = await database()
        const transaction = db.transaction(['works', 'assets'], 'readwrite')
        const workStore = transaction.objectStore('works')
        const record = await requestResult(workStore.get(workId) as IDBRequest<WorkRecord | undefined>)
        if (!record || record.ownerId !== accountId) {
          transaction.abort()
          return
        }
        workStore.delete(workId)
        transaction.objectStore('assets').delete(record.assetId)
        await transactionDone(transaction)
      } catch (error) {
        throw storageError(error)
      }
    },
  }
}
