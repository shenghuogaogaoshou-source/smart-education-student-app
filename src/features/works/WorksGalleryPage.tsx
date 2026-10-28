import { Bookmark, CalendarDays, CalendarRange, Heart, Sparkles, Sun } from 'lucide-react'
import { useState } from 'react'
import { useAppState } from '../../app/AppState'
import { MobilePageHeader } from '../../components/MobilePageHeader'
import { rankPublishedWorks, type RankingPeriod } from './moderation'
import { WorkMediaThumbnail } from './WorkMediaThumbnail'
import { useOptionalWorks } from './WorksProvider'
import './works.css'

const periodLabels = [
  { id: 'day', label: '每天', Icon: Sun },
  { id: 'week', label: '每周', Icon: CalendarDays },
  { id: 'year', label: '每年', Icon: CalendarRange },
] as const satisfies Array<{ id: RankingPeriod; label: string; Icon: typeof Sun }>

export function WorksGalleryPage({ onBack, onWorkClick }: { onBack: () => void; onWorkClick?: (workId: string) => void }) {
  const [period, setPeriod] = useState<RankingPeriod>('day')
  const { state } = useAppState()
  const worksState = useOptionalWorks()
  const allPublished = rankPublishedWorks(worksState?.works ?? [], period)

  return (
    <div className="works-gallery-page">
      <MobilePageHeader
        className="works-gallery-header"
        eyebrow="看看大家的新作品"
        title="作品展示"
        onBack={onBack}
      />

      <div className="gallery-period-tabs" aria-label="作品热度时间范围">
        {periodLabels.map(({ id, label, Icon }) => (
          <button
            key={id}
            className="gallery-period-button"
            type="button"
            aria-pressed={period === id}
            onClick={() => setPeriod(id)}
          >
            <Icon aria-hidden="true" size={16} />
            <span>{label}</span>
          </button>
        ))}
      </div>

      <div className="gallery-work-list">
        {allPublished.slice(0, 3).map((work, index) => {
          const liked = work.likedBy.includes(state.accountId)
          const saved = work.favoritedBy.includes(state.accountId)
          return (
            <article className="gallery-showcase-card" key={work.id}>
              <button className="gallery-work-open" type="button" onClick={() => onWorkClick?.(work.id)} aria-label={`查看${work.title}`}>
                <div className="gallery-work-media">
                  <WorkMediaThumbnail work={work} />
                  <div className="gallery-work-index">{String(index + 1).padStart(2, '0')}</div>
                </div>
                <div className="gallery-work-copy">
                  <span>{work.source === 'brain-film' ? '脑洞放映厅' : work.source === 'creative-module' ? '创造模块' : 'AI 创作'}</span>
                  <h3>{work.title}</h3>
                  <p>{work.creatorName || state.nickname} · ❤️ {work.likes} · ⭐ {work.favorites}</p>
                </div>
              </button>
              <div className="gallery-work-actions">
                <button type="button" aria-label="点赞作品" aria-pressed={liked} onClick={() => worksState?.toggleLike(work.id)}>
                  <Heart aria-hidden="true" size={18} fill={liked ? 'currentColor' : 'none'} />
                </button>
                <button type="button" aria-label="收藏作品" aria-pressed={saved} onClick={() => worksState?.toggleFavorite(work.id)}>
                  <Bookmark aria-hidden="true" size={18} fill={saved ? 'currentColor' : 'none'} />
                </button>
              </div>
            </article>
          )
        })}
      </div>

      {allPublished.length > 3 && (
        <div className="gallery-compact-grid" aria-label="全部作品">
          {allPublished.slice(3).map((work, offset) => {
            const liked = work.likedBy.includes(state.accountId)
            const saved = work.favoritedBy.includes(state.accountId)
            return (
              <article className="gallery-showcase-card is-compact" key={work.id}>
                <button className="gallery-work-open" type="button" onClick={() => onWorkClick?.(work.id)} aria-label={`查看${work.title}`}>
                  <div className="gallery-work-media"><WorkMediaThumbnail work={work} /></div>
                  <div className="gallery-work-copy">
                    <span>{work.source === 'brain-film' ? '脑洞放映厅' : work.source === 'creative-module' ? '创造模块' : 'AI 创作'}</span>
                    <h3>{work.title}</h3>
                    <p>{work.creatorName || state.nickname} · ❤️ {work.likes} · ⭐ {work.favorites}</p>
                  </div>
                </button>
                <div className="gallery-work-actions">
                  <button type="button" aria-label={`点赞作品${offset + 4}`} aria-pressed={liked} onClick={() => worksState?.toggleLike(work.id)}>
                    <Heart aria-hidden="true" size={17} fill={liked ? 'currentColor' : 'none'} />
                  </button>
                  <button type="button" aria-label={`收藏作品${offset + 4}`} aria-pressed={saved} onClick={() => worksState?.toggleFavorite(work.id)}>
                    <Bookmark aria-hidden="true" size={17} fill={saved ? 'currentColor' : 'none'} />
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      )}

      {!worksState?.loading && allPublished.length === 0 && (
        <div className="gallery-empty" role="status">
          <Sparkles aria-hidden="true" />
          <strong>还没有公开作品</strong>
          <p>完成一次创作并发布后，就会出现在这里。</p>
        </div>
      )}

    </div>
  )
}
