import { ArrowRight, Camera, ChevronRight, Clock3, Search, Sparkles } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useAppState } from '../../app/AppState'
import { AchievementShowcase } from './AchievementShowcase'
import { CameraToolSheet } from './CameraToolSheet'
import { games, stageCopy } from './homeData'
import './home.css'

const carouselGradientsElementary = [
  'linear-gradient(135deg, #FFF5E6 0%, #FFD9B8 30%, #FF9D6E 65%, #E87045 100%)',
  'linear-gradient(135deg, #FFE4EF 0%, #FFB8D4 30%, #FF8AB0 65%, #E85F8A 100%)',
  'linear-gradient(135deg, #FFF8E0 0%, #FFE8A8 30%, #FFC958 65%, #FFA82E 100%)',
  'linear-gradient(135deg, #F3E6FF 0%, #E0B8E8 30%, #C88AB4 65%, #A85F8A 100%)',
  'linear-gradient(135deg, #FFF0E0 0%, #FFCFA8 30%, #FF9D8A 65%, #E87060 100%)',
]

const carouselGradientsSecondary = [
  'linear-gradient(135deg, #D0E4F5 0%, #8AB8E0 35%, #5A7EC8 70%, #3A4FA8 100%)',
  'linear-gradient(135deg, #E8D5F5 0%, #B88AE0 35%, #8A4FC8 70%, #6A2FA8 100%)',
  'linear-gradient(135deg, #C0E4EC 0%, #5AB0D8 35%, #2A7AB8 70%, #1A4A88 100%)',
  'linear-gradient(135deg, #FFDDE8 0%, #E890B0 35%, #B85A8A 70%, #88386A 100%)',
  'linear-gradient(135deg, #C8D0F0 0%, #8898D8 35%, #6868C0 70%, #4838A0 100%)',
]

const carouselDecorations = [
  { size: 48, icon: Sparkles },
  { size: 42, icon: Sparkles },
  { size: 54, icon: Sparkles },
  { size: 38, icon: Sparkles },
  { size: 50, icon: Sparkles },
]

export function HomePage({ onWorkClick, onMoreWorks, onOpenNotifications, onNavigateToKnowledge }: { onWorkClick?: (workId: string) => void; onMoreWorks?: () => void; onOpenNotifications?: () => void; onNavigateToKnowledge?: () => void }) {
  const { state } = useAppState()
  const [cameraOpen, setCameraOpen] = useState(false)
  const [notice, setNotice] = useState('')
  const [currentNewsIndex, setCurrentNewsIndex] = useState(0)
  const touchStartX = useRef(0)
  const touchEndX = useRef(0)
  const copy = stageCopy[state.stage]

  const gradients = state.stage === 'elementary'
    ? carouselGradientsElementary
    : carouselGradientsSecondary

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
  const currentGradient = gradients[currentNewsIndex % gradients.length]
  const deco = carouselDecorations[currentNewsIndex % carouselDecorations.length]
  const DecorIcon = deco.icon

  return (
    <div className="home-page">
      <header className="home-header">
        <div><p>{copy.subline}</p><h1>{copy.greeting}</h1></div>
        <button className="icon-button" type="button" aria-label="消息通知" onClick={() => onOpenNotifications?.()}><img src={`/icons/${state.stage}/bell.png`} alt="" aria-hidden="true" /></button>
      </header>
      {notice && <p className="inline-notice" role="status">{notice}</p>}

      <div className="search-shell">
        <button type="button" aria-label="拍照与扫码" onClick={() => setCameraOpen(true)}><Camera aria-hidden="true" size={20} /></button>
        <Search aria-hidden="true" size={19} />
        <input type="search" aria-label="搜索知识、游戏或作品" placeholder="搜索你想探索的内容" />
      </div>

      <section className="news-carousel-section" aria-label="最新 AI 通识资讯">
        <div
          className={`news-carousel stage-${state.stage}`}
          style={{ background: currentGradient }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className="carousel-content">
            <span className="carousel-tag">{state.stage === 'elementary' ? 'AI 通识新鲜报' : 'AI 前沿资讯'}</span>
            <h2 className="carousel-title">{currentNews}</h2>
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
          {games.map(({ id, title, note, icon }) => <button key={id} type="button" onClick={() => setNotice(`${title}内容正在准备中`)}><span className="game-icon"><img src={`/games/${state.stage}/${icon}.png`} alt="" aria-hidden="true" /></span><strong>{title}</strong><small>{note}</small></button>)}
          <button className="all-games" type="button" onClick={() => setNotice('全部游戏页面正在准备中')}><span className="game-icon"><img src={`/games/${state.stage}/all.png`} alt="" aria-hidden="true" /></span><strong>全部游戏</strong><small>看看更多创意玩法</small></button>
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
