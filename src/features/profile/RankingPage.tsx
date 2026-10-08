import { ArrowLeft, Crown, Medal, Sparkles, Trophy } from 'lucide-react'
import './profile.css'

type Ranker = {
  rank: number
  name: string
  points: number
  isMe?: boolean
}

const rankers: Ranker[] = [
  { rank: 1, name: '星河同学', points: 3120 },
  { rank: 2, name: '小明同学', points: 2890 },
  { rank: 3, name: '晨曦同学', points: 2510 },
  { rank: 4, name: '远帆同学', points: 2340 },
  { rank: 5, name: '林川同学', points: 2180 },
  { rank: 6, name: '清禾同学', points: 2005 },
  { rank: 7, name: '小红同学', points: 1950 },
  { rank: 8, name: '小刚同学', points: 1820 },
  { rank: 9, name: '小雨同学', points: 1700 },
  { rank: 10, name: '阿墨同学', points: 1610 },
  { rank: 18, name: '我（晨曦同学）', points: 1280, isMe: true },
]

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <Crown className="rank-gold" size={18} />
  if (rank === 2) return <Medal className="rank-silver" size={18} />
  if (rank === 3) return <Medal className="rank-bronze" size={18} />
  return <span className="rank-number">{rank}</span>
}

export function RankingPage({ onBack }: { onBack: () => void }) {
  const me = rankers.find((r) => r.isMe)

  return (
    <div className="rewards-page ranking-page">
      <header className="profile-page-header">
        <button className="profile-back" type="button" onClick={onBack} aria-label="返回">
          <ArrowLeft size={20} />
        </button>
        <h1>积分排行榜</h1>
      </header>

      {me && (
        <div className="ranking-me-card">
          <div className="ranking-me-badge"><RankBadge rank={me.rank} /></div>
          <div>
            <strong>你的排名：第 {me.rank} 名</strong>
            <small>本周继续学习就能往前冲！</small>
          </div>
          <Sparkles aria-hidden="true" size={20} />
        </div>
      )}

      <h3 className="detail-section-title">本周前 10 名</h3>
      <ol className="ranking-list">
        {rankers.filter((r) => !r.isMe).map((r) => (
          <li key={r.rank} className="ranking-item">
            <div className="ranking-item-rank"><RankBadge rank={r.rank} /></div>
            <div className="ranking-item-copy">
              <strong>{r.name}</strong>
              <small>本周获得 {r.points} 积分</small>
            </div>
            <span className="ranking-item-points">{r.points}</span>
          </li>
        ))}
      </ol>

      <p className="ranking-note">积分每周末清零；认真学习、完成作品就能获得积分。</p>
    </div>
  )
}
