import { ArrowLeft, BookOpen, Image, Tag, Trash2 } from 'lucide-react'
import { useState } from 'react'
import './profile.css'

type FavFilter = '全部' | '知识卡片' | '作品'

const allFavorites = [
  { id: 'f1', type: '知识卡片' as const, title: '光合作用与呼吸作用的区别', tag: '初中科学', time: '2 天前', source: 'AI 知识卡' },
  { id: 'f2', type: '知识卡片' as const, title: '古诗鉴赏方法与技巧', tag: '语文·古诗词', time: '3 天前', source: '课堂笔记' },
  { id: 'f3', type: '知识卡片' as const, title: '英语时态速查表', tag: '语法', time: '5 天前', source: '学习工具' },
  { id: 'f4', type: '作品' as const, title: '会分类的照相机', tag: 'AI 创意', time: '1 天前', source: '我的作品' },
  { id: 'f5', type: '作品' as const, title: '未来校园小设计', tag: '设计挑战', time: '上周', source: '我的作品' },
  { id: 'f6', type: '知识卡片' as const, title: '三角形面积公式推导', tag: '数学·几何', time: '本周', source: 'AI 知识卡' },
]

export function FavoritesPage({ onBack }: { onBack: () => void }) {
  const [filter, setFilter] = useState<FavFilter>('全部')
  const [tagFilter, setTagFilter] = useState<string | null>(null)

  const cardCount = allFavorites.filter((f) => f.type === '知识卡片').length
  const worksCount = allFavorites.filter((f) => f.type === '作品').length

  const allTags = Array.from(new Set(allFavorites.map((f) => f.tag)))

  let filtered = filter === '全部' ? allFavorites : allFavorites.filter((f) => f.type === filter)
  if (tagFilter) filtered = filtered.filter((f) => f.tag === tagFilter)

  return (
    <div className="rewards-page favorites-page">
      <header className="profile-page-header">
        <button className="profile-back" type="button" onClick={onBack} aria-label="返回">
          <ArrowLeft size={20} />
        </button>
        <h1>我的收藏</h1>
      </header>

      <div className="rewards-summary">
        <div
          className={`rewards-stat clickable ${filter === '全部' && !tagFilter ? 'active' : ''}`}
          role="button" tabIndex={0}
          onClick={() => { setFilter('全部'); setTagFilter(null) }}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { setFilter('全部'); setTagFilter(null) } }}
          title="显示全部收藏"
        >
          <BookOpen size={24} />
          <div>
            <strong>{allFavorites.length}</strong>
            <span>总收藏</span>
          </div>
        </div>
        <div
          className={`rewards-stat clickable ${filter === '知识卡片' ? 'active' : ''}`}
          role="button" tabIndex={0}
          onClick={() => setFilter(filter === '知识卡片' ? '全部' : '知识卡片')}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setFilter(filter === '知识卡片' ? '全部' : '知识卡片') }}
          title="只看知识卡片"
        >
          <BookOpen size={24} />
          <div>
            <strong>{cardCount}</strong>
            <span>知识卡片</span>
          </div>
        </div>
        <div
          className={`rewards-stat clickable ${filter === '作品' ? 'active' : ''}`}
          role="button" tabIndex={0}
          onClick={() => setFilter(filter === '作品' ? '全部' : '作品')}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setFilter(filter === '作品' ? '全部' : '作品') }}
          title="只看作品"
        >
          <Image size={24} />
          <div>
            <strong>{worksCount}</strong>
            <span>作品</span>
          </div>
        </div>
      </div>

      <div className="wb-filter-row">
        <button
          type="button"
          className={`wb-filter-chip ${filter === '全部' && !tagFilter ? 'active' : ''}`}
          onClick={() => { setFilter('全部'); setTagFilter(null) }}
        >全部</button>
        <button
          type="button"
          className={`wb-filter-chip ${filter === '知识卡片' ? 'active' : ''}`}
          onClick={() => setFilter(filter === '知识卡片' ? '全部' : '知识卡片')}
        >知识卡片</button>
        <button
          type="button"
          className={`wb-filter-chip ${filter === '作品' ? 'active' : ''}`}
          onClick={() => setFilter(filter === '作品' ? '全部' : '作品')}
        >作品</button>
      </div>

      {allTags.length > 0 && (
        <div className="wb-tag-row">
          <Tag size={14} />
          {allTags.map((t) => (
            <button
              key={t}
              type="button"
              className={`wb-tag-chip ${tagFilter === t ? 'active' : ''}`}
              onClick={() => setTagFilter(tagFilter === t ? null : t)}
            >#{t}</button>
          ))}
        </div>
      )}

      <div className="wb-list">
        {filtered.map((f) => (
          <div key={f.id} className={`fav-card ${f.type === '作品' ? 'work' : 'card'}`}>
            <div className="fav-icon-wrap">
              {f.type === '作品' ? <Image size={22} /> : <BookOpen size={22} />}
            </div>
            <div className="fav-copy">
              <strong>{f.title}</strong>
              <div className="fav-meta">
                <span className="fav-tag">#{f.tag}</span>
                <span className="fav-source">{f.source}</span>
                <span className="fav-time">{f.time}</span>
              </div>
            </div>
            <button type="button" className="wb-action-btn ghost">
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
