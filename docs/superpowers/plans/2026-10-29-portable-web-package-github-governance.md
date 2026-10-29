# 智芽便携 Web 演示包与 GitHub 治理实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 清理并验证智芽完整项目，生成可在 Windows 10/11 一键运行的免环境 Web 演示 ZIP，并将不含密钥的最终源码与治理设置同步到公开 GitHub 仓库。

**Architecture:** 采用白名单重建交付包，而不是复制整个工作目录。交付暂存区分为源码、便携 Node/Python/FFmpeg、启动器和演示数据四层；真实 `.env` 只在本地交付阶段注入。GitHub 保持公开，以 PolyForm Noncommercial 许可、只读 Actions、CI 和 `main` ruleset 管理协作。

**Tech Stack:** React 19、TypeScript、Vite 8、Node.js 24、Python 3.12、FFmpeg 9、PowerShell、Node test runner、Vitest、GitHub Actions、GitHub REST API。

**Spec:** `docs/superpowers/specs/2026-10-29-portable-web-package-github-governance-design.md`

## Global Constraints

- GitHub 仓库保持 Public，许可证为 `PolyForm Noncommercial 1.0.0`，禁止商业使用。
- ZIP 必须保留全部现有功能，并包含便携 Node.js、Python、FFmpeg/FFprobe 和依赖。
- ZIP 可以包含当前本地真实 `.env`；Git、GitHub、日志和测试夹具绝不能包含真实 Key。
- 输出目录保留 `E:\智芽\运行文件\智芽.apk`，新增且只新增 `智芽-Web完整演示包.zip`。
- 演示账号为 `123 / 123`，使用统一幂等演示数据，不复制浏览器用户目录或当前个人缓存。
- 保留 Android 源码，排除 Android/Gradle 构建缓存和 APK 产物。
- 不重写 Git 历史、不强制推送、不删除历史分支。
- `main` 禁止删除和强制推送；管理员可直接推送，其他协作者必须走通过 CI 的 Pull Request。
- 启动器可自动结束当前交付包残留进程；外部端口占用必须确认；系统服务永不自动结束。
- 任何关键测试失败时不得替换旧 ZIP、推送 `main` 或应用 GitHub ruleset。

---

### Task 1: 建立仓库政策、非商业许可和 CI 基线

**Files:**
- Modify: `LICENSE`
- Modify: `README.md`
- Create: `docs/README.md`
- Create: `SECURITY.md`
- Create: `CONTRIBUTING.md`
- Create: `.github/CODEOWNERS`
- Create: `.github/workflows/ci.yml`
- Create: `.github/dependabot.yml`
- Create: `scripts/repository-policy.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Produces: `npm run test:repository-policy`，供 CI 和发布前验证仓库许可、安全文件与 Actions 权限。
- Produces: GitHub Actions 必须出现的状态检查 `ci / test-and-build`，供 Task 8 的 ruleset 使用。

- [ ] **Step 1: 写仓库政策失败测试**

在 `scripts/repository-policy.test.mjs` 中检查：

```js
test('repository is noncommercial and CI has least privilege', () => {
  assert.match(read('LICENSE'), /PolyForm Noncommercial License 1\.0\.0/)
  assert.match(read('README.md'), /禁止商业使用/)
  assert.match(read('SECURITY.md'), /不要在 Issue|不得在 Issue/)
  assert.match(read('.github/workflows/ci.yml'), /permissions:\s*\n\s*contents: read/)
  assert.match(read('.github/CODEOWNERS'), /@shenghuogaogaoshou-source/)
})
```

并在 `package.json` 增加：

```json
"test:repository-policy": "node --test scripts/repository-policy.test.mjs"
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm run test:repository-policy`  
Expected: FAIL，指出现有 MIT License 或缺少 `.github`/安全文档。

- [ ] **Step 3: 替换许可证并补齐仓库文档**

从 PolyForm 官方页面取得 `PolyForm Noncommercial License 1.0.0` 完整原文写入 `LICENSE`，不得自行删改许可条款。README 使用以下固定结构：

```markdown
# 智芽 · 小学 AI 通识教育应用
## 项目背景与定位
## 核心学习闭环
## 三学段课程
## AI 伙伴、相机工具与创意工坊
## 儿童安全与隐私
## 界面预览
## 快速启动
## 技术架构与目录
## 测试、构建与交付
## 数据与原型边界
## 许可证：禁止商业使用
```

`docs/README.md` 索引现有部署、课程、AI、安全和规格文档。`SECURITY.md` 指定私下报告漏洞，不允许在公开 Issue 粘贴 Key。`CONTRIBUTING.md` 要求非商业贡献、测试通过和协作者使用 PR。`CODEOWNERS` 至少包含：

```text
* @shenghuogaogaoshou-source
/.github/ @shenghuogaogaoshou-source
/server/ @shenghuogaogaoshou-source
/deploy/ @shenghuogaogaoshou-source
```

- [ ] **Step 4: 添加只读 CI 与 Dependabot**

`.github/workflows/ci.yml` 使用 `ubuntu-latest`、Node 24、Python 3.12 和系统 FFmpeg；顶层权限固定为：

```yaml
permissions:
  contents: read
```

工作流在 `pull_request` 和 `main` push 上执行 `npm ci`、`npm run test:all`、`npm run build`，job id 固定为 `test-and-build`。Dependabot 每周检查根 npm workspace 和 GitHub Actions。

- [ ] **Step 5: 运行仓库政策测试和工作流语法检查**

Run: `npm run test:repository-policy`  
Expected: PASS

Run: `npx --yes yaml-lint .github/workflows/ci.yml .github/dependabot.yml`  
Expected: PASS；若该 CLI 不支持当前 Node，则使用 `npx prettier --check` 解析两份 YAML，并在提交记录中注明替代验证。

- [ ] **Step 6: 提交仓库政策基线**

```bash
git add LICENSE README.md docs/README.md SECURITY.md CONTRIBUTING.md .github package.json scripts/repository-policy.test.mjs
git commit -m "docs: establish noncommercial repository policy"
```

---

### Task 2: 建立安全清理引擎并执行有证据的清理

**Files:**
- Create: `scripts/cleanup-project.mjs`
- Create: `scripts/cleanup-project.test.mjs`
- Create: `docs/maintenance/cleanup-2026-10-29.md`
- Modify: `package.json`
- Delete: 仅删除清理报告列出的当前无用文件

**Interfaces:**
- Produces: `buildCleanupPlan(projectRoot): CleanupEntry[]`
- Produces: `assertSafeCleanupTarget(projectRoot, targetPath): string`
- Produces: CLI `node scripts/cleanup-project.mjs --dry-run|--apply`
- Cleanup entry shape: `{ path: string, reason: string, kind: 'generated' | 'obsolete-artifact' }`

- [ ] **Step 1: 写安全边界失败测试**

使用临时目录验证：

```js
assert.throws(() => assertSafeCleanupTarget(root, root))
assert.throws(() => assertSafeCleanupTarget(root, dirname(root)))
assert.ok(buildCleanupPlan(root).some((entry) => entry.path === 'dist'))
assert.ok(!buildCleanupPlan(root).some((entry) => entry.path.includes('.env')))
assert.ok(!buildCleanupPlan(root).some((entry) => entry.path.startsWith('public/courses/')))
```

测试还应保证 `.git`、源码、课程、伙伴、作品、模型和真实配置永不进入清理计划。

- [ ] **Step 2: 运行测试确认失败**

Run: `node --test scripts/cleanup-project.test.mjs`  
Expected: FAIL，模块尚不存在。

- [ ] **Step 3: 实现默认 dry-run 的清理脚本**

明确允许清理：`.data/`、`dist/`、`*.tsbuildinfo`、`*-out.txt`、`*-err.txt`、应用 `dist/`、`__pycache__/`、Android `build/`、Gradle 项目缓存、已确认未被文档引用的验证截图。`--apply` 只能删除 `buildCleanupPlan` 返回且通过 `assertSafeCleanupTarget` 的路径。

在 `package.json` 增加：

```json
"cleanup:check": "node scripts/cleanup-project.mjs --dry-run",
"cleanup:apply": "node scripts/cleanup-project.mjs --apply"
```

- [ ] **Step 4: 运行单测和真实 dry-run**

Run: `node --test scripts/cleanup-project.test.mjs`  
Expected: PASS

Run: `npm run cleanup:check`  
Expected: 输出相对路径与删除原因，不修改磁盘。

- [ ] **Step 5: 建立清理证据报告**

在 `docs/maintenance/cleanup-2026-10-29.md` 记录 dry-run 清单、每一类删除依据、保留的大资源原因、清理前后大小和验证命令。使用 `rg` 检查静态引用，并检查课程/作品/伙伴的动态清单；无法证明无用的文件从清单移除。

- [ ] **Step 6: 使用 Git 管理命令移除内部旧 worktree**

先再次运行 `git status --short` 确认三个 worktree 干净，再执行：

```powershell
git worktree remove "E:\移动应用--GPT\智芽-教育APP\.worktrees\ai-companion-redesign"
git worktree remove "E:\移动应用--GPT\智芽-教育APP\.worktrees\game-works-integration"
git worktree remove "E:\移动应用--GPT\智芽-教育APP\.worktrees\grade56-course-recovery"
git worktree prune
```

不得删除 `C:\Users\qinch\.codex\worktrees\ai-companion-identity\数智教育学生端初版`，不得删除对应 Git 分支。

- [ ] **Step 7: 应用清理并验证状态**

Run: `npm run cleanup:apply`  
Expected: 仅删除报告中已批准的生成物和旧验证产物。

Run: `git status --short`  
Expected: 只出现预期的代码/文档删除和新清理脚本，不出现课程、作品、伙伴或配置误删。

- [ ] **Step 8: 重新安装、构建并提交清理**

Run: `npm ci --no-audit --no-fund`  
Run: `npm run build`  
Run: `npm run test:all`  
Expected: 全部 PASS

```bash
git add -A
git commit -m "chore: remove obsolete generated project files"
```

---

### Task 3: 实现便携启动器和安全端口处理

**Files:**
- Modify: `templates/source-packages/complete/启动.cmd`
- Delete: `templates/source-packages/complete/open-browser.ps1`
- Create: `templates/source-packages/complete/launcher/start.ps1`
- Create: `templates/source-packages/complete/launcher/health-check.ps1`
- Create: `templates/source-packages/complete/launcher/process-manager.ps1`
- Create: `scripts/portable-launcher.test.mjs`

**Interfaces:**
- PowerShell: `Get-ZhiyaPortOwner([int]$Port)`
- PowerShell: `Test-ZhiyaOwnedProcess([int]$Pid, [string]$PackageRoot)`
- PowerShell: `Stop-ZhiyaPortConflict([int]$Port, [string]$PackageRoot, [switch]$NonInteractive)`
- PowerShell: `Wait-ZhiyaEndpoint([string]$Uri, [int]$TimeoutSeconds)`
- Launcher environment: `ZHIYA_NO_BROWSER=1` disables browser opening for automated verification。

- [ ] **Step 1: 写启动器合同失败测试**

Node 测试启动临时 HTTP 服务占用测试端口，并调用 PowerShell 函数验证：

```js
assert.equal(await invoke('Test-ZhiyaOwnedProcess', ownedPid, packageRoot), 'True')
assert.equal(await invoke('Test-ZhiyaOwnedProcess', externalPid, packageRoot), 'False')
assert.equal(await invoke('Wait-ZhiyaEndpoint', healthUrl, 5), 'True')
```

测试还要验证 `启动.cmd` 使用相对路径定位 `runtime` 和 `project`，而不是调用系统 `node`、`python`、`npm` 或 `ffmpeg`。

- [ ] **Step 2: 运行测试确认失败**

Run: `node --test scripts/portable-launcher.test.mjs`  
Expected: FAIL，launcher 文件尚不存在。

- [ ] **Step 3: 实现进程与端口策略**

`process-manager.ps1` 通过 `Win32_Process` 读取 `ExecutablePath` 与 `CommandLine`。路径位于当前解压目录时允许自动结束；外部进程显示名称、PID、端口并要求输入 `Y`；`svchost.exe`、`System`、PID 0/4 和无法读取路径的进程永不自动结束。记录本次启动的根 PID，并在退出时递归清理该进程树。

- [ ] **Step 4: 实现健康检查与主启动器**

`health-check.ps1` 检查：

```text
http://127.0.0.1:5173/
http://127.0.0.1:5191/
http://127.0.0.1:5192/
http://127.0.0.1:8766/api/health
http://127.0.0.1:8787/api/health
```

`start.ps1` 设置：

```powershell
$env:ZHIYA_PYTHON = Join-Path $PackageRoot 'runtime\python\python.exe'
$env:PATH = "$(Join-Path $PackageRoot 'runtime\ffmpeg');$(Join-Path $PackageRoot 'runtime\node');$env:PATH"
```

随后在 `project` 目录使用便携 `node.exe server/dev.mjs`，等待五个端点通过后打开浏览器。所有退出路径执行进程树清理。

- [ ] **Step 5: 运行启动器测试**

Run: `node --test scripts/portable-launcher.test.mjs`  
Expected: PASS；测试完成后无测试进程残留。

- [ ] **Step 6: 提交启动器**

```bash
git add templates/source-packages/complete scripts/portable-launcher.test.mjs
git commit -m "feat: add self-contained Windows launcher"
```

---

### Task 4: 收集并验证便携 Node、Python 与 FFmpeg

**Files:**
- Create: `scripts/portable-runtime.mjs`
- Create: `scripts/portable-runtime.test.mjs`
- Create: `docs/third-party/portable-runtime-notices.md`
- Modify: `scripts/package-complete-app.mjs`

**Interfaces:**
- Produces: `resolveRuntimeSources(env): { nodeRoot, pythonRoot, ffmpegBinRoot }`
- Produces: `copyNodeRuntime(source, destination)`
- Produces: `copyPythonRuntime(source, destination)`
- Produces: `copyFfmpegRuntime(source, destination)`
- Produces: `verifyPortableRuntime(runtimeRoot): RuntimeVerification`
- Environment overrides: `ZHIYA_PORTABLE_NODE_ROOT`、`ZHIYA_PORTABLE_PYTHON_ROOT`、`ZHIYA_PORTABLE_FFMPEG_ROOT`。

- [ ] **Step 1: 写运行时发现与安全复制失败测试**

用临时假运行时验证：只接受存在 `node.exe`、`python.exe`、`ffmpeg.exe`、`ffprobe.exe` 的绝对目录；禁止目标等于源目录或项目根目录；排除 `__pycache__`、pip 缓存和用户临时文件；复制许可证文件。

- [ ] **Step 2: 运行测试确认失败**

Run: `node --test scripts/portable-runtime.test.mjs`  
Expected: FAIL，模块尚不存在。

- [ ] **Step 3: 实现运行时发现与复制**

默认来源：

- Node：`dirname(process.execPath)`，当前预期为 `E:\node.js`；
- Python：通过 `py -3.12 -c "import sys; print(sys.base_prefix)"`，当前预期为 `C:\Users\qinch\AppData\Local\Programs\Python\Python312`；
- FFmpeg：通过 `where ffmpeg` 和 `where ffprobe`，当前预期为 Gyan FFmpeg 9 的 `bin` 目录。

Python 后端只使用标准库，因此复制 Python 标准运行时并排除用户 site-packages 缓存；Node 运行时必须包含 `node.exe` 和 npm CLI；FFmpeg 必须同时包含 `ffmpeg.exe`、`ffprobe.exe` 及对应许可声明。

- [ ] **Step 4: 实现真实运行时自检**

`verifyPortableRuntime` 在复制后执行：

```text
runtime/node/node.exe --version
runtime/node/node.exe runtime/node/node_modules/npm/bin/npm-cli.js --version
runtime/python/python.exe --version
runtime/ffmpeg/ffmpeg.exe -version
runtime/ffmpeg/ffprobe.exe -version
```

任何命令非零退出都阻止生成 ZIP。

- [ ] **Step 5: 运行测试并更新第三方声明**

Run: `node --test scripts/portable-runtime.test.mjs`  
Expected: PASS

`docs/third-party/portable-runtime-notices.md` 记录 Node.js、Python、FFmpeg 与打包来源，不把第三方运行时描述为 PolyForm 授权内容。

- [ ] **Step 6: 提交便携运行时支持**

```bash
git add scripts/portable-runtime.mjs scripts/portable-runtime.test.mjs scripts/package-complete-app.mjs docs/third-party/portable-runtime-notices.md
git commit -m "feat: bundle verified portable runtimes"
```

---

### Task 5: 重构白名单完整包生成器并隔离密钥

**Files:**
- Modify: `scripts/package-complete-app.mjs`
- Modify: `scripts/package-complete-app.test.mjs`
- Create: `scripts/portable-package-security.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Produces: `portableProjectManifest(): string[]`
- Produces: `forbiddenPortablePath(filePath): boolean`
- Produces: `buildCompletePackage(options): { zipPath, stageRoot, packageRoot, sha256 }`
- Options: `{ projectRoot, outputRoot, runtimeSources, deliveryConfig, keepStage }`
- Delivery config reads exactly `server/.env.local` and `apps/brain-film/.env` from the local source tree after confirming both are Git-ignored。

- [ ] **Step 1: 将现有测试改成便携交付合同**

测试必须断言：

```js
assert.ok(portableProjectManifest().includes('android'))
assert.ok(portableProjectManifest().includes('src'))
assert.ok(forbiddenPortablePath('.git/config'))
assert.ok(forbiddenPortablePath('.worktrees/old/file'))
assert.ok(forbiddenPortablePath('android/app/build/output.apk'))
assert.ok(forbiddenPortablePath('dist/index.html'))
assert.equal(forbiddenPortablePath('public/courses/qmx/page.png'), false)
```

安全测试使用虚假 `.env` 值生成临时包，验证虚假值只出现在交付暂存区，不出现在 Git 跟踪清单、控制台 JSON 或校验报告中。

- [ ] **Step 2: 运行测试确认失败**

Run: `node --test scripts/package-complete-app.test.mjs scripts/portable-package-security.test.mjs`  
Expected: FAIL，现有生成器不包含运行时和 Android 源码，且缺少交付隔离。

- [ ] **Step 3: 实现白名单暂存结构**

将包根调整为：

```text
智芽-Web完整演示包/
  启动.cmd
  launcher/
  runtime/
  project/
  data/
```

源代码复制到 `project/`。先复制无密钥白名单，再安装完整 workspace 依赖到暂存 `project/node_modules`；验证 `@zhiya/task-client` 与 `@zhiya/works-bridge` 在解压后可解析。最后才把本机两个 `.env` 复制进暂存 `project` 对应位置。

- [ ] **Step 4: 实现安全且原子的 ZIP 输出**

输出根固定为 `E:\智芽\运行文件`。先创建唯一暂存目录和临时 ZIP；成功解压验证前不得删除旧 `智芽-Web完整演示包.zip`。替换时使用同卷重命名；保留 `智芽.apk`。打印结果只能包含 ZIP 路径、大小、SHA-256 和非敏感运行时版本。

`package.json` 保留并更新：

```json
"package:complete": "node scripts/package-complete-app.mjs"
```

- [ ] **Step 5: 运行打包单测**

Run: `node --test scripts/package-complete-app.test.mjs scripts/portable-package-security.test.mjs scripts/portable-runtime.test.mjs`  
Expected: PASS

- [ ] **Step 6: 提交完整包生成器**

```bash
git add scripts/package-complete-app.mjs scripts/package-complete-app.test.mjs scripts/portable-package-security.test.mjs package.json
git commit -m "feat: build isolated portable web delivery"
```

---

### Task 6: 锁定统一比赛演示数据合同

**Files:**
- Modify: `src/app/storage.test.ts`
- Modify: `src/app/storage.ts` only if the new contract exposes a mismatch
- Modify: `src/features/works/demoWorks.test.ts`
- Modify: `src/features/works/demoWorks.ts` only if the new contract exposes a mismatch
- Modify: `src/features/works/importedWorks.test.ts`
- Modify: `src/features/works/WorksProvider.test.tsx`
- Modify: `src/features/works/WorksProvider.tsx` only if the new contract exposes a mismatch
- Modify: `src/features/profile/courseAchievements.test.ts`

**Interfaces:**
- Consumes: existing account-scoped storage and works seeding APIs；不建立浏览器 profile 快照。
- Produces: 对 `123` 账号幂等的比赛演示数据合同，重复启动不重复积分、勋章或作品。

- [ ] **Step 1: 写统一演示数据合同测试**

测试固定验证：

- `123 / 123` 可进入应用；
- 三个年级段均有课程/测试展示数据，但当前学习位置仍指向有效知识单元；
- 积分、勋章、错题和学习记录相互一致；
- 公共作品、收藏、草稿、审核中和仅自己可见状态均有代表数据；
- 草稿只来自脑洞放映厅或创造模块；外部 AI 成品不带可继续创作标签；
- 《改项目》按固定来源 ID 只导入一次；
- 两次初始化得到相同作品 ID 集合和相同奖励余额。

- [ ] **Step 2: 运行目标测试确认当前状态**

Run: `npm test -- --run src/app/storage.test.ts src/features/works/demoWorks.test.ts src/features/works/importedWorks.test.ts src/features/works/WorksProvider.test.tsx src/features/profile/courseAchievements.test.ts`  
Expected: 新增断言至少有一项先失败；若全部通过，保留产品代码不变，只提交合同测试。

- [ ] **Step 3: 最小修正种子逻辑**

只修改导致合同失败的现有种子函数。不得写死浏览器当前 localStorage/IndexedDB，不得增加新的账号密码，不得改变生产数据迁移版本，幂等键继续使用账号和固定来源 ID。

- [ ] **Step 4: 运行演示数据与相关集成测试**

Run: `npm test -- --run src/app/storage.test.ts src/app/learningState.actions.test.tsx src/features/works src/features/profile/courseAchievements.test.ts src/features/profile/MedalsPage.test.tsx`  
Expected: PASS

- [ ] **Step 5: 提交演示数据合同**

```bash
git add src/app/storage.ts src/app/storage.test.ts src/features/works src/features/profile/courseAchievements.test.ts
git commit -m "test: lock deterministic competition demo data"
```

若产品代码未变化，提交中只包含测试文件。

---

### Task 7: 实现解压启动、API 冒烟和交付验证器

**Files:**
- Create: `scripts/verify-portable-package.mjs`
- Create: `scripts/verify-portable-package.test.mjs`
- Modify: `scripts/package-complete-app.mjs`
- Modify: `package.json`

**Interfaces:**
- Produces: `verifyPortablePackage({ zipPath, extractionRoot, liveApi }): VerificationReport`
- CLI: `node scripts/verify-portable-package.mjs --zip E:\智芽\运行文件\.portable-candidate\智芽-Web完整演示包.candidate.zip [--live-api]`
- Environment: `ZHIYA_NO_BROWSER=1`，验证时不打开浏览器。
- Verification report contains only status、duration、version、file size、SHA-256 and endpoint status；不包含配置值或请求正文。

- [ ] **Step 1: 写解压与启动验证失败测试**

测试用最小假 ZIP 验证：中文与空格路径解压、缺少 runtime 时失败、端点超时时失败、子进程退出后无残留、报告不包含虚假 secret。

- [ ] **Step 2: 运行测试确认失败**

Run: `node --test scripts/verify-portable-package.test.mjs`  
Expected: FAIL，验证器尚不存在。

- [ ] **Step 3: 实现基础便携验证**

验证器解压到系统临时目录下的 `智芽 比赛验证`，调用 `启动.cmd` 的非交互验证入口，等待五个端点，检查主页面 HTML、AI 健康 JSON、脑洞后端健康 JSON，然后触发统一退出并检查端口已释放。

- [ ] **Step 4: 实现显式 `--live-api` 冒烟验证**

仅在命令带 `--live-api` 时执行：

1. `POST /api/deepseek/chat/completions`：发送儿童安全的简短问句，要求非空回复；
2. `POST /api/tts` 生成短中文 WAV，再以 data URL 调用 `POST /api/companion/transcribe`，要求得到非空中文；
3. 使用仓库内小型安全图片调用 `POST /api/companion/recognize`，要求得到非空结果；
4. 调用脑洞放映厅 `/api/health` 与 `/api/config`，确认文本、图片、视频、TTS 配置状态；
5. 只做一次低成本创作请求，轮询到成功或明确的上游错误；不在失败时无限重试。

所有请求有固定超时；响应只记录状态与耗时。

- [ ] **Step 5: 运行验证器单测**

Run: `node --test scripts/verify-portable-package.test.mjs`  
Expected: PASS

- [ ] **Step 6: 提交交付验证器**

```bash
git add scripts/verify-portable-package.mjs scripts/verify-portable-package.test.mjs scripts/package-complete-app.mjs package.json
git commit -m "test: verify portable delivery end to end"
```

---

### Task 8: 全量验证、生成最终 ZIP 并原子发布

**Files:**
- Generated locally only: `E:\智芽\运行文件\智芽-Web完整演示包.zip`
- Preserve unchanged: `E:\智芽\运行文件\智芽.apk`
- Modify: `docs/maintenance/cleanup-2026-10-29.md` with final measurements

**Interfaces:**
- Consumes: Tasks 1–7 的代码、测试、启动器和打包器。
- Produces: 已通过真实解压启动和 API 冒烟的最终 ZIP，以及不含秘密的验证摘要。

- [ ] **Step 1: 在安全边界检查 5 小时用量和工作树**

读取 300 分钟窗口；剩余额度低于 8% 时在此安全点暂停。否则运行：

```powershell
git status --short
git diff --check
```

Expected: 只有计划内修改；真实 `.env` 保持 ignored/untracked。

- [ ] **Step 2: 运行秘密扫描**

扫描 tracked files 和 staged diff 中常见 Key 前缀、私钥头、密码字段和当前 `.env` 值的 SHA-256 指纹。输出只能是文件路径、规则名和是否命中，不得输出秘密原文。任何命中立即停止。

- [ ] **Step 3: 运行全量测试和构建**

```powershell
npm run test:repository-policy
npm run test:all
npm run build
```

Expected: 全部 PASS。

- [ ] **Step 4: 生成临时完整 ZIP**

Run: `npm run package:complete`  
Expected: 在安全暂存位置生成候选包，旧 `E:\智芽\运行文件\智芽-Web完整演示包.zip` 尚未被覆盖，`智芽.apk` 未变化。

- [ ] **Step 5: 执行真实便携验证和 API 冒烟**

Run: `node scripts/verify-portable-package.mjs --zip "E:\智芽\运行文件\.portable-candidate\智芽-Web完整演示包.candidate.zip" --live-api`  
Expected: 五个服务、统一退出、Node/Python/FFmpeg、自带依赖、演示数据和 API 全部 PASS。

- [ ] **Step 6: 原子发布 ZIP 并记录结果**

候选包验证成功后同卷重命名为：

```text
E:\智芽\运行文件\智芽-Web完整演示包.zip
```

确认目录仅保留原 `智芽.apk` 和新 ZIP。记录 ZIP 字节数、SHA-256、运行时版本、测试数量和验证耗时到清理报告，不记录 Key。

- [ ] **Step 7: 提交最终验证记录**

```bash
git add docs/maintenance/cleanup-2026-10-29.md
git commit -m "docs: record portable delivery verification"
```

---

### Task 9: 合并、推送并配置 GitHub 仓库

**Files:**
- External state: `origin/main`
- External state: repository features, Actions permissions, security settings, topics, ruleset

**Interfaces:**
- Consumes: `ci / test-and-build` GitHub status check。
- Produces: 本地 `main`、`origin/main` 和已验证目标提交一致。

- [ ] **Step 1: 验证当前分支是 `main` 的纯后继**

```powershell
git fetch --prune origin
git merge-base --is-ancestor main HEAD
git rev-list --left-right --count origin/main...HEAD
```

Expected: `main` 是当前分支祖先，远端没有本地缺少的新提交。若远端领先，停止并先审阅差异。

- [ ] **Step 2: 最终秘密扫描与测试复核**

Run: `npm run test:all`  
Run: `npm run build`  
Expected: PASS

确认 `git status --short` 仅允许 ignored 的本地配置和运行数据，不允许 staged/track 的 `.env`、Key、签名文件或 ZIP。

- [ ] **Step 3: 快进本地 main 并推送**

```powershell
git switch main
git merge --ff-only fix/android-permissions-camera-works
git push origin main
```

不得使用 `--force`。推送后记录目标 commit SHA。

- [ ] **Step 4: 更新仓库展示设置**

通过已认证 GitHub CLI 或 GitHub 设置页面应用：

```json
{
  "description": "智芽：面向小学1—6年级的AI通识教育与创作应用（非商业许可）",
  "has_issues": true,
  "has_projects": false,
  "has_wiki": false,
  "has_discussions": false
}
```

Topics 至少包含：`ai-education`、`elementary-education`、`react`、`typescript`、`vite`、`child-safety`、`zhiya`。

- [ ] **Step 5: 配置 Actions 与安全功能**

将 Actions 默认 workflow 权限设为 Read repository contents；禁止 Actions 自动创建或批准 PR。启用 Dependabot alerts/security updates、Secret Scanning 和 Push Protection。若个人公开仓库的当前计划不提供某项设置，记录 GitHub 返回的不可用状态，不伪造成功。

- [ ] **Step 6: 创建平衡型 main ruleset**

ruleset 目标为默认分支，enforcement 为 active：

- block deletion；
- block force pushes；
- require pull request for non-admin collaborators；
- require status check `ci / test-and-build`；
- repository admin/owner always bypass。

创建后读取 ruleset 回执，验证规则和 bypass actor。若 GitHub Free/个人仓库限制导致无法同时表达“owner 直推、其他人 PR”，保留删除/强推保护和 required status check，并把限制明确报告给用户。

- [ ] **Step 7: 远端一致性验证**

```powershell
git fetch origin
git rev-parse main
git rev-parse origin/main
git status --short --branch
```

Expected: `main` 与 `origin/main` SHA 相同，无待推送提交。

通过 GitHub API/页面复查仓库 Public、README、LICENSE、Issues、Actions 权限、安全设置、Topics 和 ruleset。

- [ ] **Step 8: 输出最终交付摘要**

向用户报告：

- `E:\智芽\运行文件\智芽-Web完整演示包.zip`；
- ZIP 大小和 SHA-256；
- `智芽.apk` 未修改；
- 全量测试、真实 API 冒烟和解压启动结果；
- `main`/`origin/main` commit SHA；
- GitHub 已应用设置和因计划限制未能应用的设置；
- ZIP 含真实 Key，仅可交给可信人员，不得公开上传。

不得在摘要中输出真实 Key、签名密码、音频、图片正文或隐私数据。
