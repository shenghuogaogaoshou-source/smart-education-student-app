# 智芽单 APK 与阿里云后端设计

## 目标

将现有智芽 Web 原型交付为一个可直接安装的 Android Release APK。安装后保留电脑端当前可演示的全部用户功能，并通过固定的阿里云 HTTPS 后端调用现有模型服务。最终 `E:\智芽\运行文件` 只保留 `智芽.apk`。

“单 APK”指用户只需安装一个文件，不需要在用户电脑上启动 Node.js、Python、代理脚本或局域网服务。AI 模型密钥和需要服务端执行的能力仍运行在云端，绝不打入 APK。

## 成功标准

1. 新 Android 设备只安装 `智芽.apk` 即可进入应用，不要求输入服务地址。
2. 登录、课程、测试、积分、勋章、错题、成长安排、成长画像、AI 伙伴搭配、收藏和本地作品与当前电脑端行为一致。
3. AI 伙伴问答、学习安排建议、拍照识别六项能力、课程朗读、语音输入和回答播报可用。
4. 脑洞放映厅和创造模块直接在应用内打开，剧本、图像、视频、配音和成片拼接能力可用。
5. 脑洞放映厅作品备份、影片 Range 播放和服务器重启后的数据恢复可用。
6. API 密钥不出现在 APK、前端资源、Git、日志和接口响应中。
7. 云端不可用时显示儿童易懂的重试提示；不破坏课程、测试和本地数据。
8. APK 使用独立 Release 签名，能在 Android 7.0 及以上设备安装。

## 总体架构

### Android APK

- 继续使用 React 19、TypeScript、Vite 和 Capacitor。
- 主应用及两款创作子应用全部编译进 `dist`，不从云端加载 UI。
- 使用 Capacitor 原生插件提供语音识别和 TTS；相机与媒体选择使用 Android 权限及 WebView 能力。
- 构建时注入唯一的生产 API 根地址，例如 `https://api.example.com`。
- AI 服务与脑洞服务都使用该根地址；脑洞接口使用 `/brain/api/*` 前缀。
- 比赛版隐藏原有“移动端学习服务地址”手动配置，避免学生误改；开发版保留可测试能力。

### 阿里云后端

- 使用阿里云中国香港轻量应用服务器，避免中国内地 Web 服务的 ICP 备案前置要求。
- 使用 Docker 部署一个统一容器：
  - Node 网关监听容器对外端口。
  - Python 脑洞服务只监听容器内部回环地址。
  - Node 直接处理 `/api/*`，将 `/brain/api/*` 反向代理到 Python `/api/*`。
- Caddy 或 Nginx 在主机上终止 HTTPS，只开放 443；80 仅用于证书签发和跳转；Node、Python 端口不对公网开放。
- 持久化卷挂载到 `/data`，保存 SQLite、成片文件及必要日志。
- Docker 镜像内安装 Node.js、Python、FFmpeg 和中文字体。

## 数据流

### AI 伙伴、识别和学习建议

1. APK 向固定 HTTPS 根地址发送 `/api/companion/*` 或 `/api/tts` 请求。
2. Node 网关执行内容边界、请求大小、速率和每日额度检查。
3. Node 从云端环境变量读取 DeepSeek、通义视觉或火山密钥，调用对应上游。
4. 仅将安全处理后的结果返回 APK。

### 脑洞放映厅

1. 内嵌子应用通过运行时桥接把 `/api/*` 改写为 `/brain/api/*`。
2. Node 网关代理请求至内部 Python 服务。
3. Python 调用智谱和火山模型，使用 FFmpeg 处理成片。
4. SQLite 与成片写入 `/data`，重启或更新容器后仍保留。
5. 视频 Range 请求继续由 Python 返回，Node 透明转发状态码和响应头。

### 本地学习数据

- 学习进度、积分、勋章、AI 伙伴搭配和作品工作台继续保存在设备 localStorage/IndexedDB。
- APK 升级时沿用同一包名与签名，Android 会保留应用数据。
- 卸载应用会删除设备本地数据，这是当前本地演示架构的既有行为，不在本次范围内扩展为正式账号云同步。

## 环境变量

### 密钥

- `DEEPSEEK_API_KEY`
- `VISION_API_KEY`
- `ZHIPU_API_KEY`
- `ARK_API_KEY`
- `VIDEO_API_KEY`
- `VOICE_API_KEY`

### 模型配置

- `DEEPSEEK_MODEL=deepseek-flash`
- `VISION_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1`
- `VISION_MODEL=qwen3-vl-plus`
- `ZHIPU_MODEL=glm-5.2`
- `ARK_MODEL=doubao-seedream-5-0-260128`
- `ARK_SIZE=2560x1440`
- `VIDEO_MODEL=doubao-seedance-2-0-mini-260615`
- `VOICE_MODEL=glm-tts`
- `VOICE_VOICE=female`
- `VOICE_SPEED=1.0`

### 服务配置

- `NODE_ENV=production`
- `PORT=8080`
- `DATA_DIR=/data`
- `VIDEO_LIMIT_PER_DAY=12`
- `ALLOWED_ORIGINS=https://localhost,capacitor://localhost`

服务器不配置本机 `HTTPS_PROXY`。所有旧密钥在上线前轮换，现有 `.env` 文件不得进入 Docker 构建上下文或 Git。

## 安全设计

- 所有上游密钥仅保存在服务器环境变量中。
- 网关限制 JSON/图片上传大小、单位时间请求数和每日高成本调用数。
- CORS 只允许 Android WebView 生产来源和健康检查需要的来源。
- 服务端错误不返回文件路径、密钥、上游完整响应或调用栈。
- 日志记录请求类型、结果、耗时和匿名设备标识，不记录孩子的完整对话、图片正文或密钥。
- 服务器安全组仅开放 443、80，以及限制来源的管理端口。
- APK 中的任何固定标识都不视为真正秘密；成本保护依赖服务器限流和上游账户预算告警。

## 可靠性与降级

- APK 启动不依赖云端健康检查；本地页面和学习数据先加载。
- 第一次 AI 请求失败时进行有限次数指数退避重试。
- 长耗时视频生成使用“提交任务—轮询状态”方式，不保持超长单次 HTTP 连接。
- Node 网关和 Python 服务均提供健康检查；Docker 设置自动重启。
- AI 失败时保留当前已有的离线提示或本地降级内容，不清空用户输入。
- 服务器磁盘与 API 额度在答辩前检查；不依赖会自动休眠的免费实例。

## 构建与签名

- 新增生产 APK 构建脚本：构建两款游戏、主前端、同步 Capacitor、执行 Gradle Release 构建并验证签名。
- Release keystore 存放在交付目录之外，加入 `.gitignore`；保留以便后续升级使用同一签名。
- 生产 API 地址由构建环境注入，不提供 APK 内手工改地址入口。
- 输出前清理 `E:\智芽\运行文件`，复制并统一命名为 `智芽.apk`。

## 验证计划

### 自动验证

- 全量前端、服务端、脚本和游戏测试。
- TypeScript 编译、Vite 生产构建和 Android lint。
- 网关路由、CORS、请求大小、限流、错误脱敏和 Python 代理测试。
- APK 签名、包名、版本、权限和内置 URL 检查。
- 扫描 APK、Git 和构建日志，确保不存在已知密钥模式。

### 云端验证

- `/api/health` 与 `/brain/api/health` 返回 200。
- 重启容器后 SQLite 作品和已生成影片仍存在。
- AI 对话、学习建议、拍照识别、剧本、图像、视频、配音和成片拼接逐项成功。

### 真机验收

- 全新安装后无需电脑端程序或手动服务配置。
- 使用固定演示账号完成登录。
- 浏览三套课程并完成测试，核对积分与勋章联动。
- 长按 AI 伙伴进行语音问答，执行允许的应用内导航命令。
- 使用相机六项能力。
- 打开两款创作应用，完成作品保存、继续编辑与发布流程。
- 断网后本地课程和数据仍可访问，联网恢复后 AI 功能可重试。

## 外部前置条件

最终可用 APK 依赖以下外部条件先完成：

1. 购买并启用阿里云中国香港轻量应用服务器。
2. 准备可用于 HTTPS 的域名并解析到服务器，或提供等价的可信 HTTPS 入口。
3. 在服务器环境变量中填写轮换后的模型密钥。
4. 确认各模型账户未来两个月具有足够额度。

在生产 HTTPS 地址确定之前可以完成代码改造、Docker 镜像和测试，但不能生成满足“安装后立即使用全部 API”的最终 APK。
