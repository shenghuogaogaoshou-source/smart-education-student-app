# 智芽 App 后端

本项目提供学生 App 所需的全部服务器端能力：

- AI 伙伴回复与小学生安全策略
- 语音合成
- 相机识别与学习工具
- AI 学习安排建议
- 伙伴自然语言指令解析
- 脑洞放映厅剧本、分镜、图片、视频、配音和作品库

## 环境

- Node.js 24 或兼容版本
- Python 3.12 或兼容版本
- 如需真实 AI，请准备 DeepSeek、智谱和火山方舟密钥

## 配置

复制环境变量示例：

```powershell
Copy-Item server/.env.local.example server/.env.local
Copy-Item apps/brain-film/.env.example apps/brain-film/.env
```

填写密钥后运行：

```powershell
npm install
npm run dev
```

默认地址：

- AI 与伙伴 API：`http://127.0.0.1:8787/`
- 脑洞放映厅 API：`http://127.0.0.1:8766/`

健康检查：

```powershell
Invoke-RestMethod http://127.0.0.1:8787/api/health
Invoke-RestMethod http://127.0.0.1:8766/api/health
```

未配置密钥时，服务仍可启动，健康检查正常；依赖外部模型的请求会返回明确的“未配置密钥”或错误提示。

学生账号、学习进度、积分、勋章、作品和收藏保存在前端浏览器中，不在本后端保存。
