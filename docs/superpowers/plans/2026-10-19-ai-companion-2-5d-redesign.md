# 智芽 AI 伙伴 2.5D 伪三维重构 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 用八方向分层 WebP 和轻量骨骼动画替换被否定的真实三维模型，同时保留四个伙伴的换装、伪 360°预览、互动、语音问答、应用控制、登录过渡和测试地图定位。

**Architecture:** 账号隔离的 `CompanionAccountRepository` 继续保存伙伴和装扮业务状态；新的 `Companion2DRenderer` 只负责角度、分层、动作与挂点。页面通过统一的 `PartnerAppearance` 使用精细、轻量和过渡三种场景预设；手势、语音和命令控制独立于渲染器，保证未来替换素材时不改业务逻辑。

**Tech Stack:** React 19、TypeScript、React Router、Vite、Vitest、Testing Library、透明 WebP、CSS/Web Animations、Pointer Events、Node.js 本机代理、DeepSeek Chat Completions、Web Speech API、Web Speech Synthesis

**Spec:** `docs/superpowers/specs/2026-10-19-ai-companion-2-5d-redesign-design.md`

## Global Constraints

- 伙伴 ID 只能是 `momo`、`yunduo`、`cloudbloom`、`cloudbelle`。
- 八方向顺序固定为 `front`、`front-right`、`right`、`back-right`、`back`、`back-left`、`left`、`front-left`。
- 角色素材保留用户参考图的细腻毛绒质感，不改成扁平卡通，也不继续使用 Blender 球块样模。
- 运行时只使用 React、透明 WebP、CSS/Web Animations 和 Pointer Events；不新增 Live2D、Spine、PixiJS 或其他游戏渲染框架。
- 只有积分商城“我的”和 AI 对话页顶部允许八方向旋转；登录页、悬浮伙伴和测试地图不允许旋转。
- 服饰和装饰按背后层、身体层、前景层组合，并为四个伙伴分别保存挂点、比例和偏移。
- 当前版本只使用按学习账号隔离的本地演示数据，不创建真实账号数据库或伪造云同步。
- DeepSeek 密钥只允许保存在服务端环境变量或被 Git 忽略的 `server/.env.local`；禁止进入 `src/`、`VITE_*`、浏览器存储、日志和提交记录。
- 登录过渡不允许起跳、原地旋转或突然缩放；伙伴最终必须停在应用容器内部右下角。
- 低风险命令可直接执行；中风险命令必须屏幕确认；高风险命令必须输入当前会话密码。
- 先完成 Momo 样板并获得用户视觉确认，再制作其余三个伙伴。
- `.superpowers/`、原始微信临时文件和本机 API 密钥不得提交。
- 所有代码任务使用测试驱动流程：先写失败测试、确认失败、实现、确认通过、提交。

## File Structure

### 2.5D 资产与清单

- `src/features/ai_companion/companionAssets.ts`：八方向角色清单、场景预设和轻量降级图。
- `src/features/ai_companion/attachments.ts`：商品八方向素材、显示层和四伙伴适配参数。
- `src/features/ai_companion/render2d/types.ts`：方向、图层、动作、挂点和场景类型。
- `public/companions-2d/<companion>/<direction>/*.webp`：伙伴分层透明素材。
- `public/companions-2d/attachments/<item>/<direction>.webp`：商品角度素材。
- `scripts/validate-companion-2d-assets.mjs`：生产素材完整性校验。
- `scripts/validate-companion-2d-assets.test.mjs`：校验器单元测试。

### 渲染、旋转与动作

- `src/features/ai_companion/render2d/Companion2DRenderer.tsx`：按角度组合角色与装扮图层。
- `src/features/ai_companion/render2d/Companion2DRenderer.test.tsx`：图层顺序、场景和降级测试。
- `src/features/ai_companion/render2d/motion.ts`：动作状态与 CSS 变量映射。
- `src/features/ai_companion/render2d/rotation.ts`：拖动距离到八方向的确定性映射。
- `src/features/ai_companion/render2d/CompanionRotator.tsx`：商城和对话页的旋转交互。
- `src/features/ai_companion/PartnerAppearance.tsx`：保持页面稳定接口，内部切换到 2.5D 渲染器。
- `src/features/ai_companion/ai-companion.css`：分层、动作、旋转、气泡和场景尺寸。

### 互动、语音与命令

- `src/features/ai_companion/interaction/gestureMachine.ts`：轻点、长按、拖动位置和拖动旋转判定。
- `src/features/ai_companion/interaction/actionSelector.ts`：页面感知的宠物式动作与短气泡。
- `src/features/ai_companion/conversation/conversationMachine.ts`：聆听、识别、思考、回答、取消和错误状态机。
- `src/features/ai_companion/CompanionBubble.tsx`：伙伴头顶的小型状态与回答气泡。
- `src/features/ai_companion/commands/commandTypes.ts`：白名单命令和风险级别。
- `src/features/ai_companion/commands/commandGateway.ts`：命令解析结果校验与执行决策。
- `src/features/ai_companion/commands/AppCommandContext.tsx`：页面导航、确认和密码验证桥接。
- `server/companionIntent.mjs`：DeepSeek JSON 意图解析与服务端白名单复核。

### 页面整合

- `src/features/ai_companion/LoginCompanion.tsx`：登录页精细伙伴与统一手势。
- `src/features/ai_companion/CompanionHandoff.tsx`：登录到应用右下角的连续过渡。
- `src/features/ai_companion/AiCompanion.tsx`：应用悬浮伙伴和测试地图伙伴。
- `src/features/profile/MallPage.tsx`：购买、试穿、“我的”搭配和八方向预览。
- `src/features/ai_companion/AiPanel.tsx`：伙伴顶部、消息区和安全区输入栏。
- `src/features/test/TestLevelNode.tsx`：暴露关卡 DOM 锚点。
- `src/features/test/TestPage.tsx`：将轻量伙伴放到当前关卡正上方。

---

### Task 1: 用 2.5D 清单替换真实三维资产契约

**Files:**
- Create: `src/features/ai_companion/render2d/types.ts`
- Modify: `src/features/ai_companion/companionAssets.ts`
- Modify: `src/features/ai_companion/attachments.ts`
- Modify: `src/features/ai_companion/attachments.test.ts`
- Create: `src/features/ai_companion/companionAssets.test.ts`
- Create: `scripts/validate-companion-2d-assets.mjs`
- Create: `scripts/validate-companion-2d-assets.test.mjs`
- Delete after replacement tests pass: `scripts/validate-companion-models.mjs`
- Delete after replacement tests pass: `scripts/validate-companion-models.test.mjs`
- Delete after replacement tests pass: `scripts/blender/create_momo_concept.py`

**Interfaces:**
- Produces: `CompanionDirection`, `CompanionLayerName`, `CompanionMotion`, `CompanionScene`.
- Produces: `getCompanionAsset(id): Companion2DAssetManifest`.
- Produces: `resolveAttachmentFrame(companionId, itemId, direction): AttachmentFrame | null`.
- Produces: `validateCompanionAssetTree(root, manifests): ValidationResult`.

- [ ] **Step 1: 写方向、降级和附件层级失败测试**

```ts
expect(COMPANION_DIRECTIONS).toEqual([
  'front', 'front-right', 'right', 'back-right',
  'back', 'back-left', 'left', 'front-left',
])
expect(getCompanionAsset('momo').fallbackImageUrl).toBe('/pets/momo.png')
expect(resolveAttachmentFrame('momo', 'cloud-backpack', 'back')?.layer).toBe('front')
expect(resolveAttachmentFrame('momo', 'cloud-backpack', 'front')?.layer).toBe('behind')
```

- [ ] **Step 2: 运行契约测试确认失败**

Run: `npm test -- --run src/features/ai_companion/companionAssets.test.ts src/features/ai_companion/attachments.test.ts`

Expected: FAIL，提示不存在八方向类型和 `resolveAttachmentFrame`。

- [ ] **Step 3: 定义稳定类型和生产清单**

```ts
export const COMPANION_DIRECTIONS = [
  'front', 'front-right', 'right', 'back-right',
  'back', 'back-left', 'left', 'front-left',
] as const
export type CompanionDirection = typeof COMPANION_DIRECTIONS[number]
export type CompanionLayerName =
  | 'shadow' | 'behind' | 'body' | 'head'
  | 'arm-left' | 'arm-right' | 'eyes' | 'mouth' | 'front'
export type CompanionMotion =
  | 'idle' | 'blink' | 'wave' | 'tilt' | 'walk'
  | 'listen' | 'think' | 'speak' | 'celebrate'
export type CompanionScene = 'login' | 'floating' | 'test-map' | 'mall' | 'chat' | 'handoff'
export type CompanionDirectionFrame = {
  direction: CompanionDirection
  layers: Array<{ name: CompanionLayerName; url: string }>
  origin: { x: number; y: number }
  visualBounds: { x: number; y: number; width: number; height: number }
}
```

未制作完八方向的伙伴保持 `frames: {}`，运行时使用 `fallbackImageUrl`，不伪造完成状态。

- [ ] **Step 4: 写独立素材校验器失败测试**

```js
const result = validateCompanionAssetTree(fixtureRoot, [fixtureManifest])
expect(result.errors).toContain('momo/back: missing layer body')
expect(result.errors).toContain('momo: missing direction front-left')
```

- [ ] **Step 5: 实现素材校验器**

校验四个固定伙伴 ID、八方向、每个方向的 `body` 图层、正面 `eyes`/`mouth`、透明素材扩展名、画布元数据、重复 URL 和越界锚点。校验器只读文件与清单，不执行图片脚本。

- [ ] **Step 6: 运行新旧清单替换检查**

Run: `npm test -- --run src/features/ai_companion/companionAssets.test.ts src/features/ai_companion/attachments.test.ts scripts/validate-companion-2d-assets.test.mjs`

Expected: PASS。

- [ ] **Step 7: 删除已被取代的真实三维校验和 Blender 样模脚本**

删除本任务 Files 中列出的三个旧路径；保留用户提供的原始参考图片在其原位置，不移动、不重命名、不提交。

- [ ] **Step 8: 提交 2.5D 资产契约**

```bash
git add src/features/ai_companion/render2d/types.ts src/features/ai_companion/companionAssets.ts src/features/ai_companion/companionAssets.test.ts src/features/ai_companion/attachments.ts src/features/ai_companion/attachments.test.ts scripts/validate-companion-2d-assets.mjs scripts/validate-companion-2d-assets.test.mjs scripts/validate-companion-models.mjs scripts/validate-companion-models.test.mjs scripts/blender/create_momo_concept.py
git commit -m "refactor: replace 3d companion contracts with 2.5d assets"
```

### Task 2: 制作并审核绒桃 Momo 八方向分层样板

**Files:**
- Create: `public/companions-2d/momo/<direction>/*.webp`
- Create: `docs/reviews/momo-2-5d-review-board.png`
- Modify: `src/features/ai_companion/companionAssets.ts`
- Modify: `src/features/ai_companion/companionAssets.test.ts`

**Interfaces:**
- Consumes: Task 1 的 `Companion2DAssetManifest`。
- Produces: Momo 的八方向生产素材和通过用户审核的视觉基准。

- [ ] **Step 1: 将原图设为身份约束**

使用绝对路径 `C:\Users\qinch\Documents\xwechat_files\wxid_b6w0y1zz0qr822_2ae9\temp\RWTemp\2026-08\cfa980c60250c8c2e60d63753a2d7d68\549058ee6b29a3905191c6e055295268.jpg`。原图中的正面、侧面和背面共同约束五官、头身比、桃粉与奶杏配色、毛绒细节、脚底基线和背部结构。

- [ ] **Step 2: 生成八方向透明母版**

图像生成提示固定为：

```text
以提供的绒桃 Momo 正面、侧面、背面角色设定为唯一身份参考，保持相同五官、头身比例、奶杏桃粉配色、细腻毛绒云团材质和儿童友好神态。生成同一角色的八方向全身正交转台图：正面、右前45度、右侧、右后45度、背面、左后45度、左侧、左前45度。每个方向站姿一致、脚底基线一致、画布留白一致、柔和正面光一致；不添加衣服、道具、文字、边框或新特征；透明背景；不得出现额外肢体、五官漂移或年龄变化。
```

输出每个方向独立 1024×1024 PNG，再无损转换为 WebP。

- [ ] **Step 3: 拆分运行图层**

每个方向按实际可见部分导出 `shadow.webp`、`behind.webp`、`body.webp`、`head.webp`、`arm-left.webp`、`arm-right.webp`、`front.webp`；正面及前斜面额外导出 `eyes.webp` 和 `mouth.webp`。不可见层不创建空白文件，清单只列出实际存在图层。

- [ ] **Step 4: 生成视觉评审板**

评审板必须同时显示八方向、正面眨眼、挥手、侧面装背包和背面装背包五项预览，并标注实际应用中的登录、悬浮、地图和商城尺寸。

- [ ] **Step 5: 停止并取得用户视觉确认**

向用户展示 `docs/reviews/momo-2-5d-review-board.png`。只有用户明确确认五官、比例、毛绒质感、八方向一致性和装扮位置后，才继续 Task 3；如果用户要求调整，只修改 Momo 样板并重新生成评审板。

- [ ] **Step 6: 写 Momo 生产素材失败测试**

```ts
const momo = getCompanionAsset('momo')
expect(Object.keys(momo.frames)).toHaveLength(8)
expect(momo.frames.front.layers.map((layer) => layer.name)).toEqual(
  expect.arrayContaining(['body', 'head', 'eyes', 'mouth']),
)
expect(momo.frames.back.layers.map((layer) => layer.name)).not.toContain('mouth')
```

- [ ] **Step 7: 注册 Momo 清单并运行校验**

Run: `npm test -- --run src/features/ai_companion/companionAssets.test.ts scripts/validate-companion-2d-assets.test.mjs`

Expected: PASS，Momo 八方向无缺失，另外三个伙伴仍使用明确的静态降级图。

- [ ] **Step 8: 提交用户确认的样板**

```bash
git add public/companions-2d/momo docs/reviews/momo-2-5d-review-board.png src/features/ai_companion/companionAssets.ts src/features/ai_companion/companionAssets.test.ts
git commit -m "feat: add approved Momo 2.5d asset pack"
```

### Task 3: 实现分层渲染器、动作和性能降级

**Files:**
- Create: `src/features/ai_companion/render2d/Companion2DRenderer.tsx`
- Create: `src/features/ai_companion/render2d/Companion2DRenderer.test.tsx`
- Create: `src/features/ai_companion/render2d/motion.ts`
- Create: `src/features/ai_companion/render2d/motion.test.ts`
- Modify: `src/features/ai_companion/PartnerAppearance.tsx`
- Modify: `src/features/ai_companion/PartnerAppearance.test.tsx`
- Modify: `src/features/ai_companion/ai-companion.css`

**Interfaces:**
- Produces: `<Companion2DRenderer loadout scene direction motion interactive />`.
- Produces: `resolveMotionStyle(motion, reduceMotion): MotionStyle`.
- Preserves: `<PartnerAppearance loadout size motion interactive />` for existing callers.

- [ ] **Step 1: 写图层顺序、场景和降级失败测试**

```tsx
render(<Companion2DRenderer loadout={momoLoadout} scene="mall" direction="front" motion="wave" />)
expect(screen.getAllByTestId(/companion-layer-/).map((node) => node.dataset.layer)).toEqual([
  'shadow', 'behind', 'body', 'head', 'arm-left', 'arm-right', 'eyes', 'mouth', 'front',
])
expect(screen.getByTestId('companion-2d')).toHaveAttribute('data-scene', 'mall')
expect(screen.getByTestId('companion-2d')).toHaveAttribute('data-motion', 'wave')
```

- [ ] **Step 2: 运行渲染测试确认失败**

Run: `npm test -- --run src/features/ai_companion/render2d/Companion2DRenderer.test.tsx src/features/ai_companion/PartnerAppearance.test.tsx`

Expected: FAIL，组件尚不存在。

- [ ] **Step 3: 实现纯展示渲染器**

按清单顺序渲染绝对定位的 `<img draggable={false}>`。没有当前方向时选择距离最近的已制作方向；没有任何方向时使用 `fallbackImageUrl`。组件必须输出 `data-companion-id`、`data-direction`、`data-motion` 和可访问名称。

- [ ] **Step 4: 实现动作映射**

```ts
export type MotionStyle = {
  rootClass: string
  headClass?: string
  armLeftClass?: string
  armRightClass?: string
  mouthClass?: string
}
```

`idle` 使用轻微呼吸与眨眼；`wave` 只摆动可见手臂；`walk` 使用水平位移配合身体微小起伏；`listen` 前倾并睁大眼睛；`think` 歪头；`speak` 按 180–260ms 节奏切换嘴型；`celebrate` 使用小幅左右摆动，不跳跃。

- [ ] **Step 5: 实现三档场景和减少动画**

精细场景为 `login`、`mall`、`chat`；轻量场景为 `floating`、`test-map`；`handoff` 使用精细身体和轻量阴影。`reduceMotion=true` 时取消惯性、走路起伏和装扮摆动，只保留淡入、眨眼和状态切换。

- [ ] **Step 6: 让 PartnerAppearance 转发到新渲染器**

保持现有 props 和测试 ID，新增可选 `direction`、`scene` 和 `reduceMotion`；旧 `size` 映射为对应场景，避免一次修改所有调用方。

- [ ] **Step 7: 运行组件和构建检查**

Run: `npm test -- --run src/features/ai_companion/render2d src/features/ai_companion/PartnerAppearance.test.tsx && npm run build`

Expected: PASS，生产包不请求 `.glb` 文件。

- [ ] **Step 8: 提交渲染器**

```bash
git add src/features/ai_companion/render2d src/features/ai_companion/PartnerAppearance.tsx src/features/ai_companion/PartnerAppearance.test.tsx src/features/ai_companion/ai-companion.css
git commit -m "feat: render layered 2.5d companions"
```

### Task 4: 实现八方向拖动、视差和装扮合成

**Files:**
- Create: `src/features/ai_companion/render2d/rotation.ts`
- Create: `src/features/ai_companion/render2d/rotation.test.ts`
- Create: `src/features/ai_companion/render2d/CompanionRotator.tsx`
- Create: `src/features/ai_companion/render2d/CompanionRotator.test.tsx`
- Modify: `src/features/ai_companion/render2d/Companion2DRenderer.tsx`
- Modify: `src/features/ai_companion/render2d/Companion2DRenderer.test.tsx`
- Modify: `src/features/ai_companion/attachments.ts`
- Modify: `src/features/ai_companion/attachments.test.ts`
- Modify: `src/features/ai_companion/ai-companion.css`

**Interfaces:**
- Produces: `directionFromDrag(startIndex, deltaX, pixelsPerStep): CompanionDirection`.
- Produces: `parallaxFromDrag(deltaY): { headY: number; bodyY: number; shadowScale: number }`.
- Produces: `<CompanionRotator loadout scene initialDirection onDirectionChange />`.

- [ ] **Step 1: 写循环方向和上下视差失败测试**

```ts
expect(directionFromDrag(0, 48, 44)).toBe('front-left')
expect(directionFromDrag(0, -48, 44)).toBe('front-right')
expect(directionFromDrag(7, 48, 44)).toBe('left')
expect(parallaxFromDrag(999)).toEqual({ headY: 6, bodyY: 2, shadowScale: .96 })
```

- [ ] **Step 2: 运行旋转测试确认失败**

Run: `npm test -- --run src/features/ai_companion/render2d/rotation.test.ts src/features/ai_companion/render2d/CompanionRotator.test.tsx`

Expected: FAIL。

- [ ] **Step 3: 实现八方向循环和有限视差**

每 44px 水平拖动切换一个方向，索引按 0–7 循环；垂直拖动只输出 `headY ∈ [-6, 6]`、`bodyY ∈ [-2, 2]`、`shadowScale ∈ [.96, 1.04]`，不生成俯仰角度。

- [ ] **Step 4: 实现旋转手势组件**

使用 Pointer Capture；移动超过 8px 后标记为旋转并阻止点击；松手停留在当前方向。只预加载当前、前一个和后一个方向的图片 URL。组件提供键盘“向左转”“向右转”按钮供无拖动设备使用。

- [ ] **Step 5: 将商品放入正确的前后层**

`cloud-backpack` 在 `front` 使用 `behind`，在 `back` 使用 `front`；手持道具根据左右角度选择对应手部前后层；场景装饰使用 `behind` 或 `front`，但不跟随身体骨骼。四伙伴适配参数均保存在 `attachments.ts`，页面不写偏移常量。

- [ ] **Step 6: 测试角色、服饰和装饰同步旋转**

```tsx
expect(screen.getByTestId('companion-2d')).toHaveAttribute('data-direction', 'back')
expect(screen.getByTestId('companion-attachment-cloud-backpack')).toHaveAttribute('data-layer', 'front')
expect(screen.getByTestId('companion-attachment-cloud-backpack')).toHaveAttribute('data-direction', 'back')
```

- [ ] **Step 7: 运行旋转和附件测试**

Run: `npm test -- --run src/features/ai_companion/render2d src/features/ai_companion/attachments.test.ts`

Expected: PASS。

- [ ] **Step 8: 提交旋转与装扮合成**

```bash
git add src/features/ai_companion/render2d src/features/ai_companion/attachments.ts src/features/ai_companion/attachments.test.ts src/features/ai_companion/ai-companion.css
git commit -m "feat: add 2.5d rotation and layered attachments"
```

### Task 5: 将积分商城“我的”接入试穿、购买和搭配

**Files:**
- Modify: `src/features/profile/MallPage.tsx`
- Modify: `src/features/profile/MallPage.test.tsx`
- Modify: `src/features/profile/profile.css`
- Modify: `src/features/ai_companion/companionCatalog.ts`
- Modify: `src/features/ai_companion/companionCatalog.test.ts`
- Modify: `src/app/companionState.actions.test.tsx`

**Interfaces:**
- Consumes: `CompanionRotator`、`purchaseCompanionItem`、`equipCompanionItem`、`unequipCompanionItem`。
- Preserves: `CompanionLoadout` and account-isolated persistence.

- [ ] **Step 1: 写购买、试穿、装上和卸下失败测试**

```tsx
await user.click(screen.getByRole('button', { name: '购买 云朵小背包' }))
expect(pointsBalance()).toBe(startingPoints - 160)
await user.click(screen.getByRole('tab', { name: '我的' }))
await user.click(screen.getByRole('button', { name: '装上 云朵小背包' }))
expect(screen.getByTestId('companion-attachment-cloud-backpack')).toBeInTheDocument()
await user.click(screen.getByRole('button', { name: '卸下 云朵小背包' }))
expect(screen.queryByTestId('companion-attachment-cloud-backpack')).not.toBeInTheDocument()
```

- [ ] **Step 2: 运行商城测试确认失败**

Run: `npm test -- --run src/features/profile/MallPage.test.tsx src/app/companionState.actions.test.tsx`

Expected: FAIL，商城尚未使用旋转预览和新附件层。

- [ ] **Step 3: 将预览区替换为 CompanionRotator**

商品详情先更新本地 `previewLoadout`，不扣积分、不修改账号；用户点击购买后才调用 `purchaseCompanionItem`。购买成功进入“我的”时保留当前观察角度。

- [ ] **Step 4: 实现“我的”搭配状态**

“我的”按形象、服饰、装饰显示已拥有商品；已穿戴按钮显示“已装上”；形象只能替换，服饰和装饰可以卸下；“恢复默认”将形象设为 `momo` 并清空服饰和装饰。

- [ ] **Step 5: 验证账号与页面同步**

购买和穿戴后卸载并重新挂载 `AppStateProvider`，断言登录页预览、悬浮伙伴和商城预览读取相同 `CompanionLoadout`。切换到另一学习账号后断言商品仍未购买。

- [ ] **Step 6: 运行商城与状态测试**

Run: `npm test -- --run src/features/profile/MallPage.test.tsx src/app/companionState.actions.test.tsx src/app/companionAccountRepository.test.ts`

Expected: PASS。

- [ ] **Step 7: 提交商城整合**

```bash
git add src/features/profile/MallPage.tsx src/features/profile/MallPage.test.tsx src/features/profile/profile.css src/features/ai_companion/companionCatalog.ts src/features/ai_companion/companionCatalog.test.ts src/app/companionState.actions.test.tsx
git commit -m "feat: equip 2.5d companions in the mall"
```

### Task 6: 统一轻点、长按、拖动和页面感知互动

**Files:**
- Create: `src/features/ai_companion/interaction/gestureMachine.ts`
- Create: `src/features/ai_companion/interaction/gestureMachine.test.ts`
- Create: `src/features/ai_companion/interaction/actionSelector.ts`
- Create: `src/features/ai_companion/interaction/actionSelector.test.ts`
- Create: `src/features/ai_companion/CompanionBubble.tsx`
- Create: `src/features/ai_companion/CompanionBubble.test.tsx`
- Modify: `src/features/ai_companion/LoginCompanion.tsx`
- Modify: `src/features/ai_companion/AiCompanion.tsx`

**Interfaces:**
- Produces: `createGestureMachine({ longPressMs: 600, moveThreshold: 8 })`.
- Produces: `selectCompanionAction({ scene, recentActions, progress }): CompanionReaction`.
- Produces: `<CompanionBubble state message onCancel />`.

- [ ] **Step 1: 写手势互斥失败测试**

```ts
expect(runGesture([{ type: 'down', x: 0, y: 0 }, { type: 'up', at: 120 }])).toBe('tap')
expect(runGesture([{ type: 'down', x: 0, y: 0 }, { type: 'tick', at: 600 }])).toBe('long-press')
expect(runGesture([{ type: 'down', x: 0, y: 0 }, { type: 'move', x: 12, y: 0 }])).toBe('drag')
```

- [ ] **Step 2: 运行互动测试确认失败**

Run: `npm test -- --run src/features/ai_companion/interaction src/features/ai_companion/CompanionBubble.test.tsx`

Expected: FAIL。

- [ ] **Step 3: 实现手势状态机**

状态固定为 `idle → pressed → tap | long-press | drag → idle`。一旦移动超过 8px，取消长按计时；一旦长按触发，松手不能再触发点击；Pointer Cancel 终止语音和动作。

- [ ] **Step 4: 实现页面动作池**

`login` 返回欢迎、挥手和探头；`home` 返回继续学习和创意游戏提示；`knowledge` 返回当前课程鼓励；`test-map` 返回指向当前关卡和通关庆祝；`mall` 返回试穿和转身提示。连续两次不返回相同 `reactionId`，每 4 秒最多触发一次主动动作。

- [ ] **Step 5: 用统一气泡替换重复状态文本**

气泡状态为 `idle | listening | transcribing | thinking | speaking | error`，固定文案为“请说，我在听”“我听到了”“我想一想”“正在回答”；错误文案使用“这次没有听清，可以再试一次”。

- [ ] **Step 6: 接入登录页和悬浮伙伴**

登录页轻点执行 `selectCompanionAction({ scene: 'login' })`；悬浮伙伴轻点根据当前路由选择 scene；测试地图伙伴不打开完整对话页，只显示关卡相关短反应。

- [ ] **Step 7: 运行手势与现有交互回归**

Run: `npm test -- --run src/features/ai_companion/interaction src/features/ai_companion/CompanionBubble.test.tsx src/features/auth/LoginCompanion.test.tsx src/features/ai_companion/AiCompanion.test.tsx`

Expected: PASS。

- [ ] **Step 8: 提交统一互动系统**

```bash
git add src/features/ai_companion/interaction src/features/ai_companion/CompanionBubble.tsx src/features/ai_companion/CompanionBubble.test.tsx src/features/ai_companion/LoginCompanion.tsx src/features/ai_companion/AiCompanion.tsx
git commit -m "feat: unify companion gestures and reactions"
```

### Task 7: 修复长按语音并建立统一对话状态机

**Files:**
- Create: `src/features/ai_companion/conversation/conversationMachine.ts`
- Create: `src/features/ai_companion/conversation/conversationMachine.test.ts`
- Modify: `src/features/ai_companion/browserSpeech.ts`
- Create: `src/features/ai_companion/browserSpeech.test.ts`
- Modify: `src/features/ai_companion/companionChat.ts`
- Modify: `src/features/ai_companion/companionChat.test.ts`
- Modify: `src/features/ai_companion/LoginCompanion.tsx`
- Modify: `src/features/ai_companion/AiCompanion.tsx`
- Modify: `server/companionPolicy.mjs`
- Modify: `server/companionPolicy.test.mjs`

**Interfaces:**
- Produces: `ConversationState = idle | listening | transcribing | thinking | speaking | error`.
- Produces: `createConversationController(deps): { start; stop; cancel; submitText; subscribe }`.
- Preserves: `requestCompanionReply({ companionId, question }): Promise<string>`.

- [ ] **Step 1: 写状态转换、取消和重复问题失败测试**

```ts
expect(runConversation(['start'])).toEqual(['idle', 'listening'])
expect(runConversation(['start', 'transcript', 'reply'])).toEqual([
  'idle', 'listening', 'transcribing', 'thinking', 'speaking', 'idle',
])
expect(runConversation(['start', 'cancel'])).toEqual(['idle', 'listening', 'idle'])
```

- [ ] **Step 2: 运行语音测试确认失败**

Run: `npm test -- --run src/features/ai_companion/conversation src/features/ai_companion/browserSpeech.test.ts src/features/ai_companion/companionChat.test.ts`

Expected: FAIL。

- [ ] **Step 3: 改进浏览器识别适配**

使用 `zh-CN`、`continuous=false`、`interimResults=true`；保留最终文本并将临时文本发送给气泡。`stop()` 只结束当前识别，`cancel()` 调用 `abort()` 且不得触发发送。无 API、权限拒绝、无结果和重复 `onend` 映射为不同内部原因，但学生只看到安全简短文案。

- [ ] **Step 4: 实现统一对话控制器**

登录页和应用内伙伴不得各自重复维护识别、fetch 和播报。新问题开始前停止上一段播报并取消上一个请求；组件卸载时取消识别、fetch 和 speech synthesis。

- [ ] **Step 5: 保持 DeepSeek 安全代理和四伙伴身份**

请求只发送规范化 `companionId` 和最多 160 字问题；服务端继续使用 `deepseek-flash` 非思考模式；回复限制为两句话和约 110 个汉字。更换伙伴只改变称呼和呈现，不改变安全策略。

- [ ] **Step 6: 接入动作和气泡**

`listening` 播放 `listen`，`thinking` 播放 `think`，`speaking` 播放 `speak`。每个状态只渲染一个 `CompanionBubble`，避免登录页和悬浮伙伴出现重复消息。

- [ ] **Step 7: 运行语音、登录和悬浮回归**

Run: `npm test -- --run src/features/ai_companion/conversation src/features/ai_companion/browserSpeech.test.ts src/features/ai_companion/companionChat.test.ts src/features/auth/LoginCompanion.test.tsx src/features/ai_companion/AiCompanion.test.tsx server/companionPolicy.test.mjs`

Expected: PASS。

- [ ] **Step 8: 提交语音修复**

```bash
git add src/features/ai_companion/conversation src/features/ai_companion/browserSpeech.ts src/features/ai_companion/browserSpeech.test.ts src/features/ai_companion/companionChat.ts src/features/ai_companion/companionChat.test.ts src/features/ai_companion/LoginCompanion.tsx src/features/ai_companion/AiCompanion.tsx server/companionPolicy.mjs server/companionPolicy.test.mjs
git commit -m "fix: make companion voice conversations reliable"
```

### Task 8: 建立自然语言应用控制和风险确认

**Files:**
- Create: `src/features/ai_companion/commands/commandTypes.ts`
- Create: `src/features/ai_companion/commands/commandGateway.ts`
- Create: `src/features/ai_companion/commands/commandGateway.test.ts`
- Create: `src/features/ai_companion/commands/AppCommandContext.tsx`
- Create: `src/features/ai_companion/commands/AppCommandContext.test.tsx`
- Create: `src/features/ai_companion/commands/CommandConfirmationDialog.tsx`
- Create: `server/companionIntent.mjs`
- Create: `server/companionIntent.test.mjs`
- Modify: `server/ai-proxy.mjs`
- Create: `server/ai-proxy.test.mjs`
- Modify: `src/features/shell/MainShell.tsx`

**Interfaces:**
- Endpoint: `POST /api/companion/interpret`.
- Produces: `CompanionCommand` discriminated union.
- Produces: `CommandDecision = execute | confirm | password | clarify | reject`.
- Produces: `useAppCommand(): { submitText; confirm; cancel; verifyPassword }`.

- [ ] **Step 1: 写风险分级和未知命令拒绝测试**

```ts
expect(evaluateCommand({ type: 'navigate', target: 'knowledge' }, state).kind).toBe('execute')
expect(evaluateCommand({ type: 'purchase', itemId: 'cloud-backpack' }, state).kind).toBe('confirm')
expect(evaluateCommand({ type: 'clear-account-data' }, state).kind).toBe('password')
expect(parseModelCommand({ type: 'open-url', url: 'https://example.com' }).kind).toBe('reject')
```

- [ ] **Step 2: 运行命令测试确认失败**

Run: `npm test -- --run src/features/ai_companion/commands/commandGateway.test.ts server/companionIntent.test.mjs`

Expected: FAIL。

- [ ] **Step 3: 定义有限命令集合**

低风险：`navigate`、`continue-learning`、`resume-game`、`search-course`、`play-course`、`show-points`、`show-medals`。中风险：`purchase`、`equip`、`unequip`、`submit-test`、`publish-work`、`post-comment`、`update-schedule`、`replace-progress`。高风险：`update-account-security`、`view-guardian`、`update-guardian`、`clear-account-data`、`sign-out-devices`、`delete-account`。

- [ ] **Step 4: 实现 DeepSeek JSON 意图路由**

服务端使用 `response_format: { type: 'json_object' }`，模型只能返回 `kind`、`reply` 和白名单 `command`。返回内容必须再次经过本地 schema；空对象、未知字段、参数缺失和含糊输入一律返回 `clarify`，不得执行。

- [ ] **Step 5: 写屏幕确认和密码失败测试**

```tsx
await command.submitText('帮我购买云朵小背包', 'voice')
expect(screen.getByRole('dialog', { name: '确认使用 160 积分购买云朵小背包' })).toBeInTheDocument()
expect(pointsBalance()).toBe(before)
await user.click(screen.getByRole('button', { name: '确认购买' }))
expect(pointsBalance()).toBe(before - 160)
```

- [ ] **Step 6: 实现应用执行桥接**

导航、继续学习和继续游戏调用现有页面接口；商城购买调用 `purchaseCompanionItem`；中风险只接受按钮点击确认；高风险使用 `useSessionCredential.verify`，语音“确认”不能替代屏幕或密码。

- [ ] **Step 7: 运行命令、安全和壳层测试**

Run: `npm test -- --run src/features/ai_companion/commands server/companionIntent.test.mjs server/ai-proxy.test.mjs server/companionPolicy.test.mjs src/features/shell/MainShell.test.tsx`

Expected: PASS。

- [ ] **Step 8: 提交命令网关**

```bash
git add src/features/ai_companion/commands server/companionIntent.mjs server/companionIntent.test.mjs server/ai-proxy.mjs server/ai-proxy.test.mjs src/features/shell/MainShell.tsx
git commit -m "feat: control the app through guarded companion commands"
```

### Task 9: 实现自然登录过渡、悬浮边界和关卡锚定

**Files:**
- Create: `src/features/ai_companion/CompanionHandoff.tsx`
- Create: `src/features/ai_companion/CompanionHandoff.test.tsx`
- Modify: `src/features/auth/LoginPage.tsx`
- Modify: `src/features/ai_companion/LoginCompanion.tsx`
- Modify: `src/features/auth/AuthFlow.test.tsx`
- Modify: `src/features/ai_companion/AiCompanion.tsx`
- Modify: `src/features/ai_companion/AiCompanion.test.tsx`
- Modify: `src/features/test/TestLevelNode.tsx`
- Modify: `src/features/test/TestPage.tsx`
- Modify: `src/features/test/TestPage.test.tsx`
- Modify: `src/features/test/test.css`

**Interfaces:**
- Produces: `HandoffSnapshot = { companionId; loadoutVersion; startRect; target: 'floating' }`.
- Produces: `calculateFloatingBounds(frame, nav, safeArea, companionSize)`.
- Produces: `calculateMapCompanionAnchor(nodeRect, companionSize, viewport)`.

- [ ] **Step 1: 写过渡关键帧和减少动画失败测试**

```ts
expect(buildHandoffTimeline(start, end, false).map((frame) => frame.motion)).toEqual([
  'idle', 'wave', 'walk', 'idle',
])
expect(buildHandoffTimeline(start, end, false).some((frame) => frame.rotate !== 0)).toBe(false)
expect(buildHandoffTimeline(start, end, true)).toHaveLength(2)
```

- [ ] **Step 2: 运行过渡测试确认失败**

Run: `npm test -- --run src/features/ai_companion/CompanionHandoff.test.tsx src/features/auth/AuthFlow.test.tsx`

Expected: FAIL。

- [ ] **Step 3: 实现顶层共享过渡层**

登录成功前记录伙伴框和 `loadout.version`；应用壳布局完成后测量目标框。过渡总时长 1200–1500ms，使用迈步、看向内容、挥手和减速落位；尺寸变化由同一覆盖层连续插值，不起跳、不旋转、不突然缩放。

- [ ] **Step 4: 写悬浮与关卡锚点失败测试**

```ts
expect(calculateFloatingBounds(frame, nav, safeArea, 78).maxY).toBeLessThan(1)
expect(calculateMapCompanionAnchor(nodeRect, { width: 64, height: 64 }, viewport).bottom)
  .toBe(nodeRect.top - 8)
```

- [ ] **Step 5: 实现应用框内位置和地图 DOM 锚点**

悬浮坐标相对 `.app-frame` 可见区域保存，并避开底部导航和安全区。`TestLevelNode` 暴露按钮 ref/`data-node-anchor`；伙伴底边固定在当前关卡按钮顶边上方 8px，滚动时与地图使用同一坐标系，进度变化时播放 `walk` 移到新节点。

- [ ] **Step 6: 确保测试页只有一个轻量伙伴**

测试页不渲染右下角悬浮伙伴；退出测试页后恢复原悬浮位置。地图伙伴只接受轻点短反应和长按语音，不允许位置拖动或角度旋转。

- [ ] **Step 7: 运行过渡、悬浮和地图测试**

Run: `npm test -- --run src/features/ai_companion/CompanionHandoff.test.tsx src/features/auth/AuthFlow.test.tsx src/features/ai_companion/AiCompanion.test.tsx src/features/test/TestPage.test.tsx`

Expected: PASS。

- [ ] **Step 8: 提交页面定位与过渡**

```bash
git add src/features/ai_companion/CompanionHandoff.tsx src/features/ai_companion/CompanionHandoff.test.tsx src/features/auth/LoginPage.tsx src/features/ai_companion/LoginCompanion.tsx src/features/auth/AuthFlow.test.tsx src/features/ai_companion/AiCompanion.tsx src/features/ai_companion/AiCompanion.test.tsx src/features/test/TestLevelNode.tsx src/features/test/TestPage.tsx src/features/test/TestPage.test.tsx src/features/test/test.css
git commit -m "feat: move companions naturally across learning scenes"
```

### Task 10: 重做 AI 对话页并接入可旋转伙伴

**Files:**
- Modify: `src/features/ai_companion/AiPanel.tsx`
- Create: `src/features/ai_companion/AiPanel.test.tsx`
- Modify: `src/features/ai_companion/ai-companion.css`
- Modify: `src/features/settings/SettingDetailPage.tsx`
- Modify: `src/features/settings/SettingsPage.test.tsx`

**Interfaces:**
- Consumes: `CompanionRotator`、conversation controller、`VoiceReplyMode`、`useAppCommand`。
- Produces: 固定安全区输入栏和可滚动消息区。

- [ ] **Step 1: 写伙伴顶部、输入安全区和回答控制失败测试**

```tsx
expect(screen.getByLabelText('当前 AI 伙伴八方向预览')).toBeInTheDocument()
expect(screen.getByRole('textbox', { name: '输入想问的问题' })).toBeVisible()
expect(screen.getByRole('button', { name: '按住说话' })).toBeInTheDocument()
expect(screen.getByRole('button', { name: '播放回答' })).toBeInTheDocument()
```

- [ ] **Step 2: 运行对话页测试确认失败**

Run: `npm test -- --run src/features/ai_companion/AiPanel.test.tsx src/features/settings/SettingsPage.test.tsx`

Expected: FAIL。

- [ ] **Step 3: 实现符合智芽风格的伙伴顶部**

顶部显示当前伙伴、昵称、等级和一句页面感知问候；不使用圆形框。角色可左右拖动八方向旋转，旋转区域与消息滚动分离。聊天开始后顶部高度收紧，但伙伴仍可见。

- [ ] **Step 4: 实现消息流和固定输入区**

根容器使用 `display:grid; grid-template-rows:auto minmax(0,1fr) auto`；消息区 `overflow-y:auto`；输入区加入 `padding-bottom:max(12px, env(safe-area-inset-bottom))`。320×568 视口必须看到输入框、按住说话和发送按钮。

- [ ] **Step 5: 接入文字、语音和应用命令**

普通问题走 `requestCompanionReply`；包含明确应用操作意图的问题走 `useAppCommand.submitText`；语音回答按 `voiceReplyMode` 决定自动播报、仅显示或手动播放。

- [ ] **Step 6: 运行对话页、设置和构建测试**

Run: `npm test -- --run src/features/ai_companion/AiPanel.test.tsx src/features/settings/SettingsPage.test.tsx && npm run build`

Expected: PASS。

- [ ] **Step 7: 提交对话体验**

```bash
git add src/features/ai_companion/AiPanel.tsx src/features/ai_companion/AiPanel.test.tsx src/features/ai_companion/ai-companion.css src/features/settings/SettingDetailPage.tsx src/features/settings/SettingsPage.test.tsx
git commit -m "feat: redesign the companion conversation page"
```

### Task 11: 完成另外三个伙伴和六件商品的正式素材

**Files:**
- Create: `public/companions-2d/yunduo/<direction>/*.webp`
- Create: `public/companions-2d/cloudbloom/<direction>/*.webp`
- Create: `public/companions-2d/cloudbelle/<direction>/*.webp`
- Create: `public/companions-2d/attachments/<item>/<direction>.webp`
- Create: `docs/reviews/all-companions-2-5d-review-board.png`
- Modify: `src/features/ai_companion/companionAssets.ts`
- Modify: `src/features/ai_companion/attachments.ts`
- Modify: `src/features/ai_companion/companionAssets.test.ts`
- Modify: `src/features/ai_companion/attachments.test.ts`

**Interfaces:**
- Consumes: 用户确认的 Momo 样板画布、方向、分层和光影规范。
- Produces: 四伙伴和六件商品的完整生产清单。

- [ ] **Step 1: 按固定映射读取三个角色参考图**

- Yunduo：`5761a6e2843001bafe7610a8971bd643.jpg`
- Cloudbloom：`a64a3e8eeeacd4725c5ac931359b293a.jpg`
- Cloudbelle：`5b391107a9f022452c968d491bdfdabf.jpg`

三个文件与 Momo 位于同一 `C:\Users\qinch\Documents\xwechat_files\wxid_b6w0y1zz0qr822_2ae9\temp\RWTemp\2026-08\cfa980c60250c8c2e60d63753a2d7d68\` 目录。每个角色使用 Task 2 的八方向提示，但把角色名和身份参考替换为对应文件；不得把四个角色特征混合。

- [ ] **Step 2: 按固定映射读取六件商品参考图**

- 晨光云杖：`codex-clipboard-ec38462e-bc07-492f-8604-957e729207bd.png`
- 云朵小背包：`codex-clipboard-f1d7f813-c5de-4b31-b494-1b5bca04c2c6.png`
- 云朵花椅：`codex-clipboard-8a845f8f-496b-47a7-b5af-136d9e0b47d1.png`
- 云光花灯：`codex-clipboard-adca57a5-d337-41f5-9e51-88297f662d58.png`
- 彩虹云门：`codex-clipboard-1c0ddf08-923c-45c6-89fb-cf0bbcdb8b77.png`
- 花云风铃：`codex-clipboard-c44fda10-982f-420c-bc64-5c8798f1bec1.png`

这些文件位于 `C:\Users\qinch\AppData\Local\Temp\`。为每件商品输出八方向透明 WebP；完全对称方向可以在清单中复用同一 URL，但角色、方向和前后层必须正确。

- [ ] **Step 3: 应用 Momo 已确认的分层规范**

三个伙伴使用与 Momo 相同的脚底基线、画布尺寸、主光方向和场景比例；不同轮廓只通过各自 `origin`、`visualBounds` 和挂点配置处理，页面不添加角色特例 CSS。

- [ ] **Step 4: 写完整生产清单失败测试**

```ts
for (const id of COMPANION_IDS) {
  expect(Object.keys(getCompanionAsset(id).frames)).toHaveLength(8)
}
for (const item of COMPANION_CATALOG.filter((entry) => entry.category !== 'appearance')) {
  for (const direction of COMPANION_DIRECTIONS) {
    expect(resolveAttachmentFrame('momo', item.id, direction)).not.toBeNull()
  }
}
```

- [ ] **Step 5: 生成四伙伴与商品评审板**

评审板显示四伙伴的正面、侧面、背面、穿戴云朵小背包背面、手持晨光云杖、登录小比例和地图小比例。检查五官稳定、颜色一致、挂点不漂移和小尺寸可识别性。

- [ ] **Step 6: 取得用户最终视觉确认**

向用户展示 `docs/reviews/all-companions-2-5d-review-board.png`。用户要求修改时只更新对应角色或商品，并重新运行完整素材校验。

- [ ] **Step 7: 运行完整资产和页面回归**

Run: `node scripts/validate-companion-2d-assets.mjs && npm test -- --run src/features/ai_companion/companionAssets.test.ts src/features/ai_companion/attachments.test.ts src/features/profile/MallPage.test.tsx`

Expected: PASS，四伙伴与六件商品无缺失方向。

- [ ] **Step 8: 提交完整正式素材**

```bash
git add public/companions-2d docs/reviews/all-companions-2-5d-review-board.png src/features/ai_companion/companionAssets.ts src/features/ai_companion/attachments.ts src/features/ai_companion/companionAssets.test.ts src/features/ai_companion/attachments.test.ts
git commit -m "feat: complete the Zhizya 2.5d companion collection"
```

### Task 12: 移除三维运行依赖并完成全量验收

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `docs/ai-companion-dialogue-rules.md`
- Modify: `docs/deepseek-companion-setup.md`
- Create: `docs/ai-companion-2-5d-acceptance.md`
- Modify: `README.md`
- Modify: `src/app/App.integration.test.tsx`

**Interfaces:**
- Consumes: Tasks 1–11 的稳定接口。
- Produces: 可复现的自动化、视觉、性能和安全验收记录。

- [ ] **Step 1: 确认 Three.js 无剩余使用点**

Run: `rg -n "@react-three|from 'three'|from \"three\"|\.glb" src public scripts`

Expected: 无结果。若其他非伙伴功能仍引用三维依赖，保留依赖并在验收文档记录真实引用路径；不得为删除依赖破坏其他页面。

- [ ] **Step 2: 删除只服务于伙伴三维渲染的依赖**

Run: `npm uninstall three @react-three/fiber @react-three/drei`

Expected: `package.json` 和锁文件不再包含三项依赖，安装和构建成功。

- [ ] **Step 3: 修正文档中的旧规则**

将“八个伙伴”改为四个，删除中学端文案；将真实三维、GLB、任意相机和上下 ±25°改为八方向伪旋转与轻微视差；将长按规则统一为 600ms 进入聆听、取消触摸立即终止。

- [ ] **Step 4: 写跨页面装扮集成测试**

```tsx
it('keeps one 2.5d loadout through login, mall, chat and test map', async () => {
  await loginAs('chenxi_2026')
  await purchaseAndEquip('cloud-backpack')
  expect(loginCompanionLoadout()).toEqual(currentLoadout())
  await openCompanionChat()
  expect(chatCompanionLoadout()).toEqual(currentLoadout())
  await openCurrentTest()
  expect(mapCompanionLoadout()).toEqual(currentLoadout())
})
```

- [ ] **Step 5: 运行完整自动化和构建检查**

Run: `node scripts/validate-companion-2d-assets.mjs && npm test -- --run && npm run build`

Expected: 所有素材检查、测试和生产构建 PASS；浏览器包没有 `.glb` 请求和真实密钥。

- [ ] **Step 6: 执行四档视口浏览器验收**

在 320×568、375×667、390×844 和桌面应用框中逐项验证：登录伙伴比例、过渡动作、右下角边界、地图关卡锚定、八方向旋转、背包装到背面、服饰摆动、长按语音、DeepSeek 回答、应用命令、中风险确认、高风险密码、输入栏安全区、减少动画和素材失败降级。

- [ ] **Step 7: 记录性能与视觉证据**

在 `docs/ai-companion-2-5d-acceptance.md` 记录每个视口的结果和截图路径；记录首次登录精细场景与测试地图轻量场景的资源请求数量。当前角度只允许预载相邻两个方向，页面初次显示不得请求四伙伴全部八方向。

- [ ] **Step 8: 执行密钥扫描**

Run: `git grep -n -I -E "sk-[A-Za-z0-9]|DEEPSEEK_API_KEY=.+" -- . ':!package-lock.json'`

Expected: 不存在真实密钥；文档只出现空变量名说明。

- [ ] **Step 9: 提交验收与清理**

```bash
git add package.json package-lock.json docs/ai-companion-dialogue-rules.md docs/deepseek-companion-setup.md docs/ai-companion-2-5d-acceptance.md README.md src/app/App.integration.test.tsx
git commit -m "chore: verify the 2.5d companion redesign"
```

- [ ] **Step 10: 完成前复核**

运行 `git status --short`，确认只保留任务开始前已存在且不属于本次重构的本机文件；检查 Tasks 1–12 每项都有对应提交、测试结果和用户视觉确认，再报告完成情况。
