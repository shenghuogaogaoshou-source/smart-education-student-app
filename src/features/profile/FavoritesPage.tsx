import { ArrowLeft, Image, Trash2, Users } from 'lucide-react'
import { useMemo, useState } from 'react'
import './profile.css'

type FavoriteSource = '全部' | '脑洞放映厅' | '创造模块' | 'AI 创作'

type CommunityWork = {
  id: string
  title: string
  author: string
  source: Exclude<FavoriteSource, '全部'>
  tag: string
  description: string
  gradient: string
}

const COMMUNITY_WORKS: CommunityWork[] = [
  {
    id: 'community-camera',
    title: '会分类的照相机',
    author: '星河同学',
    source: '创造模块',
    tag: '创意实验',
    description: '用图像分类模块做出一台会整理照片的小机器。',
    gradient: 'linear-gradient(145deg, #DDEEFF, #BAD8F4)',
  },
  {
    id: 'community-library',
    title: '未来图书馆',
    author: '小羽同学',
    source: '脑洞放映厅',
    tag: '空间想象',
    description: '把想安静读书的未来空间拍成一段小电影。',
    gradient: 'linear-gradient(145deg, #F2E6FF, #D8C1EF)',
  },
  {
    id: 'community-voice',
    title: '声音地图',
    author: '清禾同学',
    source: 'AI 创作',
    tag: '科学表达',
    description: '记录校园里的不同声音，并整理成一张声音地图。',
    gradient: 'linear-gradient(145deg, #E5F7EC, #BFE3CF)',
  },
  {
    id: 'community-campus',
    title: '未来校园小设计',
    author: '林川同学',
    source: '创造模块',
    tag: '生活创想',
    description: '为校园节能问题设计了一套可以测试的小提示。',
    gradient: 'linear-gradient(145deg, #FFF0DE, #F5CFA5)',
  },
]

const SOURCE_FILTERS: FavoriteSource[] = ['全部', '脑洞放映厅', '创造模块', 'AI 创作']

export function FavoritesPage({ onBack }: { onBack: () => void }) {
  const [filter, setFilter] = useState<FavoriteSource>('全部')
  const [removed, setRemoved] = useState<string[]>([])
  const visibleWorks = COMMUNITY_WORKS.filter((work) => (
    !removed.includes(work.id) && (filter === '全部' || work.source === filter)
  ))
  const creatorCount = useMemo(
    () => new Set(COMMUNITY_WORKS.filter((work) => !removed.includes(work.id)).map((work) => work.author)).size,
    [removed],
  )

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
          <Image size={24} /><div><strong>{COMMUNITY_WORKS.length - removed.length}</strong><span>收藏作品</span></div>
        </button>
        <div className="rewards-stat">
          <Users size={24} /><div><strong>{creatorCount}</strong><span>作品作者</span></div>
        </div>
        <div className="rewards-stat">
          <Image size={24} /><div><strong>{SOURCE_FILTERS.length - 1}</strong><span>作品来源</span></div>
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
            <div className="fav-work-cover" style={{ background: work.gradient }}>
              <Image aria-hidden="true" size={28} />
            </div>
            <div className="fav-work-copy">
              <span>{work.source} · {work.tag}</span>
              <strong>{work.title}</strong>
              <p>{work.author}</p>
              <small>{work.description}</small>
            </div>
            <button
              type="button"
              className="fav-remove-button"
              aria-label={`取消收藏 ${work.title}`}
              onClick={() => setRemoved((current) => [...current, work.id])}
            >
              <Trash2 size={15} />
            </button>
          </article>
        ))}
        {visibleWorks.length === 0 && (
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
