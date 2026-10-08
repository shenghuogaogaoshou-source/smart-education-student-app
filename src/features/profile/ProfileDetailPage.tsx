import { ArrowLeft, ChevronRight, UserRound } from 'lucide-react'
import { useAppState } from '../../app/AppState'

export function ProfileDetailPage({ onBack, onEdit }: { onBack: () => void; onEdit: () => void }) {
  const { state } = useAppState()

  const infoRows = [
    { label: '学段', value: state.stage === 'elementary' ? '小学端 · 五年级' : '中学端 · 初二' },
    { label: '学习天数', value: '45 天' },
    { label: '完成作品', value: '8 个' },
    { label: '获得勋章', value: '8 枚' },
    { label: '当前积分', value: '1,280' },
  ]

  return (
    <div className="profile-detail-page">
      <header className="profile-page-header">
        <button className="profile-back" type="button" onClick={onBack} aria-label="返回">
          <ArrowLeft size={20} />
        </button>
        <h1>个人资料</h1>
      </header>

      <div className="profile-detail-hero">
        <div className={`profile-avatar-large avatar-${state.avatar % 5}`}>
          <UserRound size={60} />
        </div>
        <h2>{state.nickname}</h2>
        <p className="profile-subtitle">Lv. 7 · 灵感探索者</p>
      </div>

      <section className="profile-detail-card">
        <div className="profile-info-list">
          {infoRows.map((row) => (
            <div key={row.label} className="profile-info-row">
              <span>{row.label}</span>
              <strong>{row.value}</strong>
            </div>
          ))}
        </div>

        <button className="profile-edit-btn" type="button" onClick={onEdit}>
          编辑资料
        </button>
      </section>

      <button className="profile-detail-more" type="button" onClick={onEdit}>
        <span><strong>头像与昵称</strong><small>更换头像颜色、修改昵称与学段</small></span>
        <ChevronRight aria-hidden="true" />
      </button>
    </div>
  )
}
