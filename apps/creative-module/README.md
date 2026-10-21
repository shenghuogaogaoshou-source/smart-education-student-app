## APP 体验优化

- 自由画布自动保存模块、位置、参数、连线和自定义代码；进入关卡再返回时恢复自由画布。
- 草稿不保存摄像头图像、推理结果或媒体流；恢复后默认停止运行。
- Aa 显示设置提供标准／大字、柔和／清晰外观，并记住选择。
- 页面异常提供重新打开入口；原有独立模块市场和长按半屏检视器保持可用。
- 草稿测试：`node --test tests/circuitDraft.test.cjs`。

> 当前界面：React + TypeScript + Vite 的竖屏 APP 预览，固定宽度 390px、最高 844px；不再提供手机安装功能。运行 npm run dev，访问 http://127.0.0.1:5173/ 。模块市场独立页面和长按半屏检视器保持可用。历史 PWA 文档与压缩包不代表当前版本。

# AI Circuit Lab · AI 数字电路实验室

> 用拖拽积木的方式搭建真实的 AI 系统。每一个 AI 模块都是真正在运行的模型——不是动画演示，是真实推理。

基于 React Flow 的可视化 AI 编程教学平台。学习者通过连接「输入 → AI 感知 → 逻辑判断 → 输出」五大层级，亲手搭建出能看、能听、能判断的智能系统，在动手过程中理解 AI 的工作原理。

## 核心特性

- **真实 AI 推理**：所有 AI 模块都加载真实模型（COCO-SSD 目标检测、亮度感知等），不是模拟动画
- **数据流可视化**：数据沿连线实时流动，每一步推理过程可见
- **类型严格匹配**：图像只能连图像、标签只能连标签，从源头杜绝接线错误
- **中文标签输出**：COCO-SSD 检测结果自动翻译为中文（瓶子、杯子、人、猫…），无需英文基础
- **关卡式教学**：故事化场景任务（海洋清道夫、森林防火…），引导式通关
- **状态自动复位**：删除连线或节点时，下游节点状态自动清空复位（如灯泡熄灭）
- **手绘漫画风格**：粗墨线边框 + 水彩色块 + 手写体 + 自定义手形光标，适合儿童与青少年
- **浏览器原生运行**：无需安装，打开即用，WebGL 加速推理

## 快速开始

### 环境要求

- Node.js ≥ 18
- npm ≥ 9
- 支持 WebGL 的现代浏览器（Chrome / Edge 推荐）

### 安装与启动

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build

# 预览生产构建
npm run preview
```

启动后访问终端显示的本地地址（默认 http://localhost:5173/）。

### COCO-SSD 模型准备

应用启动时会自动加载 COCO-SSD 目标检测模型，按以下优先级探测源：

1. 环境变量 `VITE_COCO_SSD_MODEL_URL`（自定义镜像，在 `.env` 中配置）
2. 本地打包 `/models/coco-ssd/model.json`（运行下方脚本后存在）
3. 官方 GCS 源（需能访问 storage.googleapis.com）

**国内网络环境推荐**：运行预下载脚本，将模型缓存到本地，永久离线可用。

```powershell
# Windows PowerShell
./scripts/fetch-coco-ssd.ps1
```

脚本会将模型权重分片下载到 `public/models/coco-ssd/`，应用加载时直接读取本地文件，避免网络等待。

## 使用指南

### 自由实验台

自由模式下可使用全部核心模块搭建任意电路。左侧是模块市场，中间是画布，右侧是检视器。

**典型链路**：摄像头 → 感光器（亮度感知）→ IF 条件判断 → 灯泡/门/警报

操作方式：
- 从模块市场**拖拽**模块到画布（也可以点市场左上角的「AI 模块市场」，点元件看说明、按「添加」放入画布）
- 拖动节点的**输出端口**（右侧圆点）到另一节点的**输入端口**（左侧圆点）建立连线
- **参数直接改**：每个元件底部显示最多 3 个可调参数（如 IF 的「当标签包含」、Timer 的间隔），点进去就能输入，改完立即生效
- 参数超过 3 个时，点元件右上角的 **🔧** 打开完整检视器（全部参数 + 代码 + 说明）
- **删除元件**：点元件右上角的 **✕**（会自动清空下游输入、复位状态），也可以选中后按 Delete / Backspace
- 点击顶部**运行**按钮启动数据流
- 删除连线时，下游节点状态会自动复位

### 关卡模式

进入「关卡探险」选择关卡。列表按**年级板块**编排（1-2年级 / 3-4年级 / 5-6年级），每个关卡有：
- **故事背景**：为什么要做这件事
- **限定模块**：只提供本关需要的 AI 模块
- **引导步骤**：逐步提示如何搭建电路
- **通关条件**：如正确率 ≥ 80%、处理 ≥ 8 张图片

**关卡 1 · 海洋清道夫**（已实现）

太平洋漂浮着塑料瓶和塑料杯，同时有鱼群活动。清理机器人需要 AI 分辨垃圾与鱼——是垃圾就抓取，是鱼就放过。

电路：场景相机 → 垃圾分类器（COCO-SSD）→ IF（匹配"垃圾"）→ 机械臂

- 场景相机拍摄真实海洋照片（传送带式滚动，每张约 3.8 秒，8 张共约 30 秒）
- 垃圾分类器用 COCO-SSD 检测瓶子/杯子，输出中文标签「鱼」或「垃圾」
- IF 节点匹配到「垃圾」时输出真信号
- 机械臂收到信号伸出抓取
- 通关条件：正确率 ≥ 80% 且处理 ≥ 8 张照片（约 1 分钟内完成）

**关卡 2-5**（占位，列表可见但标注「敬请期待」，暂不可进入）：森林防火哨兵、城市无障碍助手、智慧交通灯、AI 生态城市

## 模块市场

### 核心模块（自由模式可用）

| 模块 | 类别 | 功能 |
|------|------|------|
| 摄像头 Camera | 输入 | 捕获摄像头画面，持续输出图像帧 |
| 感光器 Photosensor | 感知 | 读取画面平均亮度，判断明暗 |
| 目标检测 Object Detection | 感知 | COCO-SSD 识别 80 类物体，输出中文标签（瓶子、人、猫…） |
| IF 条件判断 | 逻辑 | 标签匹配时输出真信号 |
| 与门 AND / 或门 OR / 非门 NOT | 逻辑 | 布尔逻辑组合 |
| 计时器 Timer | 逻辑 | 周期性输出信号 |
| 计数器 Counter | 逻辑 | 上升沿累计次数，达标输出信号（重置端可选） |
| 延时器 DelayTimer | 逻辑 | 触发后延时 N 秒输出脉冲 |
| 文本合并 TextMerge | 逻辑 | 2~3 路文本拼接/模板（第 2、3 路可选） |
| 行动输出 Output | 输出 | 灯泡/门/警报/机器人挥手 |
| 文本显示 / 蜂鸣器 / 音频播放器 / LED 指示灯 | 输出 | 文字气泡、音效、朗读、指示灯 |
| 数值仪表 NumberGauge | 输出 | 显示数值输出（亮度% / 数量 / 计数 / 音量 / 置信度） |
| 文本输入 / 图片输入 | 输入 | 静态数据源（文本支持 自动 / 按钮 / 信号 三种触发） |
| 麦克风 Microphone | 输入 | 采集音频 |

### 关卡专用模块（仅关卡模式可见）

| 模块 | 关卡 | 功能 |
|------|------|------|
| 场景相机 SceneCamera | L1 | 拍摄场景画布的滚动画面 |
| 垃圾分类器 TrashClassifier | L1 | COCO-SSD 检测瓶子/杯子，输出中文标签「鱼/垃圾」 |
| 机械臂 RoboticArm | L1 | 收到信号时抓取场景中的物体 |

### 自定义模块

支持用户在「自定义模块创建器」中编写 JavaScript 代码定义新模块的求值逻辑，保存到 localStorage，应用重启后自动重新注册。执行环境为沙盒模式，拦截 37 类危险 API 并遮蔽全局对象。

**AI 助手**：创建器顶部可以用一句话描述需求（例如「把 0~1 的置信度换算成 0~100 的百分比并输出数值」），由 DeepSeek 生成模块名称、分类、图标、输入/输出端口、可调参数和求值代码，自动填好后点「创建模块」即可。生成结果仍会经过本机安全检查与端口类型校验。

- 默认接口：`https://api.deepseek.com/chat/completions`（模型 `deepseek-chat`），浏览器可直连
- Key 可在浏览器 `localStorage['aicircuit.aiSettings']` 里覆盖 `{ apiKey, endpoint, model }`
- ⚠️ 前端持有 API Key 等于公开：只适合本地/课堂演示，正式上线必须换成自己的后端代理

### 模块详情

模块市场里**点任意一个元件**即可查看它的详情：它做什么、为什么有用、输入/输出端口与类型、可调参数与默认值、**可以怎么组合**（能接在哪些元件后面 / 结果能送给哪些元件，按端口类型自动推导）、以及**代码实现**（点开看真实逻辑）。详情页里也能直接「加入画布」。

### 作品检查与导出（画布右下角）

点右下角的「**作品检查与导出**」，在一个面板里完成四件事：

1. **结构自检（本机、立刻、免费）**：空画布、必需输入没接线（可选端口不算）、IF 目标标签为空、孤立元件、没有终端输出、连线成环。每条都给出「怎么改」。
2. **AI 审查**：把元件与连线清单（含参数）交给大模型，返回 0~100 的可用度评分、一句话总评和问题清单（必须修 / 建议修 / 提示）。
3. **生成实物图**：按电路里的元件翻译成现实部件（摄像头、光线传感器、控制主板、继电器+灯泡…），用火山方舟 `doubao-seedream` 文生图画一张「现实中类似物品」的示意图，可一键保存。
4. **导出作品**：导出 JSON（元件、参数、位置、连线类型 + 一份人可读的电路说明），文件名带时间戳。

接口与配置：
- 检查：复用自定义模块助手的 DeepSeek 配置（`localStorage['aicircuit.aiSettings']`）
- 出图：火山方舟 `https://ark.cn-beijing.volces.com/api/v3/images/generations`，默认模型 `doubao-seedream-4-0-20260415`（失败自动切 `doubao-seedream-4-0-250828`），可覆盖 `localStorage['aicircuit.imageSettings']` 的 `{ apiKey, endpoint, model }`
- 出图走 `response_format: 'b64_json'`，图片内嵌为 data URL，导出/保存不依赖跨域

## 技术架构

### 技术栈

| 层级 | 技术 |
|------|------|
| 框架 | React 18 + TypeScript 5 |
| 构建工具 | Vite 5 |
| 画布 | React Flow 11（节点编辑器） |
| 状态管理 | Zustand 4 |
| AI 推理 | TensorFlow.js 4 + COCO-SSD |
| 样式 | Tailwind CSS 3 + 手绘主题 |
| 图标 | lucide-react |

### 系统分层

```
┌─────────────────────────────────────────┐
│  视图层  React Flow 画布 + 节点组件      │
├─────────────────────────────────────────┤
│  状态层  Zustand store（电路/节点/连线） │
├─────────────────────────────────────────┤
│  求值层  Evaluator 函数（每个模块一个）   │
├─────────────────────────────────────────┤
│  AI 层   TensorFlow.js + COCO-SSD 模型   │
└─────────────────────────────────────────┘
```

### 数据流引擎

电路本质是一个有向无环图（DAG）。数据包沿边流动：

1. 源节点（如摄像头）按设定频率采集数据，发出 Packet
2. `propagate()` 递归函数把 Packet 写入下游节点的输入端口
3. 检查目标节点所有输入是否就绪 → 调用对应 Evaluator 求值
4. Evaluator 返回新的输出 Packet → 继续向下游传播
5. 推理中的节点标记 `busy`，避免重入丢帧
6. 删除连线时，`deleteEdge` 清空目标节点对应输入端口数据 + 重置 aiState
7. 删除节点时，`deleteNode` 清空所有曾连到该节点的下游输入端口

### 数据类型系统

端口有严格类型，连线时校验：

| 类型 | 说明 | 兼容类型 |
|------|------|----------|
| image | 图像（canvas） | image |
| label | 标签（字符串） | label |
| confidence | 置信度（0~1） | confidence / number |
| signal | 布尔信号 | signal |
| text | 文本 | text |
| number | 数值 | number / confidence |
| audio | 音频 | audio |

> `number` 与 `confidence` 互通：两者都是数值语义（0~1 置信度、0~100 音量、计数），
> 否则「亮度值 / 数量 / 计数值 / 音量 / 置信度」这些输出端口在市场里找不到可连的入端。
> 端口声明 `optional: true` 时可以不接线（如计数器的重置、文本合并的第 2/3 路）。

## 项目结构

```
├── public/
│   ├── images/ocean/        # 关卡1真实海洋图片（4鱼 + 4垃圾）
│   ├── models/coco-ssd/     # COCO-SSD 本地模型权重（运行 fetch 脚本后生成）
│   ├── circuit.svg          # 站点图标 / 装饰
│   └── cursor_hand.png      # 自定义手形光标
├── scripts/
│   └── fetch-coco-ssd.ps1   # COCO-SSD 模型预下载脚本（Windows）
├── tests/                   # 契约测试（node --test，不需要浏览器）
├── _smoke/                  # 无头浏览器（CDP）端到端检查脚本，仅开发用
├── src/
│   ├── components/
│   │   ├── nodes/           # 各类节点组件 + NodeChrome（元件右上角 ✕/🔧）+ NodeShell（内联参数）
│   │   ├── edges/           # 连线组件（DataFlowEdge）
│   │   └── workbench/       # 工作台（Canvas、ModulePalette、Inspector、Toolbar、CustomModuleCreator、WorkCheckPanel）
│   ├── levels/
│   │   ├── scenes/          # 关卡场景（OceanScene 传送带式真实图片滚动）
│   │   ├── levelData.ts     # 关卡定义（年级板块、电路、提示、通关条件）
│   │   ├── LevelRunner.tsx  # 关卡运行器
│   │   ├── LevelSelect.tsx  # 关卡列表（按 1-2 / 3-4 / 5-6 年级分板块）
│   │   └── LevelHintPanel.tsx # 引导提示面板（按 expectValue 判定步骤完成）
│   ├── lib/
│   │   ├── ai/objectDetector.ts  # COCO-SSD 封装（多源加载、分片预缓存 + 看门狗、80类中文翻译）
│   │   ├── aiAssistant.ts        # 自定义模块的 AI 生成（DeepSeek）
│   │   ├── artwork.ts            # 作品检查（结构自检 + AI 审查）、实物图、导出
│   │   ├── moduleRegistry.ts     # 模块注册表（所有 AI 模块定义）
│   │   └── evaluators.ts         # 求值器（每个模块的真实推理逻辑）
│   ├── store/circuitStore.ts # 电路状态 + 流式运行时引擎（含信号复位）
│   ├── types/circuit.ts     # 核心类型定义
│   ├── index.css            # 全局样式（手绘主题 + 自定义手形光标）
│   └── App.tsx              # 应用入口（路由 + COCO-SSD 初始化）
├── index.html               # HTML 入口
├── package.json             # 依赖与脚本
├── tailwind.config.js       # Tailwind 配置
├── tsconfig.json            # TypeScript 配置（开启 noUnusedLocals/Parameters，增量缓存放 node_modules/.tmp）
├── tsconfig.node.json       # vite.config.ts 的类型检查（产物也进 node_modules/.tmp）
└── vite.config.ts           # Vite 配置
```

## 视觉设计

采用手绘漫画分镜风格，区别于常见的扁平化 UI：

- **粗墨线边框** + **硬偏移阴影**：节点像贴在纸上的卡片
- **水彩色块标题栏**：每个模块类别用不同蜡笔色（青蓝/琥珀/橄榄绿/砖橙/紫）
- **手写体字体**：标题与标签使用手写风格（Caveat / Patrick Hand / Kalam）
- **纸张纹理背景**：营造手绘草稿本氛围（SVG 噪点 + 水彩晕染）
- **复古色调**：靛蓝、琥珀黄、橄榄绿、砖橙、紫罗兰
- **自定义手形光标**：全站使用 `cursor_hand.png` 手形光标，强化"动手搭建"的代入感

## 兼容性说明

- COCO-SSD 模型在部分国内网络下无法直接从 GCS 加载，已实现多源探测 + 本地预缓存
- 模型权重分片并发请求可能被浏览器中止，启动时并行预取所有分片以利用浏览器缓存
- 首帧推理可能卡顿，启动时用 canvas 预热模型（避免 dtype 不匹配）
- WebGL 不可用时自动回退到 CPU 推理（速度较慢）
- COCO-SSD 原生输出英文标签，已在 detect 层统一翻译为中文（80 类全覆盖）
- 删除连线/节点时，下游节点输入端口自动清空，状态正确复位（如灯泡熄灭、机械臂停止）
- 自定义手形光标通过 CSS `cursor: url()` 实现，加载失败时自动回退到系统 pointer

## 缺陷修复记录（2026-10）

排查方式是「先找根因再改一处」，每项都有对应的验证手段；完整说明见下表。

### 运行时引擎（store / types / evaluators / registry）

| 根因 | 用户可见后果 | 修复 |
|------|--------------|------|
| 求值器只能拿到 `data`，而节点 id 没放进 `data` | 所有计数器共用一份状态、音量窗口串台 | `makeNode` 写入 `data.id`，状态按 id 隔离，清空/删除时回收 |
| 求值门禁要求**所有**声明入端都接线 | 计数器不接 reset 就永不计数、文本合并必须接满 3 路 | `PortDef.optional` + `inputsReady()` |
| 延时器两套实现互抢同一端口 | 求值器发出的假 `false` 盖掉组件刚发的真脉冲 | 延时只由组件负责，求值器返回 `null` |
| `reevaluate` 没有 `catch/finally` | 求值抛一次错就把节点永久锁进 `busy`（画布卡死） | 补 `catch` + `finally` 解锁 |
| 推理中到达的数据包被直接丢弃 | 一次性信号（定时器脉冲/单次识别）那一帧永久丢失 | 记 pending，结束后补算一次（带 2 次预算防环形自激） |
| 键盘 Delete 走 `onNodesChange`，绕过 `deleteNode` | 删元件后下游输入与状态不复位（灯泡常亮） | `remove` 分支做同样的下游清空 + 状态清理 |
| 终端模块求值返回 `null` 没人收尾 | 节点状态永远显示「推理中」 | 求值结束统一把 `running` 收尾为 `ready` |
| `number`/`confidence` 端口没有同类型入端 | 亮度值/数量/音量等端口拖线必被静默拒绝 | 两者互通 + 新增**数值仪表**作为消费端 |
| 停止运行后不清脉冲 | 连线「数据流动」动画一直跑 | `setRunning(false)` 清 `lastPulse` |
| 示例链路 IF 目标标签为空串 | 空串永不匹配 → 「光线暗时灯泡不亮」 | `loadDemoChain` 显式设 `targetLabel: '暗'`；IF 元件空标签时红字提示 |

### 关卡（levels / scenes）

- 机械臂信号是 latched：停止/断开/删节点后场景仍认为在抓 → 场景启动时复位 `armActiveRef`，机械臂节点在无输入与卸载时主动下发 `false`。
- 场景 HUD 与顶部统计各持一份数据 → 统计统一由 `LevelRunner` 持有并下传（重置后两端一起归零）。
- 引导第 5 步只判断「填了东西」→ 改为必须等于本关需要的「垃圾」（`expectValue`）。
- 模型未就绪也能运行，每张照片都记「漏掉」（正确率封顶 50%）→ 模型未就绪时禁用运行并提示。
- L2–L5 只有占位数据却可进入 → `comingSoon`，列表可见但不可进入。
- 关卡市场没按 `availableModules` 过滤 → 核心分类同样按本关过滤。
- 场景 `dt` 上限 0.05s，弱设备上时间被拉慢数倍 → 放宽到 0.2s；采样频率下限提到 1 帧/秒。

### 节点组件

摄像头/麦克风 `getUserMedia` 在卸载后才返回导致设备指示灯常亮 → `disposedRef` 立即停轨；麦克风 60Hz 发包 → 节流 10Hz，并改用「用户意图」判断重启；图片输入陈旧闭包导致「先运行后加载」永远不发射 → ref + `loaded` 依赖；文本输入三种触发方式落地；TTS 队列/竞态与蜂鸣器、延时器、定时器的定时器清理；语音识别阈值不再重建识别器；元件右下角/右上角的参数内联编辑与删除按钮。

### 持久化 / 模型 / 自定义模块

草稿丢失连线 `data`（类型徽标消失）与 `data.id`、旧草稿参数缺失 → 保留并回填注册表默认值；`saveDraft` 失败改打印告警；自定义模块保存失败改为抛出中文错误并在创建器显示；模型分片预缓存只 `fetch` 不读 body（等于没缓存）+ 加载无超时 → 读掉 body + 45 秒看门狗；自定义模块每次求值都 `new Function` 重编译、返回值不校验端口 → 编译一次 + 按声明端口与包类型校验；沙箱补关键词与参数遮蔽（并注明只能降低风险）。

### 样式 / 偏好

「大字」选择器写的是不存在的 `.app-viewport` → 改为 `#root`；`@container phone` 没有具名容器导致整段移动端布局不生效 → `body` 声明 `container-type/name`。

### 验证方式

```bash
npm run build                              # tsc -b（含 noUnusedLocals/Parameters）+ vite build
node --test tests/*.test.cjs               # 草稿 / 端口契约 / 关卡 / 感光链路 / AI 助手 / 作品检查
```

### 代码与文件清理（2026-10）

**删除的死代码**（`tsc --noUnusedLocals --noUnusedParameters` 现在为 0，并已把这两项写入 `tsconfig.json`，以后新增未使用代码会直接编译失败）：

- 未使用的导出：`CORE_MODULE_TYPES`、`getDetectorEngine`、`saveAiSettings`、`SceneObject`、`LevelRunState`
- 未使用的局部变量/导入：`ImageClassifierNode` 的 `bright`、`LogicGateNode` 的 `computeGate`/`outActive`、`ObjectDetectionNode` 的 `ScanSearch`、`TrashClassifierNode` 的 `Recycle`、`Canvas` 的 `TYPE_COLOR`、`Inspector` 的 `isPreview` 与多余 `mod`、`ModulePalette` 的 `addModule`、`LevelHintPanel` 的 `isLastStep`、`levelStore` 的 `get`、`artwork.ts` 的 `nameOf`、`normalizePorts` 的多余参数；求值器里未使用的 `data` 形参改为 `_data`

**删除的多余文件**：

- `dev.log`（历史调试日志）
- `vite.config.js`、`vite.config.d.ts`、`tsconfig.tsbuildinfo`、`tsconfig.node.tsbuildinfo`（`tsc -b` 的编译产物）——同时把两个 tsconfig 的产物/增量缓存目录改到 `node_modules/.tmp`，以后不再污染根目录
- `public/icon-192.png`、`public/icon-512.png`（PWA 已移除、无 manifest 引用；`dist` 里也不再产出）
- `_smoke/` 下的一次性探针与结果文件（`inventory.mjs`、`workcheck-result.json`、重复的 `verify-inline-edit.mjs`、`verify-panel-toggle.mjs`）
- `dist/` 里残留的旧哈希产物（整体重建）

`_backup/` 保留了两份 `src` 快照（原始版 + 本次恢复后的版本），用于误覆盖时回滚。

`_smoke/` 下是无头浏览器（CDP）端到端脚本：`verify.mjs`（关卡 1 建链路→设置 IF→运行、定时器→计数器）、`verify-ui.mjs`（数值仪表读数、清空会停止运行、大字偏好）、`verify-workcheck.mjs`（作品检查面板 + AI 审查 + 实物图 + 导出 JSON）、`verify-inline-edit.mjs`（元件内联改参数 / ✕ 删除 / 🔧 检视器）、`verify-levels.mjs`（年级板块）、`verify-position.mjs`（右下角按钮不压小地图与提示条）。

> 注意：长时间运行的 dev server 偶尔会漏掉文件变更（继续发旧模块）。改完代码后如果界面行为与源码不一致，**重启 `npm run dev`** 再验证。

## 许可证

私有项目，未公开发布。
