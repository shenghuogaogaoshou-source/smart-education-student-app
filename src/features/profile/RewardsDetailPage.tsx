import { ArrowLeft, Medal, Sparkles, Trophy } from 'lucide-react'
import { medals } from './medalsData'
import { MedalIcon } from './MedalIcon'
import './profile.css'

export function RewardsDetailPage({ onBack }: { onBack: () => void }) {
  const earnedCount = medals.filter(m => m.earned).length

  return (
    <div className="detail-page">
      <header className="detail-header">
        <button className="back-button" type="button" onClick={onBack}>
          <ArrowLeft size={20} />
        </button>
        <h1>勋章与积分</h1>
      </header>

      <div className="detail-content">
        <div className="rewards-summary">
          <div className="rewards-stat">
            <Medal size={24} />
            <div>
              <strong>{earnedCount}</strong>
              <span>已获得勋章</span>
            </div>
          </div>
          <div className="rewards-stat">
            <Sparkles size={24} />
            <div>
              <strong>1,280</strong>
              <span>当前积分</span>
            </div>
          </div>
          <div className="rewards-stat">
            <Trophy size={24} />
            <div>
              <strong>#18</strong>
              <span>本周排名</span>
            </div>
          </div>
        </div>

        <h3 className="detail-section-title">我的勋章墙</h3>
        <div className="medal-grid">
          {medals.map((medal) => (
            <div key={medal.id} className={`medal-card ${medal.earned ? 'earned' : 'locked'}`}>
              <MedalIcon medal={medal} />
              <strong>{medal.name}</strong>
              <small>{medal.desc}</small>
              {!medal.earned && <span className="lock-tag">未解锁</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
