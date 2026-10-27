# 智芽 App 前端

学生端 React 应用，包含主应用、脑洞放映厅和创造模块。

## 环境

- Node.js 24 或兼容版本
- 后端包已启动

## 启动

```powershell
npm install
npm run dev
```

默认地址：

- 主应用：`http://127.0.0.1:5173/`
- 脑洞放映厅：`http://127.0.0.1:5191/`
- 创造模块：`http://127.0.0.1:5192/`

默认连接本机后端：

- AI 与伙伴 API：`http://127.0.0.1:8787`
- 脑洞放映厅 API：`http://127.0.0.1:8766`

如果后端部署在其他地址，可在启动前设置：

```powershell
$env:ZHIYA_AI_API_ORIGIN = "http://127.0.0.1:8787"
$env:ZHIYA_CREATIVE_API_ORIGIN = "http://127.0.0.1:8787"
$env:ZHIYA_BRAIN_FILM_API_ORIGIN = "http://127.0.0.1:8766"
npm run dev
```

## 本地数据

登录状态、学习进度、积分、勋章、作品、收藏和互动保存在浏览器 `localStorage` 与 IndexedDB 中，不会写入源码或后端。

## 验证

```powershell
npm test
npm run build
```
