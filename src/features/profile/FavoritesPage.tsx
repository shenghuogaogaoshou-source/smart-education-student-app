import { ArrowLeft, BookOpen, Image, Tag, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useAppState } from '../../app/AppState'
import { useOptionalWorks } from '../works/WorksProvider'
import './profile.css'

type FavFilter = '全部' | '知识卡片' | '作品'
type FavoriteItem = {
  id: string
  type: '知识卡片' | '作品'
  title: string
  tag: string
  source: string
}

const knowledgeFavorites: FavoriteItem[] = [
  { id: 'f1', type: '知识卡片', title: '光合作用与呼吸作用的区别', tag: '小学科学', source: 'AI 知识卡' },
  { id: 'f2', type: '知识卡片', title: '古诗鉴赏方法与技巧', tag: '语文·古诗词', source: '课堂笔记' },
  { id: 'f3', type: '知识卡片', title: '英语时态速查表', tag: '语法', source: '学习工具' },
  { id: 'f6', type: '知识卡片', title: '三角形面积公式推导', tag: '数学·几何', source: 'AI 知识卡' },
]

export function FavoritesPage({ onBack }: { onBack: () => void }) {
  const [filter, setFilter] = useState<FavFilter>('全部')
  const [tagFilter, setTagFilter] = useState<string | null>(null)
  const { state } = useAppState()
  const worksState = useOptionalWorks()
  const workFavorites = useMemo<FavoriteItem[]>(() => (worksState?.works ?? [])
    .filter((work) => work.favoritedBy.includes(state.accountId))
    .map((work) => ({
      id: work.id,
      type: '作品',
      title: work.title,
      tag: work.source === 'brain-film' ? '脑洞放映厅' : work.source === 'creative-module' ? '创造模块' : 'AI 创作',
      source: work.aiTools.join(' · '),
    })), [state.accountId, worksState?.works])
  const allFavorites = [...knowledgeFavorites, ...workFavorites]
  const cardCount = allFavorites.filter((item) => item.type === '知识卡片').length
  const worksCount = workFavorites.length
  const allTags = Array.from(new Set(allFavorites.map((item) => item.tag)))
  let filtered = filter === '全部' ? allFavorites : allFavorites.filter((item) => item.type === filter)
  if (tagFilter) filtered = filtered.filter((item) => item.tag === tagFilter)

  const remove = (item: FavoriteItem) => {
    if (item.type === '作品') worksState?.toggleFavorite(item.id)
  }

  return (
    <div className="rewards-page favorites-page">
      <header className="profile-page-header">
        <button className="profile-back" type="button" onClick={onBack} aria-label="返回"><ArrowLeft size={20} /></button>
        <h1>我的收藏</h1>
      </header>

      <div className="rewards-summary">
        <button className={`rewards-stat clickable ${filter === '全部' && !tagFilter ? 'active' : ''}`} type="button" onClick={() => { setFilter('全部'); setTagFilter(null) }}>
          <BookOpen size={24} /><div><strong>{allFavorites.length}</strong><span>总收藏</span></div>
        </button>
        <button className={`rewards-stat clickable ${filter === '知识卡片' ? 'active' : ''}`} type="button" onClick={() => setFilter(filter === '知识卡片' ? '全部' : '知识卡片')}>
          <BookOpen size={24} /><div><strong>{cardCount}</strong><span>知识卡片</span></div>
        </button>
        <button className={`rewards-stat clickable ${filter === '作品' ? 'active' : ''}`} type="button" onClick={() => setFilter(filter === '作品' ? '全部' : '作品')}>
          <Image size={24} /><div><strong>{worksCount}</strong><span>作品</span></div>
        </button>
      </div>

      <div className="wb-filter-row">
        {(['全部', '知识卡片', '作品'] as FavFilter[]).map((item) => (
          <button key={item} type="button" className={`wb-filter-chip ${filter === item ? 'active' : ''}`} onClick={() => setFilter(item)}>{item}</button>
        ))}
      </div>

      {allTags.length > 0 && (
        <div className="wb-tag-row">
          <Tag size={14} />
          {allTags.map((tag) => <button key={tag} type="button" className={`wb-tag-chip ${tagFilter === tag ? 'active' : ''}`} onClick={() => setTagFilter(tagFilter === tag ? null : tag)}>#{tag}</button>)}
        </div>
      )}

      <div className="wb-list">
        {filtered.map((item) => (
          <div key={item.id} className={`fav-card ${item.type === '作品' ? 'work' : 'card'}`}>
            <div className="fav-icon-wrap">{item.type === '作品' ? <Image size={22} /> : <BookOpen size={22} />}</div>
            <div className="fav-copy"><strong>{item.title}</strong><div className="fav-meta"><span className="fav-tag">#{item.tag}</span><span className="fav-source">{item.source}</span></div></div>
            {item.type === '作品' && <button type="button" className="wb-action-btn ghost" aria-label="取消收藏" onClick={() => remove(item)}><Trash2 size={14} /></button>}
          </div>
        ))}
        {filtered.length === 0 && <div className="wm-empty"><Image size={30} /><strong>还没有收藏作品</strong><small>在公开作品里点亮收藏，它就会出现在这里。</small></div>}
      </div>
    </div>
  )
}
