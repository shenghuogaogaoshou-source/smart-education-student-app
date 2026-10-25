import { ArrowLeft, ChevronLeft, ChevronRight, Clock3 } from 'lucide-react'
import { useState } from 'react'
import { useAppState } from '../../app/AppState'
import type { LearningPlanTask } from '../../app/learningPlan'
import { formatMonthTitle, getPlanTaskView, isActiveBandTask, isEditablePlanDate, tasksForDate } from './plan'
import './profile.css'

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

type Props = {
  onBack: () => void
  onStartTask?: (task: LearningPlanTask) => void
  onOpenSchedule?: (date?: string) => void
}

export function CalendarPage({ onBack, onStartTask, onOpenSchedule }: Props) {
  const { state } = useAppState()
  const now = new Date()
  const [cursor, setCursor] = useState({ y: now.getFullYear(), m: now.getMonth() })
  const [selected, setSelected] = useState(() => {
    const date = new Date()
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  })
  const tasks = state.learningPlan.tasks.filter((task) => isActiveBandTask(task, state.grade))

  const firstWeekday = new Date(cursor.y, cursor.m, 1).getDay()
  const daysInMonth = new Date(cursor.y, cursor.m + 1, 0).getDate()
  const cells: (Date | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => new Date(cursor.y, cursor.m, index + 1)),
  ]

  const moveMonth = (delta: number) => {
    setCursor(({ y, m }) => {
      const next = new Date(y, m + delta, 1)
      return { y: next.getFullYear(), m: next.getMonth() }
    })
  }

  const [selectedYear, selectedMonth, selectedDay] = selected.split('-').map(Number)
  const selectedDate = new Date(selectedYear, selectedMonth - 1, selectedDay)
  const selectedTasks = tasksForDate(tasks, selectedDate)
  const canEditSelectedDate = isEditablePlanDate(selected, now)
  const isCurrentMonth = cursor.y === now.getFullYear() && cursor.m === now.getMonth()

  const label = (date: Date) => {
    if (date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate()) return '今天'
    return `${date.getMonth() + 1} 月 ${date.getDate()} 日`
  }

  return (
    <div className="calendar-page">
      <header className="profile-page-header">
        <button className="profile-back" type="button" onClick={onBack} aria-label="返回">
          <ArrowLeft size={20} />
        </button>
        <h1>学习日历</h1>
      </header>

      <section className="calendar-card">
        <div className="calendar-nav">
          <button type="button" aria-label="上个月" onClick={() => moveMonth(-1)}><ChevronLeft aria-hidden="true" size={18} /></button>
          <strong>{formatMonthTitle(cursor.y, cursor.m)}</strong>
          <button type="button" aria-label="下个月" onClick={() => moveMonth(1)}><ChevronRight aria-hidden="true" size={18} /></button>
        </div>

        <div className="calendar-grid" role="grid" aria-label={`${formatMonthTitle(cursor.y, cursor.m)} 日历`}>
          {WEEKDAYS.map((weekday) => (
            <div key={weekday} className="calendar-weekday" role="columnheader">{weekday}</div>
          ))}
          {cells.map((date, index) => {
            if (!date) return <div key={`empty-${index}`} className="calendar-day empty" />
            const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
            const dayTasks = tasksForDate(tasks, date)
            const statuses = dayTasks.map((task) => getPlanTaskView(task, state.learningProgress).statusLabel)
            const isToday = date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate()
            const classes = [
              'calendar-day',
              dayTasks.length ? 'has-task' : '',
              statuses.includes('待调整') ? 'has-overdue' : '',
              statuses.includes('已完成') ? 'has-completed' : '',
              isToday ? 'today' : '',
              key === selected ? 'selected' : '',
            ].filter(Boolean).join(' ')
            const statusCopy = dayTasks.length
              ? `，有安排${statuses.includes('待调整') ? '，有待调整' : statuses.includes('已完成') ? '，有已完成' : ''}`
              : ''
            return (
              <button
                key={key}
                type="button"
                className={classes}
                aria-label={`${date.getDate()} 日${statusCopy}`}
                aria-pressed={key === selected}
                onClick={() => setSelected(key)}
              >
                <span>{date.getDate()}</span>
                {dayTasks.length > 0 && <i aria-hidden="true" />}
              </button>
            )
          })}
        </div>

        <div className="calendar-legend">
          <span><i className="legend-dot today-dot" aria-hidden="true" />今天</span>
          <span><i className="legend-dot task-dot" aria-hidden="true" />有安排</span>
          <span><i className="legend-dot completed-dot" aria-hidden="true" />已完成</span>
          <span><i className="legend-dot overdue-dot" aria-hidden="true" />待调整</span>
        </div>
      </section>

      <section className="calendar-card selected-day-card">
        <div className="section-heading-row">
          <h2>{label(selectedDate)}的安排</h2>
          {onOpenSchedule && canEditSelectedDate && (
            <button className="calendar-adjust" type="button" onClick={() => onOpenSchedule(selected)}>调整这天的安排</button>
          )}
        </div>
        {!canEditSelectedDate && (
          <p className="calendar-readonly-note">此日期仅查看记录，未来七天内的安排可调整。</p>
        )}
        {selectedTasks.length === 0 ? (
          <p className="calendar-empty">这一天暂时没有安排，好好休息吧。</p>
        ) : (
          <ul className="schedule-list calendar-task-list">
            {selectedTasks.map((task) => {
              const view = getPlanTaskView(task, state.learningProgress)
              return (
                <li key={task.id} className="calendar-task-card">
                  <div className="calendar-task-top">
                    <span className={`schedule-kind schedule-kind--${task.kind}`}>{view.kindLabel}</span>
                    {view.showReview && <span className="schedule-review">复习</span>}
                    <span className={`schedule-status schedule-status--${view.tone}`}>{view.statusLabel}</span>
                  </div>
                  <strong>{task.title}</strong>
                  <span className="schedule-time"><Clock3 aria-hidden="true" size={13} />{task.time} · 预计 {task.minutes} 分钟</span>
                  <button type="button" onClick={() => onStartTask?.(task)}>开始 {task.title}</button>
                </li>
              )
            })}
          </ul>
        )}
        {isCurrentMonth && <p className="calendar-tip">点日历上的其他日期，可以查看那天的安排。</p>}
      </section>
    </div>
  )
}
