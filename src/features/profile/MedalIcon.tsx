import { useState } from 'react'
import { useAppState } from '../../app/AppState'
import type { MedalInfo } from './medalsData'

// 勋章图标：优先显示 /medals/<学段>/<id>.png；
// 图片未放入时自动回退到 lucide 图标；未解锁的勋章图片自动变灰。
export function MedalIcon({ medal }: { medal: MedalInfo }) {
  const { state } = useAppState()
  const [imgFailed, setImgFailed] = useState(false)
  const { id, earned, icon: Fallback, color } = medal

  if (imgFailed) {
    return (
      <div className="medal-icon" style={{ background: earned ? color : '#E5E7EB' }}>
        <Fallback size={22} color={earned ? '#fff' : '#9CA3AF'} />
      </div>
    )
  }

  return (
    <div className="medal-icon medal-icon-image">
      <img
        className={`medal-img ${earned ? 'is-earned' : 'is-locked'}`}
        src={`/medals/${state.stage}/${id}.png`}
        alt=""
        loading="lazy"
        onError={() => setImgFailed(true)}
      />
    </div>
  )
}
