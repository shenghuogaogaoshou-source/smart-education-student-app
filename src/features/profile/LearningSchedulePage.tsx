import { ArrowLeft, Check, Clock, Minus, Plus } from 'lucide-react'
import { useState } from 'react'
import { PLAN_TASKS } from './plan'
import './profile.css'

function shiftTime(time: string, minutes: number) {
  const [h, m] = time.split(':').map(Number)
  const total = (h * 60 + m + minutes + 24 * 60) % (24 * 60)
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

const DAY_LABELS = ['今天', '明天', '后天']

export function LearningSchedulePage({ onBack }: { onBack: () => void }) {
  const [adjustments, setAdjustments] = useState<Record<string, string>>({})
  const [savedTitle, setSavedTitle] = useState('')

  const dayLabel = (offset: number) => DAY_LABELS[offset] ?? `+${offset} 天`

  const handleSave = (title: string, time: string) => {
    setSavedTitle(`${title} 已调整到 ${time}`)
    window.setTimeout(() => setSavedTitle(''), 2500)
  }

  return (
    <div className="schedule-page">
      <header className="profile-page-header">
        <button className="profile-back" type="button" onClick={onBack} aria-label="返回">
          <ArrowLeft size={20} />
        </button>
        <h1>学习安排</h1>
      </header>

      <p className="schedule-page-intro">按自己的节奏来，拖动时间或用加减号微调，安排会即时更新。</p>

      <ul className="schedule-list">
        {PLAN_TASKS.map((task) => {
          const current = adjustments[task.title] ?? task.time
          return (
            <li key={task.title} className="schedule-card">
              <div className="schedule-item">
                <span className="schedule-day">{dayLabel(task.dayOffset)}</span>
                <div className="schedule-copy"><strong>{task.title}</strong><small>预计 {task.minutes} 分钟</small></div>
                <span className="schedule-time"><Clock aria-hidden="true" size={14} />{current}</span>
              </div>
              <div className="schedule-adjust">
                <button type="button" aria-label={`${task.title} 提前 30 分钟`} onClick={() => setAdjustments((a) => ({ ...a, [task.title]: shiftTime(current, -30) }))}><Minus aria-hidden="true" size={15} />30 分</button>
                <input
                  type="time"
                  value={current}
                  aria-label={`${task.title} 的时间`}
                  onChange={(e) => setAdjustments((a) => ({ ...a, [task.title]: e.target.value }))}
                />
                <button type="button" aria-label={`${task.title} 推后 30 分钟`} onClick={() => setAdjustments((a) => ({ ...a, [task.title]: shiftTime(current, 30) }))}><Plus aria-hidden="true" size={15} />30 分</button>
                <button
                  className="schedule-confirm"
                  type="button"
                  disabled={current === task.time}
                  onClick={() => handleSave(task.title, current)}
                >
                  <Check aria-hidden="true" size={14} />确认
                </button>
              </div>
            </li>
          )
        })}
      </ul>

      {savedTitle && <p className="success-note" role="status">{savedTitle}</p>}
      <p className="calendar-tip">调整只影响提醒时间，学习内容不会变化。</p>
    </div>
  )
}
