import { ArrowLeft, Bookmark, Heart } from 'lucide-react'
import { useState } from 'react'
import { useAppState } from '../../app/AppState'
import { worksByPeriod } from '../home/homeData'
import './works.css'

type Period = keyof typeof worksByPeriod

const periodLabels: Array<{ id: Period; label: string }> = [
  { id: 'day', label: '每天' },
  { id: 'week', label: '每周' },
  { id: 'year', label: '每年' },
]

export function WorksGalleryPage({ onBack, onWorkClick }: { onBack: () => void; onWorkClick?: (workId: string) => void }) {
  const [period, setPeriod] = useState<Period>('day')
  const { state, toggleLike, toggleFavorite } = useAppState()

  const allWorks = Object.values(worksByPeriod).flat()

  return (
    <div className="works-gallery-page">
      <header className="gallery-header">
        <button className="back-button" type="button" onClick={onBack}>
          <ArrowLeft size={20} />
        </button>
        <div className="gallery-header-title">
          <h1>作品展示</h1>
          <p>看看大家的新作品</p>
        </div>
      </header>

      <div className="gallery-period-tabs" aria-label="作品热度时间范围">
        {periodLabels.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            aria-pressed={period === id}
            onClick={() => setPeriod(id)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="gallery-work-list">
        {worksByPeriod[period].map((work, index) => {
          const liked = state.likes.includes(work.id)
          const saved = state.favorites.includes(work.id)
          return (
            <article className="gallery-showcase-card" key={work.id}>
              <div className="gallery-work-index">{String(index + 1).padStart(2, '0')}</div>
              <div
                className="gallery-work-copy"
                onClick={() => onWorkClick?.(work.id)}
                style={{ cursor: onWorkClick ? 'pointer' : 'default' }}
              >
                <span>{work.tag}</span>
                <h3>{work.title}</h3>
                <p>{work.author}</p>
              </div>
              <div className="gallery-work-actions">
                <button
                  type="button"
                  aria-label="点赞作品"
                  aria-pressed={liked}
                  onClick={() => toggleLike(work.id)}
                >
                  <Heart aria-hidden="true" size={18} fill={liked ? 'currentColor' : 'none'} />
                </button>
                <button
                  type="button"
                  aria-label="收藏作品"
                  aria-pressed={saved}
                  onClick={() => toggleFavorite(work.id)}
                >
                  <Bookmark aria-hidden="true" size={18} fill={saved ? 'currentColor' : 'none'} />
                </button>
              </div>
            </article>
          )
        })}
      </div>

      <div className="gallery-all-works">
        <p className="gallery-section-title">全部作品 ({allWorks.length})</p>
        <div className="gallery-all-list">
          {allWorks.map((work) => {
            const liked = state.likes.includes(work.id)
            const saved = state.favorites.includes(work.id)
            return (
              <article
                className="gallery-all-card"
                key={work.id}
                onClick={() => onWorkClick?.(work.id)}
                style={{ cursor: onWorkClick ? 'pointer' : 'default' }}
              >
                <div className="gallery-all-placeholder">
                  <span>{work.tag}</span>
                </div>
                <div className="gallery-all-info">
                  <h3>{work.title}</h3>
                  <p>{work.author}</p>
                  <div className="gallery-all-stats">
                    <span><Heart size={12} fill={liked ? 'currentColor' : 'none'} /> {liked ? 1 : 0}</span>
                    <span><Bookmark size={12} fill={saved ? 'currentColor' : 'none'} /> {saved ? 1 : 0}</span>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      </div>
    </div>
  )
}
