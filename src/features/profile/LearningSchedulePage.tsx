import {
  AlertCircle,
  ArrowLeft,
  BookOpen,
  CalendarPlus,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Clock,
  FlaskConical,
  GripVertical,
  Pencil,
  Trash2,
  X,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useAppState } from '../../app/AppState'
import { getGradeBand, isTestUnlocked, type LearningProgress } from '../../app/learning'
import { getTaskCompletion, getTaskTiming, type LearningPlanTask } from '../../app/learningPlan'
import { getCourseForBand } from '../knowledge/courseCatalog'
import { LearningContentPicker } from './LearningContentPicker'
import { getPlanCandidates, type PlanCandidate } from './learningPlanner'
import './profile.css'

const RELATIVE_DAY_LABELS = ['今天', '明天', '后天']
const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

type EditorState = {
  taskId?: string
  date: string
  time: string
  minutes: string
  candidate: PlanCandidate
  createdAt?: string
}

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function datesFromToday(now: Date) {
  return Array.from({ length: 7 }, (_, index) =>
    new Date(now.getFullYear(), now.getMonth(), now.getDate() + index))
}

function dayLabel(date: Date, index: number) {
  if (index < RELATIVE_DAY_LABELS.length) return RELATIVE_DAY_LABELS[index]
  return WEEKDAYS[date.getDay()]
}

function fullDateLabel(date: Date) {
  return `${date.getMonth() + 1}月${date.getDate()}日`
}

function regionLabel(date: Date, index: number) {
  return `${dayLabel(date, index)} ${dateKey(date)}`
}

function timeToMinutes(value: string) {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return null
  return Number(value.slice(0, 2)) * 60 + Number(value.slice(3))
}

function minutesToTime(value: number) {
  return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`
}

function suggestedTime(tasks: LearningPlanTask[], date: string, fallback = '18:30') {
  const dayTasks = tasks
    .filter((task) => task.date === date)
    .sort((a, b) => timeToMinutes(a.time)! - timeToMinutes(b.time)!)
  if (!dayTasks.length) return fallback
  const latestEnd = Math.max(...dayTasks.map((task) => timeToMinutes(task.time)! + task.minutes))
  return latestEnd < 23 * 60 + 30 ? minutesToTime(latestEnd) : fallback
}

function statusFor(task: LearningPlanTask, progress: LearningProgress) {
  if (getTaskCompletion(task, progress) === 'completed') return { label: '已完成', tone: 'complete' }
  const timing = getTaskTiming(task)
  if (timing === 'overdue') return { label: '待调整', tone: 'overdue' }
  if (timing === 'today') return { label: '今天', tone: 'today' }
  return { label: '待开始', tone: 'upcoming' }
}

export function LearningSchedulePage({
  onBack,
  onStartTask,
}: {
  onBack: () => void
  onStartTask?: (task: LearningPlanTask) => void
}) {
  const {
    state,
    upsertPlanTask,
    removePlanTask,
    reorderPlanTasks,
  } = useAppState()
  const [selectedDate, setSelectedDate] = useState(() => dateKey(new Date()))
  const [editor, setEditor] = useState<EditorState | null>(null)
  const [editorError, setEditorError] = useState('')
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [notice, setNotice] = useState('')
  const now = new Date()
  const dates = useMemo(
    () => datesFromToday(now),
    [now.getFullYear(), now.getMonth(), now.getDate()],
  )
  const dateKeys = useMemo(() => new Set(dates.map(dateKey)), [dates])
  const course = getCourseForBand(getGradeBand(state.grade))
  const progress = state.learningProgress[getGradeBand(state.grade)]
  const candidates = getPlanCandidates(course, progress)
  const weekTasks = state.learningPlan.tasks.filter((task) =>
    task.grade === state.grade && dateKeys.has(task.date))

  const tasksForDate = (date: string) => weekTasks
    .filter((task) => task.date === date)
    .sort((a, b) => a.order - b.order || a.time.localeCompare(b.time))

  const openAdd = () => {
    const candidate = candidates[0]
    if (!candidate) return
    setEditor({
      date: selectedDate,
      time: suggestedTime(weekTasks, selectedDate),
      minutes: String(candidate.suggestedMinutes),
      candidate,
    })
    setEditorError('')
  }

  const openEdit = (task: LearningPlanTask) => {
    const candidate = candidates.find((item) => item.partId === task.partId && item.kind === task.kind)
    if (!candidate) return
    setEditor({
      taskId: task.id,
      date: task.date,
      time: task.time,
      minutes: String(task.minutes),
      candidate,
      createdAt: task.createdAt,
    })
    setEditorError('')
  }

  const updateEditorDate = (date: string) => {
    setEditor((current) => current ? {
      ...current,
      date,
      time: suggestedTime(weekTasks.filter((task) => task.id !== current.taskId), date),
    } : current)
  }

  const selectCandidate = (candidate: PlanCandidate) => {
    setEditor((current) => current ? {
      ...current,
      candidate,
      minutes: String(candidate.suggestedMinutes),
      time: suggestedTime(weekTasks.filter((task) => task.id !== current.taskId), current.date),
    } : current)
  }

  const saveEditor = () => {
    if (!editor) return
    const minutes = Number(editor.minutes)
    const start = timeToMinutes(editor.time)
    const day = state.learningPlan.availability.find((item) => item.date === editor.date)
    const dayStart = day ? timeToMinutes(day.startTime) : null
    const dayEnd = day ? timeToMinutes(day.endTime) : null
    const today = dateKey(now)
    if (!Number.isInteger(minutes) || minutes < 5 || minutes > 90) {
      setEditorError('预计时长需要填写 5—90 分钟。')
      return
    }
    if (!dateKeys.has(editor.date)) {
      setEditorError('请选择未来七天中的一天。')
      return
    }
    if (start === null || !day || !day.enabled || dayStart === null || dayEnd === null
      || start < dayStart || start + minutes > dayEnd) {
      setEditorError('这个时间不在当天的可用时段里，可以换一个时间试试。')
      return
    }
    if (editor.date === today && start < now.getHours() * 60 + now.getMinutes()) {
      setEditorError('这个时间已经过去了，请选择稍后的时间。')
      return
    }
    const duplicate = weekTasks.some((task) =>
      task.id !== editor.taskId
      && task.date === editor.date
      && task.partId === editor.candidate.partId
      && task.kind === editor.candidate.kind)
    if (duplicate) {
      setEditorError('这一天已经安排过同一项内容了，可以换一项或调整原来的安排。')
      return
    }
    const timestamp = new Date().toISOString()
    const original = editor.taskId
      ? state.learningPlan.tasks.find((item) => item.id === editor.taskId)
      : undefined
    const sameDay = tasksForDate(editor.date).filter((task) => task.id !== editor.taskId)
    const task: LearningPlanTask = {
      id: editor.taskId ?? `student-${Date.now()}-${editor.candidate.partId}-${editor.candidate.kind}`,
      grade: state.grade,
      partId: editor.candidate.partId,
      kind: editor.candidate.kind,
      title: editor.candidate.title,
      date: editor.date,
      time: editor.time,
      minutes,
      order: original?.date === editor.date ? original.order : sameDay.length,
      source: 'student',
      review: editor.candidate.review,
      createdAt: editor.createdAt ?? timestamp,
      updatedAt: timestamp,
    }
    upsertPlanTask(task)
    setSelectedDate(editor.date)
    setEditor(null)
    setEditorError('')
    setNotice('学习安排已保存。')
  }

  const moveTask = (task: LearningPlanTask, direction: -1 | 1) => {
    const dayTasks = tasksForDate(task.date)
    const currentIndex = dayTasks.findIndex((item) => item.id === task.id)
    const targetIndex = currentIndex + direction
    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= dayTasks.length) return
    const ids = dayTasks.map((item) => item.id)
    ;[ids[currentIndex], ids[targetIndex]] = [ids[targetIndex], ids[currentIndex]]
    reorderPlanTasks(task.date, ids)
  }

  const confirmDelete = (id: string) => {
    removePlanTask(id)
    setDeleteId(null)
    setNotice('这项安排已移除，学习进度保持原样。')
  }

  return (
    <div className="schedule-page">
      <header className="profile-page-header schedule-page-header">
        <button className="profile-back" type="button" onClick={onBack} aria-label="返回">
          <ArrowLeft size={20} />
        </button>
        <div>
          <p className="section-kicker">未来七天</p>
          <h1>成长安排</h1>
        </div>
        <button className="schedule-add" type="button" onClick={openAdd}>
          <CalendarPlus aria-hidden="true" size={17} />
          添加学习内容
        </button>
      </header>

      <p className="schedule-page-intro">选一项真实课程或挑战，按自己的节奏安排。临时改变也没关系。</p>

      <nav className="schedule-strip" aria-label="未来七天日期">
        {dates.map((date, index) => {
          const key = dateKey(date)
          return (
            <button
              key={key}
              type="button"
              aria-pressed={selectedDate === key}
              aria-label={`${regionLabel(date, index)}，${tasksForDate(key).length} 项安排`}
              onClick={() => setSelectedDate(key)}
            >
              <span>{dayLabel(date, index)}</span>
              <strong>{date.getDate()}</strong>
              <small>{fullDateLabel(date)}</small>
            </button>
          )
        })}
      </nav>

      {notice && <p className="success-note schedule-notice" role="status">{notice}</p>}

      <div className="schedule-days">
        {dates.map((date, index) => {
          const key = dateKey(date)
          const dayTasks = tasksForDate(key)
          return (
            <section
              className={`schedule-day-group${selectedDate === key ? ' is-selected' : ''}`}
              role="region"
              aria-label={regionLabel(date, index)}
              key={key}
            >
              <header>
                <div>
                  <strong>{dayLabel(date, index)}</strong>
                  <span>{fullDateLabel(date)} · {WEEKDAYS[date.getDay()]}</span>
                </div>
                <small>{dayTasks.length ? `${dayTasks.length} 项安排` : '留白也很好'}</small>
              </header>

              {dayTasks.length ? (
                <ul className="schedule-list">
                  {dayTasks.map((task, taskIndex) => {
                    const status = statusFor(task, state.learningProgress)
                    const lockedTest = task.kind === 'test' && !isTestUnlocked(progress, task.partId)
                    return (
                      <li className="schedule-card" key={task.id}>
                        <div className="schedule-card-top">
                          <span className={`schedule-kind schedule-kind--${task.kind}`}>
                            {task.kind === 'knowledge'
                              ? <BookOpen aria-hidden="true" size={13} />
                              : <FlaskConical aria-hidden="true" size={13} />}
                            {task.kind === 'knowledge' ? '知识' : '测试'}
                          </span>
                          {task.review && <span className="schedule-review">复习</span>}
                          <GripVertical className="schedule-grip" aria-hidden="true" size={17} />
                        </div>
                        <div className="schedule-card-main">
                          <strong>{task.title}</strong>
                          <span className={`schedule-status schedule-status--${status.tone}`}>
                            {status.tone === 'complete' && <CheckCircle2 aria-hidden="true" size={13} />}
                            {status.tone === 'overdue' && <AlertCircle aria-hidden="true" size={13} />}
                            {status.label}
                          </span>
                        </div>
                        <div className="schedule-meta">
                          <span><Clock aria-hidden="true" size={14} />{task.time}</span>
                          <span>预计 {task.minutes} 分钟</span>
                        </div>
                        <div className="schedule-card-actions">
                          <button
                            className="schedule-start"
                            type="button"
                            onClick={() => onStartTask?.(task)}
                          >
                            {lockedTest ? '先学知识' : '开始'}
                            <ChevronRight aria-hidden="true" size={14} className="schedule-start-arrow" />
                          </button>
                          <button type="button" aria-label={`编辑 ${task.title}`} onClick={() => openEdit(task)}>
                            <Pencil aria-hidden="true" size={14} />编辑
                          </button>
                          <button
                            type="button"
                            aria-label={`${task.title} 上移`}
                            disabled={taskIndex === 0}
                            onClick={() => moveTask(task, -1)}
                          >
                            <ChevronUp aria-hidden="true" size={15} />上移
                          </button>
                          <button
                            type="button"
                            aria-label={`${task.title} 下移`}
                            disabled={taskIndex === dayTasks.length - 1}
                            onClick={() => moveTask(task, 1)}
                          >
                            <ChevronDown aria-hidden="true" size={15} />下移
                          </button>
                          <button className="schedule-delete" type="button" aria-label={`删除 ${task.title}`} onClick={() => setDeleteId(task.id)}>
                            <Trash2 aria-hidden="true" size={14} />删除
                          </button>
                        </div>
                        {deleteId === task.id && (
                          <div className="schedule-delete-confirm" role="group" aria-label={`确认删除 ${task.title}`}>
                            <p>这项安排会从计划中移除，学习进度不会改变。</p>
                            <div>
                              <button type="button" onClick={() => setDeleteId(null)}>保留安排</button>
                              <button type="button" onClick={() => confirmDelete(task.id)}>确认删除</button>
                            </div>
                          </div>
                        )}
                      </li>
                    )
                  })}
                </ul>
              ) : (
                <p className="schedule-empty">今天还没有安排，可以留作休息，也可以添加一项。</p>
              )}
            </section>
          )
        })}
      </div>

      {editor && (
        <div className="schedule-editor-backdrop" role="presentation">
          <section className="schedule-editor" role="dialog" aria-modal="true" aria-label="安排学习内容">
            <header>
              <div>
                <p className="section-kicker">{editor.taskId ? '调整已有安排' : '添加新安排'}</p>
                <h2>{editor.taskId ? '修改学习计划' : '选择学习内容'}</h2>
              </div>
              <button type="button" aria-label="关闭安排编辑" onClick={() => setEditor(null)}><X aria-hidden="true" /></button>
            </header>

            <LearningContentPicker
              candidates={candidates}
              selected={editor.candidate}
              onSelect={selectCandidate}
            />

            <div className="schedule-editor-fields">
              <label>
                日期
                <select aria-label="日期" value={editor.date} onChange={(event) => updateEditorDate(event.target.value)}>
                  {dates.map((date, index) => (
                    <option value={dateKey(date)} key={dateKey(date)}>{regionLabel(date, index)}</option>
                  ))}
                </select>
              </label>
              <label>
                学习时间
                <input aria-label="学习时间" type="time" value={editor.time} onChange={(event) => setEditor((current) => current ? { ...current, time: event.target.value } : current)} />
              </label>
              <label>
                预计时长
                <span className="schedule-duration-field">
                  <input aria-label="预计时长" inputMode="numeric" value={editor.minutes} onChange={(event) => setEditor((current) => current ? { ...current, minutes: event.target.value } : current)} />
                  <span>分钟</span>
                </span>
              </label>
            </div>

            {editorError && <p className="schedule-editor-error" role="alert">{editorError}</p>}

            <footer>
              <button type="button" onClick={() => setEditor(null)}>暂不安排</button>
              <button type="button" onClick={saveEditor}><Check aria-hidden="true" size={16} />保存安排</button>
            </footer>
          </section>
        </div>
      )}

      <p className="schedule-footnote">逾期安排只会提示“待调整”，不会自动改到别的时间。</p>
    </div>
  )
}
