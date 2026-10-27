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
