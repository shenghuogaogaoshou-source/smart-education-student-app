import { ArrowLeft, BookmarkCheck, ChevronRight, Image, Users } from 'lucide-react'
import { useMemo, useState } from 'react'
import { WorkMediaThumbnail } from '../works/WorkMediaThumbnail'
import { useOptionalWorks } from '../works/WorksProvider'
import type { WorkSource } from '../works/types'
import './profile.css'

type FavoriteSource = '全部' | '脑洞放映厅' | '创造模块' | 'AI 创作'

const SOURCE_FILTERS: FavoriteSource[] = ['全部', '脑洞放映厅', '创造模块', 'AI 创作']

function sourceLabel(source: WorkSource): Exclude<FavoriteSource, '全部'> {
  if (source === 'brain-film') return '脑洞放映厅'
  if (source === 'creative-module') return '创造模块'
  return 'AI 创作'
}

export function FavoritesPage({
  onBack,
  onWorkClick,
}: {
  onBack: () => void
  onWorkClick?: (workId: string) => void
}) {
  const worksState = useOptionalWorks()
  const [filter, setFilter] = useState<FavoriteSource>('全部')
  const favorites = useMemo(() => (
    (worksState?.works ?? []).filter((work) => (
      work.status === 'published'
      && (work.creatorId || work.ownerId) !== worksState?.accountId
      && work.favoritedBy.includes(worksState?.accountId ?? '')
    ))
  ), [worksState?.accountId, worksState?.works])
  const visibleWorks = favorites.filter((work) => (
    filter === '全部' || sourceLabel(work.source) === filter
  ))
  const creatorCount = new Set(favorites.map((work) => work.creatorId)).size
  const sourceCount = new Set(favorites.map((work) => sourceLabel(work.source))).size

  return (
    <div className="rewards-page favorites-page">
      <header className="profile-page-header">
        <button className="profile-back" type="button" onClick={onBack} aria-label="返回"><ArrowLeft size={20} /></button>
        <h1>我的收藏</h1>
      </header>

      <div className="rewards-summary">
        <button
          className={`rewards-stat clickable ${filter === '全部' ? 'active' : ''}`}
          type="button"
          onClick={() => setFilter('全部')}
        >
          <BookmarkCheck size={24} /><div><strong>{favorites.length}</strong><span>收藏作品</span></div>
        </button>
        <div className="rewards-stat">
          <Users size={24} /><div><strong>{creatorCount}</strong><span>作品作者</span></div>
        </div>
        <div className="rewards-stat">
          <Image size={24} /><div><strong>{sourceCount}</strong><span>作品来源</span></div>
        </div>
      </div>

      <div className="wb-filter-row" aria-label="收藏作品来源">
        {SOURCE_FILTERS.map((source) => (
          <button
            key={source}
            type="button"
            className={`wb-filter-chip ${filter === source ? 'active' : ''}`}
            aria-pressed={filter === source}
            onClick={() => setFilter(source)}
          >
            {source}
          </button>
        ))}
      </div>

      <div className="fav-work-list">
        {visibleWorks.map((work) => (
          <article key={work.id} className="fav-work-card">
            <button className="fav-work-open" type="button" onClick={() => onWorkClick?.(work.id)}>
              <WorkMediaThumbnail work={work} className="fav-work-cover" />
              <span className="fav-work-copy">
                <span>{sourceLabel(work.source)} · 已导入作品</span>
                <strong>{work.title}</strong>
                <span className="fav-work-author">{work.creatorName}</span>
                <small>{work.description}</small>
              </span>
              <ChevronRight className="fav-work-chevron" aria-hidden="true" size={18} />
            </button>
            <button
              type="button"
              className="fav-remove-button"
              aria-label={`取消收藏 ${work.title}`}
              onClick={() => worksState?.toggleFavorite(work.id)}
            >
              <BookmarkCheck size={16} fill="currentColor" />
            </button>
          </article>
        ))}
        {!worksState?.loading && visibleWorks.length === 0 && (
          <div className="wm-empty">
            <Image size={30} />
            <strong>这里暂时没有收藏作品</strong>
            <small>去“看看大家的新作品”里发现更多同学的创意吧。</small>
          </div>
        )}
      </div>
    </div>
  )
}
