import { ArrowLeft, Clock, PlayCircle, Search, Trophy } from 'lucide-react'
import './profile.css'

type DayGroup = {
  label: string
  date: string
  items: HistoryItem[]
  totalMinutes: number
}

type HistoryItem = {
  id: string
  title: string
  type: '学习' | '测试' | '创作' | '搜索'
  duration: number // minutes
  tag: string
}

const history: DayGroup[] = [
  {
    label: '今天',
    date: '2026-09-02',
    totalMinutes: 62,
    items: [
      { id: 'h1', title: 'AI 通识 · 第 3 课', type: '学习', duration: 25, tag: '课程' },
      { id: 'h2', title: 'Python 语法练习', type: '测试', duration: 18, tag: '练习' },
      { id: 'h3', title: '"神经网络" 知识卡片', type: '搜索', duration: 8, tag: '搜索' },
      { id: 'h4', title: '未来城市 · 插画创作', type: '创作', duration: 11, tag: '作品' },
    ],
  },
  {
    label: '昨天',
    date: '2026-09-01',
    totalMinutes: 45,
    items: [
      { id: 'h5', title: 'AI 通识 · 第 2 课', type: '学习', duration: 30, tag: '课程' },
      { id: 'h6', title: '数学几何小测', type: '测试', duration: 15, tag: '测验' },
    ],
  },
  {
    label: '本周更早',
    date: '2026-08-30',
    totalMinutes: 98,
    items: [
      { id: 'h7', title: '星空下的小镇 · 绘画', type: '创作', duration: 40, tag: '作品' },
      { id: 'h8', title: '机器学习三要素', type: '学习', duration: 22, tag: '课程' },
      { id: 'h9', title: '英语语法复习', type: '学习', duration: 20, tag: '复习' },
      { id: 'h10', title: '"光合作用" 搜索', type: '搜索', duration: 16, tag: '搜索' },
    ],
  },
]

const typeIcon: Record<HistoryItem['type'], typeof PlayCircle> = {
  '学习': PlayCircle,
  '测试': Trophy,
  '创作': Search,
  '搜索': Search,
}

const typeColor: Record<HistoryItem['type'], string> = {
  '学习': '#A8C8E4',
  '测试': '#F5C7A5',
  '创作': '#CFBDE8',
  '搜索': '#8BC4A8',
}

export function HistoryPage({ onBack }: { onBack: () => void }) {
  const totalMinutes = history.reduce((sum, g) => sum + g.totalMinutes, 0)
  const totalSessions = history.reduce((sum, g) => sum + g.items.length, 0)

  return (
    <div className="rewards-page history-page">
      <header className="profile-page-header">
        <button className="profile-back" type="button" onClick={onBack} aria-label="返回">
          <ArrowLeft size={20} />
        </button>
        <h1>学习记录</h1>
      </header>

      <div className="rewards-summary">
        <div className="rewards-stat">
          <Clock size={24} />
          <div>
            <strong>{Math.floor(totalMinutes / 60)}h {totalMinutes % 60}m</strong>
            <span>累计时长</span>
          </div>
        </div>
        <div className="rewards-stat">
          <PlayCircle size={24} />
          <div>
            <strong>{totalSessions}</strong>
            <span>学习次数</span>
          </div>
        </div>
        <div className="rewards-stat">
          <Trophy size={24} />
          <div>
            <strong>7</strong>
            <span>连续天数</span>
          </div>
        </div>
      </div>

      <div className="history-flow">
        {history.map((group) => (
          <div key={group.date} className="history-group">
            <div className="history-group-header">
              <strong>{group.label}</strong>
              <span>共 {group.items.length} 项 · {group.totalMinutes} 分钟</span>
            </div>
            <div className="history-timeline">
              {group.items.map((item) => {
                const Icon = typeIcon[item.type]
                const color = typeColor[item.type]
                return (
                  <div key={item.id} className="history-item">
                    <div className="history-dot" style={{ background: color }} />
                    <div className="history-item-body">
                      <div className="history-item-icon" style={{ background: color }}>
                        <Icon size={14} color="#fff" />
                      </div>
                      <div className="history-item-copy">
                        <strong>{item.title}</strong>
                        <div className="history-item-meta">
                          <span className="wb-tag">{item.tag}</span>
                          <span className="history-duration">{item.duration} 分钟</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
