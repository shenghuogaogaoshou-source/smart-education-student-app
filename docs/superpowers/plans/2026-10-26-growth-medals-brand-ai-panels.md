# Growth, Medals, Brand, and AI Panels Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** 让智芽的成长画像和三组课程勋章由真实学习动作实时驱动，统一品牌信息，并把 AI 对话页的两个辅助功能改成适配 APP 内容区的无障碍底部抽屉。

**Architecture:** 以 `LearningEvent` 作为知识、测试、订正、作品和计划五类完成动作的统一事实来源；`AppState` 只持久化事件、真实错题与当前温和称号，成长画像和勋章均通过纯选择器派生，避免组件维护第二份状态。品牌由单一常量提供；AI 主聊天 DOM 保持不变，仅将现有两个本地面板提取为复用的 `AiLocalSheet`，继续挂载在现有 APP 对话容器内。

**Tech Stack:** React 19、TypeScript、Vite、Vitest、Testing Library、CSS、localStorage、现有 IndexedDB 作品仓库

**Spec:** `docs/superpowers/specs/2026-10-26-growth-medals-brand-ai-panels-design.md`

## Global Constraints

- 成长画像固定为“好奇探索、知识理解、问题解决、实践创造、自主规划”五维，每维上限 100。
- 有效完成动作贡献固定为：知识 `+2/+4`、测试 `+2/+4`、订正 `+2/+2`、作品 `+4/+2`、按计划完成 `+3`；答错、退出和未完成不扣分。
- 同一账号、年级组、动作与内容只能产生一条有效完成事件；事件、错题和称号均按学习账号隔离。
- 历史迁移只补事件和勋章达成日期，不重复发积分、不制造课程完成记录；`APP_STATE_VERSION` 从 4 升到 5。
- AI 对话原文、语音内容和敏感信息不能进入学习事件。
- 三组勋章总数固定为 49：1—2 年级 17 枚、3—4 年级 13 枚、5—6 年级 19 枚。
- 当前年级组默认展开，另外两组默认折叠；保留“全部、已获得、待解锁”筛选。
- 统一品牌值：`智芽`、`小学生 AI 学习成长伙伴`、`学生端 v1.1.0`、`智芽｜小学生 AI 学习成长伙伴`。
- 复用 `/brand/zhinya-mark.png`，不能新增 emoji 书本 Logo。
- AI 主聊天页消息、输入框、伙伴展示和信息架构不改；只重做“本机对话记录”和“伙伴设置”。
- 底部抽屉限制在 APP 内容区内，支持遮罩、关闭按钮、Escape、焦点循环、焦点恢复、内部滚动和 `prefers-reduced-motion`。
- 不新增依赖，不提交密钥、`.env.local`、构建产物或日志，不推送远端。

---

## File Map

- `src/app/learningEvents.ts`：学习事件类型、稳定 ID、增长映射、去重和安全规范化。
- `src/app/model.ts`：把学习事件、真实错题和当前称号纳入 `AppState v5`。
- `src/app/storage.ts`：v2—v5 状态规范化，v4 完成记录一次性补为学习事件。
- `src/app/AppState.tsx`：在一个 reducer 动作内同步写进度、错题、学习事件、称号和原积分交易。
- `src/features/profile/growthProfile.ts`：从事件派生五维画像和温和非重复称号。
- `src/features/profile/courseAchievements.ts`：从三套课程与事件派生 49 枚勋章及真实日期。
- `src/features/ai_companion/AiLocalSheet.tsx`：两个 AI 辅助面板共用的底部抽屉骨架。
- `src/app/brand.ts`：全局唯一品牌配置。

### Task 1: Learning-event domain and v5 persistence

**Files:**
- Create: `src/app/learningEvents.ts`
- Create: `src/app/learningEvents.test.ts`
- Modify: `src/app/model.ts`
- Modify: `src/app/storage.ts`
- Modify: `src/app/storage.test.ts`
- Modify: `src/app/companionAccountRepository.test.ts`

**Interfaces:**
- Produces: `GrowthDimension`, `GrowthScores`, `LearningEvent`, `LearningEventAction`, `LearningEventSource`, `createLearningEvent(input)`, `appendLearningEvent(events, event)`, `normalizeLearningEvents(value, accountId)`, `eventKey(input)`.
- Produces in `AppState`: `learningEvents: LearningEvent[]`, `wrongAnswers: WrongAnswerRecord[]`, `growthTitle: GrowthTitle | null`.
- Consumes: `GradeBand` and `CoursePartId` from `src/app/learning.ts`.

- [x] **Step 1: Write failing event and migration tests**

Add tests proving exact deltas, 100-point caps at selector level, stable IDs, duplicate suppression, account/band isolation, hostile record rejection, and one-time v4 migration:

```ts
it('maps a completed knowledge part to the approved dimensions', () => {
  const event = createLearningEvent({
    accountId: 'student-a', gradeBand: 'grade1-2', source: 'knowledge',
    contentId: 'qmx-1', action: 'knowledge-completed', occurredAt: '2026-10-26T09:00:00.000Z',
  })
  expect(event.dimensionDeltas).toEqual({ curiosity: 2, knowledge: 4, problemSolving: 0, creativity: 0, planning: 0 })
  expect(appendLearningEvent([event], event)).toEqual([event])
})

it('migrates v4 progress into events without changing points', () => {
  const v4 = { ...createDefaultState(), stateVersion: 4, learningEvents: undefined }
  const migrated = normalizePersistedState(v4)
  expect(migrated.stateVersion).toBe(5)
  expect(migrated.learningEvents.map(({ action, contentId }) => [action, contentId])).toEqual([
    ['knowledge-completed', 'ael-1'], ['knowledge-completed', 'ael-2'], ['knowledge-completed', 'ael-3'],
    ['test-passed', 'ael-1'], ['test-passed', 'ael-2'],
  ])
  expect(migrated.transactions).toEqual(v4.transactions)
})
```

- [x] **Step 2: Run the focused tests and verify failure**

Run: `npm test -- --run src/app/learningEvents.test.ts src/app/storage.test.ts src/app/companionAccountRepository.test.ts`

Expected: FAIL because `learningEvents.ts`, state v5 fields and v4 migration do not exist.

- [x] **Step 3: Implement the event model and safe normalizer**

Use these exact public shapes and approved mapping:

```ts
export type GrowthDimension = 'curiosity' | 'knowledge' | 'problemSolving' | 'creativity' | 'planning'
export type GrowthScores = Record<GrowthDimension, number>
export type LearningEventAction = 'knowledge-completed' | 'test-passed' | 'correction-completed' | 'work-completed' | 'schedule-completed'
export type LearningEventSource = 'knowledge' | 'test' | 'correction' | 'creative' | 'schedule'

export type LearningEvent = {
  id: string
  accountId: string
  gradeBand: GradeBand
  source: LearningEventSource
  contentId: string
  action: LearningEventAction
  occurredAt: string
  dimensionDeltas: GrowthScores
  migrationVersion?: 1
}

export const LEARNING_EVENT_DELTAS: Record<LearningEventAction, GrowthScores> = {
  'knowledge-completed': { curiosity: 2, knowledge: 4, problemSolving: 0, creativity: 0, planning: 0 },
  'test-passed': { curiosity: 0, knowledge: 2, problemSolving: 4, creativity: 0, planning: 0 },
  'correction-completed': { curiosity: 0, knowledge: 0, problemSolving: 2, creativity: 0, planning: 2 },
  'work-completed': { curiosity: 2, knowledge: 0, problemSolving: 0, creativity: 4, planning: 0 },
  'schedule-completed': { curiosity: 0, knowledge: 0, problemSolving: 0, creativity: 0, planning: 3 },
}
```

`eventKey()` must return `${accountId}:${gradeBand}:${action}:${contentId}`; `createLearningEvent()` copies the matching mapping and uses that key as `id`; `appendLearningEvent()` returns the original array when the ID already exists. `normalizeLearningEvents()` must accept only known sources/actions, current account, valid ISO dates, five finite non-negative deltas and unique IDs.

- [x] **Step 4: Upgrade `AppState` and migrate v4 data**

Set `APP_STATE_VERSION = 5`, add these exact types, and initialize empty records in `createDefaultState()` before normalization:

```ts
export type WrongAnswerRecord = {
  id: string; gradeBand: GradeBand; partId: CoursePartId; questionId: string
  prompt: string; options: string[]; selectedIndex: number; answerIndex: number
  explanation: string; occurredAt: string; correctedAt: string | null
}
export type GrowthTitle = { text: string; description: string; eventId: string }
```

In `normalizePersistedState()`, retain support for state versions 2, 3 and 4. For v4 only, create migrated knowledge/test events from validated `learningProgress` using the record date when available and otherwise `new Date().toISOString()`, set `migrationVersion: 1`, leave `transactions` and `processedRewardIds` byte-for-byte equivalent after normalization, and save the v5 result once. Normalize `wrongAnswers`, `learningEvents` and `growthTitle` independently so one corrupt item cannot discard valid siblings.

- [x] **Step 5: Run tests and verify persistence/account isolation**

Run: `npm test -- --run src/app/learningEvents.test.ts src/app/storage.test.ts src/app/companionAccountRepository.test.ts`

Expected: PASS; existing v2/v3 migration tests still pass after expected version assertions change from 4 to 5.

- [x] **Step 6: Commit**

```bash
git add src/app/learningEvents.ts src/app/learningEvents.test.ts src/app/model.ts src/app/storage.ts src/app/storage.test.ts src/app/companionAccountRepository.test.ts
git commit -m "feat: add account-scoped learning events"
```

### Task 2: Knowledge, tests, plans, and real wrong answers

**Files:**
- Modify: `src/app/AppState.tsx`
- Modify: `src/app/learningState.actions.test.tsx`
- Modify: `src/app/learningPlanState.actions.test.tsx`
- Modify: `src/features/test/QuizModal.tsx`
- Modify: `src/features/test/TestPage.tsx`
- Modify: `src/features/test/TestPage.test.tsx`

**Interfaces:**
- Consumes: `createLearningEvent()` and `appendLearningEvent()` from Task 1.
- Produces: `QuizResult = { score: number; total: number; wrongAnswers: QuizWrongAnswer[] }` exported from `QuizModal.tsx`.
- Produces: `QuizWrongAnswer = Pick<WrongAnswerRecord, 'questionId' | 'prompt' | 'options' | 'selectedIndex' | 'answerIndex' | 'explanation'>`.
- Produces in `useAppState()`: `submitQuizResult(partId, title, result)`; existing `completeKnowledge(partId, title)` remains public.

- [x] **Step 1: Write failing reducer and quiz-result tests**

Cover real completion, duplicates, locked tests, wrong answers, and schedule completion in the same state transition:

```ts
it('records knowledge and matching schedule events once', async () => {
  await user.click(screen.getByRole('button', { name: '完成知识' }))
  await user.click(screen.getByRole('button', { name: '完成知识' }))
  expect(readState().learningEvents.filter((event) => event.contentId === 'ael-4')).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ action: 'knowledge-completed' }),
      expect.objectContaining({ action: 'schedule-completed' }),
    ]),
  )
  expect(readState().learningEvents.filter((event) => event.action === 'knowledge-completed' && event.contentId === 'ael-4')).toHaveLength(1)
})

it('reports the selected wrong option to the page', async () => {
  await answerQuizWithOneMistake(user)
  expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({
    wrongAnswers: [expect.objectContaining({ questionId: expect.any(String), selectedIndex: 1, answerIndex: 0 })],
  }))
})
```

- [x] **Step 2: Run focused tests and verify failure**

Run: `npm test -- --run src/app/learningState.actions.test.tsx src/app/learningPlanState.actions.test.tsx src/features/test/TestPage.test.tsx`

Expected: FAIL because quiz answers are not returned and no learning events are recorded.

- [x] **Step 3: Return structured quiz results**

Export `QuizResult` and `QuizWrongAnswer`. In `QuizModal`, store the chosen option index for every question, then build `wrongAnswers` only where `selectedIndex !== answerIndex`. Change `onComplete` from `(score, total) => void` to `(result: QuizResult) => void`. No event is emitted from the modal itself.

- [x] **Step 4: Record progress, wrong answers, events and existing point rewards atomically**

Replace `passTest()` usage in `TestPage` with:

```ts
submitQuizResult(activePart.id, activePart.title, result)
```

The reducer must:

1. Upsert current wrong answers by `${gradeBand}:${partId}:${questionId}`, keeping the latest selected answer and timestamp.
2. Generate no test completion event when the pass threshold is not reached.
3. Preserve the current knowledge-before-test gate.
4. On the first valid pass, update `testsPassed`, append `test-passed`, and run the existing `buildProgressRewardTransactions()` exactly once.
5. On the first knowledge completion, update `knowledgeCompleted`, append `knowledge-completed`, and preserve current point rewards.
6. Before changing progress, collect pending `LearningPlanTask` entries matching the current part and kind; after valid completion append one `schedule-completed` event per newly completed matching task using its task ID as `contentId`.
7. Do not use question prompt, typed text or AI chat text as an event `contentId`.

- [x] **Step 5: Run focused and regression tests**

Run: `npm test -- --run src/app/learningState.actions.test.tsx src/app/learningPlanState.actions.test.tsx src/features/test/TestPage.test.tsx src/features/knowledge/CourseContentPage.test.tsx`

Expected: PASS, including existing point totals and locked-test behavior.

- [x] **Step 6: Commit**

```bash
git add src/app/AppState.tsx src/app/learningState.actions.test.tsx src/app/learningPlanState.actions.test.tsx src/features/test/QuizModal.tsx src/features/test/TestPage.tsx src/features/test/TestPage.test.tsx
git commit -m "feat: record real learning and quiz events"
```

### Task 3: Wrong-answer correction and creative-work events

**Files:**
- Modify: `src/app/AppState.tsx`
- Modify: `src/features/profile/WrongBookPage.tsx`
- Modify: `src/features/profile/WrongBookPage.test.tsx`
- Modify: `src/features/games/GameWorkBridge.tsx`
- Modify: `src/features/games/GameWorkBridge.test.tsx`
- Modify: `src/features/games/EmbeddedGamePage.tsx`
- Modify: `src/app/gameWorks.integration.test.tsx`

**Interfaces:**
- Produces in `useAppState()`: `completeCorrection(wrongAnswerId: string)` and `recordCreativeWork(workId: string, occurredAt?: string)`.
- Consumes: `WrongAnswerRecord`, `createLearningEvent()`, `appendLearningEvent()`.
- Changes `GameWorkBridge` prop to `onWorkSaved?: (record: WorkRecord) => void` without changing its postMessage protocol.

- [x] **Step 1: Write failing correction and work-event tests**

```ts
it('only completes correction after the child chooses the right answer', async () => {
  renderWrongBookWith(oneWrongAnswer)
  await user.click(screen.getByRole('button', { name: '重做' }))
  await user.click(screen.getByRole('button', { name: '错误选项' }))
  expect(screen.getByText('再想一想，你已经更接近答案了')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: '正确选项' }))
  expect(app.completeCorrection).toHaveBeenCalledWith(oneWrongAnswer.id)
})

it('records one creative event after a game draft is saved', async () => {
  await dispatchValidGameSaveMessage()
  expect(onWorkSaved).toHaveBeenCalledWith(expect.objectContaining({ id: 'work-1', source: 'brain-film' }))
})
```

- [x] **Step 2: Run focused tests and verify failure**

Run: `npm test -- --run src/features/profile/WrongBookPage.test.tsx src/features/games/GameWorkBridge.test.tsx src/app/gameWorks.integration.test.tsx`

Expected: FAIL because wrong-book data is synthetic and saved works do not emit learning events.

- [x] **Step 3: Replace synthetic wrong-book entries with `state.wrongAnswers`**

Render only the current account's persisted records. “重做” expands the original options; an incorrect retry shows the gentle local message and changes no state. Choosing `answerIndex` calls `completeCorrection(id)`, sets `correctedAt`, and appends a `correction-completed` event with the wrong-answer ID as `contentId`. Repeating the correct answer keeps the same timestamp and event. Keep “全部／待复习／已复习” filtering and remove the delete action so a completed correction remains traceable.

- [x] **Step 4: Emit creative events only for the two embedded games**

Call `onWorkSaved(record)` after `saveDraft()` resolves. In `EmbeddedGamePage`, pass a callback that invokes `recordCreativeWork(record.id, record.createdAt)` only when `record.source` is `brain-film` or `creative-module`. External uploads and gallery interactions must not emit events. `recordCreativeWork()` uses `work-completed`, so repeated save messages for the same record do not increase growth twice.

- [x] **Step 5: Run focused tests**

Run: `npm test -- --run src/features/profile/WrongBookPage.test.tsx src/features/games/GameWorkBridge.test.tsx src/app/gameWorks.integration.test.tsx`

Expected: PASS and no work repository test changes are required.

- [x] **Step 6: Commit**

```bash
git add src/app/AppState.tsx src/features/profile/WrongBookPage.tsx src/features/profile/WrongBookPage.test.tsx src/features/games/GameWorkBridge.tsx src/features/games/GameWorkBridge.test.tsx src/features/games/EmbeddedGamePage.tsx src/app/gameWorks.integration.test.tsx
git commit -m "feat: connect corrections and game works to growth"
```

### Task 4: Derived growth profile and gentle rotating titles

**Files:**
- Create: `src/features/profile/growthProfile.ts`
- Create: `src/features/profile/growthProfile.test.ts`
- Modify: `src/app/AppState.tsx`
- Modify: `src/features/profile/GrowthRadar.tsx`
- Modify: `src/features/profile/GrowthSection.tsx`
- Modify: `src/features/profile/ProfilePage.test.tsx`
- Modify: `src/features/profile/profile.css`

**Interfaces:**
- Consumes: `LearningEvent`, `GrowthScores`, `GrowthTitle`.
- Produces: `deriveGrowthProfile(events, accountId): { scores: GrowthScores; hasEvidence: boolean; eventCount: number }`.
- Produces: `chooseNextGrowthTitle(event, previous): GrowthTitle`.
- Uses a neutral base of 40 for each dimension and clamps each result with `Math.min(100, Math.max(0, value))`.

- [x] **Step 1: Write failing selector/title tests**

```ts
it('derives a neutral profile and caps growth at one hundred', () => {
  expect(deriveGrowthProfile([], 'student-a')).toEqual({
    scores: { curiosity: 40, knowledge: 40, problemSolving: 40, creativity: 40, planning: 40 },
    hasEvidence: false, eventCount: 0,
  })
  expect(deriveGrowthProfile(repeatKnowledgeEvents(20), 'student-a').scores.knowledge).toBe(100)
})

it('chooses a different, non-comparative title for consecutive events', () => {
  const first = chooseNextGrowthTitle(knowledgeEvent, null)
  const second = chooseNextGrowthTitle(knowledgeEvent2, first)
  expect(second.text).not.toBe(first.text)
  expect(`${first.text}${second.text}`).not.toMatch(/天才|第一|最强|落后|薄弱/)
})
```

- [x] **Step 2: Run tests and verify failure**

Run: `npm test -- --run src/features/profile/growthProfile.test.ts src/features/profile/ProfilePage.test.tsx`

Expected: FAIL because the selectors do not exist and UI values are hard-coded.

- [x] **Step 3: Implement the pure growth and title selectors**

Filter by exact `accountId`, sum event deltas over the neutral base, and cap every dimension. Define at least three ordered candidates per dominant action; examples include “愿意多问一步的小探索家”“把新知识慢慢连起来的小研究员”“愿意回头检查的小侦探”“把点子慢慢做出来的小创客”“会为明天留位置的小规划员”. `chooseNextGrowthTitle()` selects by the latest event's largest delta, then rotates to the next candidate when the first equals `previous.text`; descriptions name the observed action, never rank ability.

- [x] **Step 4: Update the title in the same reducer transition as each new event**

Centralize event appending in an `applyLearningEvent(state, event)` helper. If `appendLearningEvent()` returns a new array, call `chooseNextGrowthTitle(event, state.growthTitle)` and store both together. Duplicate events return the original state and cannot rotate the title.

- [x] **Step 5: Drive the radar and copy from current account data**

Change `GrowthRadar` to accept `scores: GrowthScores`; render the same five labels and SVG geometry using selector values. In `GrowthSection`, compute the profile from `state.learningEvents` and `state.accountId`. When `hasEvidence` is false, show “正在认识你的学习方式” plus neutral explanatory copy; otherwise show `state.growthTitle`. Preserve “只和自己的近期相比” and “AI 对话不会进入画像数据”.

- [x] **Step 6: Run focused tests and visual-state assertions**

Run: `npm test -- --run src/features/profile/growthProfile.test.ts src/features/profile/ProfilePage.test.tsx src/app/learningState.actions.test.tsx`

Expected: PASS; profile values update immediately after a simulated completion action.

- [x] **Step 7: Commit**

```bash
git add src/features/profile/growthProfile.ts src/features/profile/growthProfile.test.ts src/app/AppState.tsx src/features/profile/GrowthRadar.tsx src/features/profile/GrowthSection.tsx src/features/profile/ProfilePage.test.tsx src/features/profile/profile.css
git commit -m "feat: derive live growth portrait and titles"
```

### Task 5: Three grouped course-achievement sets

**Files:**
- Create: `src/features/profile/courseAchievements.ts`
- Create: `src/features/profile/courseAchievements.test.ts`
- Modify: `src/features/profile/medalsData.ts`
- Modify: `src/features/profile/MedalsPage.tsx`
- Create: `src/features/profile/MedalsPage.test.tsx`
- Modify: `src/features/profile/RewardsSection.tsx`
- Modify: `src/features/profile/rewards.test.tsx`
- Modify: `src/features/profile/profile.css`

**Interfaces:**
- Consumes: all `COURSE_PACKAGES`, `LearningEvent[]`, current `accountId`, current `GradeBand`.
- Produces: `CourseAchievement = { id; band; kind: 'knowledge' | 'challenge' | 'finale'; partId?: CoursePartId; name; icon; description; earned; earnedAt: string | null; statusText }`.
- Produces: `deriveCourseAchievementGroups(events, accountId): Record<GradeBand, CourseAchievement[]>` and `getAchievementSummary(groups)`.

- [x] **Step 1: Write failing 49-medal derivation tests**

```ts
it('builds the approved 17, 13 and 19 achievement groups', () => {
  const groups = deriveCourseAchievementGroups([], 'student-a')
  expect(groups['grade1-2']).toHaveLength(17)
  expect(groups['grade3-4']).toHaveLength(13)
  expect(groups['grade5-6']).toHaveLength(19)
  expect(Object.values(groups).flat()).toHaveLength(49)
})

it('earns paired medals and finale from exact events with dates', () => {
  const groups = deriveCourseAchievementGroups(allQmxEvents, 'student-a')
  expect(groups['grade1-2'].find(({ id }) => id === 'qmx-1:knowledge')).toMatchObject({ earned: true, earnedAt: '2026-10-20T09:00:00.000Z' })
  expect(groups['grade1-2'].find(({ id }) => id === 'qmx-finale')).toMatchObject({ earned: true })
})
```

- [x] **Step 2: Run tests and verify failure**

Run: `npm test -- --run src/features/profile/courseAchievements.test.ts src/features/profile/rewards.test.tsx`

Expected: FAIL because current code has one combined medal per part plus eight unrelated demonstration medals.

- [x] **Step 3: Implement exact paired achievements and statuses**

For every course part, create `${partId}:knowledge` from `knowledge-completed` and `${partId}:challenge` from `test-passed`. Reuse each course medal's icon for its knowledge pair and use a consistent star/shield icon token for the challenge pair. The finale is earned only when every part has both event types; `earnedAt` is the latest prerequisite event date. Status copy must be exactly selected from:

```ts
'先去认识这个主题'
'知识已点亮，下一步去挑战'
'再试一次，订正后继续挑战'
'已获得 · YYYY-MM-DD'
```

Use current unresolved `wrongAnswers` only to choose the third status; earned logic remains event-based. Delete `growthMedals` and the `growthEarnedCount` branch from `medalsData.ts`.

- [x] **Step 4: Rebuild the medals page into three accessible groups**

Initialize expanded state with only the current band. Each group header shows course name, earned/total count and an accessible expand button with `aria-expanded`. Pair knowledge and challenge cards by part inside each group, then render the finale. Apply the global filter to all groups without collapsing the current group. Show dates for earned cards. Other groups remain discoverable and expandable.

- [x] **Step 5: Update profile summary to all 49 medals**

`RewardsSection` must use `getAchievementSummary()` over all three groups, not demo medal constants. The profile card displays total earned out of 49 and keeps its existing navigation behavior.

- [x] **Step 6: Run tests**

Run: `npm test -- --run src/features/profile/courseAchievements.test.ts src/features/profile/MedalsPage.test.tsx src/features/profile/rewards.test.tsx src/features/profile/ProfilePage.test.tsx`

Expected: PASS for grouping, default expansion, filters, dates, finale rules and total count.

- [x] **Step 7: Commit**

```bash
git add src/features/profile/courseAchievements.ts src/features/profile/courseAchievements.test.ts src/features/profile/medalsData.ts src/features/profile/MedalsPage.tsx src/features/profile/MedalsPage.test.tsx src/features/profile/RewardsSection.tsx src/features/profile/rewards.test.tsx src/features/profile/profile.css
git commit -m "feat: add three course achievement groups"
```

### Task 6: Unified 智芽 brand configuration

**Files:**
- Create: `src/app/brand.ts`
- Create: `src/app/brand.test.ts`
- Modify: `src/features/auth/AuthLayout.tsx`
- Modify: `src/features/auth/LoginPage.tsx`
- Modify: `src/features/auth/AuthFlow.test.tsx`
- Modify: `src/features/settings/SettingDetailPage.tsx`
- Modify: `src/features/settings/SettingsPage.test.tsx`
- Modify: `index.html`

**Interfaces:**
- Produces: `BRAND = { name; positioning; version; browserTitle; copyright; logoSrc; logoAlt } as const`.
- Consumes: `/brand/zhinya-mark.png` already used by the login page.

- [x] **Step 1: Write failing brand consistency tests**

```ts
it('defines the single approved 智芽 brand source', () => {
  expect(BRAND).toEqual({
    name: '智芽', positioning: '小学生 AI 学习成长伙伴', version: '学生端 v1.1.0',
    browserTitle: '智芽｜小学生 AI 学习成长伙伴',
    copyright: '© 2026 智芽 · 陪孩子安全、好奇地学习 AI',
    logoSrc: '/brand/zhinya-mark.png', logoAlt: '智芽品牌标志',
  })
})
```

Extend the settings test to assert the logo image, `智芽`, `学生端 v1.1.0` and copyright, and to reject visible `数智学习世界`.

- [x] **Step 2: Run tests and verify failure**

Run: `npm test -- --run src/app/brand.test.ts src/features/settings/SettingsPage.test.tsx src/features/auth/AuthFlow.test.tsx`

Expected: FAIL because the About section and login heading still contain the old brand.

- [x] **Step 3: Add `BRAND` and consume it in visible brand surfaces**

Use the exact object above. `AuthLayout` and `LoginPage` must read the name, positioning, logo source and alt text from `BRAND`; keep the approved login layout otherwise unchanged. Replace the About book emoji with `<img src={BRAND.logoSrc} alt={BRAND.logoAlt} />`, render the approved version/copyright, and leave agreement/privacy/legal behavior intact. Set `<title>智芽｜小学生 AI 学习成长伙伴</title>` in `index.html` and assert it equals `BRAND.browserTitle` in the test.

- [x] **Step 4: Scan and classify legacy visible brand strings**

Run: `rg -n "数智学习世界|学生端 v1\.0\.0|© 2026 数智教育" src index.html`

Expected: no UI source hits. Do not replace “数智教育”“数智能力” where they describe course subject matter rather than the product name. Update obsolete tests that assert “欢迎来到数智学习世界” to the new brand copy.

- [x] **Step 5: Run focused tests**

Run: `npm test -- --run src/app/brand.test.ts src/features/settings/SettingsPage.test.tsx src/features/auth/AuthFlow.test.tsx src/app/App.test.tsx src/app/App.integration.test.tsx`

Expected: PASS and the legacy visible-brand scan remains empty.

- [x] **Step 6: Commit**

```bash
git add src/app/brand.ts src/app/brand.test.ts src/features/auth/AuthLayout.tsx src/features/auth/LoginPage.tsx src/features/auth/AuthFlow.test.tsx src/features/settings/SettingDetailPage.tsx src/features/settings/SettingsPage.test.tsx src/app/App.test.tsx src/app/App.integration.test.tsx index.html
git commit -m "feat: unify zhiya brand metadata"
```

### Task 7: AI history and settings bottom sheets

**Files:**
- Create: `src/features/ai_companion/AiLocalSheet.tsx`
- Create: `src/features/ai_companion/AiLocalSheet.test.tsx`
- Modify: `src/app/model.ts`
- Modify: `src/app/storage.ts`
- Modify: `src/app/AppState.tsx`
- Modify: `src/app/companionAccountRepository.test.ts`
- Modify: `src/features/ai_companion/AiPanel.tsx`
- Modify: `src/features/ai_companion/AiPanel.test.tsx`
- Modify: `src/features/ai_companion/ai-companion.css`
- Reuse: `src/app/useDialogFocus.ts`

**Interfaces:**
- Produces: `AiLocalSheet({ label, eyebrow, title, triggerRef, onClose, children, footer? })`.
- Extends: `ConversationSummary` with normalized `messageCount: number`; missing legacy values normalize to `1`.
- Consumes: existing `useDialogFocus({ open, containerRef, triggerRef, onClose })` signature after confirming it from source.
- Leaves unchanged: `messages`, conversation machine, voice handlers, composer, companion rotator and portal root.

- [x] **Step 1: Write failing behavior and accessibility tests**

Test both panels for in-APP sheet classes, Escape, backdrop, focus loop, focus restoration, compact empty state, grouped history, confirmation before clear, setting cards and privacy footer:

```ts
it('opens history as an app-contained bottom sheet and restores focus', async () => {
  const trigger = screen.getByRole('button', { name: '历史对话' })
  await user.click(trigger)
  expect(screen.getByRole('dialog', { name: '本机对话记录' })).toHaveClass('ai-local-sheet')
  await user.keyboard('{Escape}')
  expect(screen.queryByRole('dialog', { name: '本机对话记录' })).not.toBeInTheDocument()
  expect(trigger).toHaveFocus()
})
```

- [x] **Step 2: Run focused tests and verify failure**

Run: `npm test -- --run src/features/ai_companion/AiLocalSheet.test.tsx src/features/ai_companion/AiPanel.test.tsx src/app/useDialogFocus.test.tsx`

Expected: FAIL because current absolute panels lack a reusable sheet, focus trap and grouped history.

- [x] **Step 3: Build the contained sheet without changing the main chat**

Render the sheet as the last child of `.ai-chat-shell`, not a separate `document.body` portal. Structure:

```tsx
<div className="ai-local-sheet-layer" data-testid="ai-local-sheet-layer">
  <button className="ai-local-sheet-backdrop" aria-label={`关闭${label}`} onClick={onClose} />
  <section ref={containerRef} className="ai-local-sheet" role="dialog" aria-modal="true" aria-label={label}>
    <header className="ai-local-sheet__header">...</header>
    <div className="ai-local-sheet__body">{children}</div>
    {footer && <footer className="ai-local-sheet__footer">{footer}</footer>}
  </section>
</div>
```

Store refs for the two header trigger buttons and pass the active one into `useDialogFocus`. Add `max-height: min(68%, 560px)`, body-only `overflow-y: auto`, rounded top corners, warm cream/pink surfaces, fixed header/footer, and a reduced-motion media query. `.ai-chat-shell` remains the containing block; do not edit the main chat sections.

- [x] **Step 4: Implement grouped history and clear confirmation**

Add `messageCount: number` to `ConversationSummary`; normalize positive integers and use `1` only for legacy records that lack the field. Group valid `conversationSummaries` into “今天、昨天、更早” using local calendar dates. Cards show time, topic, one-line summary and `messageCount`. Clicking a card expands its summary. Add “清空记录”; opening it shows an in-sheet confirmation with cancel/confirm. Confirm calls `clearHistory()`, which must set both `historyCount: 0` and `conversationSummaries: []`, then closes only the confirmation. Empty state uses the existing companion visual language and no fixed tall spacer.

- [x] **Step 5: Implement three compact settings cards**

Use icon + title + one-line explanation + accessible switch for voice reply, save summary and learning memory. The footer always states that settings belong to the current account and provides “管理全部隐私设置”; wire it to the existing settings navigation callback passed into `AiPanel`, or add `onOpenPrivacySettings?: () => void` with a tested no-op-safe fallback. Do not alter the semantics of the three existing AppState setters.

- [x] **Step 6: Run focused tests and preserve main-chat assertions**

Run: `npm test -- --run src/features/ai_companion/AiLocalSheet.test.tsx src/features/ai_companion/AiPanel.test.tsx src/app/useDialogFocus.test.tsx`

Expected: PASS; existing message, voice and command tests remain unchanged.

- [x] **Step 7: Commit**

```bash
git add src/app/model.ts src/app/storage.ts src/app/AppState.tsx src/app/companionAccountRepository.test.ts src/features/ai_companion/AiLocalSheet.tsx src/features/ai_companion/AiLocalSheet.test.tsx src/features/ai_companion/AiPanel.tsx src/features/ai_companion/AiPanel.test.tsx src/features/ai_companion/ai-companion.css
git commit -m "feat: redesign ai auxiliary panels as sheets"
```

### Task 8: Cross-module regression and release verification

**Files:**
- Modify: `src/app/App.integration.test.tsx`
- Modify: `src/features/profile/ProfilePage.test.tsx`
- Modify: `docs/superpowers/plans/2026-10-26-growth-medals-brand-ai-panels.md` only to check completed boxes during execution

**Interfaces:**
- Consumes all interfaces produced by Tasks 1—7.
- Produces no new production API.

- [x] **Step 1: Add an end-to-end state integration test**

Use the real providers and UI to cover this sequence in one account: finish a knowledge topic, submit a passing quiz with one wrong answer, correct it, save one embedded-game work, and verify growth values, paired medals, dates and title. Then switch to a second account and assert none of the first account's events, wrong answers or medals appear.

```ts
expect(screen.getByText(/知识理解 46/)).toBeInTheDocument()
expect(screen.getByText(/问题解决 46/)).toBeInTheDocument()
expect(screen.getByText(/实践创造 44/)).toBeInTheDocument()
expect(screen.getByText('已获得 · 2026-10-26')).toBeInTheDocument()
```

Use fake timers at `2026-10-26T10:00:00+08:00` so date assertions are deterministic. Compute final expected scores from exactly one event of each relevant action; do not mock the growth selector.

- [x] **Step 2: Run the new integration test and fix only integration defects**

Run: `npm test -- --run src/app/App.integration.test.tsx src/features/profile/ProfilePage.test.tsx`

Expected: PASS. If the test exposes duplicate events, fix the producer or `appendLearningEvent()` rather than weakening assertions.

- [x] **Step 3: Run the complete automated suite**

Run: `npm run test:all`

Expected: all frontend, server, script and embedded-game tests pass.

- [x] **Step 4: Run the production build**

Run: `npm run build`

Expected: TypeScript, Vite web build and both embedded-game builds succeed.

- [x] **Step 5: Run repository hygiene and secret scans**

Run: `git diff --check`

Expected: no whitespace errors.

Run: `rg -n "数智学习世界|学生端 v1\.0\.0|© 2026 数智教育" src index.html`

Expected: no visible old-brand hits.

Run: `git status --short`

Expected: only intended source, tests and this checked plan are modified; `.env.local`, `dist`, logs and API keys are absent.

- [x] **Step 6: Commit integration coverage**

```bash
git add src/app/App.integration.test.tsx src/features/profile/ProfilePage.test.tsx docs/superpowers/plans/2026-10-26-growth-medals-brand-ai-panels.md
git commit -m "test: verify growth medals brand and ai sheets"
```

## Self-Review Checklist

- [x] Spec coverage: learning-event architecture, five dimensions, non-punitive scoring, account/band isolation, migration, rotating titles, 49 medals, brand source, two AI sheets and accessibility each map to a task above.
- [x] Data integrity: the plan never awards points during migration and never records AI conversation content as learning evidence.
- [x] Placeholder scan: search the plan for the five prohibited placeholder patterns listed in the `writing-plans` skill; all searches return no matches.
- [x] Type consistency: `LearningEvent`, `WrongAnswerRecord`, `GrowthTitle`, `QuizResult`, `CourseAchievement`, `submitQuizResult`, `completeCorrection`, and `recordCreativeWork` use the same names in producer and consumer tasks.
- [x] Scope protection: the main AI chat remains unchanged; external uploads do not increase growth; legal behavior and point rewards remain intact.
