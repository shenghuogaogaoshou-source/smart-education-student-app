import { randomUUID } from 'node:crypto'
import { COURSE_TITLES } from './learningCatalog.mjs'

const BAND_BY_GRADE = {
  grade1: 'grade1-2', grade2: 'grade1-2',
  grade3: 'grade3-4', grade4: 'grade3-4',
  grade5: 'grade5-6', grade6: 'grade5-6',
}
const REQUEST_TIME = Symbol('scheduleRequestTime')
const VALID_TIME = /^([01]\d|2[0-3]):[0-5]\d$/
const VALID_DATE = /^\d{4}-\d{2}-\d{2}$/

export const CHILD_SCHEDULE_RULES = '你是面向小学生的学习安排助手。只可使用课程清单中的 ID 与 kind，不得发明课程或测试。仅安排提供的未来七天及启用的时段，遵守每日分钟上限；未完成知识必须在相应测试之前。只返回 JSON 对象，格式为 {"tasks":[{"partId":"...","kind":"knowledge|test","date":"YYYY-MM-DD","time":"HH:mm","minutes":15,"reason":"..."}],"weekSummary":"..."}。表达简短、温和、具体，不使用压力语言、比较评价、奖励承诺或医疗建议，不做排课以外的改变。'

function invalidInput() { throw new Error('invalid_input') }
function isRecord(value) { return value !== null && typeof value === 'object' && !Array.isArray(value) }
function dateKey(date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}` }
function timeMinutes(time) { return Number(time.slice(0, 2)) * 60 + Number(time.slice(3)) }
function partIsReal(id, band) { return typeof id === 'string' && Object.hasOwn(COURSE_TITLES[band], id) }
function canonicalTopic(value, catalog) {
  // The provider sees only server-owned course titles, never client-authored prose.
  if (typeof value === 'string') return catalog.find((item) => item.title === value)?.title ?? ''
  if (!isRecord(value)) return ''
  return catalog.find((item) => item.partId === value.partId && item.kind === value.kind)?.title ?? ''
}
function taskReason(item, review) {
  if (review) return `回顾《${item.title}》的相关内容。`
  return item.kind === 'knowledge' ? `了解《${item.title}》的知识内容。` : `通过《${item.title}》练习回顾相关内容。`
}
function minimalTask(value, catalog) {
  if (!isRecord(value) || !VALID_DATE.test(value.date) || !VALID_TIME.test(value.time)
    || !Number.isInteger(value.minutes) || value.minutes < 5 || value.minutes > 90) return null
  const item = catalog.find((candidate) => candidate.partId === value.partId && candidate.kind === value.kind)
  if (!item) return null
  return { partId: item.partId, kind: item.kind, date: value.date, time: value.time, minutes: value.minutes }
}

export function normalizeScheduleRequest(input, now = new Date()) {
  if (!isRecord(input) || typeof input.grade !== 'string' || !Object.hasOwn(BAND_BY_GRADE, input.grade) || !Array.isArray(input.availability)
    || !Array.isArray(input.catalog) || !input.catalog.length || !isRecord(input.progress)) invalidInput()
  const band = BAND_BY_GRADE[input.grade]
  if (input.gradeBand !== undefined && input.gradeBand !== band) invalidInput()
  const dates = new Set(Array.from({ length: 7 }, (_, i) => dateKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() + i))))
  const seenDates = new Set()
  const availability = input.availability.filter((day) => {
    if (!isRecord(day) || !dates.has(day.date) || seenDates.has(day.date)) return false
    if (typeof day.enabled !== 'boolean' || !VALID_TIME.test(day.startTime) || !VALID_TIME.test(day.endTime)
      || day.startTime >= day.endTime || !Number.isInteger(day.maxMinutes)
      || day.maxMinutes < 5 || day.maxMinutes > 180) return false
    seenDates.add(day.date)
    return true
  }).slice(0, 7).map((day) => ({ date: day.date, enabled: day.enabled, startTime: day.startTime, endTime: day.endTime, maxMinutes: day.maxMinutes }))
    .sort((a, b) => a.date.localeCompare(b.date))
  const seenCatalog = new Set()
  const catalog = []
  for (const item of input.catalog.slice(0, 120)) {
    if (!isRecord(item) || !partIsReal(item.partId, band) || !['knowledge', 'test'].includes(item.kind)) invalidInput()
    const key = `${item.partId}:${item.kind}`
    if (seenCatalog.has(key)) continue
    seenCatalog.add(key)
    const title = COURSE_TITLES[band][item.partId][item.kind === 'knowledge' ? 0 : 1]
    catalog.push({ partId: item.partId, kind: item.kind, title, suggestedMinutes: Number.isInteger(item.suggestedMinutes) && item.suggestedMinutes >= 5 && item.suggestedMinutes <= 90 ? item.suggestedMinutes : 15 })
    if (catalog.length === 60) break
  }
  if (!catalog.length || !availability.some((day) => day.enabled)) invalidInput()
  const progressValue = isRecord(input.progress[band]) ? input.progress[band] : input.progress
  const progress = {
    knowledgeCompleted: Array.isArray(progressValue.knowledgeCompleted) ? [...new Set(progressValue.knowledgeCompleted.filter((id) => partIsReal(id, band)))] : [],
    testsPassed: Array.isArray(progressValue.testsPassed) ? [...new Set(progressValue.testsPassed.filter((id) => partIsReal(id, band)))] : [],
  }
  const currentTasks = Array.isArray(input.currentTasks) ? input.currentTasks.slice(0, 80)
    .map((item) => minimalTask(item, catalog)).filter((item) => item && dates.has(item.date)) : []
  const wrongQuestionSummaries = Array.isArray(input.wrongQuestionSummaries)
    ? input.wrongQuestionSummaries.slice(0, 20).map((item) => canonicalTopic(item, catalog)).filter(Boolean) : []
  const schedule = { grade: input.grade, gradeBand: band, availability, catalog, progress, currentTasks, wrongQuestionSummaries }
  Object.defineProperty(schedule, REQUEST_TIME, { value: new Date(now.getTime()) })
  return schedule
}

export function buildSchedulePayload(request, model = process.env.DEEPSEEK_MODEL || 'deepseek-flash') {
  // Re-normalize even for direct callers; no arbitrary request properties reach the provider.
  const { grade, gradeBand, availability, catalog, progress, currentTasks, wrongQuestionSummaries } = request
  return {
    model, response_format: { type: 'json_object' }, temperature: 0.3,
    messages: [
      { role: 'system', content: CHILD_SCHEDULE_RULES },
      { role: 'user', content: JSON.stringify({ grade, gradeBand, availability, catalog, progress, currentTasks, wrongQuestionSummaries }) },
    ],
  }
}

export function validateScheduleResponse(provider, request, now = request[REQUEST_TIME] ?? new Date()) {
  let content = provider?.choices?.[0]?.message?.content
  if (typeof content !== 'string' || content.length > 64 * 1024) throw new Error('invalid_result')
  content = content.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  let parsed
  try { parsed = JSON.parse(content) } catch { throw new Error('invalid_result') }
  if (!isRecord(parsed) || !Array.isArray(parsed.tasks)) throw new Error('invalid_result')
  const catalog = new Map(request.catalog.map((item) => [`${item.partId}:${item.kind}`, item]))
  const available = new Map(request.availability.filter((day) => day.enabled).map((day) => [day.date, day]))
  const candidates = parsed.tasks.slice(0, 160).filter(isRecord).sort((a, b) =>
    `${a.date ?? ''} ${a.time ?? ''}`.localeCompare(`${b.date ?? ''} ${b.time ?? ''}`))
  const tasks = []
  const reasons = {}
  const seen = new Set()
  const used = new Map()
  const intervals = new Map()
  const scheduledKnowledge = new Map()
  for (const candidate of candidates) {
    const catalogItem = catalog.get(`${candidate.partId}:${candidate.kind}`)
    const day = available.get(candidate.date)
    if (!catalogItem || !day || !VALID_TIME.test(candidate.time) || !Number.isInteger(candidate.minutes)
      || candidate.minutes < 5 || candidate.minutes > 90) continue
    const start = timeMinutes(candidate.time)
    const end = start + candidate.minutes
    const key = `${candidate.date}:${candidate.partId}:${candidate.kind}`
    if (seen.has(key) || start < timeMinutes(day.startTime) || (candidate.date === dateKey(now) && start < now.getHours() * 60 + now.getMinutes())
      || end > timeMinutes(day.endTime) || (used.get(day.date) ?? 0) + candidate.minutes > day.maxMinutes
      || (intervals.get(day.date) ?? []).some(([from, to]) => start < to && end > from)) continue
    const moment = `${candidate.date} ${candidate.time}`
    if (candidate.kind === 'test' && !request.progress.knowledgeCompleted.includes(candidate.partId)
      && !(scheduledKnowledge.get(candidate.partId) < moment)) continue
    const id = `ai-${randomUUID()}`
    seen.add(key)
    used.set(day.date, (used.get(day.date) ?? 0) + candidate.minutes)
    intervals.set(day.date, [...(intervals.get(day.date) ?? []), [start, end]])
    if (candidate.kind === 'knowledge') scheduledKnowledge.set(candidate.partId, moment)
    const order = tasks.filter((item) => item.date === candidate.date).length
    const review = (candidate.kind === 'knowledge' ? request.progress.knowledgeCompleted : request.progress.testsPassed).includes(candidate.partId)
    tasks.push({ id, grade: request.grade, partId: catalogItem.partId, kind: catalogItem.kind, title: catalogItem.title,
      date: candidate.date, time: candidate.time, minutes: candidate.minutes, order, source: 'ai',
      review,
      createdAt: now.toISOString(), updatedAt: now.toISOString() })
    reasons[id] = taskReason(catalogItem, review)
  }
  if (!tasks.length) throw new Error('invalid_result')
  return { tasks, weekSummary: `本周安排了${tasks.length}项课程学习，可按自己的节奏探索。`, reasons }
}
