# 智芽单 APK 与阿里云后端 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建一个安装后无需电脑端服务或手工配置、通过固定阿里云 HTTPS 后端保留当前全部功能的智芽 Android Release APK，并让 `E:\智芽\运行文件` 最终只包含 `智芽.apk`。

**Architecture:** APK 内置主应用和两款创作子应用；阿里云中国香港轻量应用服务器运行一个包含 Node 统一网关和 Python 脑洞服务的 Docker 应用容器，主机 Caddy 提供 HTTPS。Node 处理 `/api/*` 并将 `/brain/api/*` 透明转发给容器内 Python，SQLite、影片和日志写入持久化 `/data`。

**Tech Stack:** React 19、TypeScript、Vite、Capacitor 8、Android Gradle、Node.js 22、Python 3、Docker、Caddy、FFmpeg、SQLite、阿里云轻量应用服务器。

**Spec:** `docs/superpowers/specs/2026-10-27-single-apk-aliyun-design.md`

## Global Constraints

- Android 包名保持 `com.zhiya.education`，应用名保持“智芽”，最低支持 Android 7.0（API 24）。
- 最终 APK 必须使用 Release 签名；签名文件和密码不能进入 Git、APK 交付目录或日志。
- 模型密钥只能存在于阿里云运行环境变量，不能进入前端、APK、Git 或接口响应。
- APK 只使用一个固定 HTTPS API 根地址，不依赖局域网、电脑端 Node/Python 或用户手工配置。
- Node 对外处理 `/api/*`，Python 脑洞服务通过 `/brain/api/*` 暴露且只监听容器回环地址。
- SQLite、影片和服务日志必须持久化到 `/data`。
- 现有登录、知识、测试、积分、勋章、错题、成长、AI 伙伴、拍照识别、语音、作品和两款创作子应用不得删除或降级。
- 现有工作区包含用户未提交修改；每次提交只暂存本任务明确修改的文件，不重置或覆盖无关文件。
- `E:\智芽\运行文件` 输出前必须验证目标绝对路径，之后清理为仅包含 `智芽.apk`。

---

## File Structure

### Server runtime

- `server/ai-proxy.mjs`: 把现有 AI HTTP 监听器拆成可复用 `createCompanionRequestListener(options)`，本地开发入口继续工作。
- `server/cloudGateway.mjs`: 统一生产网关；处理安全头、CORS、限流和 `/brain/*` 二进制透明代理。
- `server/cloudGateway.test.mjs`: 验证路由、Range、CORS、请求限制和错误脱敏。
- `apps/brain-film/server.py`: 支持 `DATA_DIR`、云端环境变量和反向代理前缀，不改变本地默认行为。
- `apps/brain-film/tests/test_local_runtime.py`: 验证环境变量覆盖与持久化目录。

### Alibaba Cloud packaging

- `deploy/aliyun/Dockerfile`: 构建 Node/Python/FFmpeg/中文字体混合运行镜像。
- `deploy/aliyun/start-container.mjs`: 启动 Python，等待内部健康检查，再启动 Node 网关；正确转发退出信号。
- `deploy/aliyun/compose.yaml`: 绑定持久化目录、环境文件和仅本机应用端口。
- `deploy/aliyun/Caddyfile`: 将公网 HTTPS 域名转发至应用容器。
- `deploy/aliyun/.env.example`: 只列变量名和非敏感默认值。
- `deploy/aliyun/runtime.test.mjs`: 静态验证 Docker、持久化、健康检查和密钥隔离。
- `deploy/aliyun/README.md`: 精确的阿里云购买、部署、DNS、HTTPS、密钥和更新步骤。

### APK client

- `src/app/mobileApi.ts`: 将移动端配置收敛为单一 `apiOrigin`，脑洞地址派生为同域 `/brain`。
- `src/app/mobileApi.test.ts`: 验证单域、旧配置迁移与 HTTPS 强制规则。
- `src/app/mobileGameApi.ts` 或实际运行时桥接文件：确保子应用 API 使用统一云端前缀。
- `src/features/settings/MobileServiceCard.tsx`: 生产 APK 隐藏地址编辑，开发构建保留诊断。
- `src/features/settings/MobileServiceCard.test.tsx`: 验证生产/开发显示规则。
- `scripts/build-android.mjs`: 分离 Debug/Release，强制生产 HTTPS 地址，构建、签名、验证并原子化输出。
- `scripts/build-android.test.mjs`: 验证 Release 命令、地址校验和安全清理。
- `android/app/build.gradle`: 从本机签名属性读取 Release keystore。
- `.gitignore`: 忽略 keystore、签名属性和本地部署环境文件。

---

### Task 1: Refactor the AI HTTP listener for gateway reuse

**Files:**
- Modify: `server/ai-proxy.mjs`
- Modify: `server/ai-proxy.test.mjs`

**Interfaces:**
- Produces: `createCompanionRequestListener(options): (request, response) => Promise<void>`
- Preserves: `startProxyServer(port?, host?)`
- Consumes later: `server/cloudGateway.mjs`

- [ ] **Step 1: Write failing listener tests**

Add tests that start `createServer(createCompanionRequestListener({...}))` on an ephemeral port and assert:

```js
const listener = createCompanionRequestListener({
  allowedOrigins: new Set(['https://localhost']),
  handleApi: async () => ({ status: 200, body: { ok: true } }),
})
const server = createServer(listener).listen(0, '127.0.0.1')
```

Verify allowed origins receive `access-control-allow-origin: https://localhost`, unknown origins receive no allow-origin header, and `/api/health` returns JSON without exposing environment values.

- [ ] **Step 2: Run the focused test and verify failure**

Run: `node --test server/ai-proxy.test.mjs`

Expected: FAIL because `createCompanionRequestListener` is not exported.

- [ ] **Step 3: Extract the reusable listener**

Implement:

```js
export function parseAllowedOrigins(raw = process.env.ALLOWED_ORIGINS || '') {
  return new Set(raw.split(',').map(value => value.trim()).filter(Boolean))
}

export function createCompanionRequestListener({
  allowedOrigins = parseAllowedOrigins(),
  handleApi = handleCompanionApiRequest,
  synthesize = synthesizeSpeech,
} = {}) {
  return async function companionRequestListener(request, response) {
    // Preserve current route limits and response shapes.
    // Reflect only a whitelisted Origin; never emit wildcard CORS in production.
  }
}
```

Change `startProxyServer` to `createServer(createCompanionRequestListener())` while preserving local CLI behavior.

- [ ] **Step 4: Run focused tests**

Run: `node --test server/ai-proxy.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit only Task 1 files**

```powershell
git add -- server/ai-proxy.mjs server/ai-proxy.test.mjs
git commit -m "refactor: expose reusable AI request listener"
```

### Task 2: Add the unified production gateway

**Files:**
- Create: `server/cloudGateway.mjs`
- Create: `server/cloudGateway.test.mjs`
- Modify: `vitest.server.config.ts` only if the new test needs inclusion

**Interfaces:**
- Consumes: `createCompanionRequestListener(options)` from Task 1
- Produces: `createCloudGatewayListener(options)` and `startCloudGateway(options)`
- Environment: `PORT`, `HOST`, `BRAIN_INTERNAL_ORIGIN`, `ALLOWED_ORIGINS`

- [ ] **Step 1: Write failing gateway route tests**

Create a temporary upstream HTTP server that returns JSON for `/api/health` and a binary `206` response for `/api/films/demo.mp4`. Assert:

```js
const listener = createCloudGatewayListener({
  brainOrigin: `http://127.0.0.1:${upstreamPort}`,
  companionListener,
  rateLimit: { requests: 240, windowMs: 60_000 },
})
```

- `/api/health` delegates to the companion listener.
- `/brain/api/health` reaches upstream `/api/health`.
- `/brain/api/films/demo.mp4` forwards `Range` and preserves `206`, `content-range`, `accept-ranges` and bytes.
- `/brain/../../server/.env` returns 400 without touching the upstream.
- oversized requests and request bursts return 413/429 with generic JSON errors.

- [ ] **Step 2: Verify the tests fail**

Run: `node --test server/cloudGateway.test.mjs`

Expected: FAIL because `server/cloudGateway.mjs` does not exist.

- [ ] **Step 3: Implement transparent proxying with Node built-ins**

Implement `createCloudGatewayListener` with `node:http`/`node:https` request streaming. Strip the `/brain` prefix, remove hop-by-hop headers, add `x-forwarded-proto=https`, apply `x-content-type-options: nosniff`, `referrer-policy: no-referrer`, and never log request bodies or authorization headers.

Start defaults:

```js
startCloudGateway({
  port: Number(process.env.PORT || 8080),
  host: process.env.HOST || '0.0.0.0',
  brainOrigin: process.env.BRAIN_INTERNAL_ORIGIN || 'http://127.0.0.1:8766',
})
```

- [ ] **Step 4: Run gateway and server tests**

Run: `node --test server/cloudGateway.test.mjs server/ai-proxy.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit only Task 2 files**

```powershell
git add -- server/cloudGateway.mjs server/cloudGateway.test.mjs vitest.server.config.ts
git commit -m "feat: add unified cloud API gateway"
```

### Task 3: Make brain-film storage cloud-persistent

**Files:**
- Modify: `apps/brain-film/server.py`
- Modify: `apps/brain-film/tests/test_local_runtime.py`

**Interfaces:**
- Consumes environment: `DATA_DIR`, `VIDEO_LIMIT_PER_DAY`, existing model variables
- Preserves local default: `apps/brain-film/data`
- Produces cloud paths: `${DATA_DIR}/bh.db`, `${DATA_DIR}/films`, `${DATA_DIR}/server.log`

- [ ] **Step 1: Add failing Python tests**

Add isolated tests that load the module with a temporary directory and assert:

```python
with mock.patch.dict(os.environ, {'DATA_DIR': temp_dir, 'VIDEO_LIMIT_PER_DAY': '12'}):
    module = load_server_module()
    self.assertEqual(module.DATA_DIR, temp_dir)
    self.assertEqual(module.video_day_limit(), 12)
```

Also verify a SQLite work written before reconnecting remains visible from the same temporary data directory.

- [ ] **Step 2: Run focused tests and verify failure**

Run: `npm run test:py --workspace @zhiya/brain-film`

Expected: FAIL because `DATA_DIR` and cloud `VIDEO_LIMIT_PER_DAY` are not currently read from `os.environ` at module initialization.

- [ ] **Step 3: Implement environment-backed persistence**

Set:

```python
DEFAULT_DATA_DIR = os.path.join(HERE, 'data')
DATA_DIR = os.path.abspath(os.environ.get('DATA_DIR') or DEFAULT_DATA_DIR)
```

Include `VIDEO_LIMIT_PER_DAY` in the environment override list. Keep `HTTPS_PROXY` optional but ensure an absent value uses direct outbound HTTPS in cloud. Create `/data` lazily as before and preserve all Range/video/SQLite behavior.

- [ ] **Step 4: Run all brain-film tests**

Run: `npm run test:py --workspace @zhiya/brain-film`

Expected: PASS.

- [ ] **Step 5: Commit only Task 3 files**

```powershell
git add -- apps/brain-film/server.py apps/brain-film/tests/test_local_runtime.py
git commit -m "feat: support persistent cloud storage for brain film"
```

### Task 4: Package the Alibaba Cloud runtime

**Files:**
- Create: `deploy/aliyun/Dockerfile`
- Create: `deploy/aliyun/start-container.mjs`
- Create: `deploy/aliyun/compose.yaml`
- Create: `deploy/aliyun/Caddyfile`
- Create: `deploy/aliyun/.env.example`
- Create: `deploy/aliyun/runtime.test.mjs`
- Create: `deploy/aliyun/README.md`
- Modify: `.dockerignore`
- Modify: `.gitignore`
- Modify: `package.json`

**Interfaces:**
- Consumes: `server/cloudGateway.mjs`, `apps/brain-film/server.py`
- Produces: image command `node deploy/aliyun/start-container.mjs`
- Health endpoints: `/api/health`, `/brain/api/health`

- [ ] **Step 1: Write failing deployment contract tests**

`runtime.test.mjs` must assert:

```js
assert.match(dockerfile, /ffmpeg/)
assert.match(dockerfile, /fonts-noto-cjk/)
assert.match(compose, /\/data/)
assert.match(compose, /127\.0\.0\.1:8080:8080/)
assert.doesNotMatch(envExample, /sk-|ark-[a-z0-9-]{16,}|[A-Za-z0-9]{32}\./i)
assert.match(caddyfile, /reverse_proxy 127\.0\.0\.1:8080/)
```

Also test `buildChildSpecs()` from `start-container.mjs` produces Python `--host 127.0.0.1 --port 8766` and Node cloud gateway commands.

- [ ] **Step 2: Run the deployment test and verify failure**

Run: `node --test deploy/aliyun/runtime.test.mjs`

Expected: FAIL because deployment files do not exist.

- [ ] **Step 3: Create the production Docker runtime**

Use `node:22-bookworm-slim`, install `python3`, `ffmpeg`, `fonts-noto-cjk` and `ca-certificates`, run `npm ci --omit=dev`, copy only runtime code, set `DATA_DIR=/data`, expose `8080`, and add a health check against `http://127.0.0.1:8080/api/health`.

`start-container.mjs` must:

1. Spawn Python on `127.0.0.1:8766` with UTF-8 mode.
2. Poll `/api/health` for at most 30 seconds.
3. Spawn `node server/cloudGateway.mjs` on `0.0.0.0:8080`.
4. Forward SIGTERM/SIGINT, wait for both children, and exit nonzero if either unexpectedly exits.

- [ ] **Step 4: Create compose, Caddy and environment templates**

`compose.yaml` mounts `/opt/zhiya/data:/data`, loads `/opt/zhiya/secrets/zhiya.env`, binds the app only to `127.0.0.1:8080`, uses `restart: unless-stopped`, and never contains secrets.

`Caddyfile` uses:

```caddy
{$ZHIYA_API_DOMAIN} {
  encode zstd gzip
  reverse_proxy 127.0.0.1:8080
}
```

Document exact variables listed in the spec and explicitly say not to copy local `.env` values; keys must be rotated first.

- [ ] **Step 5: Run deployment tests and build the image locally**

Run:

```powershell
node --test deploy/aliyun/runtime.test.mjs
docker build -f deploy/aliyun/Dockerfile -t zhiya-backend:local .
```

Expected: tests PASS and Docker image builds without copying any `.env` file.

- [ ] **Step 6: Run local container integration checks**

Run the container with test-only placeholder providers disabled, then call:

```powershell
Invoke-RestMethod http://127.0.0.1:8080/api/health
Invoke-RestMethod http://127.0.0.1:8080/brain/api/health
```

Expected: both return `ok: true`; `/data/bh.db` appears on the mounted host directory and survives container restart.

- [ ] **Step 7: Commit only Task 4 files**

```powershell
git add -- deploy/aliyun .dockerignore .gitignore package.json
git commit -m "feat: package aliyun cloud backend"
```

### Task 5: Collapse APK networking to one fixed HTTPS origin

**Files:**
- Modify: `src/app/mobileApi.ts`
- Modify: `src/app/mobileApi.test.ts`
- Modify: `packages/works-bridge/src/index.ts`
- Modify: `src/features/games/gameRegistry.ts`
- Modify: `src/features/games/gameRegistry.test.ts`
- Modify: `src/features/settings/MobileServiceCard.tsx`
- Modify: `src/features/settings/MobileServiceCard.test.tsx`
- Modify: `src/features/settings/SettingsPage.tsx`
- Modify: `src/vite-env.d.ts`

**Interfaces:**
- Produces: `readMobileApiConfig(): { apiOrigin: string }`
- Produces: `resolveApiUrl(path, service)` where brain requests resolve to `${apiOrigin}/brain${path}`
- Build variable: `VITE_PRODUCTION_API_ORIGIN`

- [ ] **Step 1: Write failing single-origin tests**

Assert:

```ts
expect(readMobileApiConfig(true)).toEqual({ apiOrigin: 'https://api.zhiya.test' })
expect(resolveApiUrl('/api/health', 'ai', true)).toBe('https://api.zhiya.test/api/health')
expect(resolveApiUrl('/api/health', 'brain', true)).toBe('https://api.zhiya.test/brain/api/health')
```

Test one-time migration from legacy `zhiya.mobileApiOrigins`, rejection of non-HTTPS production values, and game iframe `apiOrigin=https://api.zhiya.test/brain`.

- [ ] **Step 2: Run focused tests and verify failure**

Run:

```powershell
npx vitest run src/app/mobileApi.test.ts src/features/games/gameRegistry.test.ts src/features/settings/MobileServiceCard.test.tsx
```

Expected: FAIL because the client still uses two origins.

- [ ] **Step 3: Implement single-origin resolution**

Replace production use of `VITE_DEFAULT_AI_ORIGIN` and `VITE_DEFAULT_BRAIN_ORIGIN` with `VITE_PRODUCTION_API_ORIGIN`. Keep a compatibility reader only long enough to migrate local test/dev storage; never prefer a stored address over the production value in a Release native build.

Expose an explicit build boolean:

```ts
const PRODUCTION_NATIVE = import.meta.env.VITE_NATIVE_RELEASE === '1'
```

Hide `MobileServiceCard` when `PRODUCTION_NATIVE` is true; keep it visible in browser and debug APK builds.

- [ ] **Step 4: Run focused tests**

Run the command from Step 2.

Expected: PASS.

- [ ] **Step 5: Commit only Task 5 files**

```powershell
git add -- src/app/mobileApi.ts src/app/mobileApi.test.ts packages/works-bridge/src/index.ts src/features/games/gameRegistry.ts src/features/games/gameRegistry.test.ts src/features/settings/MobileServiceCard.tsx src/features/settings/MobileServiceCard.test.tsx src/features/settings/SettingsPage.tsx src/vite-env.d.ts
git commit -m "feat: use one production API origin in Android"
```

### Task 6: Build and sign a production Release APK safely

**Files:**
- Modify: `scripts/build-android.mjs`
- Modify: `scripts/build-android.test.mjs`
- Modify: `android/app/build.gradle`
- Modify: `android/app/src/main/AndroidManifest.xml`
- Modify: `.gitignore`
- Modify: `package.json`
- Create: `docs/android-release.md`

**Interfaces:**
- Produces command: `npm run android:release`
- Requires environment: `ZHIYA_PRODUCTION_API_ORIGIN`, `ZHIYA_ANDROID_KEYSTORE_PATH`, `ZHIYA_ANDROID_KEYSTORE_PASSWORD`, `ZHIYA_ANDROID_KEY_ALIAS`, `ZHIYA_ANDROID_KEY_PASSWORD`
- Output: `E:\智芽\运行文件\智芽.apk`

- [ ] **Step 1: Write failing Release build tests**

Test exported pure helpers:

```js
assert.equal(validateProductionOrigin('https://api.example.test'), 'https://api.example.test')
assert.throws(() => validateProductionOrigin('http://10.0.0.2:8080'), /HTTPS/)
assert.deepEqual(releaseGradleCommand(), ['gradlew.bat', 'assembleRelease'])
assert.equal(releaseApkPath(root), join(root, 'android', 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk'))
```

Use a temporary output directory containing extra files and verify `publishSingleApk` leaves exactly `智芽.apk` without deleting anything outside the resolved target directory.

- [ ] **Step 2: Run the script test and verify failure**

Run: `node --test scripts/build-android.test.mjs`

Expected: FAIL because Release helpers are not implemented.

- [ ] **Step 3: Add environment-backed Gradle signing**

Configure `signingConfigs.release` only when all five signing variables are present. Make `assembleRelease` fail with a clear message if signing is incomplete. Set `android:usesCleartextTraffic="false"` for Release-compatible HTTPS operation and keep camera/microphone/media permissions.

- [ ] **Step 4: Implement the Release build pipeline**

`buildAndroidRelease()` must:

1. Validate `ZHIYA_PRODUCTION_API_ORIGIN` is an HTTPS origin without a path, query or fragment.
2. Set `VITE_PRODUCTION_API_ORIGIN` and `VITE_NATIVE_RELEASE=1`.
3. Run `npm run build`, Capacitor sync, `lintRelease`, `assembleRelease`.
4. Run Android SDK `apksigner verify --verbose --print-certs`.
5. Scan built web assets and APK strings for known key prefixes and local origins (`127.0.0.1:8787`, `127.0.0.1:8766`, private LAN defaults).
6. Resolve and validate `E:\智芽\运行文件`, clear its direct children, then atomically copy the APK as `智芽.apk`.
7. Verify the directory contains exactly one regular file named `智芽.apk`.

- [ ] **Step 5: Run Release helper and full script tests**

Run:

```powershell
node --test scripts/build-android.test.mjs
npm run test:scripts
```

Expected: PASS.

- [ ] **Step 6: Generate the local Release keystore outside the output directory**

Create `E:\智芽\签名\zhiya-release.jks` with alias `zhiya-release`. Store passwords only in a local ignored PowerShell environment file under `E:\智芽\签名`; do not print passwords or commit them. Record the SHA-256 certificate fingerprint in a local verification note outside `E:\智芽\运行文件`.

- [ ] **Step 7: Commit only Task 6 source files**

```powershell
git add -- scripts/build-android.mjs scripts/build-android.test.mjs android/app/build.gradle android/app/src/main/AndroidManifest.xml .gitignore package.json docs/android-release.md
git commit -m "feat: add signed Android release pipeline"
```

### Task 7: Deploy the backend to Alibaba Cloud

**Files:**
- No source changes expected after Task 4; if deployment reveals a defect, return to the owning task and add a regression test before changing code.

**Interfaces:**
- Consumes: Git repository, `deploy/aliyun/*`, rotated provider keys
- Produces: one fixed HTTPS origin stored locally as `ZHIYA_PRODUCTION_API_ORIGIN`

- [ ] **Step 1: Create the Alibaba Cloud resources**

In the authenticated Alibaba Cloud console:

1. Buy a China (Hong Kong) lightweight application server for at least two months with Ubuntu 24.04, 2 vCPU, at least 2 GB RAM and at least 40 GB disk.
2. Add a firewall rule for 443/TCP and 80/TCP; restrict SSH to the administrator's current public IP.
3. Create DNS A record for the API hostname pointing to the public IPv4 address.

- [ ] **Step 2: Install Docker and Caddy, then create protected paths**

On the server create:

```text
/opt/zhiya/app
/opt/zhiya/data
/opt/zhiya/secrets
```

Set `/opt/zhiya/secrets` to owner-only permissions. Clone the repository to `/opt/zhiya/app`; never upload local `.env` files.

- [ ] **Step 3: Enter rotated secrets in `/opt/zhiya/secrets/zhiya.env`**

Fill every required variable from the spec. Set `VIDEO_LIMIT_PER_DAY=12`, `DATA_DIR=/data`, and omit `HTTPS_PROXY`. Confirm the file is mode `600` and absent from `git status`.

- [ ] **Step 4: Build and start the cloud runtime**

Run Docker Compose from `deploy/aliyun`, install the supplied Caddyfile with `ZHIYA_API_DOMAIN` set, and wait for both health endpoints:

After assigning the actual origin to the local shell variable `ZHIYA_PRODUCTION_API_ORIGIN`, request `${ZHIYA_PRODUCTION_API_ORIGIN}/api/health` and `${ZHIYA_PRODUCTION_API_ORIGIN}/brain/api/health`.

Expected: both return HTTP 200 and `ok: true`.

- [ ] **Step 5: Verify persistence and provider calls**

Create a temporary brain-film work through `/brain/api/works`, restart the container, and verify the work remains. Then make one bounded call for AI reply, schedule, vision, story, image, video submission/polling, TTS and film stitching. Delete only the temporary verification work after success.

- [ ] **Step 6: Verify operational protection**

Check that unknown origins do not receive permissive CORS, bursts receive 429, oversized images receive 413, application logs do not contain key values, and only 80/443 plus restricted SSH are externally reachable.

### Task 8: Build the final APK and perform full acceptance

**Files:**
- Output only: `E:\智芽\运行文件\智芽.apk`

**Interfaces:**
- Consumes: production HTTPS origin from Task 7 and Release signing variables from Task 6
- Produces: final installable APK

- [ ] **Step 1: Run the complete automated suite**

Run:

```powershell
npm run test:all
npx tsc --noEmit
```

Expected: all frontend, server, script, Python and game tests PASS.

- [ ] **Step 2: Build the final Release APK**

Set the five local signing variables and `ZHIYA_PRODUCTION_API_ORIGIN` to the verified HTTPS origin, then run:

```powershell
npm run android:release
```

Expected: `E:\智芽\运行文件` contains exactly one file, `智芽.apk`.

- [ ] **Step 3: Verify APK metadata and signature**

Use Android SDK `apkanalyzer`/`aapt2` and `apksigner` to verify:

- package `com.zhiya.education`
- version code/name expected by the build
- min SDK 24 and target SDK 36
- camera, microphone and network permissions
- valid Release signature certificate
- no Debug certificate
- no known API key prefix or local backend URL

- [ ] **Step 4: Install on a clean Android emulator or device**

Uninstall prior debug package, install the final Release APK, launch it, grant camera/microphone access and verify it reaches the login screen without WebView or network-security errors.

- [ ] **Step 5: Execute the user-flow acceptance checklist**

Verify in order:

1. Login with the fixed demo account.
2. Open all three grade bands, complete one knowledge unit and one test; confirm points and badge update.
3. Open growth plan and obtain an AI suggestion.
4. Ask the current AI companion by text and long-press voice; confirm the correct companion name and spoken reply.
5. Execute one allowed voice navigation command.
6. Run all six camera tools with a real image.
7. Open brain-film, generate or polish a script, create an image, submit/poll a video, synthesize speech and save a work.
8. Open creative-module, call AI assistance and image generation, then save a draft to the main workbench.
9. Open works, favorites, wrong answers and learning records; verify current project data.
10. Disable network; confirm local learning pages and stored progress still work. Restore network and confirm AI retry succeeds.

- [ ] **Step 6: Confirm single-file delivery**

Resolve `E:\智芽\运行文件`, list direct children, and assert there is exactly one file and zero subdirectories. Compute and record the APK SHA-256 in the task response, not as another file in the delivery directory.

- [ ] **Step 7: Commit final source changes only after verification**

If acceptance required any source fixes, commit those files with their regression tests. Do not commit the APK, keystore, secret environment file or provider credentials.

---

## Final Plan Self-Review

- Spec coverage: APK、云端统一网关、Node/Python、持久化、FFmpeg、HTTPS、密钥隔离、Release 签名、单文件输出、自动测试、真机全流程均由 Tasks 1–8 覆盖。
- Placeholder scan: 生产域名是 Task 7 的部署产物，通过 `ZHIYA_PRODUCTION_API_ORIGIN` 传递；计划中没有需要工程师猜测的 `TBD`/`TODO`。
- Type consistency: Task 1 输出 `createCompanionRequestListener`，Task 2 消费；Task 2 输出单根网关；Task 5 输出 `readMobileApiConfig` 与单域解析；Task 6 消费唯一生产地址并输出 Release APK；Task 8 消费云端地址和签名变量完成交付。
