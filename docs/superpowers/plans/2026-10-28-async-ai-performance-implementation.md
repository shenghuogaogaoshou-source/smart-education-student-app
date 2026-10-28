# 智芽异步 AI 与性能体验 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复 Android 语音无回复和慢播报，将摄像头、实物图、脑洞画面改为可恢复后台任务，并统一优化作品展示页面。

**Architecture:** Node 云端网关新增持久化任务服务，按 `vision`、`product-image`、`film-image` 三类异步执行并供客户端轮询。APP 与两个内嵌游戏共享任务客户端；语音使用停止兜底和 1.5 秒本机 TTS 回退。作品页复用共享移动端页头，并把重复列表收敛为精选卡片加两列网格。

**Tech Stack:** React 19、TypeScript、Vite、Vitest、Capacitor 8、Node.js HTTP、Python 脑洞服务、Docker、Caddy、Android SDK 36。

**Spec:** `docs/superpowers/specs/2026-10-28-async-ai-performance-design.md`

## Global Constraints

- 继续使用现有正式签名和 `versionCode=1`。
- 覆盖安装必须保留学习进度、积分、勋章、作品和 AI 形象数据。
- 生产 API 保持 `https://api.zhiyaedu.com.cn`。
- 快速视觉模型固定为 `qwen3.5-omni-flash-2026-03-15`，高质量回退为 `qwen3-vl-plus`。
- 任务结果最多保留 24 小时、最近 100 个；禁止记录图片正文、学生问题、Authorization 或 API Key。
- 云端 TTS 1.5 秒内未就绪时，Android 必须立即使用本机中文语音。
- 任务创建后必须可离开页面，重新进入时按 task ID 恢复。
- 作品详情和更多作品必须复用 `MobilePageHeader`。
- 不改变知识、测试、积分、勋章和成长画像业务语义。

---

### Task 1: 持久化任务服务

**Files:**
- Create: `server/taskService.mjs`
- Create: `server/taskService.test.mjs`

**Interfaces:**
- Produces: `createTaskService(options): { start, create, get, close }`。
- Produces: `TaskKind = 'vision' | 'product-image' | 'film-image'`。
- Produces: `TaskStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'interrupted'`。

- [ ] **Step 1: 写持久化和后台执行失败测试**

```js
it('persists a queued task and completes it outside the request lifecycle', async () => {
  let release
  const service = createTaskService({
    dataDir: tempDir,
    execute: ({ updateStage }) => new Promise((resolve) => {
      updateStage('recognizing')
      release = () => resolve({ title: '机器人', output: '机器人抱着幼苗' })
    }),
  })
  await service.start()
  const created = await service.create({ kind: 'vision', payload: { tool: 'object' }, clientTaskId: 'client-1' })
  expect(created.status).toBe('queued')
  await vi.waitFor(() => expect(service.get(created.taskId)?.stage).toBe('recognizing'))
  release()
  await vi.waitFor(() => expect(service.get(created.taskId)?.status).toBe('succeeded'))
  const reloaded = createTaskService({ dataDir: tempDir, execute: async () => ({}) })
  await reloaded.start()
  expect(reloaded.get(created.taskId)?.result.title).toBe('机器人')
})

it('returns the same task for a duplicate clientTaskId', async () => {
  const service = createTaskService({ dataDir: tempDir, execute: async () => ({ image: 'data:image/png;base64,AA' }) })
  await service.start()
  const first = await service.create({ kind: 'product-image', payload: { prompt: '小灯' }, clientTaskId: 'same' })
  const second = await service.create({ kind: 'product-image', payload: { prompt: '小灯' }, clientTaskId: 'same' })
  expect(second.taskId).toBe(first.taskId)
})
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `npx vitest run --config vitest.server.config.ts server/taskService.test.mjs`  
Expected: FAIL，`taskService.mjs` 不存在。

- [ ] **Step 3: 实现任务服务**

```js
import { randomUUID } from 'node:crypto'
import { mkdirSync, readdirSync } from 'node:fs'
import { readFile, rename, unlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

export function createTaskService({
  dataDir,
  execute,
  maxConcurrent = 4,
  ttlMs = 86_400_000,
  maxTasks = 100,
  now = () => new Date(),
  randomId = randomUUID,
} = {}) {
  const tasks = new Map()
  let active = 0
  const pending = []
  const controllers = new Set()
  const runPromises = new Set()
  let closed = false

  function publicView(task) {
    return {
      taskId: task.taskId,
      kind: task.kind,
      status: task.status,
      stage: task.stage,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
      elapsedMs: Math.max(0, now().getTime() - Date.parse(task.createdAt)),
      ...(task.result === undefined ? {} : { result: task.result }),
      ...(task.error ? { error: task.error } : {}),
    }
  }

  async function persist(task) {
    const target = join(dataDir, `${task.taskId}.json`)
    const temporary = `${target}.tmp`
    await writeFile(temporary, JSON.stringify(task), { mode: 0o600 })
    await rename(temporary, target)
  }

  async function run(task) {
    const controller = new AbortController()
    controllers.add(controller)
    task.status = 'running'
    task.stage = 'preparing'
    task.updatedAt = now().toISOString()
    await persist(task)
    try {
      task.result = await execute({
        kind: task.kind,
        payload: task.payload,
        signal: controller.signal,
        updateStage: async (stage) => {
          task.stage = String(stage).slice(0, 40)
          task.updatedAt = now().toISOString()
          await persist(task)
        },
      })
      task.status = 'succeeded'
      delete task.stage
    } catch (error) {
      task.status = controller.signal.aborted ? 'interrupted' : 'failed'
      task.error = controller.signal.aborted
        ? 'task_interrupted'
        : String(error instanceof Error ? error.message : 'task_failed').replace(/[^a-z0-9_-]/gi, '_').slice(0, 64)
    } finally {
      task.updatedAt = now().toISOString()
      await persist(task)
      controllers.delete(controller)
      active -= 1
      pump()
    }
  }

  function pump() {
    while (!closed && active < maxConcurrent && pending.length) {
      const task = pending.shift()
      active += 1
      const running = run(task).finally(() => runPromises.delete(running))
      runPromises.add(running)
    }
  }

  return {
    async start() {
      mkdirSync(dataDir, { recursive: true })
      const entries = readdirSync(dataDir, { withFileTypes: true })
        .filter((entry) => entry.isFile() && /^[0-9a-f-]{36}\.json$/.test(entry.name))
        .map((entry) => join(dataDir, entry.name))
        .sort()
        .reverse()
      for (const [index, file] of entries.entries()) {
        const task = JSON.parse(await readFile(file, 'utf8'))
        if (index >= maxTasks || now().getTime() - Date.parse(task.createdAt) > ttlMs) {
          await unlink(file).catch(() => undefined)
          continue
        }
        if (task.status === 'queued' || task.status === 'running') {
          task.status = 'interrupted'
          task.error = 'task_interrupted'
          task.updatedAt = now().toISOString()
          await persist(task)
        }
        tasks.set(task.taskId, task)
      }
    },
    async create(input) {
      if (closed) throw new Error('service_closed')
      const kind = input?.kind
      const payload = input?.payload
      const clientTaskId = typeof input?.clientTaskId === 'string' ? input.clientTaskId.trim() : ''
      if (!['vision', 'product-image', 'film-image'].includes(kind)
        || !payload || typeof payload !== 'object' || Array.isArray(payload)
        || !clientTaskId || clientTaskId.length > 120) throw new Error('invalid_input')
      const existing = [...tasks.values()].find((task) => task.clientTaskId === clientTaskId)
      if (existing) return publicView(existing)
      const timestamp = now().toISOString()
      const task = {
        taskId: randomId(),
        kind,
        payload,
        clientTaskId,
        status: 'queued',
        createdAt: timestamp,
        updatedAt: timestamp,
      }
      tasks.set(task.taskId, task)
      await persist(task)
      pending.push(task)
      pump()
      return publicView(task)
    },
    get(taskId) {
      const task = tasks.get(taskId)
      return task ? publicView(task) : null
    },
    async close() {
      closed = true
      pending.length = 0
      for (const controller of controllers) controller.abort()
      await Promise.allSettled([...runPromises])
    },
  }
}
```

- [ ] **Step 4: 运行任务服务测试**

Run: `npx vitest run --config vitest.server.config.ts server/taskService.test.mjs`  
Expected: PASS，包括持久化、幂等、并发上限、失败、过期清理和重启中断。

- [ ] **Step 5: 提交**

```bash
git add server/taskService.mjs server/taskService.test.mjs
git commit -m "feat: add persistent background task service"
```

---

### Task 2: 任务 API 与三类执行器

**Files:**
- Create: `server/taskExecutors.mjs`
- Create: `server/taskExecutors.test.mjs`
- Modify: `server/ai-proxy.mjs`
- Modify: `server/ai-proxy.test.mjs`
- Modify: `server/cloudGateway.test.mjs`
- Modify: `vite.config.ts`
- Modify: `packages/works-bridge/src/index.ts`
- Modify: `src/app/mobileGameApi.test.ts`

**Interfaces:**
- Consumes: Task 1 `createTaskService`。
- Produces: `POST /api/tasks`、`GET /api/tasks/:id`。
- Produces: `executeTask({ kind, payload, updateStage })`。

- [ ] **Step 1: 写路由失败测试**

```js
it('creates a vision task immediately and exposes completion by task id', async () => {
  const listener = createCompanionRequestListener({
    taskService: createTaskService({
      dataDir: tempDir,
      execute: async ({ updateStage }) => {
        updateStage('recognizing')
        return { title: '物品观察卡', output: '白色机器人' }
      },
    }),
  })
  const base = await listen(listener)
  const created = await fetch(`${base}/api/tasks`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ kind: 'vision', payload: { tool: 'object' }, clientTaskId: 'camera-1' }),
  })
  expect(created.status).toBe(202)
  const { taskId } = await created.json()
  await vi.waitFor(async () => {
    const result = await (await fetch(`${base}/api/tasks/${taskId}`)).json()
    expect(result.status).toBe('succeeded')
    expect(result.result.output).toBe('白色机器人')
  })
})
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `npx vitest run --config vitest.server.config.ts server/taskExecutors.test.mjs server/ai-proxy.test.mjs server/cloudGateway.test.mjs`  
Expected: FAIL，任务路由尚不存在。

- [ ] **Step 3: 实现执行器**

```js
export function createTaskExecutor({ handleApi, brainOrigin, fetchImpl = fetch }) {
  return async function executeTask({ kind, payload, updateStage }) {
    if (kind === 'vision') {
      updateStage('recognizing')
      const result = await handleApi({ method: 'POST', path: '/api/companion/recognize', body: payload })
      if (result.status !== 200) throw new Error(result.body?.error || 'vision_failed')
      return result.body.result
    }
    if (kind === 'product-image') {
      updateStage('rendering')
      const result = await handleApi({ method: 'POST', path: '/api/ark/images/generations', body: payload })
      if (result.status !== 200) throw new Error(result.body?.error || 'image_failed')
      return result.body
    }
    if (kind === 'film-image') {
      updateStage('rendering')
      const response = await fetchImpl(`${brainOrigin}/api/image`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!response.ok) throw new Error('film_image_failed')
      return response.json()
    }
    throw new Error('invalid_task_kind')
  }
}
```

- [ ] **Step 4: 接入 HTTP 路由**

- `POST /api/tasks` 使用 8 MB JSON 上限，成功返回 `202 { taskId, status, createdAt }`。
- `GET /api/tasks/<uuid>` 返回公开任务状态，未知 ID 返回 404。
- `vite.config.ts` 将 `/api/tasks` 代理到 `http://127.0.0.1:8787`。
- `installGameApiShim('brain')` 对 `/api/tasks` 不添加 `/brain`，其他 `/api` 保持不变。
- `createCompanionRequestListener` 支持注入 `taskService`；生产默认目录为 `DATA_DIR/tasks`。

- [ ] **Step 5: 运行测试**

Run: `npx vitest run --config vitest.server.config.ts server/taskExecutors.test.mjs server/ai-proxy.test.mjs server/cloudGateway.test.mjs`  
Run: `npx vitest run src/app/mobileGameApi.test.ts`  
Expected: PASS。

- [ ] **Step 6: 提交**

```bash
git add server/taskExecutors.mjs server/taskExecutors.test.mjs server/ai-proxy.mjs server/ai-proxy.test.mjs server/cloudGateway.test.mjs vite.config.ts packages/works-bridge/src/index.ts src/app/mobileGameApi.test.ts
git commit -m "feat: expose unified background AI tasks"
```

---

### Task 3: 共享任务客户端

**Files:**
- Create: `packages/task-client/package.json`
- Create: `packages/task-client/src/index.ts`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `apps/creative-module/package.json`
- Modify: `apps/brain-film/package.json`
- Create: `src/app/taskClient.test.ts`

**Interfaces:**
- Consumes: Task 2 HTTP contract。
- Produces: `createTask`, `getTask`, `pollTask`，类型 `TaskKind`, `TaskStatus`, `TaskView`。

```ts
createTask(input: { kind: TaskKind; payload: unknown; clientTaskId: string }, options?: TaskRequestOptions): Promise<TaskView>
getTask(taskId: string, options?: TaskRequestOptions): Promise<TaskView>
pollTask(taskId: string, options?: PollOptions): Promise<TaskView>
```

- [ ] **Step 1: 写轮询节奏失败测试**

```ts
it('polls with 1-second cadence before ten seconds and 2.5-second cadence after', async () => {
  const timeout = vi.fn((callback) => { callback(); return 1 })
  let clock = 0
  const fetcher = vi.fn()
    .mockResolvedValueOnce(jsonResponse({ status: 'running', stage: 'recognizing' }))
    .mockResolvedValueOnce(jsonResponse({ status: 'succeeded', result: { output: '机器人' } }))
  const result = await pollTask('task-1', { fetcher, setTimeoutImpl: timeout, now: () => clock })
  expect(result.status).toBe('succeeded')
  expect(timeout.mock.calls[0][1]).toBe(1000)
})
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `npx vitest run src/app/taskClient.test.ts`  
Expected: FAIL，`@zhiya/task-client` 尚不存在。

- [ ] **Step 3: 实现任务客户端**

- `createTask` 调用 `POST /api/tasks`。
- `getTask` 调用 `GET /api/tasks/<taskId>`。
- `pollTask` 前 10 秒每 1 秒、之后每 2.5 秒查询。
- `document.visibilityState === 'hidden'` 时等待 `visibilitychange`，恢复时立即查询。
- `AbortSignal` 取消后停止。
- 请求失败只对 `408/429/5xx` 重试一次。
- `fetcher`、`now`、`setTimeoutImpl`、`clearTimeoutImpl` 可注入。

```ts
export async function pollTask(taskId, {
  fetcher = fetch,
  signal,
  now = Date.now,
  setTimeoutImpl = setTimeout,
  clearTimeoutImpl = clearTimeout,
} = {}) {
  const startedAt = now()
  while (!signal?.aborted) {
    const task = await getTask(taskId, { fetcher, signal })
    if (task.status === 'succeeded' || task.status === 'failed' || task.status === 'interrupted') return task
    const delay = now() - startedAt < 10_000 ? 1_000 : 2_500
    await waitVisible(delay, { signal, setTimeoutImpl, clearTimeoutImpl })
  }
  throw new DOMException('Aborted', 'AbortError')
}
```

- [ ] **Step 4: 运行测试**

Run: `npx vitest run src/app/taskClient.test.ts`  
Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add packages/task-client package.json package-lock.json apps/creative-module/package.json apps/brain-film/package.json src/app/taskClient.test.ts
git commit -m "feat: share resilient background task client"
```

---

### Task 4: Android 语音停止兜底与流式回答

**Files:**
- Modify: `src/features/ai_companion/browserSpeech.ts`
- Modify: `src/features/ai_companion/browserSpeech.test.ts`
- Modify: `src/features/ai_companion/companionChat.ts`
- Modify: `src/features/ai_companion/companionChat.test.ts`
- Modify: `src/features/ai_companion/conversation/conversationMachine.ts`
- Modify: `src/features/ai_companion/conversation/conversationMachine.test.ts`
- Modify: `server/ai-proxy.mjs`
- Modify: `server/ai-proxy.test.mjs`

**Interfaces:**
- Consumes: 现有对话控制器。
- Produces: 可选的 `requestReply({ ..., onDelta })`；流式端点 `/api/companion/reply/stream`。

- [ ] **Step 1: 写语音停止竞态测试**

```ts
it('submits the latest transcript when Android never emits a stopped event', async () => {
  vi.useFakeTimers()
  const onComplete = vi.fn()
  const plugin = fakeNativeSpeechPlugin({
    start: async () => undefined,
    stop: vi.fn(async () => undefined),
  })
  const capture = startNativeSpeechCaptureForTest({ onComplete, onError: vi.fn(), plugin })
  await plugin.emitPartial('你叫什么名字呀')
  capture.stop()
  await vi.advanceTimersByTimeAsync(700)
  expect(onComplete).toHaveBeenCalledWith('你叫什么名字呀')
})

it('stops immediately after initialization if the finger was released too early', async () => {
  let finishStart
  const plugin = fakeNativeSpeechPlugin({
    start: () => new Promise((resolve) => { finishStart = resolve }),
  })
  const capture = startNativeSpeechCaptureForTest(callbacks, { plugin })
  capture.stop()
  finishStart()
  await vi.waitFor(() => expect(plugin.stop).toHaveBeenCalled())
})
```

- [ ] **Step 2: 运行语音测试并确认失败**

Run: `npx vitest run src/features/ai_companion/browserSpeech.test.ts`  
Expected: FAIL，当前停止后没有兜底提交。

- [ ] **Step 3: 实现原生语音停止兜底**

- 为 `startNativeSpeechCapture` 增加插件注入参数，生产默认动态导入。
- 记录 `stopRequested`、`latestTranscript`、`lastPartialAt`、`stopTimer`。
- `stop()` 调用插件 stop 后启动 700ms 兜底计时器。
- 收到 `listeningState=stopped` 立即 `finish()`。
- `finish()` 只执行一次；有文本提交，无文本报 `no-speech`。
- 初始化完成时若 `stopRequested`，立即执行停止和收尾。
- `cancel()` 清除计时器且永不提交半句话。

```ts
const finish = (error?: SpeechCaptureErrorReason) => {
  if (!active) return
  active = false
  if (stopTimer) clearTimeout(stopTimer)
  cleanup()
  const transcript = latestTranscript.trim()
  if (transcript) onComplete(transcript)
  else onError(error ?? 'no-speech')
}

const stop = () => {
  stopRequested = true
  void plugin?.stop()
  if (active) stopTimer = setTimeout(() => finish(), STOP_FINALIZE_MS)
}
```

- [ ] **Step 4: 写流式回答失败测试**

```ts
it('shows reply deltas before completion and plays speech only once', async () => {
  const speakReply = vi.fn(() => ({ cancel: vi.fn() }))
  const controller = createConversationController({
    startCapture: fakeCapture('你叫什么名字'),
    requestReply: async ({ onDelta }) => {
      onDelta('我是你的')
      onDelta(' AI 学习伙伴。')
      return '我是你的 AI 学习伙伴。'
    },
    speakReply,
    getCompanionId: () => 'momo',
    getVoiceEnabled: () => true,
  })
  controller.start()
  await vi.waitFor(() => expect(speakReply).toHaveBeenCalledOnce())
  expect(speakReply).toHaveBeenCalledWith('我是你的 AI 学习伙伴。', true, expect.any(Function))
})
```

- [ ] **Step 5: 实现 SSE 和增量显示**

服务端：

- 新增 `POST /api/companion/reply/stream`。
- 先完整生成并校验回答，再按 6—12 个字符分块发送 `delta`，最后发送 `done`。
- 开始 SSE 前失败返回普通 JSON；开始后失败写 `error` 事件。
- 响应头使用 `text/event-stream`、`cache-control: no-store`。

客户端：

- `requestCompanionReply` 优先请求流式端点。
- 解析 SSE 的 `event:` 和完整 JSON `data:`。
- 每次 delta 把当前累计回答传给 `onDelta`。
- 已输出部分后断流时返回累计文本并允许“重新回答”；无文本时抛错。
- 完整回答结束前不启动 TTS。

- [ ] **Step 6: 运行语音与对话测试**

Run: `npx vitest run src/features/ai_companion src/features/auth/LoginCompanion.test.tsx`  
Run: `npx vitest run --config vitest.server.config.ts server/ai-proxy.test.mjs`  
Expected: PASS。

- [ ] **Step 7: 提交**

```bash
git add src/features/ai_companion server/ai-proxy.mjs server/ai-proxy.test.mjs
git commit -m "fix: finalize Android speech and stream companion replies"
```

---

### Task 5: TTS 快速回退与跟读预取

**Files:**
- Modify: `src/features/ai_companion/browserSpeech.ts`
- Modify: `src/features/ai_companion/browserSpeech.test.ts`
- Modify: `src/features/knowledge/useReadAloud.ts`
- Modify: `src/features/knowledge/useReadAloud.test.ts`

**Interfaces:**
- Consumes: Task 4 完成后的 `speakCompanionReply`。
- Produces: Android 会话级 `nativePreferred`，以及 `useReadAloud(..., { prefetchText })`。

- [ ] **Step 1: 写 1.5 秒回退测试**

```ts
it('starts Android local speech after 1.5 seconds while cloud TTS is pending', async () => {
  vi.useFakeTimers()
  const speakNative = vi.fn(async () => undefined)
  const playback = speakCompanionReplyForTest('你好', true, undefined, {
    isNative: true,
    speakNative,
    requestAudio: vi.fn(() => new Promise(() => undefined)),
  })
  await vi.advanceTimersByTimeAsync(1500)
  expect(speakNative).toHaveBeenCalledOnce()
  playback.cancel()
})
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `npx vitest run src/features/ai_companion/browserSpeech.test.ts`  
Expected: FAIL，当前会继续等待云端。

- [ ] **Step 3: 实现会话级快速回退**

- 云端请求启动 1500ms 计时器。
- 云端音频先完成则清除计时器并播放。
- 计时器先到或云端失败时取消 fetch，立即调用本机 TTS。
- 暴露 `createNativeSpeechSession()`，同一次跟读或回答共享 `nativePreferred`。
- 取消时清除计时器、audio、object URL、native queue 和请求。

- [ ] **Step 4: 写跟读预取测试**

```ts
it('prefetches the next segment while the current segment is playing', async () => {
  const playText = vi.fn((_text, _enabled, onEnd) => ({ cancel: vi.fn(), finish: onEnd }))
  const prefetchText = vi.fn()
  const { result } = renderHook(() => useReadAloud(sampleSegments, { playText, prefetchText, isNative: true }))
  act(() => result.current.play(0))
  expect(prefetchText).toHaveBeenCalledWith(sampleSegments[1].text)
})
```

- [ ] **Step 5: 实现跟读预取**

- `useReadAloud` 可选接收 `prefetchText`。
- 当前段开始后异步预取下一段 `/api/tts` Blob。
- 最多缓存 3 段，按段文本作 key。
- 预取不改变高亮、index 或播放状态。
- 已进入本机语音模式时跳过云端预取。

- [ ] **Step 6: 运行测试**

Run: `npx vitest run src/features/ai_companion/browserSpeech.test.ts src/features/knowledge/useReadAloud.test.ts`  
Expected: PASS。

- [ ] **Step 7: 提交**

```bash
git add src/features/ai_companion/browserSpeech.ts src/features/ai_companion/browserSpeech.test.ts src/features/knowledge/useReadAloud.ts src/features/knowledge/useReadAloud.test.ts
git commit -m "perf: start Android speech quickly and preload reading"
```

---

### Task 6: 摄像头任务化与快速模型

**Files:**
- Modify: `server/recognition.mjs`
- Modify: `server/recognition.test.mjs`
- Modify: `src/features/home/recognitionTools.ts`
- Modify: `src/features/home/recognitionTools.test.ts`
- Modify: `src/features/home/CameraToolSheet.tsx`
- Modify: `src/features/home/CameraToolSheet.test.tsx`
- Modify: `src/features/home/HomePage.tsx`
- Modify: `src/features/home/HomePage.test.tsx`
- Create: `src/features/home/BackgroundRecognitionTask.tsx`
- Create: `src/features/home/BackgroundRecognitionTask.test.tsx`

**Interfaces:**
- Consumes: Task 1/2 task API、Task 3 `createTask/pollTask`。
- Produces: `imageMaxEdgeForTool(tool): number`。
- Produces: `submitVisionTask(payload, clientTaskId): Promise<TaskView>`。

- [ ] **Step 1: 写模型分级失败测试**

```js
it('uses the fast omni model first and falls back to qwen3-vl-plus', async () => {
  const fetchImpl = vi.fn()
    .mockResolvedValueOnce(new Response(JSON.stringify({ error: { code: 'provider_error' } }), { status: 502 }))
    .mockResolvedValueOnce(new Response(providerJson(validRecognitionResult), { status: 200 }))
  await recognize(validObjectBody, { apiKey: 'key', fetchImpl })
  expect(JSON.parse(fetchImpl.mock.calls[0][1].body).model).toBe('qwen3.5-omni-flash-2026-03-15')
  expect(JSON.parse(fetchImpl.mock.calls[1][1].body).model).toBe('qwen3-vl-plus')
})
```

- [ ] **Step 2: 写图片压缩路由测试**

```ts
it.each([
  ['object', 960],
  ['solve', 1024],
  ['translate', 1024],
  ['check', 1024],
  ['ocr', 1280],
])('%s compresses to the expected maximum edge', (tool, edge) => {
  expect(imageMaxEdgeForTool(tool)).toBe(edge)
})
```

- [ ] **Step 3: 运行测试并确认失败**

Run: `npx vitest run --config vitest.server.config.ts server/recognition.test.mjs`  
Run: `npx vitest run src/features/home/recognitionTools.test.ts`  
Expected: FAIL，当前固定 `qwen3-vl-plus` 和 1600px。

- [ ] **Step 4: 实现视觉模型降级**

```js
const models = useVisionProvider
  ? [
      process.env.VISION_FAST_MODEL || 'qwen3.5-omni-flash-2026-03-15',
      process.env.VISION_MODEL || 'qwen3-vl-plus',
    ]
  : [process.env.DEEPSEEK_MODEL || 'deepseek-chat']
```

- 首选模型允许一次格式修正。
- 首选模型返回 provider error、timeout 或 invalid_result 时，才执行高质量回退。
- 鉴权、输入错误和用户取消不触发回退。
- 服务器安全日志只记录模型、tool、尝试次数、耗时和稳定错误码。

- [ ] **Step 5: 实现图片尺寸路由**

```ts
export function imageMaxEdgeForTool(tool: ToolId) {
  if (tool === 'object') return 960
  if (tool === 'ocr') return 1280
  if (tool === 'scan') return 1600
  return 1024
}
```

- `readImage(file, { maxEdge, preserveOriginal })` 按目标长边等比压缩。
- JPEG 质量保持 0.88。
- `scan` 仍先保留原图做本地解码，不把原图上传。

- [ ] **Step 6: 写 12 秒后台化测试**

```tsx
it('closes the camera panel after 12 seconds and exposes a background task card', async () => {
  vi.useFakeTimers()
  const onClose = vi.fn()
  const createTask = vi.fn().mockResolvedValue({ taskId: 't1', status: 'queued' })
  render(
    <CameraToolSheet
      open
      onClose={onClose}
      createTask={createTask}
      initialTool={0}
      initialImage="data:image/png;base64,AA"
    />,
  )
  fireEvent.click(screen.getByRole('button', { name: '开始分析' }))
  await vi.advanceTimersByTimeAsync(12_000)
  expect(onClose).toHaveBeenCalledOnce()
})
```

- [ ] **Step 7: 实现摄像头后台任务 UI**

- 提交任务时调用 `createTask({ kind: 'vision', payload, clientTaskId })`。
- 当前面板轮询自己的任务；成功仍直接显示结果。
- 达到 12 秒时调用 `onBackground(taskId)` 并关闭面板。
- `HomePage` 保存 `cameraTaskId`，渲染 `BackgroundRecognitionTask`。
- 后台任务卡片显示“识别中/识别完成/识别失败”。
- 完成后点击卡片调用 `CameraToolSheet` 的恢复入口展示 `RecognitionResultView`。
- 失败卡片提供“重新识别”和稳定错误说明。

- [ ] **Step 8: 运行摄像头测试**

Run: `npx vitest run src/features/home`  
Run: `npx vitest run --config vitest.server.config.ts server/recognition.test.mjs`  
Expected: PASS。

- [ ] **Step 9: 提交**

```bash
git add server/recognition.mjs server/recognition.test.mjs src/features/home
git commit -m "perf: background and accelerate camera recognition"
```

---

### Task 7: 创造模块后台实物图

**Files:**
- Modify: `apps/creative-module/src/lib/artwork.ts`
- Modify: `apps/creative-module/tests/artwork.test.cjs`
- Modify: `apps/creative-module/src/components/workbench/WorkCheckPanel.tsx`
- Modify: `apps/creative-module/src/lib/storage.ts`
- Modify: `apps/creative-module/tests/storage.test.cjs`

**Interfaces:**
- Consumes: Task 3 `createTask/pollTask`。
- Produces: `generateProductImageTask(prompt, clientTaskId): Promise<TaskView>`。
- Produces: 草稿字段 `imageTaskId?: string`。

- [ ] **Step 1: 写任务提交与恢复失败测试**

```js
test('restores a running product image task from the saved draft', async () => {
  const draft = { ...baseDraft, imageTaskId: 'task-product-1' }
  saveDraft(draft)
  const task = await resumeProductImage(draft.imageTaskId, { getTask: fakeTask({ status: 'running' }) })
  assert.equal(task.status, 'running')
})

test('does not clear the existing image while a redraw is running', async () => {
  const panel = renderHook(() => useWorkCheck({ imageSrc: 'old-image', createTask }))
  act(() => panel.result.current.runImage())
  assert.equal(panel.result.current.imageSrc, 'old-image')
})
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `npm test --workspace @zhiya/creative-module`  
Expected: FAIL，`imageTaskId` 和任务恢复尚不存在。

- [ ] **Step 3: 实现后台实物图任务**

```ts
export async function requestProductImageTask(prompt: string, clientTaskId: string) {
  return createTask({
    kind: 'product-image',
    clientTaskId,
    payload: {
      model: IMAGE_API_DEFAULTS.model,
      size: IMAGE_API_DEFAULTS.size,
      response_format: 'b64_json',
      watermark: false,
      prompt,
    },
  })
}
```

- `clientTaskId` 生成一次后写入草稿；重试使用新 ID，恢复使用旧 ID。
- 轮询任务并保存 `imageTaskId`。
- 任务成功后才替换 `imageSrc`。
- 失败/中断保留旧图和当前提示词。
- 显示文案改为“正在画 · 通常需要 20—40 秒”。
- 组件重新挂载时读取草稿中的 `imageTaskId` 并恢复查询。

- [ ] **Step 4: 运行创造模块测试**

Run: `npm test --workspace @zhiya/creative-module`  
Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add apps/creative-module
git commit -m "perf: resume product image generation in background"
```

---

### Task 8: 脑洞放映厅后台分镜画面

**Files:**
- Modify: `apps/brain-film/src/studioEngine.js`
- Modify: `apps/brain-film/src/draftState.js`
- Modify: `apps/brain-film/tests/draftState.test.mjs`
- Modify: `apps/brain-film/tests/studioContracts.test.mjs`
- Modify: `packages/task-client/src/index.ts`

**Interfaces:**
- Consumes: Task 3 task client、Task 2 `/api/tasks`。
- Produces: 每个 `G.panels[i]` 字段 `imageTaskId`。
- Produces: `resumePanelTasks()`。

- [ ] **Step 1: 写草稿字段与恢复失败测试**

```js
test('draft keeps panel image task ids without keeping temporary task payloads', () => {
  const draft = normalizeDraft({
    panels: [{ cap: '小兔出发', prm: '草地', imageTaskId: 'task-img-1', imageTaskStatus: 'running' }],
  })
  assert.equal(draft.panels[0].imageTaskId, 'task-img-1')
  assert.equal(draft.panels[0].imageTaskStatus, 'running')
})

test('resumePanelTasks restores a completed image without charging quota again', async () => {
  const draw = fakeTask({ status: 'succeeded', result: { src: 'data:image/png;base64,AA' } })
  const panel = { imageTaskId: 'task-img-1', aiShots: 1 }
  await applyPanelTask(panel, draw, { shrinkImg: async (src) => src })
  assert.equal(panel.img.startsWith('data:image/png'), true)
  assert.equal(panel.aiShots, 1)
})
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `npm test --workspace @zhiya/brain-film`  
Expected: FAIL，草稿不保存 `imageTaskId`。

- [ ] **Step 3: 实现分镜任务**

```js
async function startAiPaint(panelIndex) {
  const p = G.panels[panelIndex]
  p.imageTaskId = crypto.randomUUID()
  p.imageTaskStatus = 'queued'
  saveDraft()
  await createTask({
    kind: 'film-image',
    clientTaskId: p.imageTaskId,
    payload: { prompt: buildPanelPrompt(p) },
  })
  watchPanelTask(panelIndex)
}
```

- 每个分镜独立任务；最多同时轮询 3 个分镜，其他显示“排队中”。
- `p.imageTaskStatus`、`p.aiMsg`、`p.imageTaskId` 写入草稿。
- 恢复草稿时自动查询非终态任务。
- 成功后才设置 `p.img`、`p.aiDrawn` 并增加 `G.aiShots`。
- 失败/中断不清除旧图，不扣额度。
- 移除重复的 catch/save 代码，保证每个任务只完成一次。

- [ ] **Step 4: 运行脑洞测试**

Run: `npm test --workspace @zhiya/brain-film`  
Run: `npm run test:py --workspace @zhiya/brain-film`  
Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add apps/brain-film packages/task-client/src/index.ts
git commit -m "perf: persist and resume film image tasks"
```

---

### Task 9: 作品详情与作品展示页统一优化

**Files:**
- Modify: `src/features/works/WorkDetailPage.tsx`
- Modify: `src/features/works/WorksGalleryPage.tsx`
- Modify: `src/features/works/works.css`
- Modify: `src/features/works/WorksGalleryPage.test.tsx`
- Create: `src/features/works/WorkDetailPage.test.tsx`

**Interfaces:**
- Consumes: `MobilePageHeader({ title, eyebrow, onBack, action })`。
- Produces: 两个页面统一返回控件和作品展示结构。

- [ ] **Step 1: 写统一返回按钮失败测试**

```tsx
it('uses the shared mobile header on a work detail page', async () => {
  renderWorksDetail()
  const back = await screen.findByRole('button', { name: '返回' })
  expect(back).toHaveClass('mobile-page-header__back')
  expect(screen.getByRole('heading', { name: '作品详情' })).toBeVisible()
})

it('does not render the old duplicate all-works section', async () => {
  render(<WorksGalleryPage onBack={vi.fn()} />)
  expect(await screen.findByRole('heading', { name: '作品展示' })).toBeVisible()
  expect(screen.queryByText(/^全部作品/)).not.toBeInTheDocument()
})
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `npx vitest run src/features/works/WorksGalleryPage.test.tsx src/features/works/WorkDetailPage.test.tsx`  
Expected: FAIL，页面仍使用旧返回按钮和重复列表。

- [ ] **Step 3: 统一页头**

```tsx
<MobilePageHeader
  className="work-detail-page-header"
  eyebrow="同学作品"
  title={sourceName}
  onBack={onBack}
/>
```

- 不存在作品时标题使用“作品详情”。
- 作品详情与作品展示使用同一 44px 圆角返回按钮。
- 页头保持 sticky 和安全区。

- [ ] **Step 4: 重构作品展示列表**

- 删除底部重复 `gallery-all-works`。
- 前 3 项使用精选卡片，附 `01/02/03` 排名标记。
- 第 4 项起使用两列紧凑网格。
- 卡片主体采用按钮或链接进入详情，点赞/收藏按钮不与进入详情点击区嵌套。
- 时间筛选按钮完整可点击，保留 `aria-pressed`。
- 空状态和数量显示保持现有业务语义。

```tsx
const featured = allPublished.slice(0, 3)
const rest = allPublished.slice(3)
```

- [ ] **Step 5: 更新响应式样式**

- 手机 375—430px 下两列卡片不溢出。
- 平板限制最大内容宽度，不拉伸为超宽卡片。
- 作者与互动数据使用可换行网格，不压缩成单字竖排。
- 返回按钮、标题和筛选区域沿用共享间距变量。

- [ ] **Step 6: 运行作品页测试**

Run: `npx vitest run src/features/works src/features/profile/WorksManagePage.test.tsx`  
Expected: PASS。

- [ ] **Step 7: 提交**

```bash
git add src/features/works
git commit -m "feat: unify and refine the works gallery"
```

---

### Task 10: 云端部署、APK 构建与最终验收

**Files:**
- Modify: `docs/android-release.md`
- Modify: `deploy/aliyun/.env.example`
- Output: `E:\智芽\运行文件\智芽.apk`

**Interfaces:**
- Consumes: Task 1—9 已提交实现。
- Produces: 唯一正式签名 APK，连接 `https://api.zhiyaedu.com.cn`。

**Environment additions:**
- `VISION_FAST_MODEL=qwen3.5-omni-flash-2026-03-15`
- `VISION_MODEL=qwen3-vl-plus`

生产 `/opt/zhiya/secrets/zhiya.env` 只补两个非敏感模型名，不输出或复制其他密钥。

- [ ] **Step 1: 运行完整测试和构建**

Run: `npm run test:all`  
Run: `npm run build`  
Expected: PASS。

- [ ] **Step 2: 记录云端回滚点**

记录当前容器镜像、Git 提交和非敏感环境变量哈希。备份新版任务目录迁移前的运行配置；不复制密钥明文。

- [ ] **Step 3: 部署香港服务**

```bash
cd /opt/zhiya/app
git pull --ff-only
cd deploy/aliyun
docker compose build --pull
docker compose up -d
docker compose ps
```

检查：

```text
https://api.zhiyaedu.com.cn/api/health
https://api.zhiyaedu.com.cn/brain/api/health
```

Expected: 两者 `ok=true`。

- [ ] **Step 4: 验证任务 API 和性能**

- 创建 `vision` 任务并轮询至成功。
- 创建 `product-image` 任务并轮询至成功。
- 创建 `film-image` 任务并轮询至成功。
- 验证相同 `clientTaskId` 返回同一 taskId。
- 验证 960px 测试图首选用时不超过 25 秒。
- 验证 AI 回答首段不超过 2.5 秒。
- 验证 TTS 1.5 秒回退在本机开始发音。

- [ ] **Step 5: 构建正式 APK**

Run: `npm run android:release`  
Expected:

- 包名 `com.zhiya.education`
- `versionCode=1`
- API `https://api.zhiyaedu.com.cn`
- APK Signature Scheme v2 验证通过
- `E:\智芽\运行文件` 中只有 `智芽.apk`

- [ ] **Step 6: Android 数据与功能验收**

覆盖安装前记录：

```bash
adb shell dumpsys package com.zhiya.education | grep -E 'versionCode|firstInstallTime|lastUpdateTime'
adb shell du -sk /data/data/com.zhiya.education/app_webview
```

使用 `adb install -r` 覆盖安装后确认：

- `firstInstallTime` 不变。
- 本地 WebView 数据目录仍存在。
- 登录页长按语音在松手后显示流式回答并播放声音。
- 摄像头 12 秒后进入后台，离开工具面板仍可完成。
- 创造模块离开页面后任务继续，重新进入恢复实物图。
- 脑洞关闭后重新打开草稿恢复分镜任务。
- 两个作品页返回按钮完全一致，无非预期横向溢出。

- [ ] **Step 7: 记录交付信息**

在 `docs/android-release.md` 记录：

- 最终 APK 大小
- SHA-256
- 签名证书 SHA-256
- 云端健康与实测性能
- 覆盖安装数据保留结果
- 真机仍需复测的项目

- [ ] **Step 8: 提交验收记录**

```bash
git add docs/android-release.md deploy/aliyun/.env.example
git commit -m "docs: record async AI release verification"
```

