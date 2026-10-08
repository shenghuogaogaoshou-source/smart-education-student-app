import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { formatMonthTitle, tasksForDate } from './plan'
import './profile.css'

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

export function CalendarPage({ onBack }: { onBack: () => void }) {
  const now = new Date()
  const [cursor, setCursor] = useState({ y: now.getFullYear(), m: now.getMonth() })
  const [selected, setSelected] = useState<string>(() => {
    const d = new Date()
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
  })

  const firstWeekday = new Date(cursor.y, cursor.m, 1).getDay()
  const daysInMonth = new Date(cursor.y, cursor.m + 1, 0).getDate()
  const cells: (Date | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(cursor.y, cursor.m, i + 1)),
  ]

  const moveMonth = (delta: number) => {
    setCursor(({ y, m }) => {
      const next = new Date(y, m + delta, 1)
      return { y: next.getFullYear(), m: next.getMonth() }
    })
  }

  const selectedDate = (() => {
    const [y, m, d] = selected.split('-').map(Number)
    return new Date(y, m, d)
  })()
  const selectedTasks = tasksForDate(selectedDate)
  const isCurrentMonth = cursor.y === now.getFullYear() && cursor.m === now.getMonth()

  const label = (d: Date) => {
    const today = new Date()
    if (d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate()) return '今天'
    return `${d.getMonth() + 1} 月 ${d.getDate()} 日`
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
          {WEEKDAYS.map((w) => (
            <div key={w} className="calendar-weekday" role="columnheader">{w}</div>
          ))}
          {cells.map((d, i) => {
            if (!d) return <div key={`empty-${i}`} className="calendar-day empty" />
            const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
            const hasTask = tasksForDate(d).length > 0
            const isToday = key === `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`
            const classes = [
              'calendar-day',
              hasTask ? 'has-task' : '',
              isToday ? 'today' : '',
              key === selected ? 'selected' : '',
            ].filter(Boolean).join(' ')
            return (
              <button key={key} type="button" className={classes} aria-label={`${d.getDate()} 日${hasTask ? '，有安排' : ''}`} aria-pressed={key === selected} onClick={() => setSelected(key)}>
                <span>{d.getDate()}</span>
                {hasTask && <i aria-hidden="true" />}
              </button>
            )
          })}
        </div>

        <div className="calendar-legend">
          <span><i className="legend-dot today-dot" aria-hidden="true" />今天</span>
          <span><i className="legend-dot task-dot" aria-hidden="true" />有安排的日子</span>
        </div>
      </section>

      <section className="calendar-card selected-day-card">
        <h2>{label(selectedDate)}的安排</h2>
        {selectedTasks.length === 0 ? (
          <p className="calendar-empty">这一天暂时没有安排，好好休息吧。</p>
        ) : (
          <ul className="schedule-list">
            {selectedTasks.map((t) => (
              <li key={t.title} className="schedule-item">
                <span className="schedule-time">{t.time}</span>
                <div className="schedule-copy"><strong>{t.title}</strong><small>预计 {t.minutes} 分钟</small></div>
              </li>
            ))}
          </ul>
        )}
        {isCurrentMonth && <p className="calendar-tip">点日历上的其他日期，可以查看那天的安排。</p>}
      </section>
    </div>
  )
}
