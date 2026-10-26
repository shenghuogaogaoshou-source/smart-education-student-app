# 智芽综合功能修复 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 完成已确认的视觉识别、账号迁移、学习续接、作品、AI 伙伴、通知、测试地图和脑洞作品导入修复。

**Architecture:** 将密钥与模型调用限制在本机 Node 代理层，前端仅调用同源 API；把迁移、演示数据生成和导航规则提取为纯函数，用本地持久化保证幂等。开发启动器把五个子服务视作独立进程，非 AI 核心服务故障才终止整组运行。

**Tech Stack:** React 19、TypeScript、Vite、Vitest、Node.js ESM、IndexedDB、SQLite（脑洞放映厅）。

**Spec:** `docs/superpowers/specs/2026-10-26-zhiya-integrated-fixes.md`

## Global Constraints

- 不在源码、日志、Git 或前端构建产物中写入任何 API Key。
- 视觉模型固定为 `qwen3-vl-plus`，DashScope compatible base URL 固定为 `https://dashscope.aliyuncs.com/compatible-mode/v1`。
- 视觉请求单次 25 秒，最多 2 次尝试。
- 唯一演示登录凭据固定为 `123 / 123`。
- 所有数据迁移和脑洞作品导入必须幂等。
- 先写失败测试并确认失败，再写最小实现。

---

### Task 1: 保留已验证作品修复

**Files:**
- Modify: `src/features/works/WorksProvider.tsx`
- Test: `src/features/works/WorksProvider.test.tsx`
- Test: `src/features/works/UploadWorkDialog.test.tsx`
- Test: `src/features/works/WorksGalleryPage.test.tsx`

**Interfaces:**
- Produces: 任意当前账号均能读取公共演示作品，同时账号私有写操作仍隔离。

- [ ] **Step 1:** 运行三组作品测试，确认已验证状态仍为绿色。
- [ ] **Step 2:** 独立提交这四个文件，提交信息 `fix: show demo works for every account`。

### Task 2: DashScope 视觉识别与安全降级

**Files:**
- Modify: `.gitignore`
- Modify: `server/ai-proxy.mjs`
- Modify: `server/recognition.mjs`
- Test: `server/recognition.test.mjs`
- Test: `server/ai-proxy.test.mjs`

**Interfaces:**
- Produces: `loadLocalEnvironmentFiles(paths)`、`recognize(body, dependencies?)`；`GET /api/health` 返回不含密钥的配置状态。

- [ ] **Step 1:** 新增失败测试：根目录 `.env.local` 优先加载、DashScope 默认配置、25 秒超时、一次重试、最终降级、健康端点不暴露密钥。
- [ ] **Step 2:** 运行 `npm run test:server -- --run` 并确认测试因缺少行为失败。
- [ ] **Step 3:** 实现根目录和 server 目录环境加载、依赖注入式视觉请求、DashScope 默认值、两次尝试及按工具生成的本地降级结构。
- [ ] **Step 4:** 实现健康端点，仅返回 provider、configured、model 和服务状态。
- [ ] **Step 5:** 重跑服务器测试直至通过。

### Task 3: 开发服务隔离与恢复

**Files:**
- Modify: `server/dev.mjs`
- Modify: `server/devProcesses.mjs`
- Test: `server/devProcesses.test.mjs`
- Create: `server/devSupervisor.mjs`
- Test: `server/devSupervisor.test.mjs`

**Interfaces:**
- Produces: `createDevSupervisor(specs, options)`；AI 代理异常自动限次重启，主应用与游戏不被终止。

- [ ] **Step 1:** 新增失败测试覆盖 AI 代理退出后重启、重启失败不停止其他服务、核心前端退出时安全停止。
- [ ] **Step 2:** 运行服务器测试确认失败。
- [ ] **Step 3:** 提取可测试的进程监督器并替换 `server/dev.mjs` 的一次性启动逻辑。
- [ ] **Step 4:** 重跑测试并确认通过。

### Task 4: 唯一演示凭据与账号数据迁移

**Files:**
- Modify: `src/features/auth/sessionCredential.tsx`
- Modify: `src/features/auth/LoginPage.tsx`
- Modify: `src/app/model.ts`
- Modify: `src/app/companionAccountRepository.ts`
- Modify: `src/app/storage.ts`
- Test: `src/features/auth/sessionCredential.test.tsx`
- Test: `src/features/auth/AuthFlow.test.tsx`
- Test: `src/app/companionAccountRepository.test.ts`
- Test: `src/app/storage.test.ts`

**Interfaces:**
- Produces: `DEMO_ACCOUNT_ID = '123'`、`verifyDemoCredential(account, password)`、幂等旧账号迁移。

- [ ] **Step 1:** 新增失败测试：仅 `123/123` 成功，其他账号失败；旧账号状态迁移到 `123` 且不覆盖已有真实数据。
- [ ] **Step 2:** 运行定向测试确认失败。
- [ ] **Step 3:** 实现凭据验证、默认账号替换和存储迁移。
- [ ] **Step 4:** 重跑定向测试并确认通过。

### Task 5: “上次学到”知识定位

**Files:**
- Modify: `src/features/home/HomePage.tsx`
- Modify: `src/app/AppState.tsx`
- Modify: `src/app/learning.ts`
- Test: `src/features/home/HomePage.test.tsx`
- Test: `src/app/AppState.test.tsx`

**Interfaces:**
- Produces: `getResumeKnowledgePart(state)`，返回当前年级最近打开未完成知识块或下一块。

- [ ] **Step 1:** 新增失败测试覆盖未完成续接、已完成进入下一块、全部完成回到最后一块。
- [ ] **Step 2:** 运行定向测试确认失败。
- [ ] **Step 3:** 实现纯函数并让首页按钮传递精确 courseId/partId。
- [ ] **Step 4:** 重跑测试确认通过。

### Task 6: 多作者与相对时间作品数据

**Files:**
- Modify: `src/features/works/demoWorks.ts`
- Modify: `src/features/works/WorksProvider.tsx`
- Modify: `src/features/works/WorksGalleryPage.tsx`
- Modify: `src/features/profile/WorksWorkbench.tsx`
- Test: `src/features/works/demoWorks.test.ts`
- Test: `src/features/works/WorksProvider.test.tsx`
- Test: `src/features/works/WorksGalleryPage.test.tsx`
- Test: `src/features/profile/WorksWorkbench.test.tsx`

**Interfaces:**
- Produces: 首次初始化锚定时间、6 名虚拟作者、8 个当前账号已发布作品；草稿来源过滤函数 `isContinuableGameDraft(work)`。

- [ ] **Step 1:** 新增失败测试覆盖 8/17 分配、6 名作者、24 小时/7 天/1 年范围、刷新时间稳定、外部成品不进入草稿。
- [ ] **Step 2:** 运行定向测试确认失败。
- [ ] **Step 3:** 重构演示种子数据与我的作品筛选、继续创作跳转。
- [ ] **Step 4:** 重跑测试确认通过。

### Task 7: AI 伙伴动态名称

**Files:**
- Modify: `src/features/ai_companion/AiPanel.tsx`
- Modify: `src/features/ai_companion/companionCatalog.ts`
- Test: `src/features/ai_companion/AiPanel.test.tsx`

**Interfaces:**
- Produces: `getCompanionDisplayName(equippedAppearanceId)` 返回当前形象中英文全名。

- [ ] **Step 1:** 新增失败测试，装备不同形象时标题和无障碍标签同步变化且不出现“小启”。
- [ ] **Step 2:** 运行定向测试确认失败。
- [ ] **Step 3:** 统一面板标题、历史和回复区名称来源。
- [ ] **Step 4:** 重跑测试确认通过。

### Task 8: 消息通知与深链

**Files:**
- Modify: `src/features/home/NotificationsPage.tsx`
- Modify: `src/app/App.tsx`
- Test: `src/features/home/NotificationsPage.test.tsx`

**Interfaces:**
- Produces: 六类 `NotificationTarget`，点击后返回目标 tab/page/entity id。

- [ ] **Step 1:** 新增失败测试覆盖六类预置消息文本及跳转目标。
- [ ] **Step 2:** 运行定向测试确认失败。
- [ ] **Step 3:** 更新消息数据和导航回调。
- [ ] **Step 4:** 重跑测试确认通过。

### Task 9: 三年级段 S 形测试地图

**Files:**
- Modify: `src/features/test/testMapData.ts`
- Modify: `src/features/test/TestPage.tsx`
- Modify: `src/features/test/test.css`
- Test: `src/features/test/TestPage.test.tsx`
- Test: `src/features/test/testMapData.test.ts`

**Interfaces:**
- Produces: 三套主题一致的 S 形节点坐标，节点横向交替且保持安全边距。

- [ ] **Step 1:** 新增失败测试验证横向交替、纵向等距、安全边距和伙伴锚点。
- [ ] **Step 2:** 运行定向测试确认失败。
- [ ] **Step 3:** 调整布局生成和 CSS，保留主题文案与地标。
- [ ] **Step 4:** 重跑测试确认通过。

### Task 10: 导入最近完整脑洞作品

**Files:**
- Create: `scripts/import-brain-film-work.mjs`
- Test: `scripts/import-brain-film-work.test.mjs`
- Modify: `src/features/works/WorksProvider.tsx`
- Modify: `package.json`

**Interfaces:**
- Produces: 由 SQLite 导出的 `public/data/brain-film-import.json`；固定 source id 保证幂等导入。

- [ ] **Step 1:** 用只读查询确认 `bh.db` 表结构和资源字段。
- [ ] **Step 2:** 新增失败测试：选择最新完成且资源存在的作品，缺资源记录跳过，重复导入只保留一份。
- [ ] **Step 3:** 运行脚本测试确认失败。
- [ ] **Step 4:** 实现导出脚本、生成静态导入文件和 WorksProvider 幂等导入。
- [ ] **Step 5:** 重跑测试确认通过。

### Task 11: 全量验证与运行检查

**Files:**
- Modify: `README.md`
- Modify: `.gitignore`

**Interfaces:**
- Produces: 可复现的本机配置和启动说明，不包含任何密钥。

- [ ] **Step 1:** 运行 `npm run test:all`，修复所有回归。
- [ ] **Step 2:** 运行 `npm run build`。
- [ ] **Step 3:** 检查 Git diff 不包含 `sk-`、真实 Key 或 `.env.local`。
- [ ] **Step 4:** 启动项目并检查 5173、5191、5192、8787 健康状态。
- [ ] **Step 5:** 记录验证结果并提交本轮改动。
