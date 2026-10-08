import { ArrowLeft, ChevronRight, LogOut, ShieldCheck } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useAppState } from '../../app/AppState'
import { SettingDetailPage } from './SettingDetailPage'
import { settingGroups } from './settingsData'
import './settings.css'

const GRADE_LABEL: Record<string, string> = {
  grade1: '一年级', grade2: '二年级', grade3: '三年级', grade4: '四年级', grade5: '五年级', grade6: '六年级',
  grade7: '初一', grade8: '初二', grade9: '初三', grade10: '高一', grade11: '高二', grade12: '高三',
}

export function SettingsPage({ onBack }: { onBack: () => void }) {
  const { state, logout } = useAppState()
  const [detail, setDetail] = useState<string | null>(null)
  const [logoutOpen, setLogoutOpen] = useState(false)
  // 保存设置列表页的滚动位置，进入详情前记录，返回时恢复
  const listScrollY = useRef(0)

  // 每次重新渲染设置列表时（detail 变回 null）恢复之前的滚动位置
  useEffect(() => {
    if (detail === null && listScrollY.current > 0) {
      window.scrollTo(0, listScrollY.current)
      listScrollY.current = 0
    }
  }, [detail])

  function openDetail(id: string) {
    // 在离开列表页前保存当前滚动位置
    listScrollY.current = window.scrollY
    setDetail(id)
  }

  function backToList() {
    setDetail(null)
  }

  if (detail) return <SettingDetailPage itemId={detail} onBack={backToList} />

  const stageLabel = state.stage === 'elementary' ? '小学端' : '中学端'
  const gradeLabel = GRADE_LABEL[state.grade] ?? ''

  function getStatusText(id: string): string {
    switch (id) {
      case 'stage': return `${stageLabel} · ${gradeLabel}`
      case 'font': return ({ standard: '标准', large: '大号', xlarge: '特大号' } as const)[state.fontScale]
      case 'security': return state.passwordHint
      case 'guardian': return state.guardian.authorised ? `${state.guardian.name} · 已授权` : `${state.guardian.name} · 未授权`
      case 'companion': return `${state.aiName} · ${({ gentle: '温柔', playful: '活泼', serious: '认真', encouraging: '鼓励' } as const)[state.aiPersonality]}`
      case 'voice': return state.voiceEnabled ? `${state.voiceMode === 'warm' ? '温暖' : state.voiceMode === 'bright' ? '明亮' : '沉稳'} · 开启` : '已关闭'
      case 'memory': return state.aiMemoryEnabled ? `记忆开启 · ${state.historyCount} 条记录` : '记忆已关闭'
      case 'operation': return ({ strict: '严格保护', standard: '标准保护', relaxed: '轻松模式' } as const)[state.safeMode]
      case 'notifications': return ({ important: '仅重要消息', all: '全部消息', off: '已关闭' } as const)[state.notifications]
      case 'sound': return state.soundEnabled ? `声音${state.soundVolume}%${state.hapticEnabled ? ' · 触感开启' : ''}` : '声音已关闭'
      case 'privacy': return state.showLearningStats ? '统计可见 · 好友查找关闭' : '统计已隐藏'
      case 'permissions': {
        const granted = [state.cameraPermission, state.micPermission, state.albumPermission].filter(p => p === 'granted').length
        return `3 项权限 · ${granted} 项已授权`
      }
      case 'content': return ({ child: '儿童模式', teen: '青少年模式', general: '标准模式' } as const)[state.contentLevel]
      case 'storage': return `${state.storageUsed} / ${state.storageTotal} MB`
      case 'help': return '常见问题 · 客服'
      case 'about': return 'v1.0.0 · 用户协议'
      default: return ''
    }
  }

  return (
    <div className="settings-page">
      <header className="settings-topbar"><button type="button" aria-label="返回我的" onClick={onBack}><ArrowLeft aria-hidden="true" /></button><h1>设置</h1><span /></header>
      <section className="account-status"><div><strong>当前学习账号</strong><span>{stageLabel} · {gradeLabel} · 数据保存在本机</span></div><b>本地正常</b></section>
      {settingGroups.map((group) => (
        <section className="settings-group" key={group.id}>
          <h2>{group.title}</h2>
          <div className="settings-list">{group.items.map(({ id, label, Icon }) => {
            const statusText = getStatusText(id)
            return <button key={id} type="button" aria-label={`${label}，${statusText}`} onClick={() => openDetail(id)}><Icon aria-hidden="true" size={19} /><span><strong>{label}</strong><small>{statusText}</small></span><ChevronRight aria-hidden="true" size={18} /></button>
          })}</div>
        </section>
      ))}
      <button className="logout-button" type="button" onClick={() => setLogoutOpen(true)}><LogOut aria-hidden="true" size={18} />退出当前账号</button>
      {logoutOpen && <div className="settings-dialog-backdrop"><section className="settings-dialog" role="dialog" aria-modal="true" aria-label="确认退出登录"><ShieldCheck aria-hidden="true" /><h2>确认退出当前账号？</h2><p>本机保留的演示偏好不会被删除，返回登录页后可以切换学习端。</p><div><button type="button" onClick={() => setLogoutOpen(false)}>继续使用</button><button type="button" onClick={logout}>确认退出</button></div></section></div>}
    </div>
  )
}
