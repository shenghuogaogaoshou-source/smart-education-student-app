import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createTaskService } from './taskService.mjs'

const directories = []

async function tempDirectory() {
  const directory = await mkdtemp(join(tmpdir(), 'zhiya-tasks-'))
  directories.push(directory)
  return directory
}

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })))
})

describe('task service', () => {
  it('persists a queued task and completes it outside the request lifecycle', async () => {
    const dataDir = await tempDirectory()
    let release
    const service = createTaskService({
      dataDir,
      execute: ({ updateStage }) => new Promise((resolve) => {
        release = async () => {
          await updateStage('recognizing')
          resolve({ title: '机器人', output: '机器人抱着幼苗' })
        }
      }),
    })
    await service.start()

    const created = await service.create({
      kind: 'vision',
      payload: { tool: 'object' },
      clientTaskId: 'client-1',
    })

    expect(created).toMatchObject({ kind: 'vision', status: 'queued' })
    await vi.waitFor(() => expect(release).toBeTypeOf('function'))
    await release()
    await vi.waitFor(() => expect(service.get(created.taskId)?.status).toBe('succeeded'))
    expect(service.get(created.taskId)?.result).toEqual({ title: '机器人', output: '机器人抱着幼苗' })
    await service.close()

    const reloaded = createTaskService({ dataDir, execute: async () => ({}) })
    await reloaded.start()
    expect(reloaded.get(created.taskId)?.result.title).toBe('机器人')
    await reloaded.close()
  })

  it('returns the same task for a duplicate clientTaskId', async () => {
    const service = createTaskService({
      dataDir: await tempDirectory(),
      execute: async () => ({ image: 'data:image/png;base64,AA' }),
    })
    await service.start()

    const first = await service.create({ kind: 'product-image', payload: { prompt: '小灯' }, clientTaskId: 'same' })
    const second = await service.create({ kind: 'product-image', payload: { prompt: '小灯' }, clientTaskId: 'same' })

    expect(second.taskId).toBe(first.taskId)
    await service.close()
  })

  it('never runs more tasks than the configured concurrency limit', async () => {
    let running = 0
    let maximum = 0
    const releases = []
    const service = createTaskService({
      dataDir: await tempDirectory(),
      maxConcurrent: 2,
      execute: () => new Promise((resolve) => {
        running += 1
        maximum = Math.max(maximum, running)
        releases.push(() => {
          running -= 1
          resolve({ ok: true })
        })
      }),
    })
    await service.start()

    await service.create({ kind: 'vision', payload: {}, clientTaskId: 'one' })
    await service.create({ kind: 'vision', payload: {}, clientTaskId: 'two' })
    await service.create({ kind: 'vision', payload: {}, clientTaskId: 'three' })
    await vi.waitFor(() => expect(maximum).toBe(2))
    expect(running).toBe(2)

    releases.shift()()
    await vi.waitFor(() => expect(running).toBe(2))
    releases.splice(0).forEach((release) => release())
    await vi.waitFor(() => expect(running).toBe(0))
    await service.close()
  })

  it('marks previously running tasks interrupted after a service restart', async () => {
    const dataDir = await tempDirectory()
    const taskId = '11111111-1111-4111-8111-111111111111'
    await writeFile(join(dataDir, `${taskId}.json`), JSON.stringify({
      taskId,
      kind: 'vision',
      payload: {},
      clientTaskId: 'restart',
      status: 'running',
      stage: 'recognizing',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }))
    const service = createTaskService({ dataDir, execute: async () => ({}) })

    await service.start()

    expect(service.get(taskId)).toMatchObject({
      status: 'interrupted',
      error: 'task_interrupted',
    })
    await service.close()
  })

  it('does not expose payload or client id and removes expired tasks', async () => {
    const dataDir = await tempDirectory()
    const service = createTaskService({
      dataDir,
      ttlMs: 1000,
      now: () => new Date('2026-10-28T00:00:10.000Z'),
      execute: async () => ({}),
    })
    const expiredId = '22222222-2222-4222-8222-222222222222'
    await writeFile(join(dataDir, `${expiredId}.json`), JSON.stringify({
      taskId: expiredId,
      kind: 'vision',
      payload: { secret: 'payload' },
      clientTaskId: 'private-client-id',
      status: 'succeeded',
      result: {},
      createdAt: '2026-10-28T00:00:00.000Z',
      updatedAt: '2026-10-28T00:00:01.000Z',
    }))

    await service.start()

    expect(service.get(expiredId)).toBeNull()
    expect(await readdir(dataDir)).toEqual([])
    await service.close()
  })
})
