import { ArrowLeft, Check, Camera, UserRound } from 'lucide-react'
import { useState } from 'react'
import { useAppState } from '../../app/AppState'

const AVATAR_GRADIENTS = 5

export function ProfileEditPage({ onBack, onDone }: { onBack: () => void; onDone: () => void }) {
  const { state, setProfile, setStage } = useAppState()
  const [nickname, setNickname] = useState(state.nickname)
  const [avatar, setAvatar] = useState(state.avatar)
  const [saved, setSaved] = useState(false)

  const trimmed = nickname.trim()
  const canSave = trimmed.length > 0 && trimmed.length <= 12
  const dirty = trimmed !== state.nickname || avatar !== state.avatar

  const handleSave = () => {
    if (!canSave) return
    setProfile({ nickname: trimmed, avatar })
    setSaved(true)
    window.setTimeout(onDone, 400)
  }

  return (
    <div className="profile-edit-page">
      <header className="profile-page-header">
        <button className="profile-back" type="button" onClick={onBack} aria-label="返回">
          <ArrowLeft size={20} />
        </button>
        <h1>编辑资料</h1>
      </header>

      <div className="profile-edit-avatar-section">
        <div className={`profile-avatar-large avatar-${avatar % AVATAR_GRADIENTS}`}>
          <UserRound size={60} />
        </div>
        <button
          className="profile-avatar-change"
          type="button"
          onClick={() => setAvatar((avatar + 1) % AVATAR_GRADIENTS)}
        >
          <Camera aria-hidden="true" size={14} />
          更换头像
        </button>
      </div>

      <section className="profile-edit-card">
        <label className="profile-edit-field">
          <span>昵称</span>
          <input
            type="text"
            value={nickname}
            onChange={(e) => { setNickname(e.target.value); setSaved(false) }}
            placeholder="输入你的昵称"
            maxLength={12}
          />
        </label>
        <p className="profile-edit-hint">{trimmed.length}/12 个字符</p>

        <div className="profile-edit-field">
          <span>学段</span>
          <div className="profile-stage-options" role="radiogroup" aria-label="选择学段">
            <button
              type="button"
              role="radio"
              aria-checked={state.stage === 'elementary'}
              className={state.stage === 'elementary' ? 'active' : ''}
              onClick={() => setStage('elementary')}
            >
              小学端
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={state.stage === 'secondary'}
              className={state.stage === 'secondary' ? 'active' : ''}
              onClick={() => setStage('secondary')}
            >
              中学端
            </button>
          </div>
        </div>

        <div className="profile-edit-field">
          <span>等级称号</span>
          <div className="profile-edit-readonly">Lv. 7 · 灵感探索者</div>
        </div>
      </section>

      <button
        className="profile-edit-btn"
        type="button"
        onClick={handleSave}
        disabled={!canSave || !dirty}
      >
        {saved ? <><Check aria-hidden="true" size={16} /> 已保存</> : '保存修改'}
      </button>
      {!canSave && <p className="profile-edit-hint center">昵称需为 1-12 个字符</p>}
    </div>
  )
}
