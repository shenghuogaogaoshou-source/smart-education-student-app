import { ArrowRight, Camera, ChevronRight, Clock3, Search, Sparkles } from 'lucide-react'
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { HomeSearch } from './HomeSearch'
import { AchievementShowcase } from './AchievementShowcase'
import { CameraToolSheet } from './CameraToolSheet'
import { games, homeCopy } from './homeData'
import './home.css'

const carouselDecorations = [
  { size: 48, icon: Sparkles },
  { size: 42, icon: Sparkles },
  { size: 54, icon: Sparkles },
  { size: 38, icon: Sparkles },
  { size: 50, icon: Sparkles },
]

export function HomePage({ onWorkClick, onMoreWorks, onOpenNotifications, onNavigateToKnowledge, onOpenContent }: { onOpenContent?: (courseId: string, chapterNum: number) => void; onWorkClick?: (workId: string) => void; onMoreWorks?: () => void; onOpenNotifications?: () => void; onNavigateToKnowledge?: () => void }) {
  const [cameraOpen, setCameraOpen] = useState(false)
  const [notice, setNotice] = useState('')
  const [currentNewsIndex, setCurrentNewsIndex] = useState(0)
  const touchStartX = useRef(0)
  const touchEndX = useRef(0)
  const copy = homeCopy

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentNewsIndex((prev) => (prev + 1) % copy.news.length)
    }, 4000)
    return () => clearInterval(interval)
  }, [copy.news.length])

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX
  }

  const handleTouchEnd = () => {
    const diff = touchStartX.current - touchEndX.current
    if (Math.abs(diff) > 50) {
      if (diff > 0) {
        setCurrentNewsIndex((prev) => (prev + 1) % copy.news.length)
      } else {
        setCurrentNewsIndex((prev) => (prev - 1 + copy.news.length) % copy.news.length)
      }
    }
  }

  const currentNews = copy.news[currentNewsIndex]
  const deco = carouselDecorations[currentNewsIndex % carouselDecorations.length]
  const DecorIcon = deco.icon

  return (
    <div className="home-page">
      <header className="home-header">
        <div><p>{copy.subline}</p><h1>{copy.greeting}</h1></div>
        <button className="icon-button" type="button" aria-label="消息通知" onClick={() => onOpenNotifications?.()}><img src="/icons/elementary/bell.png" alt="" aria-hidden="true" /></button>
      </header>
      {notice && <p className="inline-notice" role="status">{notice}</p>}

      <div className="search-shell">
        <button type="button" aria-label="拍照与扫码" onClick={() => setCameraOpen(true)}><Camera aria-hidden="true" size={20} /></button>
        <HomeSearch onOpenContent={onOpenContent} onWorkClick={onWorkClick} />
      </div>

      <section className="news-carousel-section" aria-label="最新 AI 通识资讯">
        <div
          className="news-carousel"
          style={{ '--news-cover': `url('${currentNews.cover}')` } as CSSProperties}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {/* 背景图放在 ::before 上并单独压暗，遮罩只压暗背景，文字层保持在最上方 */}
          <div className="news-carousel-overlay" style={{ background: currentNews.gradient }} aria-hidden="true" />
          <div className="carousel-content">
            <span className="carousel-tag">AI 通识新鲜报</span>
            <h2 className="carousel-title">{currentNews.title}</h2>
            <p className="carousel-desc">点击了解更多 AI 精彩内容</p>
          </div>
          <div className="carousel-decoration">
            <DecorIcon aria-hidden="true" size={deco.size} />
          </div>
        </div>
        <div className="carousel-dots">
          {copy.news.map((_, idx) => (
            <button
              key={idx}
              type="button"
              className={`carousel-dot ${idx === currentNewsIndex ? 'active' : ''}`}
              aria-label={`第 ${idx + 1} 条资讯`}
              onClick={() => setCurrentNewsIndex(idx)}
            />
          ))}
        </div>
      </section>

      <section className="games-section section-block" aria-label="创意 AI 游戏">
        <div className="section-heading-row"><div><p className="section-kicker">动手创造</p><h2>精选 AI 创意游戏</h2></div><span className="tiny-status">5 个精选</span></div>
        <div className="games-grid">
          {games.map(({ id, title, note, icon }) => <button key={id} type="button" onClick={() => setNotice(`${title}内容正在准备中`)}><span className="game-icon"><img src={`/games/elementary/${icon}.png`} alt="" aria-hidden="true" /></span><strong>{title}</strong><small>{note}</small></button>)}
          <button className="all-games" type="button" onClick={() => setNotice('全部游戏页面正在准备中')}><span className="game-icon"><img src="/games/elementary/all.png" alt="" aria-hidden="true" /></span><strong>全部游戏</strong><small>看看更多创意玩法</small></button>
        </div>
      </section>

      <section className="continue-card">
        <div className="continue-icon"><Clock3 aria-hidden="true" size={21} /></div>
        <div><span>上次学到</span><h2>AI 怎样认出图片</h2><div className="mini-progress"><span /></div></div>
        <button type="button" aria-label="继续学习" onClick={() => { if (onNavigateToKnowledge) onNavigateToKnowledge(); else setNotice('知识内容等待开发中') }}><ArrowRight aria-hidden="true" size={20} /></button>
      </section>

      <AchievementShowcase onWorkClick={onWorkClick} onMoreWorks={onMoreWorks} />
      <CameraToolSheet open={cameraOpen} onClose={() => setCameraOpen(false)} />
    </div>
  )
}
