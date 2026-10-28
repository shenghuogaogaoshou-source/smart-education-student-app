# 智芽 APK 稳定性与移动端排版修复 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复智芽 APK 的 AI 语音回复、1—2 年级跟读、摄像头六项能力和实物图生成，并统一移动端返回按钮、安全区、排版与作品删除交互。

**Architecture:** 保留现有页面与数据模型，在对话控制器、朗读适配器、图片采集适配器和云端代理四个公共边界修复根因，再用共享移动端头部与确认弹窗收敛视觉差异。云端和 APK 分开验证、一起发布，任何失败都可回滚。

**Tech Stack:** React 19、TypeScript、Vite、Vitest、Capacitor 8、Android SDK 36、Node.js 云端网关、Docker、Caddy。

**Spec:** `docs/superpowers/specs/2026-10-28-apk-stability-ui-redesign.md`

## Global Constraints

- 包名保持 `com.zhiya.education`，使用现有正式签名。
- 按用户要求保持 `versionCode=1`。
- 不清空或破坏 `localStorage`、IndexedDB、作品 Blob、学习进度、积分或勋章。
- 生产 API 保持 `https://api.zhiyaedu.com.cn`，秘密值不得进入 APK、Git 或日志。
- 页面内容、模块顺序和整体画风保持不变；只修复功能与移动端排版。
- 手机竖屏优先；平板不拉伸；视频和创意游戏允许横屏。
- 每个任务先写失败测试，再做最小修复并独立提交。

---

### Task 1: 建立可诊断、可重试的移动 API 请求层

**Files:**
- Create: `src/app/apiRequest.ts`
- Create: `src/app/apiRequest.test.ts`
- Modify: `src/app/mobileApi.ts`

**Interfaces:**
- Consumes: `resolveApiUrl(path, service, native)`。
- Produces: `requestWithRetry(input, init, options): Promise<Response>`，供 AI 对话、摄像头和跟读调用。

- [ ] **Step 1: 写失败测试，约束一次重试、不可恢复错误不重试和请求编号**

```ts
it('retries one transient 502 response and preserves the request id', async () => {
  const fetcher = vi.fn()
    .mockResolvedValueOnce(new Response('{"error":"provider_error"}', { status: 502 }))
    .mockResolvedValueOnce(new Response('{"reply":"你好"}', { status: 200 }))
  const response = await requestWithRetry('/api/companion/reply', {}, {
    fetcher,
    attempts: 2,
    requestId: 'req-test',
  })
  expect(response.status).toBe(200)
  expect(fetcher).toHaveBeenCalledTimes(2)
  expect(fetcher.mock.calls[0][1].headers['x-zhiya-request-id']).toBe('req-test')
})

it('does not retry a 400 response', async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response('{}', { status: 400 }))
  await requestWithRetry('/api/test', {}, { fetcher, attempts: 2 })
  expect(fetcher).toHaveBeenCalledTimes(1)
})
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `npx vitest run src/app/apiRequest.test.ts`  
Expected: FAIL，提示 `requestWithRetry` 尚不存在。

- [ ] **Step 3: 实现最小请求策略**

```ts
export type ApiRequestOptions = {
  attempts?: 1 | 2
  timeoutMs?: number
  requestId?: string
  fetcher?: typeof fetch
  service?: ApiService
}

export async function requestWithRetry(input: string, init: RequestInit = {}, options: ApiRequestOptions = {}) {
  const attempts = options.attempts ?? 1
  const requestId = options.requestId ?? crypto.randomUUID()
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const response = await (options.fetcher ?? fetch)(resolveApiUrl(input, options.service), {
      ...init,
      headers: { ...Object.fromEntries(new Headers(init.headers).entries()), 'x-zhiya-request-id': requestId },
    })
    if (attempt === attempts || ![408, 429, 500, 502, 503, 504].includes(response.status)) return response
    await new Promise((resolve) => setTimeout(resolve, 350))
  }
  throw new Error('unreachable')
}
```

实现时合并调用方 `AbortSignal` 与内部超时信号；取消请求不得重试。

- [ ] **Step 4: 运行测试**

Run: `npx vitest run src/app/apiRequest.test.ts src/app/mobileApi.test.ts`  
Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add src/app/apiRequest.ts src/app/apiRequest.test.ts src/app/mobileApi.ts
git commit -m "feat: add resilient mobile API requests"
```

---

### Task 2: 修复三个 AI 入口的回答与语音播放

**Files:**
- Modify: `src/features/ai_companion/companionChat.ts`
- Modify: `src/features/ai_companion/browserSpeech.ts`
- Modify: `src/features/ai_companion/conversation/conversationMachine.ts`
- Modify: `src/features/ai_companion/LoginCompanion.tsx`
- Modify: `src/features/ai_companion/AiCompanion.tsx`
- Modify: `src/features/ai_companion/AiPanel.tsx`
- Test: `src/features/ai_companion/browserSpeech.test.ts`
- Test: `src/features/ai_companion/conversation/conversationMachine.test.ts`
- Test: `src/features/auth/LoginCompanion.test.tsx`
- Test: `src/features/ai_companion/AiCompanion.test.tsx`

**Interfaces:**
- Consumes: `requestWithRetry` from Task 1；生产 `/api/companion/reply` 与语音接口。
- Produces: 所有 AI 入口共用的 `createConversationController` 行为；成功回答始终保留文字，播放优先云端、失败回退本机。

- [ ] **Step 1: 写失败测试，复现“识别成功但无回答”与 TTS 失败**

```ts
it('keeps the reply visible when speech playback fails', async () => {
  const controller = createConversationController({
    startCapture: fakeCapture('你是谁'),
    requestReply: vi.fn().mockResolvedValue('我是绒桃 Momo。'),
    speakReply: vi.fn(() => { throw new Error('tts unavailable') }),
    getCompanionId: () => 'momo',
    getVoiceEnabled: () => true,
  })
  controller.start()
  await vi.waitFor(() => expect(controller.getSnapshot().reply).toBe('我是绒桃 Momo。'))
  expect(controller.getSnapshot().status).toBe('idle')
})
```

再增加请求第一次 `502`、第二次成功，以及登录页/悬浮伙伴/面板都显示相同回答状态的测试。

- [ ] **Step 2: 运行目标测试并确认失败**

Run: `npx vitest run src/features/ai_companion/conversation/conversationMachine.test.ts src/features/ai_companion/browserSpeech.test.ts src/features/auth/LoginCompanion.test.tsx src/features/ai_companion/AiCompanion.test.tsx`  
Expected: 至少 TTS 抛错测试和重试测试 FAIL。

- [ ] **Step 3: 让回答请求使用一次重试，并修复播放异常状态**

```ts
const response = await requestWithRetry('/api/companion/reply', requestInit, {
  attempts: 2,
  timeoutMs: 45_000,
})
```

`conversationMachine` 捕获同步与异步播放错误；回答文字先发布，再开始播放。播放失败只结束 `speaking` 状态，不清除 `reply`。

- [ ] **Step 4: 增加云端 TTS 到 Android TTS 的回退**

```ts
export function speakCompanionReply(text: string, enabled: boolean, onEnd?: () => void): SpeechPlayback | null {
  if (!enabled) return null
  return isNativeApp()
    ? startCloudSpeechWithNativeFallback(text, onEnd)
    : startBrowserSpeech(text, onEnd)
}
```

云端音频播放失败时再调用 `@capacitor-community/text-to-speech`；两者都失败时触发 `onEnd`，文字继续显示。取消时同时中止 fetch、audio 和本机 TTS。

- [ ] **Step 5: 统一三个入口的错误操作**

错误气泡提供“重新回答”和“转文字提问”；登录页没有完整面板时，“转文字提问”打开紧凑文字输入。不得显示原始 HTTP 错误。

- [ ] **Step 6: 运行测试**

Run: `npx vitest run src/features/ai_companion src/features/auth/LoginCompanion.test.tsx`  
Expected: PASS。

- [ ] **Step 7: 提交**

```bash
git add src/features/ai_companion src/features/auth/LoginCompanion.test.tsx
git commit -m "fix: restore companion voice replies in native app"
```

---

### Task 3: 恢复 1—2 年级 APK 跟读并保持 Web 行为

**Files:**
- Modify: `src/features/knowledge/useReadAloud.ts`
- Modify: `src/features/knowledge/CourseContentPage.tsx`
- Test: `src/features/knowledge/useReadAloud.test.ts`
- Test: `src/features/knowledge/CourseContentPage.readAloud.test.tsx`

**Interfaces:**
- Consumes: Task 2 的 `speakCompanionReply(text, enabled, onEnd)` 播放回退能力。
- Produces: `useReadAloud(segments)` 在 Web 与 APK 使用相同段落顺序与界面状态。

- [ ] **Step 1: 写失败测试，覆盖原生平台开始、暂停、切页与卸载**

```ts
it('uses the native-capable player and advances through the same story segments', async () => {
  const playText = vi.fn((_text, _enabled, onEnd) => ({ cancel: vi.fn(), finish: onEnd }))
  const { result, unmount } = renderHook(() => useReadAloud(sampleSegments, { playText }))
  act(() => result.current.start(0))
  expect(playText).toHaveBeenCalledWith(expect.stringContaining('小多说'), true, expect.any(Function))
  act(() => playText.mock.results[0].value.finish())
  expect(result.current.activePanelIndex).toBe(1)
  unmount()
  expect(playText.mock.results[0].value.cancel).toHaveBeenCalled()
})
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `npx vitest run src/features/knowledge/useReadAloud.test.ts`  
Expected: 原生适配或生命周期断言 FAIL。

- [ ] **Step 3: 注入平台语音适配器并恢复页面接线**

将段落构建、播放状态和 UI 保持原样，只替换底层播放调用。确保离开课程、切换天数和应用后台时取消旧播放。

- [ ] **Step 4: 运行课程测试**

Run: `npx vitest run src/features/knowledge`  
Expected: PASS，现有 Web 跟读测试不回归。

- [ ] **Step 5: 提交**

```bash
git add src/features/knowledge
git commit -m "fix: restore grade 1-2 read aloud in Android"
```

---

### Task 4: 修复 APK 摄像头、相册与六项识别能力

**Files:**
- Create: `src/features/home/imageCapture.ts`
- Create: `src/features/home/imageCapture.test.ts`
- Modify: `src/features/home/CameraToolSheet.tsx`
- Modify: `src/features/home/recognitionTools.ts`
- Modify: `src/features/home/recognitionCompatibility.test.ts`
- Modify: `android/app/src/main/AndroidManifest.xml`（只有诊断证明权限声明缺失时才修改）

**Interfaces:**
- Consumes: Task 1 `requestWithRetry`；现有 `toolDetails`、`readImage`、`scanImage`。
- Produces: `captureImage(options): Promise<CapturedImage>` 和统一 `ImageCaptureError`。

- [ ] **Step 1: 写失败测试，覆盖权限、方向、等比压缩与六项映射**

```ts
it('compresses a portrait image without stretching it', async () => {
  const result = await normalizeCapturedImage(fakeImage(3024, 4032), { maxEdge: 1600 })
  expect(result.width).toBe(1200)
  expect(result.height).toBe(1600)
})

it.each(['object', 'scan', 'ocr', 'solve', 'translate', 'check'])('%s keeps the web request mapping', (tool) => {
  expect(buildRecognitionPayload(tool, sampleInput)).toMatchSnapshot()
})
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `npx vitest run src/features/home/imageCapture.test.ts src/features/home/CameraToolSheet.test.tsx src/features/home/recognitionCompatibility.test.ts`  
Expected: 新适配器测试 FAIL。

- [ ] **Step 3: 实现平台图片采集适配器**

Web 保留 `getUserMedia` 和文件上传。Android 优先使用可靠的原生/系统相机输入；权限拒绝返回 `permission-denied`，不把所有异常压成同一句话。统一处理 EXIF 方向、最大边 1600px、JPEG 质量 0.88 和原图宽高比。

- [ ] **Step 4: 让六项请求共用重试与分类错误**

```ts
const response = await requestWithRetry('/api/companion/recognize', request, {
  attempts: 2,
  timeoutMs: 210_000,
})
```

`scan` 保留本地扫码后再整理结果的现有逻辑。权限、图片读取、输入、超时、上游错误分别映射为不同用户提示，并提供相应动作。

- [ ] **Step 5: 运行首页工具测试**

Run: `npx vitest run src/features/home`  
Expected: PASS。

- [ ] **Step 6: 提交**

```bash
git add src/features/home android/app/src/main/AndroidManifest.xml
git commit -m "fix: restore native camera recognition tools"
```

---

### Task 5: 修复实物图 502 并增加一次安全重试

**Files:**
- Modify: `server/ai-proxy.mjs`
- Modify: `server/ai-proxy.test.mjs`
- Modify: `server/cloudGateway.mjs`
- Modify: `server/cloudGateway.test.mjs`
- Modify: `apps/creative-module/src/lib/artwork.ts`
- Modify: `apps/creative-module/tests/artwork.test.cjs`
- Modify: `apps/creative-module/src/components/workbench/WorkCheckPanel.tsx`

**Interfaces:**
- Consumes: `/api/ark/images/generations` 代理与现有 `generateProductImage`。
- Produces: 只重试临时错误一次；返回稳定错误码与请求编号；前端保留作品并可再次生成。

- [ ] **Step 1: 写失败测试，复现上游第一次 502、第二次成功**

```js
it('retries the image provider once after a transient 502', async () => {
  const upstream = vi.fn()
    .mockResolvedValueOnce(new Response('{}', { status: 502 }))
    .mockResolvedValueOnce(new Response('{"data":[{"url":"https://image.test/a.png"}]}', { status: 200 }))
  const result = await proxyImageGeneration(validRequest, { fetch: upstream })
  expect(result.status).toBe(200)
  expect(upstream).toHaveBeenCalledTimes(2)
})
```

再测试 401 不重试、两次 502 返回稳定 `image_provider_unavailable`，且不包含密钥和上游响应正文。

- [ ] **Step 2: 运行服务端与创作模块测试并确认失败**

Run: `npx vitest run --config vitest.server.config.ts server/ai-proxy.test.mjs server/cloudGateway.test.mjs`  
Run: `npm test --workspace @zhiya/creative-module`  
Expected: 新重试断言 FAIL。

- [ ] **Step 3: 实现服务端一次退避重试和安全日志**

```js
const retryableImageStatus = new Set([408, 429, 500, 502, 503, 504])
```

只记录 `requestId`、耗时、尝试次数、上游状态码和错误类别；不记录 Authorization、完整请求体或上游正文。

- [ ] **Step 4: 改进创作模块错误与再次生成**

`generateProductImage` 将稳定错误码转成儿童可理解文案。`WorkCheckPanel` 失败时不清空标题、节点、边、提示词；按钮恢复为“再次生成实物图”。

- [ ] **Step 5: 运行测试**

Run: `npm run test:server && npm run test:games`  
Expected: PASS。

- [ ] **Step 6: 提交**

```bash
git add server apps/creative-module
git commit -m "fix: retry transient product image failures"
```

---

### Task 6: 建立共享移动端头部、安全区与方向规则

**Files:**
- Create: `src/components/MobilePageHeader.tsx`
- Create: `src/components/MobilePageHeader.test.tsx`
- Create: `src/components/ConfirmDialog.tsx`
- Create: `src/components/ConfirmDialog.test.tsx`
- Create: `src/styles/mobile-layout.css`
- Modify: `src/app/global.css`
- Modify: `src/features/auth/ForgotPasswordPage.tsx`
- Modify: `src/features/auth/GuardianConsentPage.tsx`
- Modify: `src/features/auth/RegisterPage.tsx`
- Modify: `src/features/ai_companion/AiPanel.tsx`
- Modify: `src/features/knowledge/CourseContentPage.tsx`
- Modify: `src/features/games/EmbeddedGamePage.tsx`
- Modify: `src/features/home/CameraToolSheet.tsx`
- Modify: `src/features/home/NotificationsPage.tsx`
- Modify: `src/features/profile/AiCenterPage.tsx`
- Modify: `src/features/profile/CalendarPage.tsx`
- Modify: `src/features/profile/FavoritesPage.tsx`
- Modify: `src/features/profile/HistoryPage.tsx`
- Modify: `src/features/profile/LearningSchedulePage.tsx`
- Modify: `src/features/profile/LearningToolsDetailPage.tsx`
- Modify: `src/features/profile/MallPage.tsx`
- Modify: `src/features/profile/MedalsPage.tsx`
- Modify: `src/features/profile/PointsPage.tsx`
- Modify: `src/features/profile/ProfileDetailPage.tsx`
- Modify: `src/features/profile/ProfileEditPage.tsx`
- Modify: `src/features/profile/RankingPage.tsx`
- Modify: `src/features/profile/WorksManagePage.tsx`
- Modify: `src/features/profile/WrongBookPage.tsx`
- Modify: `src/features/settings/SettingsPage.tsx`
- Modify: `src/features/settings/SettingDetailPage.tsx`
- Modify: `src/features/works/WorkDetailPage.tsx`
- Modify: `src/features/works/WorksGalleryPage.tsx`

**Interfaces:**
- Produces: `MobilePageHeader({ title, eyebrow, onBack, action })`；`ConfirmDialog({ open, title, description, confirmLabel, busy, onConfirm, onCancel })`。

- [ ] **Step 1: 写共享组件失败测试**

```tsx
it('renders one accessible back button and a non-overlapping action slot', () => {
  render(<MobilePageHeader title="作品管理" onBack={onBack} action={<button>上传作品</button>} />)
  expect(screen.getAllByRole('button', { name: '返回' })).toHaveLength(1)
  expect(screen.getByRole('heading', { name: '作品管理' })).toBeVisible()
})
```

确认弹窗测试必须覆盖取消、进行中禁用、确认一次且只触发一次。

- [ ] **Step 2: 运行组件测试并确认失败**

Run: `npx vitest run src/components/MobilePageHeader.test.tsx src/components/ConfirmDialog.test.tsx`  
Expected: FAIL，组件尚不存在。

- [ ] **Step 3: 实现组件和布局变量**

```css
:root {
  --mobile-page-gutter: clamp(16px, 4vw, 24px);
  --mobile-header-control: 44px;
  --mobile-bottom-nav: 76px;
  --mobile-safe-top: env(safe-area-inset-top, 0px);
  --mobile-safe-bottom: env(safe-area-inset-bottom, 0px);
}
```

返回按钮触控区域至少 44×44px。平板内容设置合理 `max-width`，不拉伸卡片。非游戏页面横屏显示旋转提示；游戏和视频容器添加豁免类。

- [ ] **Step 4: 逐页迁移返回按钮**

按上述文件清单，以“我的子页 → 作品页 → 设置页 → 课程页 → 认证页 → 游戏与弹窗”顺序迁移。每迁移一组就运行对应测试，不修改页面内容和模块顺序。

- [ ] **Step 5: 运行组件和页面测试**

Run: `npx vitest run src/components src/features/profile src/features/works src/features/settings src/features/knowledge`  
Expected: PASS。

- [ ] **Step 6: 提交**

```bash
git add src/components src/styles src/features
git commit -m "refactor: unify mobile page headers and safe areas"
```

---

### Task 7: 重做作品删除确认并修复卡片挤压

**Files:**
- Modify: `src/features/profile/WorksManagePage.tsx`
- Modify: `src/features/profile/profile.css`
- Modify: `src/features/profile/WorksManagePage.test.tsx`

**Interfaces:**
- Consumes: Task 6 `ConfirmDialog`。
- Produces: 卡片内单个“删除”按钮；独立二次确认；失败不移除作品。

- [ ] **Step 1: 写失败测试**

```tsx
it('opens a separate confirmation dialog and deletes only after confirmation', async () => {
  renderWorksPage()
  await user.click(screen.getByRole('button', { name: '删除作品' }))
  expect(screen.getByRole('dialog', { name: '删除作品？' })).toBeVisible()
  expect(remove).not.toHaveBeenCalled()
  await user.click(screen.getByRole('button', { name: '确认删除' }))
  expect(remove).toHaveBeenCalledTimes(1)
})
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `npx vitest run src/features/profile/WorksManagePage.test.tsx`  
Expected: FAIL，因为当前确认按钮仍挤在卡片中。

- [ ] **Step 3: 使用确认弹窗并调整卡片动作区**

删除按钮显示 `Trash2 + 删除`，使用红色描边；卡片动作允许合理换行但按钮文字不竖排。确认期间禁用按钮，失败时弹窗保留并显示重试提示。

- [ ] **Step 4: 运行测试**

Run: `npx vitest run src/features/profile/WorksManagePage.test.tsx src/features/works/repository.test.ts`  
Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add src/features/profile/WorksManagePage.tsx src/features/profile/profile.css src/features/profile/WorksManagePage.test.tsx
git commit -m "fix: move work deletion into confirmation dialog"
```

---

### Task 8: 全页面响应式巡检与回归修复

**Files:**
- Modify: 仅巡检中确认有溢出、遮挡或错位的现有 CSS/组件文件
- Create: `artifacts/apk-layout-review/report.md`
- Create: `artifacts/apk-layout-review/screenshots/` 下的证据截图

**Interfaces:**
- Consumes: Task 6 的共享布局变量和组件。
- Produces: 手机与平板关键页面无溢出的证据报告。

- [ ] **Step 1: 启动 Web 预览并建立页面清单**

覆盖登录、首页、摄像头六项弹窗、三套知识详情、测试地图与答题、我的、成长安排、成长画像、商城、作品管理、AI 对话、设置、脑洞放映厅和创造模块。

- [ ] **Step 2: 在 360×800、390×844、412×915、768×1024 四组视口截图**

每次导航后检查控制台错误。记录状态栏重叠、返回按钮不齐、按钮竖排、卡片溢出、底部导航遮挡、伙伴越界和文字截断。

- [ ] **Step 3: 只修复有证据的问题**

每个视觉问题先在报告中记录页面、视口和截图，再做最小 CSS 修改；不得顺手更换文案、颜色主题或模块顺序。

- [ ] **Step 4: 重跑完整前端测试和生产构建**

Run: `npm test -- --run`  
Run: `npm run build`  
Expected: PASS；无 TypeScript 或 Vite 构建错误。

- [ ] **Step 5: 提交**

```bash
git add src apps artifacts/apk-layout-review
git commit -m "fix: polish responsive APK layouts"
```

---

### Task 9: 云端部署、APK 构建与最终验收

**Files:**
- Modify: `docs/android-release.md`（仅记录新的验收结论，不记录秘密）
- Output: `E:\智芽\运行文件\智芽.apk`

**Interfaces:**
- Consumes: Tasks 1—8 的已提交实现；现有香港服务器、签名材料和 `npm run android:release`。
- Produces: 已签名、已安装验证、连接生产云端的唯一 APK。

- [ ] **Step 1: 检查 5 小时用量、工作树和完整测试**

Run: `npm run test:all`  
Expected: 全部 PASS。确认未提交内容只包含已知且不属于本轮的行尾状态或验证材料。

- [ ] **Step 2: 保存云端回滚依据并部署**

记录当前运行容器、Git 提交和非敏感配置哈希；部署新提交后检查：

```text
GET https://api.zhiyaedu.com.cn/api/health
GET https://api.zhiyaedu.com.cn/brain/api/health
```

Expected: 两者 `ok=true`。随后有限调用 AI 回答、TTS、六项识别路径和实物图。

- [ ] **Step 3: 构建正式 APK**

Run: `npm run android:release`  
Expected: 使用现有正式签名，包名 `com.zhiya.education`，`versionCode=1`。

- [ ] **Step 4: 验证签名、安装与数据保留**

先在旧 APK 中写入学习进度、积分、勋章和作品，再使用覆盖安装命令安装新版。确认数据仍在；不得卸载或清除应用数据。验证冷启动、`123 / 123` 登录、三个 AI 入口、跟读、摄像头六项能力、实物图、删除确认和主要页面排版。

- [ ] **Step 5: 交付唯一 APK**

安全、定向移除 `E:\智芽\运行文件` 中旧的 APK 文件，再复制最终签名包为 `E:\智芽\运行文件\智芽.apk`。确认目录只有该 APK，记录大小和 SHA-256。

- [ ] **Step 6: 更新验收文档并提交**

```bash
git add docs/android-release.md
git commit -m "docs: record APK stability release verification"
```

- [ ] **Step 7: 提供真实手机复测清单**

清单限制在 3 分钟内完成：麦克风长按问答、摄像头拍摄与六项工具、AI 语音播放、1—2 年级跟读、实物图、作品删除与平板显示。
