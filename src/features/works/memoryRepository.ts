import {
  applyWorkPatch,
  applyWorkStatus,
  buildWorkRecord,
} from './repository'
import type { SaveWorkDraftInput, WorkRecord, WorkRepository } from './types'

type MemoryState = Map<string, { works: Map<string, WorkRecord>; assets: Map<string, Blob> }>

export function createMemoryWorkRepository(): WorkRepository {
  const state: MemoryState = new Map()
  let sequence = 0
  const accountState = (accountId: string) => {
    let bucket = state.get(accountId)
    if (!bucket) {
      bucket = { works: new Map(), assets: new Map() }
      state.set(accountId, bucket)
    }
    return bucket
  }
  const createId = () => `memory-${++sequence}`
  const now = () => new Date().toISOString()

  return {
    async list(accountId) {
      return [...accountState(accountId).works.values()]
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .map((work) => structuredClone(work))
    },
    async get(accountId, workId) {
      const work = accountState(accountId).works.get(workId)
      return work ? structuredClone(work) : undefined
    },
    async getAsset(accountId, assetId) {
      return accountState(accountId).assets.get(assetId)
    },
    async saveDraft(accountId: string, input: SaveWorkDraftInput) {
      const bucket = accountState(accountId)
      const existing = input.sourceDraftId
        ? [...bucket.works.values()].find((work) => (
            work.source === input.source && work.sourceDraftId === input.sourceDraftId
          ))
        : undefined
      const record = buildWorkRecord({ accountId, input, existing, now: now(), createId })
      bucket.works.set(record.id, record)
      bucket.assets.set(record.assetId, input.blob)
      return structuredClone(record)
    },
    async update(accountId, workId, patch) {
      const bucket = accountState(accountId)
      const work = bucket.works.get(workId)
      if (!work) throw new Error('work-not-found')
      const updated = applyWorkPatch(work, patch, now())
      bucket.works.set(workId, updated)
      return structuredClone(updated)
    },
    async setStatus(accountId, workId, status) {
      const bucket = accountState(accountId)
      const work = bucket.works.get(workId)
      if (!work) throw new Error('work-not-found')
      const updated = applyWorkStatus(work, status, now())
      bucket.works.set(workId, updated)
      return structuredClone(updated)
    },
    async delete(accountId, workId) {
      const bucket = accountState(accountId)
      const work = bucket.works.get(workId)
      if (!work) return
      bucket.works.delete(workId)
      bucket.assets.delete(work.assetId)
    },
  }
}
