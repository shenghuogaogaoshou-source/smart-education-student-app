# DeepSeek AI 伙伴本机配置

AI 伙伴使用 `deepseek-flash` 的非思考模式，适合短问短答。语音识别与语音播报在学生的浏览器本机执行；只有转写后的短文本会发到本机代理，再由代理请求 DeepSeek。

1. 在项目根目录运行 `Copy-Item server/.env.example server/.env.local`。
2. 打开 `server/.env.local`，填入**已轮换的新** `DEEPSEEK_API_KEY`；不要把它放进 `src/`、`VITE_*` 变量或 Git。
3. 运行 `npm run dev`。这个命令会同时启动网页和只监听本机的 AI 安全代理，避免只启动网页而导致问答不可用。

如果只想单独调试其中一部分，可以分别运行 `npm run ai:server` 和 `npm run dev:web`。

开发环境中，Vite 会将 `/api/companion/reply` 和 `/api/companion/interpret` 转发到只监听本机的 AI 代理。前者回答普通学习问题，后者把自然语言转换为经过本地白名单复核的应用命令。部署时应使用同样的服务端路由，并把密钥设置为部署平台的私密环境变量。

浏览器需要允许麦克风，并支持 Web Speech API。若浏览器没有语音识别能力，页面会显示提示但不会录音或上传音频。
