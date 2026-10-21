# 智芽创意游戏与作品中心联动 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** 将脑洞放映厅和创造模块作为两个可在智芽 APP 内打开的独立子应用，并让游戏导出、任意文件上传、我的作品和公开作品流共享同一套本地数据。

**Architecture:** 把两个游戏迁入仓库的 `apps/` 工作区，由根开发脚本同时启动，并用受控 iframe 和版本化 `postMessage` 协议连接智芽。智芽侧以 IndexedDB 作品仓库保存元数据和 Blob，通过 `WorksProvider` 向首页、作品管理和详情页提供一致状态；图标仍使用静态图片资源，但六个入口按统一视觉规范重新生成。

**Tech Stack:** React 19（智芽）、React 18（两个子应用）、TypeScript、Vite、Vitest、Testing Library、IndexedDB、`fake-indexeddb`、浏览器 `postMessage`、DeepSeek 现有代理（不提交密钥）

**Spec:** `docs/superpowers/specs/2026-10-20-games-and-works-integration-design.md`

## Global Constraints

- 项目名称始终显示为“智芽”，产品只面向小学 1—6 年级。
- 保留首页“滚动资讯 + 游戏区 + 成果展示”的奶油白、浅桃粉、柔和立体画风和两排三列布局。
- 精选入口固定顺序：脑洞放映厅、创造模块、分类挑战、机器判断局、创意拼搭站；第六项为“全部游戏”。
- 两个游戏必须是独立子应用；启动智芽时同时启动服务，但不得自动打开游戏窗口。
- 游戏必须在智芽 APP 框内作为二级页面打开，不跳转新窗口。
- 游戏导出默认进入当前账号的“我的作品·草稿”，不得直接发布。
- “保存到智芽”和“保存到本地”必须是两个明确动作。
- 删除所有写死的普通演示作品；公开区只显示真实 `published` 记录。
- 外部上传不得限制文件格式；不能预览的格式显示通用文件卡片且不得直接执行。
- 首版仅保存本地演示账号数据；不伪造跨设备同步或真实多用户社区。
- 不提交 API 密钥、`.env.local`、`node_modules`、`dist`、缓存或用户生成文件。
- 暂停中的 AI 伙伴工作树和 stash 不得修改、删除或合并。

---

## File Structure Map

### Repository and runtime

- `apps/brain-film/`：迁入后的脑洞放映厅独立应用。
- `apps/creative-module/`：迁入后的创造模块独立应用。
- `packages/works-bridge/src/index.ts`：宿主和子应用共享的消息协议、类型和校验。
- `server/dev.mjs`：同时启动 AI 代理、智芽 Web 和两个子游戏服务。
- `scripts/build-embedded-games.mjs`：构建两个子应用并复制到智芽发布产物。
- `src/features/games/gameRegistry.ts`：游戏 ID、标题、开发 URL、发布 URL和允许来源的唯一配置。
- `src/features/games/EmbeddedGamePage.tsx`：智芽内二级游戏容器。
- `src/features/games/GameWorkBridge.tsx`：接收 iframe 作品消息并写入作品仓库。

### Work domain

- `src/features/works/types.ts`：作品、状态、评论和输入类型。
- `src/features/works/preview.ts`：MIME 类型到预览类型的纯函数。
- `src/features/works/repository.ts`：`WorkRepository` 接口和 IndexedDB 实现。
- `src/features/works/memoryRepository.ts`：测试用内存实现。
- `src/features/works/WorksProvider.tsx`：按当前账号加载和更新作品的 React 边界。
- `src/features/works/moderation.ts`：本地文本规范、危险打开策略和可替换审核接口。
- `src/features/works/WorkAssetPreview.tsx`：图片、视频、音频、文本、PDF和通用文件预览。
- `src/features/works/UploadWorkDialog.tsx`：任意格式外部上传表单。

### Existing UI changes

- `src/features/home/homeData.ts`：游戏入口改名、换图、换路由；删除静态作品数据。
- `src/features/home/HomePage.tsx`：前两个入口打开二级游戏页。
- `src/features/home/AchievementShowcase.tsx`：读取已发布作品，支持真实互动和空状态。
- `src/features/profile/WorksManagePage.tsx`：读取真实状态、上传、发布、撤回和删除。
- `src/features/works/WorksGalleryPage.tsx`：真实公开列表和时间筛选。
- `src/features/works/WorkDetailPage.tsx`：真实文件预览、互动和留言。
- `src/features/shell/MainShell.tsx`：增加游戏页和作品编辑导航。
- `src/app/App.tsx`：登录后挂载 `WorksProvider`。

---

### Task 1: 将两个独立游戏迁入仓库并建立工作区基线

**Files:**
- Create: `apps/brain-film/**`（来自 `E:/移动应用--GPT/创造性游戏/脑洞放映厅`，排除生成物和私密配置）
- Create: `apps/creative-module/**`（来自 `E:/移动应用--GPT/创造性游戏/创造模块`，排除生成物和私密配置）
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `.gitignore`
- Test: `scripts/workspace-layout.test.mjs`

**Interfaces:**
- Consumes: 两个现有游戏的完整源码和各自 `package.json`。
- Produces: npm 工作区 `@zhiya/brain-film`、`@zhiya/creative-module`，供后续启动、构建和消息桥任务使用。

- [x] **Step 1: 写工作区布局失败测试**

```js
// scripts/workspace-layout.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

test('两个创意游戏作为仓库内工作区存在', () => {
  const root = JSON.parse(readFileSync(new URL('../package.json', import.meta.url)))
  assert.deepEqual(root.workspaces, ['apps/*', 'packages/*'])
  assert.equal(existsSync(new URL('../apps/brain-film/package.json', import.meta.url)), true)
  assert.equal(existsSync(new URL('../apps/creative-module/package.json', import.meta.url)), true)
})
```

- [x] **Step 2: 运行测试确认失败**

Run: `node --test scripts/workspace-layout.test.mjs`  
Expected: FAIL，根包尚无 `workspaces` 或两个目录不存在。

- [x] **Step 3: 迁移源码并清理不应复制的内容**

使用 PowerShell 复制源码；`robocopy` 返回码 0—7 视为成功，8 以上视为失败：

```powershell
robocopy 'E:\移动应用--GPT\创造性游戏\脑洞放映厅' '.\apps\brain-film' /E /XD node_modules dist .git .vite /XF .env .env.local
robocopy 'E:\移动应用--GPT\创造性游戏\创造模块' '.\apps\creative-module' /E /XD node_modules dist .git .vite /XF .env .env.local
```

将两个子包名称改为：

```json
{ "name": "@zhiya/brain-film", "private": true }
{ "name": "@zhiya/creative-module", "private": true }
```

根包增加：

```json
{
  "workspaces": ["apps/*", "packages/*"]
}
```

`.gitignore` 增加：

```gitignore
apps/*/dist/
apps/*/.env
apps/*/.env.local
apps/*/node_modules/
```

- [x] **Step 4: 安装工作区依赖并跑三个应用的基线检查**

Run:

```powershell
npm install
npm test -- --run
npm --workspace @zhiya/brain-film test
npm --workspace @zhiya/brain-film run build
npm --workspace @zhiya/creative-module run build
```

Expected: 根应用测试通过；脑洞放映厅测试和两个子应用构建通过。

- [x] **Step 5: 重跑布局测试并提交**

Run: `node --test scripts/workspace-layout.test.mjs`  
Expected: PASS。

```powershell
git add package.json package-lock.json .gitignore scripts/workspace-layout.test.mjs apps
git commit -m "chore: import creative game workspaces"
```

---

### Task 2: 一个命令启动和构建三个前端

**Files:**
- Modify: `server/dev.mjs`
- Create: `server/devProcesses.mjs`
- Create: `server/devProcesses.test.mjs`
- Create: `scripts/build-embedded-games.mjs`
- Modify: `package.json`
- Modify: `apps/brain-film/vite.config.ts`
- Modify: `apps/creative-module/vite.config.ts`

**Interfaces:**
- Consumes: Task 1 的两个 npm 工作区。
- Produces: `buildDevProcessSpecs(root, forwardedArgs)` 和生产静态路径 `/embedded-games/brain-film/`、`/embedded-games/creative-module/`。

- [x] **Step 1: 写进程规格失败测试**

```js
// server/devProcesses.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { buildDevProcessSpecs } from './devProcesses.mjs'

test('dev 同时启动两个游戏且不打开浏览器', () => {
  const specs = buildDevProcessSpecs('C:/repo', ['--host', '127.0.0.1', '--port', '5175'])
  assert.deepEqual(specs.map((item) => item.name), ['ai-proxy', 'zhiya-web', 'brain-film', 'creative-module'])
  assert.equal(specs.some((item) => item.args.includes('--open')), false)
  assert.match(specs.find((item) => item.name === 'brain-film').args.join(' '), /5191/)
  assert.match(specs.find((item) => item.name === 'creative-module').args.join(' '), /5192/)
})
```

- [x] **Step 2: 运行测试确认失败**

Run: `node --test server/devProcesses.test.mjs`  
Expected: FAIL，模块尚不存在。

- [x] **Step 3: 实现可测试的进程清单和统一停止逻辑**

```js
// server/devProcesses.mjs
import { join } from 'node:path'

export function buildDevProcessSpecs(root, forwardedArgs) {
  const vite = join(root, 'node_modules', 'vite', 'bin', 'vite.js')
  return [
    { name: 'ai-proxy', cwd: root, args: [join(root, 'server', 'ai-proxy.mjs')] },
    { name: 'zhiya-web', cwd: root, args: [vite, ...forwardedArgs] },
    { name: 'brain-film', cwd: join(root, 'apps', 'brain-film'), args: [vite, '--host', '127.0.0.1', '--port', '5191', '--strictPort'] },
    { name: 'creative-module', cwd: join(root, 'apps', 'creative-module'), args: [vite, '--host', '127.0.0.1', '--port', '5192', '--strictPort'] },
  ]
}
```

`server/dev.mjs` 遍历清单启动；任一必需进程异常退出时终止本组进程，不能误杀系统中其他 Node 服务。

- [x] **Step 4: 配置生产 base 和聚合构建**

子应用按环境设置：

```ts
base: process.env.NODE_ENV === 'production'
  ? '/embedded-games/brain-film/'
  : '/'
```

创造模块对应 `/embedded-games/creative-module/`。`scripts/build-embedded-games.mjs` 依次执行两个 workspace 的 build，再把各自 `dist` 复制到根 `dist/embedded-games/<id>`。根脚本改为：

```json
{
  "scripts": {
    "build:web": "tsc -b && vite build",
    "build:games": "node scripts/build-embedded-games.mjs",
    "build": "npm run build:web && npm run build:games"
  }
}
```

- [x] **Step 5: 验证进程规格、构建和实际启动**

Run:

```powershell
node --test server/devProcesses.test.mjs
npm run build
Test-Path .\dist\embedded-games\brain-film\index.html
Test-Path .\dist\embedded-games\creative-module\index.html
```

Expected: 测试和构建通过，两个 `Test-Path` 返回 `True`。

- [x] **Step 6: 提交**

```powershell
git add server scripts package.json package-lock.json apps/*/vite.config.ts
git commit -m "feat: orchestrate embedded game runtimes"
```

---

### Task 3: 建立宿主与子游戏共享的作品桥协议

**Files:**
- Create: `packages/works-bridge/package.json`
- Create: `packages/works-bridge/src/index.ts`
- Test: `src/features/games/workBridgeProtocol.test.ts`
- Modify: `apps/brain-film/package.json`
- Modify: `apps/creative-module/package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Consumes: 浏览器 `MessageEvent` 和 `Blob`。
- Produces: `WORK_SAVE_DRAFT`, `WORK_SAVED`, `WORK_SAVE_FAILED`, `isSaveDraftMessage(value)`、`postDraftToHost(draft)`。

- [x] **Step 1: 写协议失败测试**

```ts
import { describe, expect, it } from 'vitest'
import { isSaveDraftMessage, WORK_SAVE_DRAFT } from '@zhiya/works-bridge'

describe('works bridge protocol', () => {
  it('只接受版本正确且带 Blob 的草稿', () => {
    expect(isSaveDraftMessage({
      type: WORK_SAVE_DRAFT,
      version: 1,
      source: 'brain-film',
      draftId: 'film-1',
      title: '云朵电影院',
      description: '',
      fileName: '云朵电影院.bhfilm',
      blob: new Blob(['{}'], { type: 'application/json' }),
    })).toBe(true)
    expect(isSaveDraftMessage({ type: WORK_SAVE_DRAFT, version: 2 })).toBe(false)
  })
})
```

- [x] **Step 2: 运行测试确认失败**

Run: `npm test -- --run src/features/games/workBridgeProtocol.test.ts`  
Expected: FAIL，模块尚不存在。

- [x] **Step 3: 实现协议和发送函数**

```ts
export const WORK_SAVE_DRAFT = 'zhiya.work.save-draft.v1' as const
export const WORK_SAVED = 'zhiya.work.saved.v1' as const
export const WORK_SAVE_FAILED = 'zhiya.work.save-failed.v1' as const

export type GameSource = 'brain-film' | 'creative-module'
export type SaveDraftMessage = {
  type: typeof WORK_SAVE_DRAFT
  version: 1
  source: GameSource
  draftId: string
  title: string
  description: string
  fileName: string
  blob: Blob
}

export function postDraftToHost(message: Omit<SaveDraftMessage, 'type' | 'version'>) {
  window.parent.postMessage({ ...message, type: WORK_SAVE_DRAFT, version: 1 }, '*')
}
```

校验函数同时限制标题 80 字、介绍 500 字、文件名非空、来源只能取两个枚举值。

- [x] **Step 4: 连接三个工作区并验证**

两个子应用加入：

```json
{ "dependencies": { "@zhiya/works-bridge": "workspace:*" } }
```

Run:

```powershell
npm install
npm test -- --run src/features/games/workBridgeProtocol.test.ts
npm run build
```

Expected: PASS。

- [x] **Step 5: 提交**

```powershell
git add packages apps/*/package.json package-lock.json
git commit -m "feat: define embedded game work bridge"
```

---

### Task 4: 在智芽内打开两个二级游戏页面

**Files:**
- Create: `src/features/games/gameRegistry.ts`
- Create: `src/features/games/EmbeddedGamePage.tsx`
- Create: `src/features/games/games.css`
- Create: `src/features/games/EmbeddedGamePage.test.tsx`
- Modify: `src/features/home/homeData.ts`
- Modify: `src/features/home/HomePage.tsx`
- Modify: `src/features/home/HomePage.test.tsx`
- Modify: `src/features/shell/MainShell.tsx`
- Modify: `src/features/shell/MainShell.test.tsx`

**Interfaces:**
- Consumes: `GameId = 'brain-film' | 'creative-module'`。
- Produces: `getGameConfig(id)`、`EmbeddedGamePage({ gameId, onBack })`、`HomePage.onOpenGame(gameId)`。

- [x] **Step 1: 写首页顺序和二级页失败测试**

```tsx
it('前两个精选入口按确认顺序打开游戏', async () => {
  const onOpenGame = vi.fn()
  render(<HomePage onOpenGame={onOpenGame} />)
  await user.click(screen.getByRole('button', { name: /脑洞放映厅/ }))
  expect(onOpenGame).toHaveBeenCalledWith('brain-film')
  await user.click(screen.getByRole('button', { name: /创造模块/ }))
  expect(onOpenGame).toHaveBeenCalledWith('creative-module')
})

it('游戏二级页在应用内渲染并可返回', async () => {
  const onBack = vi.fn()
  render(<EmbeddedGamePage gameId="brain-film" onBack={onBack} />)
  expect(screen.getByTitle('脑洞放映厅')).toHaveAttribute('src', 'http://127.0.0.1:5191')
  await user.click(screen.getByRole('button', { name: '返回首页' }))
  expect(onBack).toHaveBeenCalled()
})
```

- [x] **Step 2: 运行测试确认失败**

Run: `npm test -- --run src/features/home/HomePage.test.tsx src/features/games/EmbeddedGamePage.test.tsx`  
Expected: FAIL，prop 和组件不存在。

- [x] **Step 3: 实现注册表和游戏页**

```ts
export const gameRegistry = {
  'brain-film': {
    title: '脑洞放映厅',
    devUrl: 'http://127.0.0.1:5191',
    productionUrl: '/embedded-games/brain-film/',
  },
  'creative-module': {
    title: '创造模块',
    devUrl: 'http://127.0.0.1:5192',
    productionUrl: '/embedded-games/creative-module/',
  },
} as const
```

`EmbeddedGamePage` 显示返回按钮、标题、加载状态、5 秒启动失败提示和重试按钮；iframe 使用 `title`，并限制在 APP 框内。

- [x] **Step 4: 接入 MainShell 导航栈**

增加视图：

```ts
| { kind: 'embedded-game'; id: number; gameId: GameId }
```

游戏页不显示底部导航和浮动 AI 伙伴，防止遮挡游戏操作；返回后恢复首页滚动位置。

- [x] **Step 5: 添加移动端样式并通过测试**

Run:

```powershell
npm test -- --run src/features/home/HomePage.test.tsx src/features/games/EmbeddedGamePage.test.tsx src/features/shell/MainShell.test.tsx
npm run build
```

Expected: PASS。

- [x] **Step 6: 提交**

```powershell
git add src/features/games src/features/home src/features/shell
git commit -m "feat: open creative games inside zhiya"
```

---

### Task 5: 统一重绘六个首页游戏图标

**Files:**
- Create: `public/games/elementary/brain-film.png`
- Create: `public/games/elementary/creative-module.png`
- Replace: `public/games/elementary/sort.png`
- Replace: `public/games/elementary/bot.png`
- Replace: `public/games/elementary/create.png`
- Replace: `public/games/elementary/all.png`
- Delete: `public/games/elementary/vision.png`
- Delete: `public/games/elementary/prompt.png`
- Create: `src/features/home/gameAssets.test.ts`

**Interfaces:**
- Consumes: `homeData.games[].icon`。
- Produces: 六张 1:1、透明背景、统一主体比例的 PNG。

- [x] **Step 1: 写资源清单失败测试**

```ts
import { describe, expect, it } from 'vitest'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { games } from './homeData'

it('六个游戏入口都使用新资源名', () => {
  const names = [...games.map((game) => game.icon), 'all']
  expect(names).toEqual(['brain-film', 'creative-module', 'sort', 'bot', 'create', 'all'])
  names.forEach((name) => expect(existsSync(resolve('public/games/elementary', `${name}.png`))).toBe(true))
})
```

- [x] **Step 2: 运行测试确认失败**

Run: `npm test -- --run src/features/home/gameAssets.test.ts`  
Expected: FAIL，前两个新资源不存在或数据仍使用旧名。

- [x] **Step 3: 使用 imagegen 逐张生成图标**

每张均使用透明背景、1:1。共同提示词前缀：

```text
小学 AI 教育应用“智芽”的精致游戏入口图标，柔和奶油白、浅桃粉、杏橙与少量彩虹高光，软陶与磨砂玻璃结合的轻立体质感，圆润边缘，右上方柔光，轻柔投影，主体居中占画布约 72%，无文字，无边框，透明背景，小尺寸仍易识别。
```

分别追加主体：胶片放映幕与故事星光；可拼模块与节点连线；彩色分类盒；友好判断机器人；创意积木结构；小奖杯与游戏合集卡片。

- [x] **Step 4: 更新资源引用并做视觉验收**

`homeData.ts` 的前两个图标改为 `brain-film`、`creative-module`；浏览 375 px APP 宽度，确认六张图主体大小相近、没有白色方底、没有文字伪影。

- [x] **Step 5: 运行测试和提交**

Run:

```powershell
npm test -- --run src/features/home/gameAssets.test.ts src/features/home/HomePage.test.tsx
npm run build
```

```powershell
git add public/games/elementary src/features/home
git commit -m "feat: refresh creative game icon set"
```

---

### Task 6: 建立 IndexedDB 统一作品仓库

**Files:**
- Create: `src/features/works/types.ts`
- Create: `src/features/works/preview.ts`
- Create: `src/features/works/repository.ts`
- Create: `src/features/works/memoryRepository.ts`
- Create: `src/features/works/repository.test.ts`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `src/test/setup.ts`

**Interfaces:**
- Consumes: `SaveWorkDraftInput`、`Blob`、`accountId`。
- Produces: `WorkRecord`、`WorkRepository`、`createIndexedDbWorkRepository()`、`createMemoryWorkRepository()`、`detectPreviewKind(mimeType, fileName)`。

- [x] **Step 1: 写仓库生命周期失败测试**

```ts
it('按账号保存 Blob 草稿并完成发布生命周期', async () => {
  const repository = createIndexedDbWorkRepository('zhiya-works-test')
  const draft = await repository.saveDraft('account-a', {
    source: 'brain-film', sourceDraftId: 'film-1', title: '云朵电影院',
    description: '', aiTools: ['脑洞放映厅'], fileName: 'film.bhfilm',
    blob: new Blob(['film'], { type: 'application/json' }),
  })
  expect(draft.status).toBe('draft')
  expect(await repository.list('account-b')).toEqual([])
  await repository.setStatus('account-a', draft.id, 'reviewing')
  await repository.setStatus('account-a', draft.id, 'published')
  expect((await repository.get('account-a', draft.id))?.status).toBe('published')
  expect(await (await repository.getAsset('account-a', draft.assetId))?.text()).toBe('film')
})
```

同时测试：相同 `source + sourceDraftId` 更新原草稿；不同账号不串数据；任意扩展名得到 `generic`；删除作品同时删除 Blob。

- [x] **Step 2: 安装测试依赖并确认失败**

Run:

```powershell
npm install -D fake-indexeddb
npm test -- --run src/features/works/repository.test.ts
```

Expected: FAIL，仓库模块不存在。

- [x] **Step 3: 定义精确类型**

```ts
export type WorkSource = 'brain-film' | 'creative-module' | 'external-upload'
export type WorkStatus = 'draft' | 'reviewing' | 'published' | 'private'
export type PreviewKind = 'image' | 'video' | 'audio' | 'text' | 'pdf' | 'generic'

export type WorkComment = {
  id: string; authorId: string; authorName: string; text: string; createdAt: string
}

export type WorkRecord = {
  id: string; ownerId: string; source: WorkSource; sourceDraftId?: string
  title: string; description: string; aiTools: string[]; status: WorkStatus
  assetId: string; fileName: string; mimeType: string; byteSize: number
  previewKind: PreviewKind; createdAt: string; updatedAt: string; publishedAt?: string
  likes: number; favorites: number; likedBy: string[]; favoritedBy: string[]
  comments: WorkComment[]; reviewMessage?: string
}

export type SaveWorkDraftInput = {
  source: WorkSource; sourceDraftId?: string; title: string; description: string
  aiTools: string[]; fileName: string; blob: Blob
}

export interface WorkRepository {
  list(accountId: string): Promise<WorkRecord[]>
  get(accountId: string, workId: string): Promise<WorkRecord | undefined>
  getAsset(accountId: string, assetId: string): Promise<Blob | undefined>
  saveDraft(accountId: string, input: SaveWorkDraftInput): Promise<WorkRecord>
  update(accountId: string, workId: string, patch: Partial<Pick<WorkRecord, 'title' | 'description' | 'aiTools' | 'reviewMessage'>>): Promise<WorkRecord>
  setStatus(accountId: string, workId: string, status: WorkStatus): Promise<WorkRecord>
  delete(accountId: string, workId: string): Promise<void>
}
```

- [x] **Step 4: 实现原子事务**

IndexedDB 使用 `works`、`assets` 两个 object store；`saveDraft`、`delete` 在同一读写事务内更新元数据和文件。浏览器配额错误转换为 `WorkStorageError('quota-exceeded')`。

- [x] **Step 5: 提供同接口内存仓库并通过测试**

Run:

```powershell
npm test -- --run src/features/works/repository.test.ts
npm run build
```

Expected: PASS。

- [x] **Step 6: 提交**

```powershell
git add src/features/works package.json package-lock.json src/test/setup.ts
git commit -m "feat: add local work repository"
```

---

### Task 7: 将作品仓库接入当前演示账号

**Files:**
- Create: `src/features/works/WorksProvider.tsx`
- Create: `src/features/works/WorksProvider.test.tsx`
- Modify: `src/app/App.tsx`
- Modify: `src/app/App.integration.test.tsx`

**Interfaces:**
- Consumes: `WorkRepository` 和 `AppState.accountId`。
- Produces: `useWorks()`，包含 `works`、`loading`、`error`、`saveDraft`、`upload`、`publish`、`makePrivate`、`withdraw`、`remove`、`toggleLike`、`toggleFavorite`、`addComment`、`getAsset`。

- [x] **Step 1: 写账号切换失败测试**

```tsx
const makeDraft = (title: string): SaveWorkDraftInput => ({
  source: 'external-upload', title, description: '', aiTools: ['测试工具'],
  fileName: `${title}.txt`, blob: new Blob([title], { type: 'text/plain' }),
})

function Probe() {
  const { works } = useWorks()
  return <>{works.map((work) => <span key={work.id}>{work.title}</span>)}</>
}

it('账号变化时只显示该账号作品', async () => {
  const repository = createMemoryWorkRepository()
  await repository.saveDraft('a', makeDraft('A 的作品'))
  await repository.saveDraft('b', makeDraft('B 的作品'))
  const { rerender } = render(
    <WorksProvider accountId="a" repository={repository}><Probe /></WorksProvider>,
  )
  expect(await screen.findByText('A 的作品')).toBeInTheDocument()
  rerender(<WorksProvider accountId="b" repository={repository}><Probe /></WorksProvider>)
  expect(await screen.findByText('B 的作品')).toBeInTheDocument()
  expect(screen.queryByText('A 的作品')).not.toBeInTheDocument()
})
```

- [x] **Step 2: 运行测试确认失败**

Run: `npm test -- --run src/features/works/WorksProvider.test.tsx`  
Expected: FAIL，Provider 不存在。

- [x] **Step 3: 实现 Provider 和刷新策略**

所有修改动作先等待仓库成功，再用返回记录更新 React 状态；失败时保留原状态并暴露中文友好错误。Provider 不生成演示作品。

- [x] **Step 4: 在登录态边界挂载 Provider**

```tsx
if (state.isLoggedIn) {
  return <WorksProvider accountId={state.accountId}><MainShell /></WorksProvider>
}
```

- [x] **Step 5: 通过测试并提交**

Run:

```powershell
npm test -- --run src/features/works/WorksProvider.test.tsx src/app/App.integration.test.tsx
npm run build
```

```powershell
git add src/features/works/WorksProvider* src/app/App.tsx src/app/App.integration.test.tsx
git commit -m "feat: scope works to the signed-in account"
```

---

### Task 8: 把两个游戏的作品保存到智芽草稿

**Files:**
- Create: `src/features/games/GameWorkBridge.tsx`
- Create: `src/features/games/GameWorkBridge.test.tsx`
- Modify: `src/features/games/EmbeddedGamePage.tsx`
- Create: `apps/brain-film/src/integration/saveToZhiya.ts`
- Modify: `apps/brain-film/src/studioEngine.js`
- Modify: `apps/brain-film/src/features/PremierePage.tsx`
- Create: `apps/creative-module/src/integration/saveToZhiya.ts`
- Modify: `apps/creative-module/src/components/workbench/WorkCheckPanel.tsx`
- Test: `apps/brain-film/tests/zhiya-bridge.test.mjs`
- Test: `apps/creative-module/src/integration/saveToZhiya.test.ts`

**Interfaces:**
- Consumes: Task 3 的 `SaveDraftMessage`，Task 7 的 `useWorks().saveDraft`。
- Produces: 两个子应用的“保存到智芽”动作和宿主成功/失败回执。

- [x] **Step 1: 写宿主来源校验失败测试**

```tsx
it('只接收当前 iframe 的已配置来源', async () => {
  const saveDraft = vi.fn().mockResolvedValue({ id: 'work-1' })
  render(<GameWorkBridge gameId="brain-film" saveDraft={saveDraft}><iframe title="game" /></GameWorkBridge>)
  const iframe = screen.getByTitle('game') as HTMLIFrameElement
  const validSaveDraftMessage = () => ({
    type: WORK_SAVE_DRAFT, version: 1, source: 'brain-film', draftId: 'film-1',
    title: '云朵电影院', description: '', fileName: 'film.bhfilm',
    blob: new Blob(['film'], { type: 'application/json' }),
  })
  fireEvent(window, new MessageEvent('message', {
    origin: 'https://evil.example',
    source: iframe.contentWindow,
    data: validSaveDraftMessage(),
  }))
  expect(saveDraft).not.toHaveBeenCalled()

  fireEvent(window, new MessageEvent('message', {
    origin: 'http://127.0.0.1:5191',
    source: iframe.contentWindow,
    data: validSaveDraftMessage(),
  }))
  await waitFor(() => expect(saveDraft).toHaveBeenCalled())
})
```

- [x] **Step 2: 运行测试确认失败**

Run: `npm test -- --run src/features/games/GameWorkBridge.test.tsx`  
Expected: FAIL，组件不存在。

- [x] **Step 3: 实现宿主桥和回执**

`GameWorkBridge` 同时校验：来源、`event.source === iframe.contentWindow`、协议版本、`message.source === gameId`。成功后返回 `WORK_SAVED` 和作品 ID；失败返回固定错误码，不回传内部异常。

- [x] **Step 4: 接入脑洞放映厅**

在首映礼保留“导出这部”本地下载，并将原“装订成册，存进作品库”明确改为“保存到智芽·我的作品”。发送 `.bhfilm` Blob、标题、作品说明和稳定 `draftId`；收到回执后显示成功 toast。

- [x] **Step 5: 接入创造模块**

在 `WorkCheckPanel` 保留“导出 JSON”“导出实物图”，新增“保存到智芽”。使用 `buildExport` 生成 JSON Blob，来源为 `creative-module`，AI 工具记录为“创造模块”。

- [x] **Step 6: 运行三端测试和构建**

Run:

```powershell
npm test -- --run src/features/games/GameWorkBridge.test.tsx
npm --workspace @zhiya/brain-film test
npm --workspace @zhiya/creative-module run build
npm run build
```

Expected: 全部通过。

- [x] **Step 7: 提交**

```powershell
git add src/features/games apps/brain-film apps/creative-module
git commit -m "feat: save game exports to zhiya drafts"
```

---

### Task 9: 重做“我的作品”为真实作品管理和任意格式上传

**Files:**
- Create: `src/features/works/UploadWorkDialog.tsx`
- Create: `src/features/works/UploadWorkDialog.test.tsx`
- Create: `src/features/works/WorkAssetPreview.tsx`
- Create: `src/features/works/WorkAssetPreview.test.tsx`
- Modify: `src/features/profile/WorksManagePage.tsx`
- Modify: `src/features/profile/ProfilePage.tsx`
- Modify: `src/features/profile/profile.css`
- Modify: `src/features/profile/ProfilePage.test.tsx`
- Create: `src/features/profile/WorksManagePage.test.tsx`

**Interfaces:**
- Consumes: `useWorks()` 和 `WorkRecord.previewKind`。
- Produces: 任意格式上传草稿、五状态筛选、发布/撤回/仅自己/删除动作。

- [x] **Step 1: 写“无 accept 限制”和草稿保存失败测试**

```tsx
it('接受任意文件并默认保存为草稿', async () => {
  render(<UploadWorkDialog open onClose={vi.fn()} />)
  const input = screen.getByLabelText('选择作品文件')
  expect(input).not.toHaveAttribute('accept')
  await user.upload(input, new File(['binary'], 'model.custom-ai', { type: '' }))
  await user.type(screen.getByLabelText('作品名称'), '我的 AI 模型作品')
  await user.type(screen.getByLabelText('使用过的 AI 工具'), '其他 AI 工具')
  await user.click(screen.getByRole('button', { name: '保存为草稿' }))
  expect(saveDraft).toHaveBeenCalledWith(expect.objectContaining({
    source: 'external-upload', fileName: 'model.custom-ai', title: '我的 AI 模型作品',
  }))
})
```

- [x] **Step 2: 写作品状态操作失败测试**

验证页面不再出现“未来校园小设计”等静态作品；草稿显示“继续/发布/删除”，审核中显示“撤回”，已发布显示真实互动数，仅自己显示“发布”。

- [x] **Step 3: 运行测试确认失败**

Run: `npm test -- --run src/features/works/UploadWorkDialog.test.tsx src/features/profile/WorksManagePage.test.tsx`  
Expected: FAIL。

- [x] **Step 4: 实现通用预览**

`WorkAssetPreview` 对 Blob 建立 object URL，并在卸载时 `URL.revokeObjectURL`：

```tsx
switch (work.previewKind) {
  case 'image': return <img src={url} alt={work.title} />
  case 'video': return <video src={url} controls />
  case 'audio': return <audio src={url} controls />
  case 'pdf': return <iframe src={url} title={`${work.title} PDF 预览`} />
  case 'text': return <TextBlobPreview blob={blob} />
  default: return <GenericFileCard fileName={work.fileName} byteSize={work.byteSize} onDownload={download} />
}
```

- [x] **Step 5: 实现上传对话框和真实列表**

上传表单验证：必须有文件、标题 1—80 字、介绍最多 500 字、至少填写一个 AI 工具。存储失败时表单内容不清空。列表空状态提供“去创作”和“上传 AI 作品”。

- [x] **Step 6: 实现状态动作和账户实时计数**

`WorksManagePage` 从 Provider 计算各状态数量，不保留任何静态数组。发布动作调用 `submitForReview`；删除要求屏幕确认，不要求密码。

- [x] **Step 7: 运行测试、可访问性检查和提交**

Run:

```powershell
npm test -- --run src/features/works/UploadWorkDialog.test.tsx src/features/works/WorkAssetPreview.test.tsx src/features/profile/WorksManagePage.test.tsx src/features/profile/ProfilePage.test.tsx
npm run build
```

```powershell
git add src/features/works src/features/profile
git commit -m "feat: manage and upload local ai works"
```

---

### Task 10: 接通审核、公开作品流和真实互动

**Files:**
- Create: `src/features/works/moderation.ts`
- Create: `src/features/works/moderation.test.ts`
- Modify: `src/features/works/WorksProvider.tsx`
- Modify: `src/features/home/AchievementShowcase.tsx`
- Modify: `src/features/home/HomePage.test.tsx`
- Modify: `src/features/works/WorksGalleryPage.tsx`
- Modify: `src/features/works/WorkDetailPage.tsx`
- Modify: `src/features/works/works.css`
- Modify: `src/features/works/WorksGalleryPage.test.tsx`
- Create: `src/features/works/WorkDetailPage.test.tsx`
- Modify: `src/features/profile/FavoritesPage.tsx`

**Interfaces:**
- Consumes: `WorkRecord`、当前 `accountId` 和 `nickname`。
- Produces: `reviewForLocalDemo(work)`、`reviewComment(text)`、`rankPublishedWorks(works, period, now)`，以及真实公开作品页面。

- [x] **Step 1: 写委婉审查和时间榜单失败测试**

```ts
it('不保存不礼貌留言并给出委婉提示', async () => {
  expect(reviewComment('你真笨')).toEqual({
    allowed: false,
    message: '这句话可能让别人不舒服，换一种友好的说法再试试吧。',
  })
})

it('每日榜只包含当天发布作品并按热度排序', () => {
  const ranked = rankPublishedWorks(works, 'day', new Date('2026-10-20T12:00:00+08:00'))
  expect(ranked.map((work) => work.id)).toEqual(['today-popular', 'today-new'])
})
```

- [x] **Step 2: 写三处共享记录失败测试**

渲染 Provider 下的首页成果展示、作品详情和我的作品；点赞一次后断言详情和我的作品都显示新计数，收藏后“我的收藏”出现同一作品。

- [x] **Step 3: 运行测试确认失败**

Run: `npm test -- --run src/features/works/moderation.test.ts src/features/works/WorksGalleryPage.test.tsx src/features/works/WorkDetailPage.test.tsx`  
Expected: FAIL。

- [x] **Step 4: 实现可替换的本地演示审核**

```ts
export interface WorkModerationService {
  review(work: WorkRecord): Promise<{ allowed: boolean; message: string }>
}

export const localDemoModeration: WorkModerationService = {
  async review(work) {
    const text = `${work.title}\n${work.description}\n${work.aiTools.join(' ')}`
    const blockedTerms = ['笨蛋', '垃圾', '滚开', '加微信', '裸聊', '色情']
    const unsafe = blockedTerms.some((term) => text.includes(term))
    return unsafe
      ? { allowed: false, message: '有些内容需要换一种更适合大家阅读的表达。' }
      : { allowed: true, message: '本地文字与文件安全检查已通过。' }
  },
}
```

实际代码使用明确词表数组，不使用示例正则中的说明文字；审核只声称检查文本和文件安全，不声称识别了所有媒体画面。

- [x] **Step 5: 实现发布状态流**

`submitForReview` 先持久化 `reviewing`，等待审核结果；通过则写入 `publishedAt` 和 `published`，不通过则回到 `draft` 并保存委婉 `reviewMessage`。组件显示实际状态变化。

- [x] **Step 6: 替换所有静态公开作品**

删除 `homeData.ts` 的 `worksByPeriod`。`AchievementShowcase` 和 `WorksGalleryPage` 只查询 `published`；为空时显示“还没有公开作品，完成一次创作并发布后就会出现在这里”。

- [x] **Step 7: 接通点赞、收藏、留言和详情预览**

所有动作由作品仓库更新一条记录。留言 1—80 字；失败留言不写库。`WorkDetailPage` 使用 `WorkAssetPreview`，未知格式只提供安全下载。

- [x] **Step 8: 运行测试和提交**

Run:

```powershell
npm test -- --run src/features/works src/features/home/HomePage.test.tsx src/features/profile/WorksManagePage.test.tsx
npm run build
```

```powershell
git add src/features/works src/features/home src/features/profile/FavoritesPage.tsx
git commit -m "feat: connect published works and interactions"
```

---

### Task 11: 端到端回归、启动验收和清理

**Files:**
- Create: `src/app/gameWorks.integration.test.tsx`
- Modify: `README.md`
- Modify: `docs/superpowers/plans/2026-10-20-games-and-works-integration.md`（只勾选已完成步骤，不改需求）

**Interfaces:**
- Consumes: Tasks 1—10 的完整接口。
- Produces: 一个命令可启动、可构建、可演示的最终集成分支。

- [x] **Step 1: 写完整用户链路测试**

```tsx
function IntegratedTestApp({ repository }: { repository: WorkRepository }) {
  return (
    <AppStateProvider>
      <WorksProvider accountId="chenxi_2026" repository={repository}>
        <MainShell />
      </WorksProvider>
    </AppStateProvider>
  )
}

function dispatchValidGameDraftMessage(source: GameSource, blob: Blob) {
  const iframe = screen.getByTitle(source === 'brain-film' ? '脑洞放映厅' : '创造模块') as HTMLIFrameElement
  fireEvent(window, new MessageEvent('message', {
    origin: source === 'brain-film' ? 'http://127.0.0.1:5191' : 'http://127.0.0.1:5192',
    source: iframe.contentWindow,
    data: {
      type: WORK_SAVE_DRAFT, version: 1, source, draftId: 'demo-1',
      title: '云朵电影院', description: '', fileName: 'film.bhfilm', blob,
    },
  }))
}

async function openMyWorks(user: UserEvent) {
  await user.click(screen.getByRole('button', { name: '我的' }))
  await user.click(screen.getByRole('button', { name: /我的作品/ }))
}

async function openHome(user: UserEvent) {
  await user.click(screen.getByRole('button', { name: '首页' }))
}

it('游戏导出草稿、发布并在首页互动', async () => {
  render(<IntegratedTestApp repository={createMemoryWorkRepository()} />)
  await user.click(screen.getByRole('button', { name: /脑洞放映厅/ }))
  dispatchValidGameDraftMessage('brain-film', new Blob(['film']))
  expect(await screen.findByText('已保存到智芽·我的作品')).toBeInTheDocument()
  await openMyWorks(user)
  expect(screen.getByText('云朵电影院')).toHaveTextContent('草稿')
  await user.click(screen.getByRole('button', { name: '发布' }))
  await openHome(user)
  expect(await screen.findByText('云朵电影院')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: '点赞作品' }))
  expect(screen.getByLabelText('点赞作品')).toHaveAttribute('aria-pressed', 'true')
})
```

- [x] **Step 2: 运行完整自动检查**

Run:

```powershell
npm test -- --run
npm run test:server
npm --workspace @zhiya/brain-film test
npm --workspace @zhiya/brain-film run build
npm --workspace @zhiya/creative-module run build
npm run build
git diff --check
```

Expected: 全部通过，`git diff --check` 无输出。

- [x] **Step 3: 实际启动并检查四个服务**

Run: `npm run dev -- --host 127.0.0.1 --port 5175 --strictPort`

另一个 PowerShell 验证：

```powershell
Invoke-WebRequest http://127.0.0.1:5175/ -UseBasicParsing
Invoke-WebRequest http://127.0.0.1:5191/ -UseBasicParsing
Invoke-WebRequest http://127.0.0.1:5192/ -UseBasicParsing
Invoke-WebRequest http://127.0.0.1:8787/api/companion/reply -Method Post -ContentType 'application/json' -Body '{"question":"你好","companionId":"momo"}'
```

Expected: 三个页面返回 HTTP 200；代理返回 200 或缺少本地密钥时返回明确 503，但不得导致前端服务退出。

- [x] **Step 4: 手动移动端验收**

在 375×812 视口完成：

1. 六个图标同风格、无遮挡、主体比例一致。
2. 前两个卡片均在 APP 框内打开，返回后首页滚动位置恢复。
3. 两个游戏均可“保存到智芽”和“保存到本地”。
4. 草稿出现在我的作品，发布后出现在首页和更多作品。
5. 上传 `.png`、`.mp4`、`.mp3`、`.pdf` 和一个未知扩展名文件；前四类正确预览，未知类型显示文件卡并可下载。
6. 点赞、收藏和友好留言同步；不礼貌留言被委婉拦截。
7. 刷新页面和重新登录同一账号后作品仍在；切换账号不串数据。

- [x] **Step 5: 检查没有演示作品和敏感文件**

Run:

```powershell
rg -n "会分类的照相机|未来校园小设计|森林里的发光蘑菇|银河中的漫游者|梦境里的糖果屋" src
git status --short
git ls-files | rg "(^|/)(\.env|node_modules|dist)(/|$)"
```

Expected: 第一个和第三个命令无匹配；状态只包含本任务预期文件。

- [x] **Step 6: 更新 README 并提交最终验收**

README 写明一个命令启动四个进程、三个前端地址、作品仅保存在当前浏览器，以及如何清理本地作品数据。

```powershell
git add README.md src/app/gameWorks.integration.test.tsx docs/superpowers/plans/2026-10-20-games-and-works-integration.md
git commit -m "test: verify game and works integration"
```

---

## Completion Gate

只有同时满足以下条件才能宣称完成：

- Tasks 1—11 每个任务均有独立提交。
- 根测试、服务端测试、两个子游戏测试/构建和总构建全部通过。
- 375×812 手动链路通过且六个图标已实际视觉检查。
- 两个游戏都能在 APP 内打开、保存智芽草稿和保存到本地。
- 任意格式文件可保存，不可预览格式不会被执行。
- 首页、更多作品、详情和我的作品共享同一记录和互动计数。
- 静态普通演示作品全部移除。
- `git diff --check` 通过，工作树干净，不含密钥和构建产物。
