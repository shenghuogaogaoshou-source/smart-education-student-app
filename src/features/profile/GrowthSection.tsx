import { CalendarDays, ChevronRight, Lightbulb, PencilLine } from 'lucide-react'
import { useState } from 'react'
import { useAppState } from '../../app/AppState'
import { GRADE_BAND_LABELS, getGradeBand, isTestUnlocked, type PrimaryGrade } from '../../app/learning'
import type { LearningPlanTask } from '../../app/learningPlan'
import { GrowthRadar } from './GrowthRadar'
import { deriveGrowthProfile } from './growthProfile'
import { formatPlanTaskDate, getNextPlanTask, getPlanTaskView, isActiveBandTask } from './plan'

type Props = {
  onStartTask: (task: LearningPlanTask) => void
  onOpenSchedule: () => void
  onOpenCalendar: () => void
}

export function GrowthSection({ onStartTask, onOpenSchedule, onOpenCalendar }: Props) {
  const [tab, setTab] = useState<'schedule' | 'portrait'>('schedule')
  const { state } = useAppState()
  const band = getGradeBand(state.grade as PrimaryGrade)
  const progress = state.learningProgress[band]
  const tasks = state.learningPlan.tasks.filter((task) => isActiveBandTask(task, state.grade))
  const nextTask = getNextPlanTask(tasks, state.learningProgress)
  const view = nextTask ? getPlanTaskView(nextTask, state.learningProgress) : null
  const followingCount = nextTask
    ? tasks.filter((task) =>
      task.id !== nextTask.id
      && (
        task.date > nextTask.date
        || (task.date === nextTask.date && task.time > nextTask.time)
        || (task.date === nextTask.date && task.time === nextTask.time && task.order > nextTask.order)
      )
      && getPlanTaskView(task, state.learningProgress).statusLabel !== '已完成').length
    : 0
  const lockedTest = nextTask?.kind === 'test' && !isTestUnlocked(progress, nextTask.partId)
  const primaryLabel = nextTask?.kind === 'test' && !lockedTest ? '开始测试' : '开始学习'
  const growthProfile = deriveGrowthProfile(state.learningEvents, state.accountId)

  return (
    <section className="profile-section growth-card" aria-label="成长安排">
      <div className="growth-tabs" aria-label="成长内容">
        <button type="button" aria-pressed={tab === 'schedule'} onClick={() => setTab('schedule')}>成长安排</button>
        <button type="button" aria-pressed={tab === 'portrait'} onClick={() => setTab('portrait')}>成长画像</button>
      </div>
      {tab === 'schedule' ? (
        <div className="schedule-panel">
          <div className="section-heading-row">
            <div>
              <p className="section-kicker">{nextTask ? '接下来安排这一项' : '未来七天安排'}</p>
              <h2>{nextTask?.title ?? '这几天暂时没有安排'}</h2>
            </div>
            <button className="calendar-entry" type="button" aria-label="打开整月日历" onClick={onOpenCalendar}>
              <CalendarDays aria-hidden="true" size={25} />
            </button>
          </div>

          {nextTask && view ? (
            <>
              <div className="growth-task-badges">
                <span className={`schedule-kind schedule-kind--${nextTask.kind}`}>{view.kindLabel}</span>
                <span>{GRADE_BAND_LABELS[band]}</span>
                {view.showReview && <span className="schedule-review">复习</span>}
                <span className={`schedule-status schedule-status--${view.tone}`}>{view.statusLabel}</span>
              </div>
              <div className="schedule-meta">
                <span>{formatPlanTaskDate(nextTask)} {nextTask.time}</span>
                <span>预计 {nextTask.minutes} 分钟</span>
                <span>{followingCount ? `之后还有 ${followingCount} 项` : '这是最近的一项'}</span>
              </div>
              <p className="gentle-tip">按自己的节奏来，需要时可以调整时间。</p>
              <div className="schedule-actions">
                <button className="solid-small" type="button" onClick={() => onStartTask(nextTask)}>{primaryLabel}</button>
                <button className="ghost-small" type="button" onClick={onOpenSchedule}>
                  <PencilLine aria-hidden="true" size={16} />调整安排
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="gentle-tip">没有任务也可以安心休息。想往前探索时，再来安排一小步。</p>
              <div className="schedule-actions">
                <button className="solid-small" type="button" onClick={onOpenSchedule}>自己安排</button>
                <button className="ghost-small" type="button" onClick={onOpenCalendar}>查看日历</button>
              </div>
            </>
          )}

          <button className="ai-suggestion" type="button" onClick={onOpenSchedule}>
            <Lightbulb aria-hidden="true" size={17} />
            <span>AI 帮我安排</span>
            <ChevronRight aria-hidden="true" size={17} />
          </button>
        </div>
      ) : (
        <div className="portrait-panel">
          <div className="section-heading-row"><div><p className="section-kicker">只和自己的近期相比</p><h2>近期成长足迹</h2></div></div>
          <GrowthRadar scores={growthProfile.scores} />
          {growthProfile.hasEvidence && state.growthTitle ? (
            <div className="praise-title">
              <span>本周小称号</span>
              <strong>{state.growthTitle.text}</strong>
              <p>{state.growthTitle.description}</p>
            </div>
          ) : (
            <div className="praise-title praise-title--neutral">
              <span>正在认识你的学习方式</span>
              <strong>每一次好奇都值得慢慢记录</strong>
              <p>完成知识、挑战、订正或作品后，这里会留下属于你的成长线索。</p>
            </div>
          )}
          <p className="portrait-note">这是近期学习过程的温和记录，不是固定能力评价；AI 对话不会进入画像数据。</p>
        </div>
      )}
    </section>
  )
}
