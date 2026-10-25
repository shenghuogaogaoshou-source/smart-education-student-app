import { describe, expect, it } from 'vitest'
import { buildSchedulePayload, normalizeScheduleRequest, validateScheduleResponse } from './schedulePolicy.mjs'

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

  it('bounds seven days, catalog, tasks and plain-text summaries before prompting', () => {
    const many = Array.from({ length: 100 }, (_, i) => ({ ...request.catalog[i % 3] }))
    const safe = normalize({ ...request,
      availability: [...request.availability, { ...request.availability[0], date: '2026-11-01' }],
      catalog: many, currentTasks: Array.from({ length: 90 }, () => task()),
      wrongQuestionSummaries: ['<script>private</script> 关键点', ...Array(30).fill('安全主题')],
    })
    expect(safe.availability).toHaveLength(2)
    expect(safe.catalog).toHaveLength(3)
    expect(safe.currentTasks).toHaveLength(80)
    expect(safe.wrongQuestionSummaries[0]).not.toMatch(/[<>]/)
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
    expect(result.tasks[0]).toMatchObject({ title: 'AI 系统拆解站', grade: 'grade5', source: 'ai' })
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
    expect(result.reasons[result.tasks[0].id]).toBe('先了解组成。')
  })

  it('uses completed knowledge to permit a test without a preceding suggested knowledge item', () => {
    const safe = normalize({ ...request, progress: { knowledgeCompleted: ['ael-4'], testsPassed: [] } })
    expect(validateScheduleResponse(provider([task({ kind: 'test', minutes: 10 })]), safe, now).tasks).toHaveLength(1)
  })

  it('rejects overlap and age-inappropriate provider copy, and caps summary/reasons', () => {
    const safe = normalize()
    const result = validateScheduleResponse(provider([
      task({ reason: '一起探索'.repeat(80) }),
      task({ partId: 'ael-5', time: '18:05' }),
      task({ partId: 'ael-5', time: '18:15', reason: '你落后了，必须完成' }),
    ], '加油探索'.repeat(80)), safe, now)
    expect(result.tasks.map(({ partId }) => partId)).toEqual(['ael-4'])
    expect(result.weekSummary.length).toBeLessThanOrEqual(120)
    expect(Object.values(result.reasons)[0].length).toBeLessThanOrEqual(120)
  })

  it('does not return insulting or privacy-seeking text in task reasons or the week summary', () => {
    const result = validateScheduleResponse(provider([
      task({ reason: '你真笨蛋。' }), task({ partId: 'ael-5', time: '18:00', reason: '学完再试一试。' }),
    ], '请提供手机号。'), normalize(), now)
    expect(result.tasks.map(({ partId }) => partId)).toEqual(['ael-5'])
    expect(result.weekSummary).not.toMatch(/手机号/)
  })

  it('rejects malformed or empty provider output without reflecting its content', () => {
    const safe = normalize()
    expect(() => validateScheduleResponse({ choices: [{ message: { content: 'secret invalid' } }] }, safe, now)).toThrow('invalid_result')
    expect(() => validateScheduleResponse(provider([task({ partId: 'ael-99' })]), safe, now)).toThrow('invalid_result')
  })
})
