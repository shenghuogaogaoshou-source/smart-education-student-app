import { CalendarDays, ChevronRight, Lightbulb, PencilLine, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { GrowthRadar } from './GrowthRadar'

// AI 建议内容每次打开都会轮换，不再总是同一条。
const AI_SUGGESTIONS = [
  {
    kicker: '先预览，再决定',
    title: '把今天的探索提前到 18:40',
    desc: '根据你今天的安排，提前 20 分钟可能更从容。你也可以直接修改下面的时间。',
    time: '18:40',
  },
  {
    kicker: '试试小步走',
    title: '拆成两个 8 分钟小节',
    desc: '今天的内容有点多，先做 8 分钟观察练习，休息一下再完成分类挑战，会更轻松。',
    time: '19:00',
  },
  {
    kicker: '温故而知新',
    title: '先花 3 分钟回看昨天的作品',
    desc: '回看昨天的《会分类的照相机》，今天的探索会更快上手。',
    time: '19:05',
  },
  {
    kicker: '状态刚好',
    title: '保持 19:00 不变',
    desc: '你最近在这个时间段专注度最好，按原计划进行就很棒。',
    time: '19:00',
  },
]

export function GrowthSection({ onStartLearning, onAdjustSchedule, onOpenCalendar }: {
  onStartLearning: () => void
  onAdjustSchedule: () => void
  onOpenCalendar: () => void
}) {
  const [tab, setTab] = useState<'schedule' | 'portrait'>('schedule')
  const [previewOpen, setPreviewOpen] = useState(false)
  const [suggestionIdx, setSuggestionIdx] = useState(() => Math.floor(Math.random() * AI_SUGGESTIONS.length))
  const [suggestionTime, setSuggestionTime] = useState(AI_SUGGESTIONS[suggestionIdx].time)
  const [confirmedNote, setConfirmedNote] = useState('')
  const suggestion = AI_SUGGESTIONS[suggestionIdx]

  const openSuggestion = () => {
    setSuggestionIdx((i) => (i + 1) % AI_SUGGESTIONS.length)
    setPreviewOpen(true)
  }

  // 弹窗打开时锁定背景滚动（html 与 body 同时锁），关闭后恢复。
  useEffect(() => {
    if (!previewOpen) return
    const { body, documentElement: root } = document
    const original = { body: body.style.overflow, root: root.style.overflow }
    body.style.overflow = 'hidden'
    root.style.overflow = 'hidden'
    return () => {
      body.style.overflow = original.body
      root.style.overflow = original.root
    }
  }, [previewOpen])

  return (
    <section className="profile-section growth-card">
      <div className="growth-tabs" aria-label="成长内容">
        <button type="button" aria-pressed={tab === 'schedule'} onClick={() => setTab('schedule')}>成长安排</button>
        <button type="button" aria-pressed={tab === 'portrait'} onClick={() => setTab('portrait')}>成长画像</button>
      </div>
      {tab === 'schedule' ? (
        <div className="schedule-panel">
          <div className="section-heading-row">
            <div><p className="section-kicker">下一项安排</p><h2>图片识别小探索</h2></div>
            <button className="calendar-entry" type="button" aria-label="打开整月日历" onClick={onOpenCalendar}><CalendarDays aria-hidden="true" size={25} /></button>
          </div>
          <div className="schedule-meta"><span>今天 19:00</span><span>预计 15 分钟</span><span>之后还有 2 项</span></div>
          <p className="gentle-tip">按自己的节奏来，需要时可以调整时间。</p>
          {confirmedNote && <p className="success-note" role="status">{confirmedNote}</p>}
          <div className="schedule-actions">
            <button className="solid-small" type="button" onClick={onStartLearning}>开始学习</button>
            <button className="ghost-small" type="button" onClick={onAdjustSchedule}><PencilLine aria-hidden="true" size={16} />调整安排</button>
          </div>
          <button className="ai-suggestion" type="button" onClick={openSuggestion}><Lightbulb aria-hidden="true" size={17} /><span>看看 AI 建议</span><ChevronRight aria-hidden="true" size={17} /></button>
        </div>
      ) : (
        <div className="portrait-panel">
          <div className="section-heading-row"><div><p className="section-kicker">只和自己的近期相比</p><h2>近期成长足迹</h2></div></div>
          <GrowthRadar />
          <div className="praise-title"><span>本周小称号</span><strong>耐心找方法的小研究员</strong><p>你最近愿意换一种方法再试一次，这份耐心很珍贵。</p></div>
          <p className="portrait-note">这是近期学习过程的温和记录，不是固定能力评价；AI 对话不会进入画像数据。</p>
        </div>
      )}
      {previewOpen && createPortal(
        <div className="profile-dialog-backdrop" role="presentation">
          <section className="profile-dialog" role="dialog" aria-modal="true" aria-label="安排建议预览">
            <button className="dialog-close" type="button" aria-label="关闭安排建议" onClick={() => setPreviewOpen(false)}><X aria-hidden="true" /></button>
            <p className="section-kicker">{suggestion.kicker}</p><h2>{suggestion.title}</h2>
            <p>{suggestion.desc}</p>
            <label>建议时间<input type="time" key={suggestionIdx} value={suggestionTime} onChange={(e) => setSuggestionTime(e.target.value)} /></label>
            <div className="dialog-actions">
              <button type="button" onClick={() => setPreviewOpen(false)}>暂不调整</button>
              <button type="button" onClick={() => { setConfirmedNote(`安排已更新：${suggestion.title}（${suggestionTime}）`); setPreviewOpen(false) }}>确认调整</button>
            </div>
          </section>
        </div>,
        document.body,
      )}
    </section>
  )
}
