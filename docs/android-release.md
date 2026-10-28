# 智芽 Android Release

正式安装包只访问一个固定 HTTPS 服务根地址。构建成功后，E:\智芽\运行文件 中只保留 智芽.apk。

## 前置条件

- Java 21、Android SDK 36 与 Build Tools。
- 阿里云后端 /api/health 和 /brain/api/health 均已通过公网 HTTPS 验证。
- Release keystore 保存在交付目录之外，例如 E:\智芽\签名\zhiya-release.jks。

不要把 keystore、密码、.env、APK 或其他签名材料提交到 Git。

## 一次性创建 Release keystore

先在专用 PowerShell 中创建签名目录：

    $keystoreDir = 'E:\智芽\签名'
    New-Item -ItemType Directory -Force -Path $keystoreDir | Out-Null
    keytool -genkeypair -v -keystore "$keystoreDir\zhiya-release.jks" -alias zhiya-release -keyalg RSA -keysize 4096 -validity 3650

keytool 会交互式询问密码和证书信息。证书申请信息可填写项目自身名称；不要使用测试证书作为最终交付签名。

## 构建

在当前 PowerShell 会话中设置以下变量，值由你本人填写：

    $env:ZHIYA_PRODUCTION_API_ORIGIN = 'https://api.example.com'
    $env:ZHIYA_ANDROID_KEYSTORE_PATH = 'E:\智芽\签名\zhiya-release.jks'
    $env:ZHIYA_ANDROID_KEYSTORE_PASSWORD = '在本次终端手工输入'
    $env:ZHIYA_ANDROID_KEY_ALIAS = 'zhiya-release'
    $env:ZHIYA_ANDROID_KEY_PASSWORD = '在本次终端手工输入'
    npm run android:release

密码不要写进 README、源码、日志或 Git。构建完成后关闭终端，避免环境变量继续留在该会话。

构建流程会执行：

1. 校验 HTTPS 根地址没有路径、查询、片段或账号密码。
2. 校验五组签名配置齐全且 keystore 存在。
3. 构建主应用和两款内嵌创作游戏。
4. 扫描 Web 构建产物中的 API 密钥前缀与本地服务地址。
5. 同步 Capacitor，执行 lintRelease 和 assembleRelease。
6. 使用 Android apksigner 验证 Release 签名。
7. 原子发布到 E:\智芽\运行文件\智芽.apk，目录内不得有其他文件。

## 验收

    Get-ChildItem -LiteralPath 'E:\智芽\运行文件'
    Get-FileHash -Algorithm SHA256 -LiteralPath 'E:\智芽\运行文件\智芽.apk'

在干净 Android 设备上卸载旧 Debug 包后安装 Release APK，至少验证登录、课程、测试、积分勋章、文字/语音 AI、六个拍照工具、两款创作游戏和作品保存。正式包不再显示“移动端学习服务”地址编辑项。

## 2026-10-28 稳定性版本验收

本轮 APK 按比赛演示版本要求继续使用 `versionCode=1`，以便直接覆盖既有演示数据。

- 包名：`com.zhiya.education`
- 版本：`1.0`
- 最低 Android：API 24（Android 7.0）
- 目标 SDK：36
- 生产 API：`https://api.zhiyaedu.com.cn`
- 文件：`E:\智芽\运行文件\智芽.apk`
- 大小：206,095,680 字节
- SHA-256：`69C038386087024061E86FCDD1F7BD05E1F972DE7B9FEA6808E7F105A29024CB`
- 正式签名：APK Signature Scheme v2
- 证书 SHA-256：`69F4DF92801EF5C7D5DC89C82DBB49E930F746FB53C71055584A6826AA8591FF`

验收结果：

- `npm run test:all`：前端、服务端、脚本、脑洞放映厅和创造模块全部通过。
- `adb install -r`：覆盖安装成功，`firstInstallTime` 保持不变，WebView 本地数据目录保持 22,208 KB。
- APK 冷启动、文字 AI 回答、1—2 年级跟读、摄像头六项入口、真实图片识别、翻译工具、创造模块真实出图和作品删除弹窗均已验证。
- 香港云端 `/api/health`、`/brain/api/health`、AI 回答、TTS 和图片生成均返回成功。

真实 Android 手机上仍需最终复测麦克风语音识别和扬声器播放；模拟器可验证文字链路和云端音频接口，但不具备真实手机麦克风体验。

## 2026-10-29 异步 AI 与性能版本验收

本轮继续使用 `versionCode=1`，通过原有正式证书覆盖升级，保留现有学习进度、积分、勋章、作品和 AI 形象数据。

- 源码提交：`ccc1137`
- 包名：`com.zhiya.education`
- 版本：`1.0`
- `versionCode`：`1`
- 生产 API：`https://api.zhiyaedu.com.cn`
- 文件：`E:\智芽\运行文件\智芽.apk`
- 大小：206,101,028 字节
- SHA-256：`39D5696C838160B2A31182BDDE89754FD29D066CF684A441157018EE8CCA0AC7`
- 正式签名：APK Signature Scheme v2
- 证书 SHA-256：`69F4DF92801EF5C7D5DC89C82DBB49E930F746FB53C71055584A6826AA8591FF`

验收结果：

- `npm run test:all`：前端 585 项、服务端 85 项、脚本 18 项、脑洞放映厅 26 项和 Python 62 项、创造模块 39 项，全部通过。
- `npm run build`：主应用、脑洞放映厅和创造模块生产构建通过。
- 香港云端 `/api/health` 与 `/brain/api/health` 均返回成功。
- `vision`、`product-image`、`film-image` 三类后台任务均成功完成；相同 `clientTaskId` 返回同一任务。
- 压缩后的真实识图任务耗时 17.94 秒；并行的实物图和分镜图任务分别耗时 33.74 秒和 34.12 秒。
- AI 回答 SSE 冷启动首段 3.15 秒，预热后 1.80 秒。
- `adb install -r` 覆盖安装成功，`firstInstallTime` 保持 `2026-10-27 12:35:50`，WebView 数据目录保持约 22 MB。
- 覆盖安装后应用正常获得前台焦点，启动日志无崩溃。

部署前源码提交为 `a4bd7ea`；香港服务器数据与配置备份位于
`/opt/zhiya/backups/pre-async-ai-20261029000707`。如需回滚，应从该提交和备份重建旧镜像，
不要清空 `/opt/zhiya/data`。

真实 Android 手机仍需最终复测麦克风长按语音、扬声器、系统后置相机和后台任务在锁屏/切后台后的恢复；模拟器不具备真实麦克风和相机体验。

## 2026-10-29 Android 权限与相机修复

本轮修复继续保持 `versionCode=1` 和原有正式签名，支持直接覆盖安装并保留本地学习数据。

- 包名：`com.zhiya.education`
- 版本：`1.0.1`
- 文件：`E:\智芽\运行文件\智芽.apk`
- 大小：206,101,100 字节
- SHA-256：`605D721191514AFAEC98168D6C6B2D5EA96CF8F961853F6CE44153A60F266DA0`
- 正式签名：APK Signature Scheme v2
- 证书 SHA-256：`69F4DF92801EF5C7D5DC89C82DBB49E930F746FB53C71055584A6826AA8591FF`

本轮变更：

- Android 麦克风在首次使用时先请求系统录音权限，再检查语音识别服务。
- APK 同时识别 Capacitor 的 `isNativePlatform()` 与 `getPlatform()`，避免原生功能被误判成浏览器。
- 六个拍照工具在 APK 内统一使用 WebView 实时相机预览，不再切换到文件选择器。
- APK 的识别任务和后台恢复请求改用生产 API 根地址，避免请求落到 `https://localhost`。
- 相机或麦克风被拒绝时，提示用户前往 Android 应用权限设置；不自动改用其他输入方式。
- “作品管理”移除重复的页面安全区和外边距，返回键与共享移动端页头保持一致。

验收结果：

- 前端测试 589 项、服务端 85 项、脚本 18 项、脑洞放映厅 26+62 项、创造模块 39 项全部通过。
- 主应用、脑洞放映厅和创造模块生产构建通过。
- `adb install -r` 覆盖安装成功，`firstInstallTime` 保持 `2026-10-27 12:35:50`。
- 模拟器中 `CAMERA` 与 `RECORD_AUDIO` 均处于未授予状态，可用于首次使用时触发系统权限选择。

真实 Android 手机仍需最终验证系统权限弹窗、长按语音收音、扬声器播放和后置相机画面。
