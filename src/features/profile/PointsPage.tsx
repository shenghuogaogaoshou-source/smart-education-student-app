import { ArrowLeft, Plus, Sparkles, Minus } from 'lucide-react'
import './profile.css'

type PointRecord = {
  id: string
  type: 'earn' | 'spend'
  title: string
  amount: number
  date: string
}

const records: PointRecord[] = [
  { id: 'p1', type: 'earn', title: '完成今日学习任务', amount: 20, date: '今天 19:15' },
  { id: 'p2', type: 'earn', title: '作品《会分类的照相机》被点赞', amount: 5, date: '今天 14:02' },
  { id: 'p3', type: 'spend', title: '解锁 AI 形象：星空精灵', amount: -500, date: '昨天 20:30' },
  { id: 'p4', type: 'earn', title: '连续学习 7 天奖励', amount: 50, date: '昨天 08:00' },
  { id: 'p5', type: 'earn', title: '勋章「观察家」获得奖励', amount: 30, date: '昨天 07:55' },
  { id: 'p6', type: 'spend', title: '购买服饰：星空披风', amount: -120, date: '2026-08-28' },
  { id: 'p7', type: 'earn', title: '完成创意作品《声音地图》', amount: 40, date: '2026-08-27' },
  { id: 'p8', type: 'earn', title: '首次登录奖励', amount: 100, date: '2026-08-01' },
]

export function PointsPage({ onBack }: { onBack: () => void }) {
  const balance = records.reduce((sum, r) => sum + r.amount, 0) + 1280 - records.reduce((s, r) => s + Math.max(r.amount, 0), 0)
  const totalEarn = records.filter((r) => r.type === 'earn').reduce((s, r) => s + r.amount, 0)
  const totalSpend = records.filter((r) => r.type === 'spend').reduce((s, r) => s + Math.abs(r.amount), 0)

  return (
    <div className="rewards-page points-page">
      <header className="profile-page-header">
        <button className="profile-back" type="button" onClick={onBack} aria-label="返回">
          <ArrowLeft size={20} />
        </button>
        <h1>积分账户</h1>
      </header>

      <div className="points-balance-card">
        <Sparkles aria-hidden="true" size={28} />
        <div>
          <span>当前积分</span>
          <strong>1,280</strong>
        </div>
      </div>

      <div className="points-summary">
        <div><span>累计获得</span><strong>+{totalEarn}</strong></div>
        <div><span>累计消耗</span><strong>-{totalSpend}</strong></div>
      </div>

      <h3 className="detail-section-title">收支明细</h3>
      <ul className="points-list">
        {records.map((r) => (
          <li key={r.id} className={`points-item ${r.type}`}>
            <div className="points-icon">{r.type === 'earn' ? <Plus size={16} /> : <Minus size={16} />}</div>
            <div className="points-copy">
              <strong>{r.title}</strong>
              <small>{r.date}</small>
            </div>
            <span className="points-amount">{r.amount > 0 ? '+' : ''}{r.amount}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
