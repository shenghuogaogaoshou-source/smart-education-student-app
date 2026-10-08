import { ArrowLeft, Medal, Star } from 'lucide-react'
import { useState } from 'react'
import { medals } from './medalsData'
import { MedalIcon } from './MedalIcon'
import './profile.css'

type MedalFilter = '全部' | '已获得' | '待解锁'

export function MedalsPage({ onBack }: { onBack: () => void }) {
  const [filter, setFilter] = useState<MedalFilter>('全部')

  const earnedCount = medals.filter((m) => m.earned).length

  const filtered = filter === '全部'
    ? medals
    : filter === '已获得'
      ? medals.filter((m) => m.earned)
      : medals.filter((m) => !m.earned)

  return (
    <div className="rewards-page medals-page">
      <header className="profile-page-header">
        <button className="profile-back" type="button" onClick={onBack} aria-label="返回">
          <ArrowLeft size={20} />
        </button>
        <h1>我的勋章</h1>
      </header>

      <div className="rewards-summary">
        <div
          className={`rewards-stat clickable ${filter === '已获得' ? 'active' : ''}`}
          role="button"
          tabIndex={0}
          onClick={() => setFilter(filter === '已获得' ? '全部' : '已获得')}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setFilter(filter === '已获得' ? '全部' : '已获得') }}
        >
          <Medal size={24} />
          <div>
            <strong>{earnedCount}</strong>
            <span>已获得</span>
          </div>
        </div>
        <div
          className={`rewards-stat clickable ${filter === '待解锁' ? 'active' : ''}`}
          role="button"
          tabIndex={0}
          onClick={() => setFilter(filter === '待解锁' ? '全部' : '待解锁')}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setFilter(filter === '待解锁' ? '全部' : '待解锁') }}
        >
          <Star size={24} />
          <div>
            <strong>{medals.length - earnedCount}</strong>
            <span>待解锁</span>
          </div>
        </div>
      </div>

      <div className="wb-filter-row">
        {(['全部', '已获得', '待解锁'] as MedalFilter[]).map((f) => (
          <button
            key={f}
            type="button"
            className={`wb-filter-chip ${filter === f ? 'active' : ''}`}
            onClick={() => setFilter(f)}
          >
            {f}
          </button>
        ))}
      </div>

      <h3 className="detail-section-title">
        {filter === '全部' ? '全部勋章' : filter === '已获得' ? '已获得勋章' : '待解锁勋章'}
        <span style={{ color: 'var(--muted)', fontSize: '0.7em', marginLeft: '8px', fontWeight: 500 }}>
          （{filtered.length} 项）
        </span>
      </h3>

      <div className="medal-grid">
        {filtered.map((medal) => (
          <div key={medal.id} className={`medal-card ${medal.earned ? 'earned' : 'locked'}`}>
            <MedalIcon medal={medal} />
            <strong>{medal.name}</strong>
            <small>{medal.desc}</small>
            {!medal.earned && <span className="lock-tag">未解锁</span>}
          </div>
        ))}
      </div>
    </div>
  )
}
