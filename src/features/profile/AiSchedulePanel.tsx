import {
  CalendarClock,
  Check,
  ChevronDown,
  ChevronUp,
  Clock3,
  LoaderCircle,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { BandProgress, PrimaryGrade } from '../../app/learning'
import type { DailyAvailability, LearningPlanTask } from '../../app/learningPlan'
import type { CoursePackage } from '../knowledge/courseCatalog'
import { buildFallbackPlan, getPlanCandidates, validatePlanTasks } from './learningPlanner'
import {
  requestScheduleSuggestion,
  ScheduleSuggestionError,
  type ScheduleSuggestionRequest,
  type ScheduleSuggestionResult,
} from './scheduleApi'

type PreviewSource = 'ai' | 'fallback'

type PlanChange = {
  kind: 'added' | 'adjusted' | 'removed'
  label: string
}

export type AiSchedulePanelProps = {
  grade: PrimaryGrade
  course: CoursePackage
  progress: BandProgress
  availability: DailyAvailability[]
  currentTasks: LearningPlanTask[]
  onSaveAvailability: (availability: DailyAvailability[]) => void
  onConfirm: (tasks: LearningPlanTask[], source: PreviewSource) => void
  onClose: () => void
  requestSuggestion?: (
    request: ScheduleSuggestionRequest,
    signal?: AbortSignal,
  ) => Promise<ScheduleSuggestionResult>
  now?: Date
}

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

function timeMinutes(value: string) {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return null
  return Number(value.slice(0, 2)) * 60 + Number(value.slice(3))
}

function dateLabel(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return `${month}月${day}日 ${WEEKDAYS[date.getDay()]}`
}

function availabilityLabel(value: string, now: Date) {
  const [year, month, day] = value.split('-').map(Number)
  const localToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const localValue = new Date(year, month - 1, day)
  const offset = Math.round((localValue.getTime() - localToday.getTime()) / 86_400_000)
  const relative = offset === 0 ? '今天' : offset === 1 ? '明天' : offset === 2 ? '后天' : ''
  return relative ? `${relative} ${dateLabel(value)}` : dateLabel(value)
}

function validDay(day: DailyAvailability) {
  const start = timeMinutes(day.startTime)
  const end = timeMinutes(day.endTime)
  return !day.enabled || (
    start !== null
    && end !== null
    && start < end
    && Number.isInteger(day.maxMinutes)
    && day.maxMinutes >= 5
    && day.maxMinutes <= 180
  )
}

function hasOverlap(tasks: LearningPlanTask[]) {
  const byDate = new Map<string, [number, number][]>()
  for (const task of tasks) {
    const start = timeMinutes(task.time)
    if (start === null) return true
    const intervals = byDate.get(task.date) ?? []
    const next = [start, start + task.minutes] as [number, number]
    if (intervals.some(([from, to]) => next[0] < to && next[1] > from)) return true
    intervals.push(next)
    byDate.set(task.date, intervals)
  }
  return false
}

function taskIdentity(task: LearningPlanTask) {
  return `${task.date}:${task.partId}:${task.kind}`
}

function sameTaskTiming(left: LearningPlanTask, right: LearningPlanTask) {
  return left.date === right.date
    && left.time === right.time
    && left.minutes === right.minutes
}

function summarizePlanChanges(
  selectedTasks: LearningPlanTask[],
  currentTasks: LearningPlanTask[],
  includeRemovals: boolean,
) {
  const changes: PlanChange[] = []
  const selectedByIdentity = new Map<string, LearningPlanTask>()
  const currentByIdentity = new Map<string, LearningPlanTask>()
  for (const task of selectedTasks) {
    selectedByIdentity.set(taskIdentity(task), task)
  }
  for (const task of currentTasks) {
    currentByIdentity.set(taskIdentity(task), task)
  }

  for (const [identity, task] of selectedByIdentity) {
    const existing = currentByIdentity.get(identity)
    if (!existing) {
      changes.push({ kind: 'added', label: task.title })
    } else if (!sameTaskTiming(existing, task)) {
      changes.push({ kind: 'adjusted', label: task.title })
    }
  }

  if (includeRemovals) {
    for (const [identity, task] of currentByIdentity) {
      if (!selectedByIdentity.has(identity)) {
        changes.push({ kind: 'removed', label: task.title })
      }
    }
  }

  return {
    added: changes.filter((change) => change.kind === 'added'),
    adjusted: changes.filter((change) => change.kind === 'adjusted'),
    removed: changes.filter((change) => change.kind === 'removed'),
  }
}

export function AiSchedulePanel({
  grade,
  course,
  progress,
  availability,
  currentTasks,
  onSaveAvailability,
  onConfirm,
  onClose,
  requestSuggestion = requestScheduleSuggestion,
  now = new Date(),
}: AiSchedulePanelProps) {
  const [days, setDays] = useState(() => availability.map((day) => ({ ...day })))
  const [previewTasks, setPreviewTasks] = useState<LearningPlanTask[] | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [previewSource, setPreviewSource] = useState<PreviewSource>('ai')
  const [reasons, setReasons] = useState<Record<string, string>>({})
  const [weekSummary, setWeekSummary] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const controllerRef = useRef<AbortController | null>(null)
  const confirmedRef = useRef(false)

  useEffect(() => () => controllerRef.current?.abort(), [])

  const candidates = useMemo(() => getPlanCandidates(course, progress), [course, progress])
  const enabledCount = days.filter((day) => day.enabled).length
  const availabilityValid = days.every(validDay) && enabledCount > 0
  const previewTotal = previewTasks?.reduce((sum, task) => sum + task.minutes, 0) ?? 0
  const selectedTasks = previewTasks?.filter((task) => selectedIds.has(task.id)) ?? []
  const selectedTotal = selectedTasks.reduce((sum, task) => sum + task.minutes, 0)
  const allSelected = Boolean(previewTasks?.length) && selectedTasks.length === previewTasks?.length
  const changes = useMemo(
    () => summarizePlanChanges(selectedTasks, currentTasks, allSelected),
    [allSelected, currentTasks, selectedTasks],
  )

  const updateDay = (date: string, patch: Partial<DailyAvailability>) => {
    setDays((current) => current.map((day) => day.date === date ? { ...day, ...patch } : day))
    setError('')
    setMessage('')
  }

  const generate = async () => {
    if (!availabilityValid || loading) return
    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller
    setLoading(true)
    setError('')
    setMessage('')
    setPreviewTasks(null)
    setSelectedIds(new Set())
    confirmedRef.current = false
    onSaveAvailability(days.map((day) => ({ ...day })))

    const request: ScheduleSuggestionRequest = {
      grade,
      gradeBand: course.band,
      availability: days.map((day) => ({ ...day })),
      catalog: candidates.map((candidate) => ({
        partId: candidate.partId,
        kind: candidate.kind,
        title: candidate.title,
        suggestedMinutes: candidate.suggestedMinutes,
      })),
      progress: {
        knowledgeCompleted: [...progress.knowledgeCompleted],
        testsPassed: [...progress.testsPassed],
      },
      currentTasks: currentTasks.map((task) => ({ ...task })),
      wrongQuestionSummaries: [],
    }

    try {
      const suggestion = await requestSuggestion(request, controller.signal)
      if (controller.signal.aborted) return
      const tasks = suggestion.tasks.map((task) => ({ ...task }))
      setPreviewTasks(tasks)
      setSelectedIds(new Set(tasks.map((task) => task.id)))
      setReasons({ ...suggestion.reasons })
      setWeekSummary(suggestion.weekSummary)
      setPreviewSource('ai')
    } catch (caught) {
      if (controller.signal.aborted || (caught instanceof DOMException && caught.name === 'AbortError')) return
      const fallback = buildFallbackPlan({
        grade,
        course,
        progress,
        availability: days,
        now,
      })
      if (!fallback.length) {
        setError('暂时没有合适的基础安排，可以调整每天可用的时间，或者自己添加学习内容。')
        setMessage('')
        return
      }
      const fallbackReasons = Object.fromEntries(fallback.map((task) => [
        task.id,
        task.review
          ? '用一小段时间回顾已经见过的内容。'
          : '先从一项合适的内容开始，按自己的节奏探索。',
      ]))
      setPreviewTasks(fallback)
      setSelectedIds(new Set(fallback.map((task) => task.id)))
      setReasons(fallbackReasons)
      setWeekSummary('先从几项容易开始的内容出发，之后还可以继续调整。')
      setPreviewSource('fallback')
      setMessage('AI 暂时没连上，先给你一份可以继续修改的基础安排')
    } finally {
      if (!controller.signal.aborted) setLoading(false)
    }
  }

  const updatePreviewTask = (id: string, patch: Partial<LearningPlanTask>) => {
    setPreviewTasks((current) => current?.map((task) =>
      task.id === id ? { ...task, ...patch, updatedAt: new Date().toISOString() } : task) ?? null)
    setError('')
  }

  const removePreviewTask = (id: string) => {
    setPreviewTasks((current) => {
      const next = current?.filter((task) => task.id !== id) ?? null
      return next?.length ? next : null
    })
    setSelectedIds((current) => {
      const next = new Set(current)
      next.delete(id)
      return next
    })
    setError('')
  }

  const toggleSelected = (id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
    setError('')
  }

  const toggleSelectAll = () => {
    setSelectedIds(allSelected
      ? new Set()
      : new Set(previewTasks?.map((task) => task.id) ?? []))
    setError('')
  }

  const movePreviewTask = (task: LearningPlanTask, direction: -1 | 1) => {
    if (!previewTasks) return
    const dayTasks = previewTasks
      .filter((item) => item.date === task.date)
      .sort((a, b) => a.order - b.order || a.time.localeCompare(b.time))
    const index = dayTasks.findIndex((item) => item.id === task.id)
    const target = index + direction
    if (index < 0 || target < 0 || target >= dayTasks.length) return
    ;[dayTasks[index], dayTasks[target]] = [dayTasks[target], dayTasks[index]]
    const otherTasks = previewTasks.filter((item) => item.date !== task.date)
    const reorderedDay = dayTasks.map((item, order) => ({ ...item, order }))
    setPreviewTasks([...otherTasks, ...reorderedDay].sort((a, b) => a.date.localeCompare(b.date) || a.order - b.order))
  }

  const confirm = () => {
    if (!previewTasks?.length || confirmedRef.current) return
    if (!selectedTasks.length) {
      setError('先选择至少一项想采用的安排。')
      return
    }
    const selectedIdentities = new Set(selectedTasks.map((task) => taskIdentity(task)))
    const nextTasks = allSelected
      ? selectedTasks
      : [
        ...currentTasks.filter((task) => !selectedIdentities.has(taskIdentity(task))),
        ...selectedTasks,
      ].sort((left, right) => left.date.localeCompare(right.date) || left.order - right.order)
    const valid = validatePlanTasks(nextTasks, { course, availability: days, now })
    if (valid.length !== nextTasks.length) {
      setError('有些安排超出了可用时间，请调整时间或时长后再确认。')
      return
    }
    if (hasOverlap(valid)) {
      setError('有两项安排的时间重叠了，请错开时间后再确认。')
      return
    }
    confirmedRef.current = true
    onSaveAvailability(days.map((day) => ({ ...day })))
    onConfirm(valid, previewSource)
  }

  const close = () => {
    controllerRef.current?.abort()
    onClose()
  }

  const previewGroups = previewTasks
    ? [...new Set(previewTasks.map((task) => task.date))].sort()
      .map((date) => ({
        date,
        tasks: previewTasks.filter((task) => task.date === date)
          .sort((a, b) => a.order - b.order || a.time.localeCompare(b.time)),
      }))
    : []

  return (
    <section className="ai-schedule-panel" role="region" aria-label="AI 帮我安排">
      <header className="ai-schedule-header">
        <div>
          <p className="section-kicker">让建议先经过你的同意</p>
          <h2><Sparkles aria-hidden="true" size={20} />AI 帮我安排</h2>
        </div>
        <button type="button" aria-label="关闭 AI 安排" onClick={close}>
          <X aria-hidden="true" size={20} />
        </button>
      </header>

      <section className="ai-schedule-section" aria-labelledby="ai-availability-title">
        <div className="ai-schedule-section-title">
          <div>
            <span>第 1 步</span>
            <h3 id="ai-availability-title">设置未来七天可用时间</h3>
          </div>
          <p>安排只是起点，临时调整也没关系。</p>
        </div>
        <div className="ai-availability-list">
          {days.map((day) => (
            <div className={`ai-availability-day${day.enabled ? ' is-enabled' : ''}`} key={day.date}>
              <label className="ai-availability-toggle">
                <input
                  type="checkbox"
                  aria-label={`启用 ${availabilityLabel(day.date, now)}`}
                  checked={day.enabled}
                  onChange={(event) => updateDay(day.date, { enabled: event.target.checked })}
                />
                <CalendarClock aria-hidden="true" size={16} />
                <strong>{availabilityLabel(day.date, now)}</strong>
              </label>
              <div className="ai-availability-fields">
                <label>
                  开始时间
                  <input
                    type="time"
                    aria-label={`${availabilityLabel(day.date, now)} 开始时间`}
                    value={day.startTime}
                    disabled={!day.enabled}
                    onChange={(event) => updateDay(day.date, { startTime: event.target.value })}
                  />
                </label>
                <label>
                  结束时间
                  <input
                    type="time"
                    aria-label={`${availabilityLabel(day.date, now)} 结束时间`}
                    value={day.endTime}
                    disabled={!day.enabled}
                    onChange={(event) => updateDay(day.date, { endTime: event.target.value })}
                  />
                </label>
                <label>
                  最多分钟
                  <input
                    type="number"
                    min="5"
                    max="180"
                    aria-label={`${availabilityLabel(day.date, now)} 最多分钟`}
                    value={day.maxMinutes}
                    disabled={!day.enabled}
                    onChange={(event) => updateDay(day.date, { maxMinutes: Number(event.target.value) })}
                  />
                </label>
              </div>
            </div>
          ))}
        </div>
        {!enabledCount && <p className="ai-schedule-hint">至少启用一天，AI 才能给出安排。</p>}
        {enabledCount > 0 && !availabilityValid && (
          <p className="ai-schedule-error" role="alert">请让开始时间早于结束时间，并把每日时长设为 5—180 分钟。</p>
        )}
        <div className="ai-schedule-generate">
          <button type="button" disabled={!availabilityValid || loading} onClick={() => void generate()}>
            {loading ? <LoaderCircle className="is-spinning" aria-hidden="true" size={17} /> : <Sparkles aria-hidden="true" size={17} />}
            {loading ? '正在整理建议…' : '生成 7 天建议'}
          </button>
          <span>只会提出建议，确认前不会改动正式计划。</span>
        </div>
      </section>

      <section className="ai-schedule-existing" aria-label="正式计划">
        <strong>当前正式计划</strong>
        <p>{currentTasks.length ? currentTasks.map((task) => task.title).join('、') : '还没有正式安排'}</p>
      </section>

      {error && <p className="ai-schedule-error" role="alert">{error}</p>}
      {message && <p className="ai-schedule-notice" role="status">{message}</p>}

      {previewTasks?.length ? (
        <section className="ai-schedule-preview" aria-labelledby="ai-preview-title">
          <div className="ai-schedule-review-head">
            <div>
              <span>第 2 步</span>
              <h3 id="ai-preview-title">安排预览</h3>
            </div>
            <span>已选 {selectedTasks.length}/{previewTasks.length} 项 · {selectedTotal}/{previewTotal} 分钟</span>
          </div>
          <p className="ai-schedule-summary">{weekSummary}</p>

          <section className="ai-schedule-changes" aria-label="与当前计划的变更">
            <div className="ai-schedule-changes-head">
              <strong>与当前计划的变化</strong>
              <button type="button" onClick={toggleSelectAll}>
                {allSelected ? '取消全选' : '一键选择全部建议'}
              </button>
            </div>
            <ul>
              <li><span>新增 {changes.added.length} 项</span>{changes.added.length > 0 && `：${changes.added.map((item) => item.label).join('、')}`}</li>
              <li><span>调整 {changes.adjusted.length} 项</span>{changes.adjusted.length > 0 && `：${changes.adjusted.map((item) => item.label).join('、')}`}</li>
              <li><span>移除 {changes.removed.length} 项</span>{changes.removed.length > 0 && `：${changes.removed.map((item) => item.label).join('、')}`}</li>
            </ul>
            {!changes.added.length && !changes.adjusted.length && !changes.removed.length && (
              <p>所选建议与当前计划一致。</p>
            )}
          </section>

          <div className="ai-schedule-preview-days">
            {previewGroups.map((group) => (
              <section key={group.date} aria-label={`${dateLabel(group.date)}建议`}>
                <h4>{dateLabel(group.date)}</h4>
                <ul className="ai-schedule-preview-list" aria-label="建议安排列表">
                  {group.tasks.map((task, index) => (
                    <li key={task.id} className={selectedIds.has(task.id) ? 'is-selected' : ''}>
                      <div className="ai-preview-task-head">
                        <label className="ai-preview-select">
                          <input
                            type="checkbox"
                            aria-label={`选择建议：${task.title}`}
                            checked={selectedIds.has(task.id)}
                            onChange={() => toggleSelected(task.id)}
                          />
                          <span>采用</span>
                        </label>
                        <span className={`schedule-kind schedule-kind--${task.kind}`}>
                          {task.kind === 'knowledge' ? '知识' : '测试'}
                        </span>
                        {task.review && <span className="schedule-review">复习</span>}
                        <strong>{task.title}</strong>
                      </div>
                      <div className="ai-preview-fields">
                        <label>
                          <Clock3 aria-hidden="true" size={14} />时间
                          <input
                            type="time"
                            aria-label={`${task.title} 学习时间`}
                            value={task.time}
                            onChange={(event) => updatePreviewTask(task.id, { time: event.target.value })}
                          />
                        </label>
                        <label>
                          预计时长
                          <input
                            type="number"
                            min="5"
                            max="90"
                            aria-label={`${task.title} 预计时长`}
                            value={task.minutes}
                            onChange={(event) => updatePreviewTask(task.id, { minutes: Number(event.target.value) })}
                          />
                          <span>分钟</span>
                        </label>
                      </div>
                      <p>{reasons[task.id] ?? '按自己的节奏探索这项内容。'}</p>
                      <div className="ai-preview-actions">
                        <button
                          type="button"
                          aria-label={`上移 ${task.title}`}
                          disabled={index === 0}
                          onClick={() => movePreviewTask(task, -1)}
                        >
                          <ChevronUp aria-hidden="true" size={15} />上移
                        </button>
                        <button
                          type="button"
                          aria-label={`下移 ${task.title}`}
                          disabled={index === group.tasks.length - 1}
                          onClick={() => movePreviewTask(task, 1)}
                        >
                          <ChevronDown aria-hidden="true" size={15} />下移
                        </button>
                        <button type="button" aria-label={`删除 ${task.title}`} onClick={() => removePreviewTask(task.id)}>
                          <Trash2 aria-hidden="true" size={14} />删除
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>

          <footer className="ai-schedule-preview-footer">
            <button type="button" onClick={close}>取消</button>
            <button type="button" disabled={!selectedTasks.length} onClick={confirm}>
              <Check aria-hidden="true" size={17} />确认采用
            </button>
          </footer>
        </section>
      ) : null}
    </section>
  )
}
