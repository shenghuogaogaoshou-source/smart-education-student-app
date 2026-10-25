# AI-Assisted Learning Plan Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the static growth schedule with an account-scoped seven-day plan built from the active grade's real knowledge and test content, including editable DeepSeek suggestions that require student confirmation.

**Architecture:** Add a normalized learning-plan domain to `AppState`, derive content and completion from the existing course catalog and learning progress, and render the same plan through the growth card, editor, and calendar. A dedicated server endpoint reuses the companion DeepSeek configuration, validates structured output against the supplied catalog and availability, and falls back to a deterministic local planner without overwriting the current plan.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, Testing Library, Node.js HTTP server, DeepSeek-compatible chat completions, browser localStorage.

**Spec:** `docs/superpowers/specs/2026-10-25-learning-plan-ai-design.md`

## Global Constraints

- Plan content must come only from the active grade band's real knowledge parts and quizzes.
- Incomplete content sorts first; completed content remains selectable as review.
- Plans cover the next seven local calendar days and respect student-entered availability.
- AI proposals remain temporary until the student confirms them on screen.
- Course completion stays sourced from `learningProgress`; plan tasks never issue rewards themselves.
- The browser must never receive, store, or log `DEEPSEEK_API_KEY`.
- AI failure must preserve the saved plan and leave manual planning usable.
- Copy must be age-appropriate, encouraging, and free of comparative or shaming language.
- Existing point, medal, growth-portrait, course, and quiz rules remain unchanged.

---

### Task 1: Learning-plan domain, normalization, and account persistence

**Files:**
- Create: `src/app/learningPlan.ts`
- Create: `src/app/learningPlan.test.ts`
- Modify: `src/app/model.ts`
- Modify: `src/app/storage.ts`
- Modify: `src/app/storage.test.ts`
- Modify: `src/app/companionAccountRepository.test.ts`

**Interfaces:**
- Produces: `LearningPlanTask`, `DailyAvailability`, `LearningPlanState`, `createDefaultLearningPlan()`, `normalizeLearningPlan(value, fallback, now)`, `getTaskCompletion(task, progress)`, and `getTaskTiming(task, now)`.
- Consumes: `PrimaryGrade`, `CoursePartId`, `LearningProgress`, and account persistence already used by `AppState`.

- [ ] **Step 1: Write failing domain and migration tests**

```ts
it('normalizes saved tasks and removes invalid date/time/duration values', () => {
  const result = normalizeLearningPlan({ tasks: [validTask, { ...validTask, id: 'bad', minutes: 0 }] }, empty, now)
  expect(result.tasks).toEqual([validTask])
})

it('derives completion from learning progress rather than a stored flag', () => {
  expect(getTaskCompletion(knowledgeTask, progressWithKnowledge)).toBe('completed')
  expect(getTaskCompletion(testTask, progressWithKnowledge)).toBe('pending')
})

it('migrates a v3 account to v4 without retaining the three legacy fake tasks', () => {
  const migrated = normalizePersistedState(v3State)
  expect(migrated.learningPlan.tasks.every((task) => task.partId.startsWith('ael-'))).toBe(true)
})
```

- [ ] **Step 2: Run the focused tests and verify the new symbols fail**

Run: `npm test -- --run src/app/learningPlan.test.ts src/app/storage.test.ts src/app/companionAccountRepository.test.ts`

Expected: FAIL because `learningPlan.ts`, state version 4, and persisted `learningPlan` do not exist.

- [ ] **Step 3: Implement the domain types and pure normalization helpers**

```ts
export type LearningPlanTask = {
  id: string
  grade: PrimaryGrade
  partId: CoursePartId
  kind: 'knowledge' | 'test'
  title: string
  date: string
  time: string
  minutes: number
  order: number
  source: 'student' | 'ai' | 'fallback'
  review: boolean
  createdAt: string
  updatedAt: string
}

export type LearningPlanState = {
  tasks: LearningPlanTask[]
  availability: DailyAvailability[]
  lastAiSuggestionAt: string | null
}

export function getTaskCompletion(task: LearningPlanTask, progress: LearningProgress) {
  const band = getGradeBand(task.grade)
  const completed = task.kind === 'knowledge'
    ? progress[band].knowledgeCompleted
    : progress[band].testsPassed
  return completed.includes(task.partId) ? 'completed' : 'pending'
}
```

Normalization must accept only unique IDs, valid primary grades, `YYYY-MM-DD`, `HH:mm`, 5—90 minutes, known kinds/sources, non-negative integer order, and a seven-day availability list. Invalid entries are discarded; arrays are cloned.

- [ ] **Step 4: Add the version-4 state field and migration**

Add `learningPlan: LearningPlanState` to `AppState`, initialize it through `createDefaultLearningPlan()`, append it to `PERSISTED_KEYS`, accept state versions 2/3/4 during migration, and normalize the plan on load. The default grade-5 account receives three real `ael-*` items selected through a small exported seed helper; no old title such as “图片识别小探索” is persisted.

- [ ] **Step 5: Run the focused tests and verify they pass**

Run: `npm test -- --run src/app/learningPlan.test.ts src/app/storage.test.ts src/app/companionAccountRepository.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit the account-persisted domain**

```bash
git add src/app/learningPlan.ts src/app/learningPlan.test.ts src/app/model.ts src/app/storage.ts src/app/storage.test.ts src/app/companionAccountRepository.test.ts
git commit -m "feat: persist account learning plans"
```

---

### Task 2: Real course candidates and deterministic fallback planner

**Files:**
- Create: `src/features/profile/learningPlanner.ts`
- Create: `src/features/profile/learningPlanner.test.ts`
- Modify: `src/features/knowledge/courseCatalog.ts`

**Interfaces:**
- Consumes: `CoursePackage`, `BandProgress`, `PrimaryGrade`, `DailyAvailability`, and existing plan tasks.
- Produces: `PlanCandidate`, `getPlanCandidates(course, progress)`, `buildFallbackPlan(input)`, and `validatePlanTasks(tasks, context)`.

- [ ] **Step 1: Write failing candidate and fallback tests for all three grade bands**

```ts
it.each(['grade1', 'grade3', 'grade5'] as const)('uses only the active grade band for %s', (grade) => {
  const band = getGradeBand(grade)
  const candidates = getPlanCandidates(getCourseForBand(band), progress[band])
  expect(new Set(candidates.map((item) => item.courseId))).toEqual(new Set([getCourseIdForBand(getGradeBand(grade))]))
})

it('sorts incomplete knowledge, unlocked tests, then completed review', () => {
  expect(candidates.map(({ kind, review }) => [kind, review])).toEqual([
    ['knowledge', false], ['test', false], ['knowledge', true], ['test', true],
  ])
})

it('keeps every generated task inside daily availability and capacity', () => {
  const plan = buildFallbackPlan(input)
  expect(plan.every((task) => isWithinAvailability(task, input.availability))).toBe(true)
  expect(totalMinutes(plan, monday)).toBeLessThanOrEqual(45)
})
```

- [ ] **Step 2: Run the planner tests and verify they fail**

Run: `npm test -- --run src/features/profile/learningPlanner.test.ts`

Expected: FAIL because planner functions do not exist.

- [ ] **Step 3: Implement catalog-backed candidates**

```ts
export type PlanCandidate = {
  courseId: CourseId
  partId: CoursePartId
  partNumber: number
  kind: 'knowledge' | 'test'
  title: string
  suggestedMinutes: number
  review: boolean
  unlocked: boolean
}
```

Build exactly two candidates per course part. Knowledge completion comes from `knowledgeCompleted`; test completion comes from `testsPassed`; test unlock uses `isTestUnlocked`. Suggested minutes are 15 for knowledge and 10 for tests.

- [ ] **Step 4: Implement deterministic fallback placement and shared validation**

The planner walks enabled days in order, places unfinished knowledge before its test, starts at each day's `startTime`, increments by task duration, and stops at `maxMinutes`/`endTime`. `validatePlanTasks` drops unknown IDs, duplicate `(date, partId, kind)` tuples, dates outside the seven-day window, times outside availability, and durations outside 5—90.

- [ ] **Step 5: Run planner and catalog tests**

Run: `npm test -- --run src/features/profile/learningPlanner.test.ts src/features/knowledge/courseCatalog.test.ts src/app/learning.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit real-content planning**

```bash
git add src/features/profile/learningPlanner.ts src/features/profile/learningPlanner.test.ts src/features/knowledge/courseCatalog.ts
git commit -m "feat: plan from real course content"
```

---

### Task 3: Child-safe DeepSeek schedule endpoint

**Files:**
- Create: `server/schedulePolicy.mjs`
- Create: `server/schedulePolicy.test.mjs`
- Modify: `server/ai-proxy.mjs`
- Modify: `server/ai-proxy.test.mjs`
- Modify: `server/.env.example`

**Interfaces:**
- Consumes: `POST /api/companion/schedule` body with `grade`, `availability`, `catalog`, `progress`, `currentTasks`, and `wrongQuestionSummaries`.
- Produces: `{ tasks: SuggestedTask[], weekSummary: string, reasons: Record<string, string> }` after server-side validation.

- [ ] **Step 1: Write failing policy and route tests**

```js
test('builds a child-safe structured schedule prompt without account secrets', () => {
  const payload = buildSchedulePayload(validRequest)
  assert.equal(payload.model, 'deepseek-flash')
  assert.match(payload.messages[0].content, /只可使用课程清单中的 ID/)
  assert.doesNotMatch(JSON.stringify(payload), /phone|password|guardian/i)
})

test('drops hallucinated parts, over-capacity tasks, and dates after day seven', () => {
  const result = validateScheduleResponse(providerResponse, validRequest)
  assert.deepEqual(result.tasks.map((task) => task.partId), ['ael-4'])
})

test('returns 503 for a missing key without exposing key details', async () => {
  const result = await handleCompanionApiRequest(request, { apiKey: '' })
  assert.equal(result.status, 503)
  assert.deepEqual(result.body, { error: 'missing_api_key' })
})
```

- [ ] **Step 2: Run server tests and verify they fail**

Run: `npm run test:server`

Expected: FAIL because the schedule policy and route do not exist.

- [ ] **Step 3: Implement strict request normalization and prompt construction**

```js
export function buildSchedulePayload(request, model = process.env.DEEPSEEK_MODEL || 'deepseek-flash') {
  return {
    model,
    response_format: { type: 'json_object' },
    temperature: 0.3,
    messages: [
      { role: 'system', content: CHILD_SCHEDULE_RULES },
      { role: 'user', content: JSON.stringify(toMinimalScheduleContext(request)) },
    ],
  }
}
```

Limit the request to seven days, 60 catalog entries, 80 current tasks, and short plain-text summaries. The system prompt forbids invented IDs, pressure language, comparative judgment, rewards, medical advice, and changes outside the schedule.

- [ ] **Step 4: Implement response parsing and validation**

Accept plain JSON or fenced JSON. Validate each task against a map keyed by `(partId, kind)`, clamp neither dates nor IDs, and drop invalid entries instead. Enforce daily time windows and capacity, knowledge-before-test ordering, unique IDs generated server-side, and a 120-character maximum for each reason/summary.

- [ ] **Step 5: Add the route to `ai-proxy.mjs`**

```js
if (path === '/api/companion/schedule') {
  const request = normalizeScheduleRequest(body)
  const upstream = await proxyJsonRequest({
    url: 'https://api.deepseek.com/chat/completions',
    apiKey,
    body: buildSchedulePayload(request),
    fetchImpl,
  })
  return { status: 200, body: validateScheduleResponse(upstream, request) }
}
```

Map invalid input to 400, missing key to 503, invalid provider output to 502, and never include upstream bodies or credentials in errors.

- [ ] **Step 6: Run all server tests and commit**

Run: `npm run test:server`

Expected: PASS.

```bash
git add server/schedulePolicy.mjs server/schedulePolicy.test.mjs server/ai-proxy.mjs server/ai-proxy.test.mjs server/.env.example
git commit -m "feat: add safe AI schedule endpoint"
```

---

### Task 4: AppState plan actions and selectors

**Files:**
- Modify: `src/app/AppState.tsx`
- Create: `src/app/learningPlanState.actions.test.tsx`

**Interfaces:**
- Consumes: normalized `LearningPlanState` from Task 1.
- Produces: `replaceLearningPlan(tasks, source)`, `upsertPlanTask(task)`, `removePlanTask(id)`, `reorderPlanTasks(date, ids)`, and `setPlanAvailability(days)` on `useAppState()`.

- [ ] **Step 1: Write failing action and account-isolation tests**

```tsx
await user.click(screen.getByRole('button', { name: '添加真实任务' }))
expect(loadAccountState('chenxi_2026').learningPlan.tasks).toContainEqual(expect.objectContaining({ partId: 'ael-4' }))

await user.click(screen.getByRole('button', { name: '采用 AI 预览' }))
expect(screen.getByLabelText('正式计划')).toHaveTextContent('ael-5')

expect(loadAccountState('other_student').learningPlan.tasks).not.toContainEqual(expect.objectContaining({ partId: 'ael-5' }))
```

- [ ] **Step 2: Run the action tests and verify they fail**

Run: `npm test -- --run src/app/learningPlanState.actions.test.tsx`

Expected: FAIL because plan actions are unavailable.

- [ ] **Step 3: Implement reducer actions with normalization at the boundary**

```ts
| { type: 'replace-learning-plan'; tasks: LearningPlanTask[]; source: 'student' | 'ai' | 'fallback' }
| { type: 'upsert-plan-task'; task: LearningPlanTask }
| { type: 'remove-plan-task'; id: string }
| { type: 'reorder-plan-tasks'; date: string; ids: string[] }
| { type: 'set-plan-availability'; availability: DailyAvailability[] }
```

Replacing a plan only replaces tasks inside the active seven-day window; it preserves completed history outside the window. All actions return new arrays, preserve the active account, and let the existing `saveAccountState` effect persist changes.

- [ ] **Step 4: Run action, storage, and reward tests**

Run: `npm test -- --run src/app/learningPlanState.actions.test.tsx src/app/storage.test.ts src/app/points.test.ts src/app/learningState.actions.test.tsx`

Expected: PASS, including unchanged one-time reward behavior.

- [ ] **Step 5: Commit the state API**

```bash
git add src/app/AppState.tsx src/app/learningPlanState.actions.test.tsx
git commit -m "feat: manage editable learning plans"
```

---

### Task 5: Seven-day manual planning interface

**Files:**
- Create: `src/features/profile/LearningContentPicker.tsx`
- Create: `src/features/profile/LearningContentPicker.test.tsx`
- Modify: `src/features/profile/LearningSchedulePage.tsx`
- Create: `src/features/profile/LearningSchedulePage.test.tsx`
- Modify: `src/features/profile/profile.css`

**Interfaces:**
- Consumes: plan candidates from Task 2 and plan actions from Task 4.
- Produces: `LearningSchedulePage({ onBack, onStartTask })`, where `onStartTask(task)` performs exact navigation later in Task 7.

- [ ] **Step 1: Write failing content-picker and editor tests**

```tsx
expect(screen.getByRole('button', { name: '知识' })).toBeInTheDocument()
expect(screen.getByText('AI 系统拆解站')).toBeInTheDocument()
expect(screen.queryByText('启明星岛')).not.toBeInTheDocument()

await user.click(screen.getByRole('button', { name: '添加学习内容' }))
await user.click(screen.getByRole('button', { name: /AI 系统拆解站/ }))
await user.selectOptions(screen.getByLabelText('日期'), tomorrowKey)
await user.clear(screen.getByLabelText('预计时长'))
await user.type(screen.getByLabelText('预计时长'), '20')
await user.click(screen.getByRole('button', { name: '保存安排' }))
expect(screen.getByText('预计 20 分钟')).toBeInTheDocument()
```

- [ ] **Step 2: Run component tests and verify they fail**

Run: `npm test -- --run src/features/profile/LearningContentPicker.test.tsx src/features/profile/LearningSchedulePage.test.tsx`

Expected: FAIL because the real-content editor is absent.

- [ ] **Step 3: Build the seven-day strip and day-grouped list**

Replace `PLAN_TASKS` rendering with `state.learningPlan.tasks` filtered to the next seven days and active grade. Render each card with knowledge/test badge, review badge, title, date, time, duration, completion/overdue state, edit/delete controls, and keyboard-accessible move-up/move-down controls alongside drag handles.

- [ ] **Step 4: Build the real-content picker and task editor**

The picker uses `getPlanCandidates` and has “知识/测试” tabs. Disabled locked tests show “先学知识” and remain selectable only as a plan that redirects to knowledge. The editor validates a seven-day date, `HH:mm`, and 5—90 minutes before `upsertPlanTask`.

- [ ] **Step 5: Add delete, reorder, and empty states**

Deletion uses a lightweight confirmation inside the card. Empty days say “今天还没有安排，可以留作休息，也可以添加一项。” Reordering updates only tasks for the selected date and preserves chronological display after reload.

- [ ] **Step 6: Run editor tests and commit**

Run: `npm test -- --run src/features/profile/LearningContentPicker.test.tsx src/features/profile/LearningSchedulePage.test.tsx`

Expected: PASS.

```bash
git add src/features/profile/LearningContentPicker.tsx src/features/profile/LearningContentPicker.test.tsx src/features/profile/LearningSchedulePage.tsx src/features/profile/LearningSchedulePage.test.tsx src/features/profile/profile.css
git commit -m "feat: let students edit seven-day plans"
```

---

### Task 6: AI availability, preview, confirmation, and fallback flow

**Files:**
- Create: `src/features/profile/scheduleApi.ts`
- Create: `src/features/profile/scheduleApi.test.ts`
- Create: `src/features/profile/AiSchedulePanel.tsx`
- Create: `src/features/profile/AiSchedulePanel.test.tsx`
- Modify: `src/features/profile/LearningSchedulePage.tsx`
- Modify: `src/features/profile/profile.css`

**Interfaces:**
- Consumes: `requestScheduleSuggestion(request, signal)`, Task 2 fallback planner, and Task 4 plan actions.
- Produces: temporary editable AI suggestion state and a single confirmed `replaceLearningPlan` call.

- [ ] **Step 1: Write failing API and confirmation tests**

```ts
expect(fetch).toHaveBeenCalledWith('/api/companion/schedule', expect.objectContaining({ method: 'POST' }))

await user.click(screen.getByRole('button', { name: '生成 7 天建议' }))
expect(await screen.findByText('安排预览')).toBeInTheDocument()
expect(screen.getByLabelText('正式计划')).not.toHaveTextContent('AI 建议任务')

await user.click(screen.getByRole('button', { name: '确认采用' }))
expect(screen.getByLabelText('正式计划')).toHaveTextContent('AI 建议任务')
```

- [ ] **Step 2: Run AI panel tests and verify they fail**

Run: `npm test -- --run src/features/profile/scheduleApi.test.ts src/features/profile/AiSchedulePanel.test.tsx`

Expected: FAIL because API client and panel do not exist.

- [ ] **Step 3: Implement the client request without secrets**

```ts
export async function requestScheduleSuggestion(request: ScheduleSuggestionRequest, signal?: AbortSignal) {
  const response = await fetch('/api/companion/schedule', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(request),
    signal,
  })
  if (!response.ok) throw new ScheduleSuggestionError(response.status)
  return parseScheduleSuggestion(await response.json())
}
```

Do not import environment variables into client code. Abort an in-flight request on panel close/unmount.

- [ ] **Step 4: Build daily availability controls**

Render seven rows containing enabled checkbox, start/end time, and maximum minutes. Validate `startTime < endTime`, 5—180 daily minutes, and at least one enabled day before enabling “生成 7 天建议”. Save availability through AppState.

- [ ] **Step 5: Build editable proposal preview and explicit confirmation**

Keep suggestions in component state. Show per-day tasks, reasons, weekly summary, total minutes, edit/delete/reorder actions, “取消” and “确认采用”. Only the confirm handler calls `replaceLearningPlan(previewTasks, 'ai')`.

- [ ] **Step 6: Add the deterministic fallback path**

On 503/502/network/invalid response, call `buildFallbackPlan` with the same catalog and availability, display “AI 暂时没连上，先给你一份可以继续修改的基础安排”, and mark preview tasks with `source: 'fallback'`. An empty fallback leaves the saved plan unchanged and returns to availability editing.

- [ ] **Step 7: Run AI UI tests and commit**

Run: `npm test -- --run src/features/profile/scheduleApi.test.ts src/features/profile/AiSchedulePanel.test.tsx src/features/profile/LearningSchedulePage.test.tsx`

Expected: PASS.

```bash
git add src/features/profile/scheduleApi.ts src/features/profile/scheduleApi.test.ts src/features/profile/AiSchedulePanel.tsx src/features/profile/AiSchedulePanel.test.tsx src/features/profile/LearningSchedulePage.tsx src/features/profile/profile.css
git commit -m "feat: preview and confirm AI study plans"
```

---

### Task 7: Growth card, calendar, and exact learning navigation

**Files:**
- Modify: `src/features/profile/plan.ts`
- Modify: `src/features/profile/GrowthSection.tsx`
- Modify: `src/features/profile/CalendarPage.tsx`
- Modify: `src/features/profile/ProfilePage.tsx`
- Modify: `src/features/profile/ProfilePage.test.tsx`
- Modify: `src/features/shell/MainShell.tsx`
- Modify: `src/features/shell/MainShell.test.tsx`
- Modify: `src/features/test/TestPage.tsx`
- Modify: `src/features/test/TestPage.test.tsx`
- Modify: `src/features/profile/profile.css`

**Interfaces:**
- Consumes: real plan selectors, `getTaskCompletion`, `getTaskTiming`, course catalog, and current navigation stack.
- Produces: exact `onStartTask(task)` navigation to a knowledge chapter or test intro; `TestPage({ initialPartId })` opens/focuses a requested test.

- [ ] **Step 1: Write failing card, calendar, and navigation tests**

```tsx
expect(screen.getByRole('heading', { name: 'AI 系统拆解站' })).toBeInTheDocument()
expect(screen.queryByText('图片识别小探索')).not.toBeInTheDocument()

await user.click(screen.getByRole('button', { name: '开始学习' }))
expect(screen.getByText('第4章 · AI 系统拆解站')).toBeInTheDocument()

await user.click(screen.getByRole('button', { name: /开始.*测试/ }))
expect(screen.getByRole('dialog', { name: /挑战介绍/ })).toBeInTheDocument()
```

- [ ] **Step 2: Run focused UI tests and verify they fail**

Run: `npm test -- --run src/features/profile/ProfilePage.test.tsx src/features/shell/MainShell.test.tsx src/features/test/TestPage.test.tsx`

Expected: FAIL because the card is static and exact schedule navigation is absent.

- [ ] **Step 3: Replace static plan selectors**

Refactor `plan.ts` into pure date/selection helpers over supplied plan state: `tasksForDate(tasks, date)`, `getNextPlanTask(tasks, progress, now)`, and `getPlanTaskView(task, progress, now)`. Remove exported `PLAN_TASKS` and static suggestion constants.

- [ ] **Step 4: Render the next real task and real month calendar**

`GrowthSection` reads the closest pending/overdue active-grade task, shows type/review/status badges and live counts, and opens `AiSchedulePanel` through the schedule page rather than a static modal. `CalendarPage` reads account tasks and renders live completion/overdue states.

- [ ] **Step 5: Add exact navigation in the shell and test page**

```ts
function startPlanTask(task: LearningPlanTask) {
  const course = getCourseForBand(getGradeBand(task.grade))
  const part = course.parts.find((candidate) => candidate.id === task.partId)
  if (!part) return
  if (task.kind === 'knowledge' || !isTestUnlocked(state.learningProgress[course.band], task.partId)) {
    openKnowledgeContent(course.id, part.number)
  } else {
    setActiveTab('test')
    setStack([{ kind: 'test-part', id: nextIdRef.current++, partId: task.partId }])
  }
}
```

Add the `test-part` view and `initialPartId` prop. On mount, `TestPage` scrolls to the requested node and opens its challenge intro only when unlocked. Locked requests show a message and route to knowledge from the schedule start handler.

- [ ] **Step 6: Run profile, shell, knowledge, test, reward, and calendar tests**

Run: `npm test -- --run src/features/profile/ProfilePage.test.tsx src/features/shell/MainShell.test.tsx src/features/test/TestPage.test.tsx src/app/learningState.actions.test.tsx src/app/points.test.ts`

Expected: PASS, with rewards still issued exactly once.

- [ ] **Step 7: Commit end-to-end plan rendering and navigation**

```bash
git add src/features/profile/plan.ts src/features/profile/GrowthSection.tsx src/features/profile/CalendarPage.tsx src/features/profile/ProfilePage.tsx src/features/profile/ProfilePage.test.tsx src/features/shell/MainShell.tsx src/features/shell/MainShell.test.tsx src/features/test/TestPage.tsx src/features/test/TestPage.test.tsx src/features/profile/profile.css
git commit -m "feat: connect plans to learning progress"
```

---

### Task 8: Accessibility, regression verification, and publish-ready cleanup

**Files:**
- Modify: tests or source files only when a failure identifies a concrete defect
- Review: `src/features/profile/profile.css`
- Review: `docs/superpowers/specs/2026-10-25-learning-plan-ai-design.md`

**Interfaces:**
- Consumes: all deliverables from Tasks 1—7.
- Produces: a verified, clean branch with no generated or secret files staged.

- [ ] **Step 1: Run the complete automated suite**

Run: `npm run test:all`

Expected: all frontend, server, script, Python, and embedded-game tests pass. Existing jsdom “not implemented” console notices are acceptable only when the process exits 0.

- [ ] **Step 2: Run the production build**

Run: `npm run build`

Expected: exit 0 for the main app and both embedded games. Bundle-size warnings are recorded but do not fail this feature.

- [ ] **Step 3: Perform focused manual checks in all grade bands**

Start with `node server/dev.mjs --host 127.0.0.1 --port 5175 --strictPort`, then verify for grades 1, 3, and 5:

1. Growth card names a real course item from the matching band.
2. Manual picker never shows another band's content.
3. A completed item can be scheduled as review.
4. AI suggestions stay in preview until confirmation.
5. Knowledge and unlocked tests open at the exact part.
6. Completion updates the plan and the existing point/medal UI once.
7. An overdue item shows “待调整” and remains unchanged until confirmation.
8. The month calendar and seven-day page show the same tasks.

- [ ] **Step 4: Verify accessibility and reduced-motion behavior**

Use keyboard-only navigation through date tabs, picker, task editor, availability form, preview editing, confirmation, and calendar. Confirm every icon-only control has an accessible name, dialogs trap/restore focus, status messages use `role="status"`, and plan reordering has move buttons in addition to drag.

- [ ] **Step 5: Verify Git hygiene and secret boundaries**

Run:

```bash
git status --short
git diff --check
git ls-files | rg '(^|/)\.env($|\.)'
rg -l --hidden --glob '!node_modules/**' --glob '!dist/**' --glob '!.git/**' 'sk-[A-Za-z0-9_-]{12,}' .
```

Expected: only `server/.env.example` may be tracked; no real key, build output, database, or log is staged.

- [ ] **Step 6: Commit any verification-only fixes**

If Steps 1—5 required source or test corrections, stage only those reviewed files and commit:

```bash
git commit -m "fix: finish learning plan verification"
```

If no corrections were required, do not create an empty commit.
