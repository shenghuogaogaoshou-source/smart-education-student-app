# 脑洞放映厅 APP

当前前端使用 React 18 + TypeScript + Vite。界面固定为 390px 宽、最高 844px 的竖屏应用容器，在桌面居中显示，在小屏幕自动适配。不包含安装入口、PWA 清单或离线服务注册。

## 本机启动

```sh
npm install
powershell -ExecutionPolicy Bypass -File .\launch.ps1
```

启动器会复用或启动本机 Python API（`127.0.0.1:8766`）和浏览器页面（`127.0.0.1:5174`），然后打开脑洞放映厅。也可以双击 `启动游戏.cmd`。

首次使用时，把 `.env.example` 复制为 `.env`，只在 `.env` 中填写模型密钥。密钥和代理不会进入 React 代码、HTML 或浏览器；浏览器只访问相对路径 `/api/*`，由本机 Python 服务转发。`.env` 已被忽略，分享作品夹前请删掉它。

若图像或影片服务需要本机代理，可在 `.env` 填写 `HTTPS_PROXY` 后重启服务。启动前确保代理软件已运行；不使用代理时保持该项为空。

开发命令仍可单独运行：`npm run dev` 启动网页，`python -X utf8 server.py --port 8766` 启动本机 API。

自测命令：

- `npm test` —— 纯逻辑单测（卡池拖动、逐格拍片规划、创作引导、启动脚本），不需要任何服务。
- `npm run test:py` —— 后端单测（HTTP 层、拼接、字幕折行，含一次真 ffmpeg 拼接）。
- `npm run test:e2e` —— 真浏览器回归（先起前端与后端）。四支脚本分别覆盖全流程、首映礼分镜翻页、抽卡拖动、逐格拍片（AI 接口全部打桩，不花钱）。

## 结构

- src/main.tsx：React 入口，含命令式层的兜底错误提示条。
- src/App.tsx：应用容器、返回导航、继续创作与显示设置。
- src/useStudioController.ts：TypeScript 导航栈、草稿状态、滚动记忆和旧引擎接口。
- src/features/：欢迎、抽卡、想法、剧本、画风、分镜、首映礼七个 React 页面组件。
- src/app/：本地显示偏好和错误恢复边界。
- src/StudioScreens.tsx：页面组合层，保持创作区域稳定挂载。
- src/studioEngine.js：保留原有卡池、创作、画图、影片与 AI 调用逻辑的兼容模块，由 Vite 打包；原有 JavaScript 逻辑尚未全面转换为 TypeScript。
- src/slotDrag.js、src/filmPlan.js、src/creationGuide.js：抽卡换位、逐格拍片、创作引导的纯逻辑，可直接被 node 测试。
- src/app.css：固定手机尺寸与内部滚动。
- css/style.css：游戏界面样式（含打印手册样式）。
- server.py：零依赖后端（静态托管 + AI 代理 + ffmpeg 拼接 + SQLite 记账）。
- tools/subtitle_film.py：给成品片补烧旁白字幕的命令行工具。
- vite.config.ts：开发服务与 API 代理。

需要在线 AI 或服务器作品库时，另行运行 `python -X utf8 server.py --port 8766`。Vite 将 /api 转发到该地址。后端不可用时仍支持本地创作，API 密钥继续只放在服务器 .env。

作品库采用“浏览器缓存 + 本机 SQLite 备份”：装订作品时会先保存到当前浏览器，再同步到 `data/bh.db`；重新打开或点「我的作品库」时会合并恢复本机备份。删除与「清空本机所有数据」也会同步删除对应备份。服务暂时未启动时不会阻止创作，恢复后再次打开作品库即可补同步。

## 首映礼：逐格拍片

点「🎬 逐格拍片 + 配音」时，前端按**分镜格数**逐格提交图生视频任务（每格用自己那张画面当首帧、自己那句剧本当提示词，并点明承接上一格），每段通常 5 秒；全部就绪后交给服务端 `/api/film/stitch`，由 ffmpeg 依次拼接并给每段配上它自己那句旁白。

- 最多 10 段（`src/filmPlan.js` 的 `MAX_SEGMENTS` 与 `server.py` 的 `MAX_FILM_SEGMENTS` 需一致）。
- 某格失败会重试一次；仍失败就降级成「这一格的分镜图 + 这句旁白」的静帧，整片照常出。
- 已经拍好的段会存进草稿，中途关掉页面再回来只补缺的段，不重复花钱。
- 每格一次调用，等于多条视频额度：`.env` 里 `VIDEO_LIMIT_PER_DAY=0` 表示不限额（仍会记账到 `data/bh.db` 的 usage 表）；想限额就填数字。
- 想完全不花钱地出片，仍可用「🎬 本机录制（免费）」，它按剧本逐页拼图文并配旁白。
- 自测：`npm run test:e2e`（AI 接口全部打桩，不花钱）与 `npm run test:py`（含一次真 ffmpeg 拼接）。

## 补字幕

已经出好的片子要加旁白字幕，用命令行：

```sh
py -3 tools/subtitle_film.py data/films/film-xxx.mp4 --lines "第一句" "第二句" "第三句" "第四句"
```

会自动按关键帧找每格的分界（也可用 `--bounds 0,10.9,22.2,33.1` 指定），烧进画面下方并保留原音轨；加 `--dry-run` 只预览切法。不加 `--out` 时就地覆盖，原片先备份成 `.orig.mp4`。

## 安全边界

后端只监听本机（`--lan` 才对外），密钥只在服务器 `.env`；写接口只接受 POST，静态托管不提供 `data/` 下的数据库与影片（影片走 `/api/films/*` 的 Range 路由）。`.env` 已被 git 忽略，分享作品夹前请删掉它；不要再额外复制一份带密钥的 `.env.*` 文件。

## 手机 / 平板

双击 `启动手机模式.cmd`（内部是 `launch.ps1 -Lan`），后端与网页都会绑到局域网，窗口会打印形如 `http://10.x.x.x:5174/` 的地址；手机连同一个 Wi-Fi 用浏览器打开即可，也可以「添加到主屏幕」。详见 `怎么装到手机.txt`。

## 清理说明

旧的 `js/`、`app-android/`、历史 APK、PWA 清单与 Service Worker 已删除：它们的游戏逻辑是早期的（HTML5 拖拽、单镜头影片），装上去只会看到过期界面。当前唯一入口是 `src/` + `server.py`；前端修改一律以 `src/` 为准。浏览器存储按端口区分，旧端口下的作品需要先用旧版本导出备份。
