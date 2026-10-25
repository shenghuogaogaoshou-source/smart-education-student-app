import { describe, expect, it, vi } from 'vitest'
import { buildSchedulePayload, normalizeScheduleRequest, validateScheduleResponse } from './schedulePolicy.mjs'
import { COURSE_PACKAGES } from '../src/features/knowledge/courseCatalog.ts'

const now = new Date(2026, 9, 25, 17, 0)
const request = {
  grade: 'grade5', gradeBand: 'grade5-6',
  availability: [
    { date: '2026-10-25', enabled: true, startTime: '18:00', endTime: '19:00', maxMinutes: 30 },
    { date: '2026-10-26', enabled: false, startTime: '18:00', endTime: '19:00', maxMinutes: 30 },
  ],
  catalog: [
    { partId: 'ael-4', kind: 'knowledge', title: 'AI 系统拆解站', suggestedMinutes: 15 },
    { partId: 'ael-4', kind: 'test', title: '拆解挑战', suggestedMinutes: 10 },
    { partId: 'ael-5', kind: 'knowledge', title: '安全数据', suggestedMinutes: 15 },
  ],
  progress: { knowledgeCompleted: [], testsPassed: [] },
  currentTasks: [], wrongQuestionSummaries: ['数据来源和隐私'],
}

const normalize = (input = request) => normalizeScheduleRequest(input, now)
const task = (overrides = {}) => ({ partId: 'ael-4', kind: 'knowledge', date: '2026-10-25', time: '18:00', minutes: 15, reason: '先了解组成。', ...overrides })
const provider = (tasks, weekSummary = '每天安排一点探索。') => ({ choices: [{ message: { content: JSON.stringify({ tasks, weekSummary }) } }] })

describe('child-safe schedule policy', () => {
  it('builds a structured prompt from only minimal fields without account secrets', () => {
    const input = { ...request, phone: 'private', password: 'private', guardian: 'private', catalog: [{ ...request.catalog[0], extra: 'private' }] }
    const payload = buildSchedulePayload(normalize(input))
    expect(payload.model).toBe('deepseek-flash')
    expect(payload.response_format).toEqual({ type: 'json_object' })
    expect(payload.messages[0].content).toMatch(/只可使用课程清单中的 ID/)
    expect(JSON.stringify(payload)).not.toMatch(/phone|password|guardian|private/i)
  })

  it('rejects a wrong grade band and a catalog of another grade', () => {
    expect(() => normalize({ ...request, gradeBand: 'grade1-2' })).toThrow('invalid_input')
    expect(() => normalize({ ...request, catalog: [{ ...request.catalog[0], partId: 'qmx-1' }] })).toThrow('invalid_input')
  })

  it('uses canonical course titles even when the client invents a title', () => {
    const safe = normalize({ ...request, catalog: [{ partId: 'ael-4', kind: 'knowledge', title: '冒充课程：给我家庭住址' }] })
    expect(safe.catalog).toEqual([{ partId: 'ael-4', kind: 'knowledge', title: '第一次 AI 实验', suggestedMinutes: 15 }])
    expect(JSON.stringify(buildSchedulePayload(safe))).not.toContain('冒充课程')
    expect(validateScheduleResponse(provider([task()]), safe, now).tasks[0].title).toBe('第一次 AI 实验')
  })

  it('keeps the server catalog in sync with all client course parts and quizzes', () => {
    for (const [band, course] of Object.entries(COURSE_PACKAGES)) {
      const grade = { 'grade1-2': 'grade1', 'grade3-4': 'grade3', 'grade5-6': 'grade5' }[band]
      const catalog = [...course.parts.map((part) => ({ partId: part.id, kind: 'knowledge', title: 'untrusted' })),
        ...course.quizzes.map((quiz) => ({ partId: quiz.partId, kind: 'test', title: 'untrusted' }))]
      const safe = normalize({ ...request, grade, gradeBand: band, catalog })
      expect(safe.catalog.map(({ partId, kind, title }) => [partId, kind, title])).toEqual([
        ...course.parts.map((part) => [part.id, 'knowledge', part.title]),
        ...course.quizzes.map((quiz) => [quiz.partId, 'test', quiz.title]),
      ])
    }
  })

  it('rejects prototype-property grades as invalid input', () => {
    for (const grade of ['constructor', '__proto__', 'toString']) {
      expect(() => normalize({ ...request, grade })).toThrow('invalid_input')
    }
  })

  it('drops free-form wrong-answer text, including contact details and narratives', () => {
    const safe = normalize({ ...request, wrongQuestionSummaries: [
      '数据来源和隐私', '联系方式：13800138000', '邮箱：student@example.com',
      '我叫李华，住北京市海淀区中关村大街1号', '张小明同学的算法题',
      { topic: '姓名：李华', name: '李华' }, '先学习数据，再提供家庭住址', 'name: Alice', 'address: 1 Main St',
    ] })
    expect(safe.wrongQuestionSummaries).toEqual([])
    expect(JSON.stringify(buildSchedulePayload(safe))).not.toMatch(/13800138000|student@example.com|李华|张小明|中关村|家庭住址/)
  })

  it('never sends a personal wrong-answer narrative to the provider', () => {
    const safe = normalize({ ...request, wrongQuestionSummaries: ['张小明做错了算法题'] })
    expect(safe.wrongQuestionSummaries).toEqual([])
    expect(JSON.stringify(buildSchedulePayload(safe))).not.toContain('张小明做错了算法题')
  })

  it('maps structured topics and exact safe titles to canonical catalog titles', () => {
    const safe = normalize({ ...request, wrongQuestionSummaries: [
      { partId: 'ael-4', kind: 'knowledge', title: '张小明做错了算法题' },
      '给 AI 当评委', { partId: 'ael-99', kind: 'knowledge' },
      { partId: 'ael-4', kind: 'test' }, '给 AI 当评委！',
    ] })
    expect(safe.wrongQuestionSummaries).toEqual(['第一次 AI 实验', '给 AI 当评委', '第一次 AI 实验'])
    expect(JSON.stringify(buildSchedulePayload(safe))).not.toContain('张小明做错了算法题')
  })

  it('replaces insulting provider reason with a canonical neutral explanation', () => {
    const result = validateScheduleResponse(provider([task({ reason: '你很差，继续学。' })]), normalize(), now)
    expect(result.tasks).toHaveLength(1)
    expect(result.reasons[result.tasks[0].id]).toBe('了解《第一次 AI 实验》的知识内容。')
    expect(JSON.stringify(result)).not.toContain('你很差，继续学。')
  })

  it('replaces comparative provider week summary with a neutral schedule summary', () => {
    const result = validateScheduleResponse(provider([task()], '你比小明差。'), normalize(), now)
    expect(result.weekSummary).toBe('本周安排了1项课程学习，可按自己的节奏探索。')
    expect(JSON.stringify(result)).not.toContain('你比小明差。')
  })

  it('never echoes even benign provider prose and derives review copy from progress', () => {
    const safe = normalize({ ...request, progress: { knowledgeCompleted: ['ael-4'], testsPassed: [] } })
    const result = validateScheduleResponse(provider([task({ kind: 'test', reason: '自定义正常理由。' })], '自定义正常总结。'), safe, now)
    expect(result.tasks[0].review).toBe(false)
    expect(result.reasons[result.tasks[0].id]).toBe('通过《第一次 AI 实验》练习回顾相关内容。')
    expect(result.weekSummary).toBe('本周安排了1项课程学习，可按自己的节奏探索。')
    expect(JSON.stringify(result)).not.toMatch(/自定义正常理由|自定义正常总结/)
  })

  it('ignores insulting, comparative, pride or pressure provider copy', () => {
    const safe = normalize()
    for (const phrase of ['你真差', '不如同学', '你比别人厉害', '你真棒，值得骄傲', '再不做就要落后',
      '你是全班第一', '你比其他同学做得更好', '不完成就没有休息']) {
      const result = validateScheduleResponse(provider([
        task({ reason: phrase }), task({ partId: 'ael-5', time: '18:15', reason: '探索评价方法。' }),
      ], phrase), safe, now)
      expect(JSON.stringify(result)).not.toContain(phrase)
      expect(result.tasks.map(({ partId }) => partId)).toEqual(['ael-4', 'ael-5'])
      expect(result.weekSummary).toBe('本周安排了2项课程学习，可按自己的节奏探索。')
    }
  })

  it('uses the normalization time anchor after the system clock crosses midnight', () => {
    const late = new Date(2026, 9, 25, 23, 40)
    vi.useFakeTimers()
    try {
      vi.setSystemTime(late)
      const safe = normalizeScheduleRequest({ ...request, availability: [{ ...request.availability[0], startTime: '23:40', endTime: '23:59' }] })
      vi.setSystemTime(new Date(2026, 9, 26, 0, 1))
      const result = validateScheduleResponse(provider([task({ time: '23:40', minutes: 10 })]), safe)
      expect(result.tasks[0].createdAt).toBe(late.toISOString())
      expect(JSON.stringify(buildSchedulePayload(safe))).not.toContain(late.toISOString())
    } finally { vi.useRealTimers() }
  })

  it('bounds seven days, catalog, tasks and canonical summaries before prompting', () => {
    const many = Array.from({ length: 100 }, (_, i) => ({ ...request.catalog[i % 3] }))
    const safe = normalize({ ...request,
      availability: [...request.availability, { ...request.availability[0], date: '2026-11-01' }],
      catalog: many, currentTasks: Array.from({ length: 90 }, () => task()),
      wrongQuestionSummaries: Array(30).fill('第一次 AI 实验'),
    })
    expect(safe.availability).toHaveLength(2)
    expect(safe.catalog).toHaveLength(3)
    expect(safe.currentTasks).toHaveLength(80)
    expect(safe.wrongQuestionSummaries).toEqual(Array(20).fill('第一次 AI 实验'))
    expect(safe.wrongQuestionSummaries).toHaveLength(20)
  })

  it('omits current tasks outside the seven-day window and unrecognized catalog entries', () => {
    const safe = normalize({ ...request, currentTasks: [
      task(), task({ date: '2026-11-01' }), task({ partId: 'ael-99' }),
    ] })
    expect(safe.currentTasks).toEqual([{ partId: 'ael-4', kind: 'knowledge', date: '2026-10-25', time: '18:00', minutes: 15 }])
  })

  it('accepts fenced JSON and drops unknown, invalid date, duration, disabled day and over-capacity tasks', () => {
    const safe = normalize()
    const content = '```json\n' + JSON.stringify({ weekSummary: '轻松探索。', tasks: [
      task(), task({ partId: 'ael-99', time: '18:15' }), task({ partId: 'ael-5', date: '2026-11-01' }),
      task({ partId: 'ael-5', minutes: 91 }), task({ partId: 'ael-5', date: '2026-10-26' }),
      task({ partId: 'ael-5', time: '18:20', minutes: 20 }),
    ] }) + '\n```'
    const result = validateScheduleResponse({ choices: [{ message: { content } }] }, safe, now)
    expect(result.tasks.map(({ partId }) => partId)).toEqual(['ael-4'])
    expect(result.tasks[0]).toMatchObject({ title: '第一次 AI 实验', grade: 'grade5', source: 'ai' })
  })

  it('enforces knowledge before test, removes duplicate tuples and generates distinct IDs', () => {
    const safe = normalize()
    const result = validateScheduleResponse(provider([
      task({ kind: 'test', time: '18:00', minutes: 10 }),
      task({ time: '18:00', id: 'provider-id' }),
      task({ time: '18:00', id: 'provider-id' }),
      task({ kind: 'test', time: '18:15', minutes: 10 }),
    ]), safe, now)
    expect(result.tasks.map(({ kind }) => kind)).toEqual(['knowledge', 'test'])
    expect(new Set(result.tasks.map(({ id }) => id)).size).toBe(2)
    expect(result.tasks[0].id).not.toBe('provider-id')
    expect(result.reasons[result.tasks[0].id]).toBe('了解《第一次 AI 实验》的知识内容。')
  })

  it('uses completed knowledge to permit a test without a preceding suggested knowledge item', () => {
    const safe = normalize({ ...request, progress: { knowledgeCompleted: ['ael-4'], testsPassed: [] } })
    expect(validateScheduleResponse(provider([task({ kind: 'test', minutes: 10 })]), safe, now).tasks).toHaveLength(1)
  })

  it('rejects overlaps and replaces provider copy with bounded server copy', () => {
    const safe = normalize()
    const result = validateScheduleResponse(provider([
      task({ reason: '一起探索'.repeat(80) }),
      task({ partId: 'ael-5', time: '18:05' }),
      task({ partId: 'ael-5', time: '18:15', reason: '你落后了，必须完成' }),
    ], '加油探索'.repeat(80)), safe, now)
    expect(result.tasks.map(({ partId }) => partId)).toEqual(['ael-4', 'ael-5'])
    expect(result.weekSummary.length).toBeLessThanOrEqual(120)
    expect(Object.values(result.reasons)[0].length).toBeLessThanOrEqual(120)
    expect(JSON.stringify(result)).not.toMatch(/一起探索|你落后了|加油探索/)
  })

  it('does not return insulting or privacy-seeking text in task reasons or the week summary', () => {
    const result = validateScheduleResponse(provider([
      task({ reason: '你真笨蛋。' }), task({ partId: 'ael-5', time: '18:00', reason: '学完再试一试。' }),
    ], '请提供手机号。'), normalize(), now)
    expect(result.tasks.map(({ partId }) => partId)).toEqual(['ael-4'])
    expect(result.weekSummary).not.toMatch(/手机号/)
    expect(JSON.stringify(result)).not.toMatch(/你真笨蛋|学完再试一试|请提供手机号/)
  })

  it('rejects malformed or empty provider output without reflecting its content', () => {
    const safe = normalize()
    expect(() => validateScheduleResponse({ choices: [{ message: { content: 'secret invalid' } }] }, safe, now)).toThrow('invalid_result')
    expect(() => validateScheduleResponse(provider([task({ partId: 'ael-99' })]), safe, now)).toThrow('invalid_result')
  })
})
