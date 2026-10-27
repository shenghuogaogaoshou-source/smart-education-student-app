import { ArrowLeft, LoaderCircle, RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useOptionalAppState } from '../../app/AppState'
import { isNativeApp, readMobileApiOrigins } from '../../app/mobileApi'
import { useOptionalWorks } from '../works/WorksProvider'
import type { WorkRecord } from '../works/types'
import { GameWorkBridge } from './GameWorkBridge'
import { getGameConfig, withGameApiOrigin, type GameId } from './gameRegistry'
import './games.css'

type LoadState = 'loading' | 'ready' | 'failed'

export function EmbeddedGamePage({ gameId, onBack }: { gameId: GameId; onBack: () => void }) {
  const config = getGameConfig(gameId)
  const mobileOrigins = readMobileApiOrigins(isNativeApp())
  const gameUrl = withGameApiOrigin(
    config.url,
    isNativeApp() ? (gameId === 'brain-film' ? mobileOrigins.brainOrigin : mobileOrigins.aiOrigin) : '',
  )
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [attempt, setAttempt] = useState(0)
  const [saveStatus, setSaveStatus] = useState('')
  const works = useOptionalWorks()
  const appState = useOptionalAppState()

  useEffect(() => {
    if (loadState !== 'loading') return
    const timer = window.setTimeout(() => setLoadState('failed'), 5000)
    return () => window.clearTimeout(timer)
  }, [attempt, loadState])

  const retry = () => {
    setLoadState('loading')
    setAttempt((current) => current + 1)
  }

  const handleWorkSaved = useCallback((record: WorkRecord) => {
    if (record.source === 'brain-film' || record.source === 'creative-module') {
      appState?.recordCreativeWork(record.id, record.createdAt)
    }
  }, [appState])

  return (
    <section className="embedded-game-page" aria-label={`${config.title}游戏`}>
      <header className="embedded-game-header">
        <button type="button" className="embedded-game-back" onClick={onBack} aria-label="返回首页">
          <ArrowLeft aria-hidden="true" size={20} />
        </button>
        <div>
          <span className="embedded-game-kicker">智芽创意工坊</span>
          <h1>{config.title}</h1>
        </div>
        <span className={`embedded-game-status embedded-game-status--${loadState}`}>
          {loadState === 'loading' ? '正在准备' : loadState === 'ready' ? '游戏已就绪' : '连接中断'}
        </span>
      </header>

      <div className="embedded-game-stage">
        {works ? (
          <GameWorkBridge
            gameId={gameId}
            saveDraft={works.saveDraft}
            onStatus={setSaveStatus}
            onWorkSaved={handleWorkSaved}
          >
            <iframe
              key={attempt}
              title={config.title}
              src={gameUrl}
              allow="camera; microphone; fullscreen"
              referrerPolicy="strict-origin-when-cross-origin"
              onLoad={() => setLoadState('ready')}
            />
          </GameWorkBridge>
        ) : (
          <iframe
            key={attempt}
            title={config.title}
            src={gameUrl}
            allow="camera; microphone; fullscreen"
            referrerPolicy="strict-origin-when-cross-origin"
            onLoad={() => setLoadState('ready')}
          />
        )}
        {saveStatus && <p className="embedded-game-save-toast" role="status">{saveStatus}</p>}

        {loadState === 'loading' && (
          <div className="embedded-game-overlay" role="status">
            <LoaderCircle className="embedded-game-spinner" aria-hidden="true" size={28} />
            <strong>正在打开{config.title}</strong>
            <span>先把你的创作工具摆好</span>
          </div>
        )}

        {loadState === 'failed' && (
          <div className="embedded-game-overlay embedded-game-overlay--error" role="alert">
            <strong>游戏暂时没有启动</strong>
            <span>请确认创意工具服务已运行，再试一次。</span>
            <button type="button" onClick={retry}>
              <RefreshCw aria-hidden="true" size={17} />
              重新加载游戏
            </button>
          </div>
        )}
      </div>
    </section>
  )
}
