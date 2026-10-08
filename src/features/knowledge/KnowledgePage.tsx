import { ChevronDown, ChevronRight, Coins, Lock, Star, Sparkles } from 'lucide-react'
import { useState } from 'react'
import './knowledge.css'

type DayPlan = {
  day: string
  subtitle: string
  tasks: {
    name: string
    stages: number
    locked?: boolean
  }[]
  unlockHint?: string
}

const weekTabs = ['体验周', '01周', '02周', '03周', '04周']

const dayPlans: DayPlan[] = [
  {
    day: '第一天',
    subtitle: '数学 9月升四年级 · 第1天：应用与图形',
    tasks: [
      { name: '混合运算应用题（上）', stages: 3, locked: true },
      { name: '巧数图形', stages: 3, locked: true },
    ],
    unlockHint: '完成以上内容后解锁个性化选学',
  },
  {
    day: '第二天',
    subtitle: '数学 9月升四年级 · 第2天：重叠与代换',
    tasks: [
      { name: '重叠问题计算长度', stages: 3, locked: true },
      { name: '等量代换', stages: 3, locked: true },
    ],
    unlockHint: '完成以上内容后解锁后续内容',
  },
  {
    day: '第三天',
    subtitle: '数学 9月升四年级 · 第3天：规律探索',
    tasks: [
      { name: '数列规律进阶', stages: 3, locked: true },
      { name: '图形规律推理', stages: 3, locked: true },
    ],
    unlockHint: '完成以上内容后解锁后续内容',
  },
]

export function KnowledgePage() {
  const [activeWeek, setActiveWeek] = useState(0)
  const [expandedDays, setExpandedDays] = useState<Record<number, boolean>>({ 0: true, 1: true })

  const toggleDay = (idx: number) => {
    setExpandedDays((prev) => ({ ...prev, [idx]: !prev[idx] }))
  }

  return (
    <div className="knowledge-page">
      <header className="knowledge-header">
        <div className="header-left">
          <h1>学习计划</h1>
          <button type="button" className="all-plans-link">
            全部计划
            <ChevronRight aria-hidden="true" size={16} />
          </button>
        </div>
        <div className="header-right">
          <div className="coin-badge">
            <Coins aria-hidden="true" size={20} />
            <span>0</span>
          </div>
          <span className="new-task-tag">新任务</span>
        </div>
      </header>

      <nav className="week-tabs" role="tablist" aria-label="周次选择">
        {weekTabs.map((tab, idx) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={idx === activeWeek}
            className={`week-tab ${idx === activeWeek ? 'active' : ''}`}
            onClick={() => setActiveWeek(idx)}
          >
            {tab}
          </button>
        ))}
      </nav>

      <section className="plan-section">
        <div className="plan-hero">
          <div className="plan-hero-content">
            <Star aria-hidden="true" size={22} />
            <h2>{weekTabs[activeWeek]}计划</h2>
          </div>
          <button type="button" className="trial-btn">
            <Coins aria-hidden="true" size={16} />
            学习权益
          </button>
        </div>

        <div className="day-cards">
          {dayPlans.map((plan, idx) => {
            const expanded = expandedDays[idx] ?? false
            return (
              <article key={plan.day} className="day-card">
                <button
                  type="button"
                  className="day-header"
                  aria-expanded={expanded}
                  onClick={() => toggleDay(idx)}
                >
                  <h3>{plan.day}</h3>
                  {expanded ? (
                    <ChevronDown aria-hidden="true" size={20} />
                  ) : (
                    <ChevronRight aria-hidden="true" size={20} />
                  )}
                </button>

                {expanded && (
                  <div className="day-body">
                    <div className="day-subtitle">
                      <span className="subject-tag">数学</span>
                      <span>{plan.subtitle}</span>
                    </div>

                    <ul className="task-list">
                      {plan.tasks.map((task) => (
                        <li key={task.name} className="task-item">
                          <div className="task-icon">
                            <span className="op-icon">×÷</span>
                          </div>
                          <div className="task-info">
                            <h4>{task.name}</h4>
                            <p>共{task.stages}个环节</p>
                          </div>
                          {task.locked && (
                            <button type="button" className="task-lock-btn" aria-label="完成前锁定">
                              <Lock aria-hidden="true" size={18} />
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>

                    {plan.unlockHint && (
                      <p className="unlock-hint">{plan.unlockHint}</p>
                    )}
                  </div>
                )}
              </article>
            )
          })}
        </div>
      </section>

      {/* 装饰 */}
      <div className="knowledge-decoration" aria-hidden="true">
        <Sparkles className="deco-sparkle-1" size={28} />
        <Sparkles className="deco-sparkle-2" size={20} />
        <Star className="deco-star" size={16} />
      </div>
    </div>
  )
}


