# 智芽双包源码拆分 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 生成两个可独立解压、共同实现当前全部功能的智芽前端与后端源码 ZIP。

**Architecture:** 前端保留完整学生应用、两款游戏和浏览器本地数据；后端保留全部需要密钥的 AI、语音、识别和脑洞放映厅 API。打包脚本按白名单复制源码并生成对应启动配置。

**Tech Stack:** React 19、Vite 8、Node.js、Python 3、Vitest、PowerShell Compress-Archive。

**Spec:** `docs/superpowers/specs/2026-10-27-two-package-source-split-design.md`

## Global Constraints

- 输出文件只能是 `E:\智芽\源文件\智芽App前端.zip` 和 `E:\智芽\源文件\智芽App后端.zip`。
- ZIP 中不得包含真实 `.env`、`.env.local`、`node_modules`、`dist`、日志或旧 worktree。
- 前端本地学习数据行为保持不变。
- 后端默认端口必须为 `8787` 和 `8766`。
- 所有源码和脚本必须使用 UTF-8。

---

### Task 1: 打包清单与敏感文件过滤

**Files:**
- Create: `scripts/package-source-app.mjs`
- Create: `scripts/package-source-app.test.mjs`

**Interfaces:**
- Produces: `frontendManifest()`, `backendManifest()`, `isForbiddenPackagePath(path)`

- [ ] **Step 1: 写失败测试，验证前后端清单和秘密过滤**
- [ ] **Step 2: 运行 `node --test scripts/package-source-app.test.mjs`，确认函数不存在导致失败**
- [ ] **Step 3: 实现清单、过滤和固定暂存目录**
- [ ] **Step 4: 再次运行测试并确认通过**

### Task 2: 生成独立前端项目

**Files:**
- Create: `scripts/package-source-app.mjs`
- Create: `scripts/dev-frontends.mjs` template
- Create: `templates/source-packages/frontend/package.json`
- Create: `templates/source-packages/frontend/vite.config.ts`
- Create: `templates/source-packages/frontend/README.md`

**Interfaces:**
- Produces: `E:\智芽\源文件\.build\frontend`

- [ ] **Step 1: 添加前端清单测试，断言包含主应用和两款游戏并排除后端**
- [ ] **Step 2: 运行测试确认失败**
- [ ] **Step 3: 生成前端 `package.json`、代理配置、三服务启动器和 README**
- [ ] **Step 4: 在暂存目录生成 lockfile，运行前端测试和构建**

### Task 3: 生成独立后端项目

**Files:**
- Create: `templates/source-packages/backend/package.json`
- Create: `templates/source-packages/backend/start-all.mjs`
- Create: `templates/source-packages/backend/README.md`
- Create: `templates/source-packages/backend/server/.env.local.example`
- Create: `templates/source-packages/backend/apps/brain-film/.env.example`

**Interfaces:**
- Produces: `E:\智芽\源文件\.build\backend`

- [ ] **Step 1: 添加后端清单测试，断言包含 AI 代理和脑洞后端并排除前端源码**
- [ ] **Step 2: 运行测试确认失败**
- [ ] **Step 3: 生成后端项目、双服务启动器、环境变量示例和 README**
- [ ] **Step 4: 在暂存目录安装依赖并运行 Node、Python 测试**

### Task 4: 生成 ZIP 并做端到端验收

**Files:**
- Create: `E:\智芽\源文件\智芽App前端.zip`
- Create: `E:\智芽\源文件\智芽App后端.zip`

**Interfaces:**
- Consumes: 两个暂存目录
- Produces: 两个可直接解压的源码包

- [ ] **Step 1: 启动后端，验证 `/api/health` 与脑洞 `/api/health`**
- [ ] **Step 2: 启动前端，验证 `5173`、`5191`、`5192` 均返回 HTTP 200**
- [ ] **Step 3: 浏览器验证主应用和两款内嵌游戏**
- [ ] **Step 4: 压缩两个目录并检查 ZIP 中不存在禁止路径**
- [ ] **Step 5: 解压到新临时目录，执行 `npm ci` 和基础构建测试**

