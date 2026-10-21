# 脑洞放映厅本机浏览器 AI 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在本机浏览器中安全启用脑洞放映厅的四类 AI 创作能力，并为中小学生提供可恢复、可理解的独立创作流程。

**Architecture:** Vite 在 `127.0.0.1:5174` 托管 React 页面，将 `/api` 代理给 `127.0.0.1:8766` 的 Python 服务。Python 从本机 `.env` 加载模型和代理配置、向上游转发请求并保存作品；前端通过已有 `studioEngine` 保留离线创作回退。

**Tech Stack:** React 18、TypeScript、Vite 5、原生 JavaScript、Python 标准库、SQLite、Node 内置测试运行器。

**Spec:** `docs/superpowers/specs/2026-10-12-local-browser-ai-design.md`

## Global Constraints

- 只支持本机浏览器；不修改 `app-android/`，不部署云端。
- 密钥和代理值只存在 `.env`；不得进入 `src/`、HTML、构建产物、测试输出或日志。
- 浏览器只通过相对 `/api/*` 调用后端；接口响应不得返回密钥、代理值或授权头。
- 学生点击生成立即调用模型；保留服务端的既有配额与速率限制。
- API 测试只验证配置和错误路由，禁止发起会计费的模型调用。
- 当前目录不是 Git 仓库；每项任务用可重复测试替代提交步骤。

---

### Task 1: 让本机配置可测试并保持密钥私有

**Files:**
- Modify: `server.py:83-102`
- Create: `tests/test_local_runtime.py`

**Interfaces:**
- Produces: `load_env(path: str | None = None, environ: Mapping[str, str] | None = None) -> dict[str, str]` 与 `proxy_status_label(proxy: str) -> str`。
- Consumes: `.env` 的 `HTTPS_PROXY`、模型配置和系统环境覆盖。

- [ ] **Step 1: 编写失败的配置加载测试**

```python
def test_load_env_reads_proxy_and_allows_environment_override(self):
    env_file.write_text('ARK_MODEL=file-model\nHTTPS_PROXY=http://127.0.0.1:7890\n', encoding='utf-8')
    actual = server.load_env(path=str(env_file), environ={'ARK_MODEL': 'process-model'})
    self.assertEqual(actual['ARK_MODEL'], 'process-model')
    self.assertEqual(actual['HTTPS_PROXY'], 'http://127.0.0.1:7890')
```

- [ ] **Step 2: 运行测试，确认它因函数尚不接受参数而失败**

Run: `python -m unittest tests.test_local_runtime.LocalRuntimeTests.test_load_env_reads_proxy_and_allows_environment_override -v`

Expected: FAIL，提示 `load_env()` 不接受 `path` 或 `environ` 参数。

- [ ] **Step 3: 用最小实现支持可注入的路径和环境**

```python
def load_env(path=None, environ=None):
    env = {}
    path = path or os.path.join(HERE, '.env')
    environ = os.environ if environ is None else environ
    # 保留 .env 所有键，再让已列出的运行时环境变量覆盖。
```

确保环境覆盖清单包含 `HTTPS_PROXY`、`HTTP_PROXY` 及全部模型/密钥变量；函数本身不记录或打印值。新增 `proxy_status_label`，无论代理地址为何都只返回“本机代理已配置”。将 `proxy_alive` 和 `main` 的日志改用该标签，避免把完整代理地址写入 `data/server.log`。

- [ ] **Step 4: 重新运行单元测试**

Run: `python -m unittest tests.test_local_runtime.LocalRuntimeTests.test_load_env_reads_proxy_and_allows_environment_override -v`

Expected: PASS。

- [ ] **Step 5: 验证公开配置不会泄露敏感字段**

```python
def test_modules_exposes_models_but_not_credentials(self):
    server.ENV = {'ZHIPU_API_KEY': 'secret-value', 'HTTPS_PROXY': 'http://private-proxy'}
    server.net_ok = lambda *args, **kwargs: True
    payload = server.modules()
    self.assertIn('model', payload['story'])
    self.assertNotIn('ZHIPU_API_KEY', json.dumps(payload))
    self.assertNotIn('private-proxy', json.dumps(payload))
```

并增加：

```python
def test_proxy_status_label_does_not_echo_proxy_address(self):
    label = server.proxy_status_label('http://127.0.0.1:7890')
    self.assertEqual(label, '本机代理已配置')
    self.assertNotIn('7890', label)
```

Run: `python -m unittest tests.test_local_runtime -v`

Expected: PASS。

### Task 2: 提供可靠的一键本机启动

**Files:**
- Modify: `launch.ps1`
- Modify: `启动游戏.cmd`
- Create: `tests/runtime-launch.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: Python 后端 `GET /api/health`、Vite 的 5174 端口。
- Produces: `npm run test` 可运行 Node 测试；`launch.ps1` 在后端就绪后打开 Vite 页面。

- [ ] **Step 1: 编写启动配置失败测试**

```js
test('launch script starts the API backend before Vite', () => {
  const script = readFileSync(new URL('../launch.ps1', import.meta.url), 'utf8');
  assert.match(script, /server\.py/);
  assert.match(script, /api\/health/);
  assert.match(script, /npm\.cmd run dev/);
  assert.match(script, /Get-NetTCPConnection -LocalPort \$webPort/);
});
```

- [ ] **Step 2: 运行测试，确认现有脚本缺少后端启动而失败**

Run: `node --test tests/runtime-launch.test.mjs`

Expected: FAIL，断言找不到 `server.py`。

- [ ] **Step 3: 最小化实现启动与健康检查**

```powershell
$apiPort = 8766; $webPort = 5174
if (-not (Get-NetTCPConnection -LocalPort $apiPort -State Listen -ErrorAction SilentlyContinue)) {
  Start-Process python -ArgumentList 'server.py','--port',$apiPort -WorkingDirectory $PSScriptRoot -WindowStyle Hidden
}
for ($attempt = 0; $attempt -lt 20; $attempt++) {
  if ((Invoke-WebRequest "http://127.0.0.1:$apiPort/api/health" -UseBasicParsing -ErrorAction SilentlyContinue).StatusCode -eq 200) { break }
  Start-Sleep -Milliseconds 300
}
if (-not (Get-NetTCPConnection -LocalPort $webPort -State Listen -ErrorAction SilentlyContinue)) {
  Start-Process npm.cmd -ArgumentList 'run','dev','--','--host','127.0.0.1','--port',$webPort -WorkingDirectory $PSScriptRoot -WindowStyle Hidden
}
Start-Process "http://127.0.0.1:$webPort/"
```

使 `启动游戏.cmd` 只调用该 PowerShell 脚本，避免两份启动逻辑漂移；为根 `package.json` 添加 `"test": "node --test tests/*.test.mjs"`。

- [ ] **Step 4: 重新运行启动配置测试**

Run: `npm run test`

Expected: PASS。

- [ ] **Step 5: 手动本机验证**

Run: `powershell -ExecutionPolicy Bypass -File .\launch.ps1`

Expected: 8766 的 `/api/health` 返回 200，浏览器打开 5174；不要发起模型生成请求。

### Task 3: 为儿童创作状态提供纯函数引导

**Files:**
- Create: `src/creationGuide.js`
- Create: `tests/creation-guide.test.mjs`
- Modify: `src/studioEngine.js`
- Modify: `src/StudioScreens.tsx`
- Modify: `src/app.css`

**Interfaces:**
- Produces: `creationGuide(stage, state) -> { title, prompt, primaryAction, privacyHint }`。
- Consumes: 既有阶段名 `card`、`idea`、`story`、`style`、`board`、`prem` 与当前草稿。

- [ ] **Step 1: 编写失败的引导逻辑测试**

```js
test('story stage asks the student to preserve their own setting', async () => {
  const { creationGuide } = await import('../src/creationGuide.js');
  const guide = creationGuide('story', { story: '' });
  assert.match(guide.prompt, /保留.*设定/);
  assert.equal(guide.primaryAction, '生成剧本');
});

test('board stage explains the character-place-action formula', async () => {
  const { creationGuide } = await import('../src/creationGuide.js');
  assert.match(creationGuide('board', {}).prompt, /谁.*在哪里.*做什么/);
});
```

- [ ] **Step 2: 运行测试，确认模块不存在而失败**

Run: `node --test tests/creation-guide.test.mjs`

Expected: FAIL，提示无法找到 `src/creationGuide.js`。

- [ ] **Step 3: 实现最小的阶段引导表**

```js
export function creationGuide(stage) {
  const guides = {
    story: { title: '把你的设定拍成故事', prompt: 'AI 会保留你的设定；不满意就换一种写法。', primaryAction: '生成剧本' },
    board: { title: '给这一幕搭画面', prompt: '写清谁、在哪里、做什么，画面会更像你想的。', primaryAction: '生成分镜' },
  };
  return { privacyHint: '别写真实姓名、学校、住址或联系方式。', ...(guides[stage] || guides.card) };
}
```

在 `StudioScreens.tsx` 添加一个仅含标题、短引导和隐私提醒的 `#creation-guide` 容器；在 `studioEngine.js` 的现有 `show(stage)` 流程中更新它。样式保持单行可读、移动端可换行、不遮挡主按钮。

- [ ] **Step 4: 重新运行引导测试**

Run: `node --test tests/creation-guide.test.mjs`

Expected: PASS。

- [ ] **Step 5: 验证构建**

Run: `npm run build`

Expected: PASS，Vite 生成 `dist/`。

### Task 4: 把生成失败转成可恢复的儿童提示

**Files:**
- Modify: `src/studioEngine.js:1270-1740`
- Modify: `src/creationGuide.js`
- Modify: `tests/creation-guide.test.mjs`

**Interfaces:**
- Produces: `friendlyGenerationError(module, errorMessage) -> { message, fallbackAction }`。
- Consumes: 后端的网络、代理、超时或 503 错误。

- [ ] **Step 1: 编写失败恢复提示测试**

```js
test('video network errors offer the local recording fallback', async () => {
  const { friendlyGenerationError } = await import('../src/creationGuide.js');
  const result = friendlyGenerationError('video', '连不上上游接口');
  assert.match(result.message, /网络/);
  assert.equal(result.fallbackAction, '本机录制');
});
```

- [ ] **Step 2: 运行测试，确认函数不存在而失败**

Run: `node --test tests/creation-guide.test.mjs`

Expected: FAIL，提示 `friendlyGenerationError` 未导出。

- [ ] **Step 3: 实现错误映射并接入既有生成 catch 分支**

```js
export function friendlyGenerationError(module, message = '') {
  if (module === 'video') return { message: '网络暂时没连好，先用本机录制把作品放出来。', fallbackAction: '本机录制' };
  if (/代理|火山|网络|timeout|超时/i.test(message)) return { message: 'AI 片场暂时连不上，稍等后点重试；你的内容已经保留。', fallbackAction: '重试' };
  return { message: '这次没有生成成功，改一改描述后再试试；你的草稿没有丢。', fallbackAction: '重试' };
}
```

在剧本、图片和影片生成的 `catch` 分支使用映射后的消息；影片错误额外保持现有本机录制按钮可见。不要删除后端原始错误记录，但不要在页面上渲染它。

- [ ] **Step 4: 重新运行前端测试和构建**

Run: `npm run test && npm run build`

Expected: PASS。

### Task 5: 配置本机密钥并完成无计费验证

**Files:**
- Modify: `.env`（仅本机，已被 `.gitignore` 忽略）
- Modify: `.env.example`
- Modify: `README.md`
- Modify: `tests/api.js`

**Interfaces:**
- Consumes: 用户在本机提供的模型、密钥和代理变量。
- Produces: `/api/config` 的模型就绪信息，以及不包含密钥的 `/api/health`、`/api/config` 响应。

- [ ] **Step 1: 编写 API 冒烟断言，验证配置隐藏敏感值**

```js
r = await j('/api/config');
const serialized = JSON.stringify(r.body);
check('配置不泄露代理或授权字段', !/https?_proxy|authorization|api_?key|secret|bearer|token/i.test(serialized));
```

- [ ] **Step 2: 运行冒烟测试，确认现有后端的配置路由通过**

Run: `$env:BH_BASE='http://127.0.0.1:8766'; node tests/api.js`

Expected: 测试只访问健康检查、配置、静态资源和本地 SQLite 作品库，不调用模型。

- [ ] **Step 3: 仅将用户提供的值写入本机 `.env`，并扩展样例说明**

`.env.example` 只保留变量名、占位符与“不要提交真实密钥”的说明。README 说明启动命令、5174/8766 地址、Clash 代理的可选配置和“密钥不会下发给浏览器”。

- [ ] **Step 4: 再次运行无计费 API 冒烟测试**

Run: `$env:BH_BASE='http://127.0.0.1:8766'; node tests/api.js`

Expected: PASS；输出不含任何密钥或代理完整值。

- [ ] **Step 5: 完成浏览器验收**

Run: `powershell -ExecutionPolicy Bypass -File .\launch.ps1`

Expected: 浏览器显示“脑洞放映厅”、AI 片场状态和儿童创作引导；不在验收中点击任何会计费的“生成”按钮。

## Plan Self-Review

- Spec coverage: Task 1 覆盖配置私有与代理；Task 2 覆盖本机启动；Task 3、4 覆盖儿童独立创作与离线回退；Task 5 覆盖密钥配置、文档与无计费验收。
- 占位检查: 每一项都给出了具体文件、接口、命令与预期结果。
- Interface consistency: `load_env`、`creationGuide` 和 `friendlyGenerationError` 在使用任务前定义；所有浏览器调用保持 `/api/*` 相对路径。
