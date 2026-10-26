import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react'
import { seedDemoWorks, type DemoAssetLoader } from './demoWorks'
import { createIndexedDbWorkRepository } from './repository'
import { localDemoModeration, reviewComment, WorkCommentRejected } from './moderation'
import type {
  SaveWorkDraftInput,
  WorkComment,
  WorkRecord,
  WorkRepository,
} from './types'

type NewUpload = Omit<SaveWorkDraftInput, 'source'>

type WorksContextValue = {
  accountId: string
  works: WorkRecord[]
  loading: boolean
  error: string
  saveDraft: (input: SaveWorkDraftInput) => Promise<WorkRecord>
  upload: (input: NewUpload) => Promise<WorkRecord>
  submitForReview: (workId: string) => Promise<WorkRecord>
  makePrivate: (workId: string) => Promise<WorkRecord>
  withdraw: (workId: string) => Promise<WorkRecord>
  remove: (workId: string) => Promise<void>
  toggleLike: (workId: string) => Promise<WorkRecord>
  toggleFavorite: (workId: string) => Promise<WorkRecord>
  addComment: (workId: string, authorName: string, text: string) => Promise<WorkRecord>
  getAsset: (assetId: string) => Promise<Blob | undefined>
}

const WorksContext = createContext<WorksContextValue | null>(null)

function friendlyError(error: unknown) {
  if (import.meta.env.DEV) console.error('[works]', error)
  if (error instanceof WorkCommentRejected) return error.message
  if (error instanceof Error && 'code' in error && error.code === 'quota-exceeded') {
    return '浏览器空间不足，请先保存到本地或清理一些旧作品。'
  }
  return '作品暂时没有保存成功，请稍后再试。'
}

function newId(prefix: string) {
  return `${prefix}-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}`
}

export function WorksProvider({
  accountId,
  repository,
  demoAssetLoader,
  children,
}: PropsWithChildren<{
  accountId: string
  repository?: WorkRepository
  demoAssetLoader?: DemoAssetLoader
}>) {
  const [fallbackRepository] = useState(() => createIndexedDbWorkRepository())
  const activeRepository = repository ?? fallbackRepository
  const [works, setWorks] = useState<WorkRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    setWorks([])
    const records = seedDemoWorks(activeRepository, accountId, demoAssetLoader)
    records
      .then((records) => {
        if (!cancelled) setWorks(records)
      })
      .catch((reason) => {
        if (!cancelled) setError(friendlyError(reason))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [accountId, activeRepository, demoAssetLoader])

  const run = useCallback(async <T,>(operation: () => Promise<T>) => {
    setError('')
    try {
      return await operation()
    } catch (reason) {
      setError(friendlyError(reason))
      throw reason
    }
  }, [])

  const replaceWork = useCallback((record: WorkRecord) => {
    setWorks((current) => {
      const exists = current.some((work) => work.id === record.id)
      const next = exists
        ? current.map((work) => work.id === record.id ? record : work)
        : [record, ...current]
      return next.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    })
  }, [])

  const saveDraft = useCallback((input: SaveWorkDraftInput) => run(async () => {
    const record = await activeRepository.saveDraft(accountId, input)
    replaceWork(record)
    return record
  }), [accountId, activeRepository, replaceWork, run])

  const upload = useCallback((input: NewUpload) => saveDraft({
    ...input,
    source: 'external-upload',
  }), [saveDraft])

  const submitForReview = useCallback((workId: string) => run(async () => {
    const reviewing = await activeRepository.setStatus(accountId, workId, 'reviewing')
    replaceWork(reviewing)
    const result = await localDemoModeration.review(reviewing)
    const finalStatus = result.allowed ? 'published' : 'draft'
    const statusRecord = await activeRepository.setStatus(accountId, workId, finalStatus)
    const record = await activeRepository.update(accountId, workId, { reviewMessage: result.message })
    replaceWork(record)
    return { ...statusRecord, ...record }
  }), [accountId, activeRepository, replaceWork, run])

  const makePrivate = useCallback((workId: string) => run(async () => {
    const record = await activeRepository.setStatus(accountId, workId, 'private')
    replaceWork(record)
    return record
  }), [accountId, activeRepository, replaceWork, run])

  const withdraw = useCallback((workId: string) => run(async () => {
    const record = await activeRepository.setStatus(accountId, workId, 'draft')
    replaceWork(record)
    return record
  }), [accountId, activeRepository, replaceWork, run])

  const remove = useCallback((workId: string) => run(async () => {
    await activeRepository.delete(accountId, workId)
    setWorks((current) => current.filter((work) => work.id !== workId))
  }), [accountId, activeRepository, run])

  const toggleLike = useCallback((workId: string) => run(async () => {
    const work = await activeRepository.get(accountId, workId)
    if (!work) throw new Error('work-not-found')
    const likedBy = work.likedBy.includes(accountId)
      ? work.likedBy.filter((id) => id !== accountId)
      : [...work.likedBy, accountId]
    const record = await activeRepository.update(accountId, workId, { likedBy })
    replaceWork(record)
    return record
  }), [accountId, activeRepository, replaceWork, run])

  const toggleFavorite = useCallback((workId: string) => run(async () => {
    const work = await activeRepository.get(accountId, workId)
    if (!work) throw new Error('work-not-found')
    const favoritedBy = work.favoritedBy.includes(accountId)
      ? work.favoritedBy.filter((id) => id !== accountId)
      : [...work.favoritedBy, accountId]
    const record = await activeRepository.update(accountId, workId, { favoritedBy })
    replaceWork(record)
    return record
  }), [accountId, activeRepository, replaceWork, run])

  const addComment = useCallback((workId: string, authorName: string, text: string) => run(async () => {
    const review = reviewComment(text)
    if (!review.allowed) throw new WorkCommentRejected(review.message)
    const work = await activeRepository.get(accountId, workId)
    if (!work) throw new Error('work-not-found')
    const comment: WorkComment = {
      id: newId('comment'),
      authorId: accountId,
      authorName,
      text: text.trim(),
      createdAt: new Date().toISOString(),
    }
    const record = await activeRepository.update(accountId, workId, {
      comments: [...work.comments, comment],
    })
    replaceWork(record)
    return record
  }), [accountId, activeRepository, replaceWork, run])

  const getAsset = useCallback((assetId: string) => run(() => activeRepository.getAsset(accountId, assetId)), [accountId, activeRepository, run])

  const value = useMemo<WorksContextValue>(() => ({
    accountId,
    works,
    loading,
    error,
    saveDraft,
    upload,
    submitForReview,
    makePrivate,
    withdraw,
    remove,
    toggleLike,
    toggleFavorite,
    addComment,
    getAsset,
  }), [
    accountId,
    works,
    loading,
    error,
    saveDraft,
    upload,
    submitForReview,
    makePrivate,
    withdraw,
    remove,
    toggleLike,
    toggleFavorite,
    addComment,
    getAsset,
  ])

  return <WorksContext.Provider value={value}>{children}</WorksContext.Provider>
}

export function useWorks() {
  const value = useContext(WorksContext)
  if (!value) throw new Error('useWorks must be used inside WorksProvider')
  return value
}

export function useOptionalWorks() {
  return useContext(WorksContext)
}
