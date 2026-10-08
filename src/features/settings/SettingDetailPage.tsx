import { ArrowLeft, Bell, Camera, CheckCircle2, Database, Eye, EyeOff, FileText, HelpCircle, Headphones, LayoutDashboard, LogOut, Mic, MessageSquare, RotateCcw, ShieldCheck, ShieldOff, Smartphone, Sparkles, Trash2, UserRound, Volume2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useAppState } from '../../app/AppState'
import type { AiPersonality, ContentLevel, FontScale, Grade, GuardianInfo, LearningStage, PermissionStatus, SafeMode, VoiceMode } from '../../app/model'
import { settingGroups } from './settingsData'

const ELEMENTARY_GRADES: Array<[Grade['elementary'], string]> = [
  ['grade1', '一年级'],
  ['grade2', '二年级'],
  ['grade3', '三年级'],
  ['grade4', '四年级'],
  ['grade5', '五年级'],
  ['grade6', '六年级'],
]
const SECONDARY_GRADES: Array<[Grade['secondary'], string]> = [
  ['grade7', '初一'],
  ['grade8', '初二'],
  ['grade9', '初三'],
  ['grade10', '高一'],
  ['grade11', '高二'],
  ['grade12', '高三'],
]

const RELATIONSHIP_LABEL: Record<GuardianInfo['relationship'], string> = {
  father: '父亲',
  mother: '母亲',
  grandparent: '祖父母',
  other: '其他',
}

export function SettingDetailPage({ itemId, onBack }: { itemId: string; onBack: () => void }) {
  const app = useAppState()
  const { state, setFontScale, setStage, setGrade, setNotifications, setTwoFactor, updatePassword, setGuardian, setFamilyName, removeDevice, resetAiPosition, setAiName, setAiPersonality, setAiSkin, setVoiceEnabled, setAutoListen, setVoiceMode, setSaveHistory, setAiMemory, clearHistory, setConfirmDangerous, setGuardianApprove, setSafeMode, setSoundEnabled, setSoundVolume, setHapticEnabled, setShowStats, setFriendFind, setDataCollection, setCameraPermission, setMicPermission, setAlbumPermission, setContentLevel, setPersonalizedRec, setAutoClean, clearCache } = app
  const [notice, setNotice] = useState('')
  const item = settingGroups.flatMap((group) => group.items).find((entry) => entry.id === itemId)
  if (!item) return null

  return (
    <div className="setting-detail">
      <header className="settings-topbar"><button type="button" aria-label="返回设置" onClick={onBack}><ArrowLeft aria-hidden="true" /></button><h1>{item.label}</h1><span /></header>

      {itemId === 'security' && <SecuritySection state={state} setTwoFactor={setTwoFactor} updatePassword={updatePassword} setNotice={setNotice} />}
      {itemId === 'guardian' && <GuardianSection state={state} setGuardian={setGuardian} setFamilyName={setFamilyName} setNotice={setNotice} />}
      {itemId === 'stage' && <StageSection state={state} setStage={setStage} setGrade={setGrade} setNotice={setNotice} />}
      {itemId === 'companion' && <CompanionSection state={state} setAiName={setAiName} setAiPersonality={setAiPersonality} setAiSkin={setAiSkin} resetAiPosition={resetAiPosition} setNotice={setNotice} />}
      {itemId === 'voice' && <VoiceSection state={state} setVoiceEnabled={setVoiceEnabled} setAutoListen={setAutoListen} setVoiceMode={setVoiceMode} setNotice={setNotice} />}
      {itemId === 'memory' && <MemorySection state={state} setSaveHistory={setSaveHistory} setAiMemory={setAiMemory} clearHistory={clearHistory} setNotice={setNotice} />}
      {itemId === 'operation' && <OperationSection state={state} setConfirmDangerous={setConfirmDangerous} setGuardianApprove={setGuardianApprove} setSafeMode={setSafeMode} setNotice={setNotice} />}
      {itemId === 'sound' && <SoundSection state={state} setSoundEnabled={setSoundEnabled} setSoundVolume={setSoundVolume} setHapticEnabled={setHapticEnabled} setNotice={setNotice} />}
      {itemId === 'privacy' && <PrivacySection state={state} setShowStats={setShowStats} setFriendFind={setFriendFind} setDataCollection={setDataCollection} setNotice={setNotice} />}
      {itemId === 'permissions' && <PermissionsSection state={state} setCameraPermission={setCameraPermission} setMicPermission={setMicPermission} setAlbumPermission={setAlbumPermission} setNotice={setNotice} />}
      {itemId === 'content' && <ContentSection state={state} setContentLevel={setContentLevel} setPersonalizedRec={setPersonalizedRec} setNotice={setNotice} />}
      {itemId === 'storage' && <StorageSection state={state} setAutoClean={setAutoClean} clearCache={clearCache} setNotice={setNotice} />}
      {itemId === 'help' && <HelpSection />}
      {itemId === 'about' && <AboutSection />}

      {itemId === 'font' && <section className="choice-card"><h2>字体大小</h2><div className="segmented-choices">{([['standard', '标准'], ['large', '大号'], ['xlarge', '特大号']] as Array<[FontScale, string]>).map(([id, label]) => <button key={id} type="button" aria-pressed={state.fontScale === id} onClick={() => setFontScale(id)}>{label}</button>)}</div></section>}
      {itemId === 'notifications' && <section className="choice-card"><h2><Bell aria-hidden="true" size={19} />消息范围</h2><div className="stacked-choices"><button type="button" aria-pressed={state.notifications === 'important'} onClick={() => setNotifications('important')}>仅重要消息</button><button type="button" aria-pressed={state.notifications === 'all'} onClick={() => setNotifications('all')}>全部学习消息</button><button type="button" aria-pressed={state.notifications === 'off'} onClick={() => setNotifications('off')}>暂时关闭</button></div></section>}

      {notice && <p className="settings-notice" role="status">{notice}</p>}
    </div>
  )
}

/* ---------- 账号与安全 ---------- */
function SecuritySection({ state, setTwoFactor, updatePassword, setNotice }: {
  state: ReturnType<typeof useAppState>['state']
  setTwoFactor: (v: boolean) => void
  updatePassword: (d: string) => void
  setNotice: (s: string) => void
}) {
  const [showChangePwd, setShowChangePwd] = useState(false)
  const [showDevices, setShowDevices] = useState(false)

  return (
    <>
      <section className="detail-card">
        <div className="security-row">
          <UserRound aria-hidden="true" size={22} />
          <div>
            <strong>{state.accountId}</strong>
            <small>学习账号</small>
          </div>
          <ShieldCheck aria-hidden="true" size={18} className="muted" />
        </div>
        <div className="security-row">
          <LockKeyholeInline />
          <div>
            <strong>{state.passwordHint}</strong>
            <small>密码保护你的学习记录</small>
          </div>
          <button type="button" className="inline-action" onClick={() => setShowChangePwd(true)}>修改</button>
        </div>
      </section>

      {showChangePwd && <ChangePasswordDialog onClose={() => setShowChangePwd(false)} onConfirm={() => { updatePassword(new Date().toISOString().slice(0, 10)); setShowChangePwd(false); setNotice('密码修改已保存') }} />}

      <section className="choice-card">
        <h2>两步验证</h2>
        <p>开启后，每次登录需要额外验证步骤，更安全。</p>
        <div className="switch-row">
          <span>{state.twoFactorEnabled ? '已开启' : '未开启'}</span>
          <button type="button" className={`switch ${state.twoFactorEnabled ? 'on' : ''}`} aria-pressed={state.twoFactorEnabled} onClick={() => setTwoFactor(!state.twoFactorEnabled)}>
            <span />
          </button>
        </div>
      </section>

      <section className="choice-card">
        <h2>登录设备</h2>
        <p>以下设备曾使用此账号登录，你可以移除非当前设备。</p>
        <button type="button" className="wide-secondary" onClick={() => setShowDevices((v) => !v)}>
          <Smartphone aria-hidden="true" size={18} />{showDevices ? '收起设备列表' : `查看 ${state.devices.length} 台设备`}
        </button>
        {showDevices && (
          <div className="device-list">
            {state.devices.map((d, i) => (
              <div className="device-item" key={i}>
                <div>
                  <strong>{d.name}{d.current && <span className="current-tag">当前</span>}</strong>
                  <small>最近活动：{d.lastActive}</small>
                </div>
                {!d.current && <RemoveDeviceInline index={i} />}
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  )
}

function RemoveDeviceInline({ index }: { index: number }) {
  const { removeDevice } = useAppState()
  return <button type="button" className="inline-action danger" onClick={() => removeDevice(index)}><Trash2 aria-hidden="true" size={14} />移除</button>
}

function LockKeyholeInline() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-lock-keyhole" aria-hidden="true">
      <circle cx="12" cy="16" r="1" /><rect width="18" height="11" x="3" y="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  )
}

function ChangePasswordDialog({ onClose, onConfirm }: { onClose: () => void; onConfirm: () => void }) {
  const [oldPwd, setOldPwd] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [showOld, setShowOld] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [err, setErr] = useState('')

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!oldPwd || !newPwd) { setErr('请填写完整信息'); return }
    if (newPwd.length < 6) { setErr('新密码至少 6 位'); return }
    if (newPwd !== confirmPwd) { setErr('两次输入的新密码不一致'); return }
    setErr('')
    onConfirm()
  }

  return (
    <div className="settings-dialog-backdrop" role="dialog" aria-modal="true" aria-label="修改密码">
      <section className="settings-dialog settings-dialog-form">
        <ShieldCheck aria-hidden="true" />
        <h2>修改密码</h2>
        <p>为保护账号安全，请填写当前密码和新密码。</p>
        <form onSubmit={submit}>
          <PasswordField label="当前密码" value={oldPwd} onChange={setOldPwd} show={showOld} toggleShow={() => setShowOld((v) => !v)} />
          <PasswordField label="新密码（至少 6 位）" value={newPwd} onChange={setNewPwd} show={showNew} toggleShow={() => setShowNew((v) => !v)} />
          <PasswordField label="确认新密码" value={confirmPwd} onChange={setConfirmPwd} show={showConfirm} toggleShow={() => setShowConfirm((v) => !v)} />
          {err && <p className="form-alert" role="alert">{err}</p>}
          <div className="dialog-actions">
            <button type="button" onClick={onClose}>取消</button>
            <button type="submit">确认修改</button>
          </div>
        </form>
      </section>
    </div>
  )
}

function PasswordField({ label, value, onChange, show, toggleShow }: {
  label: string; value: string; onChange: (v: string) => void; show: boolean; toggleShow: () => void
}) {
  return (
    <div className="dialog-field">
      <label>{label}</label>
      <div className="input-with-icon">
        <input type={show ? 'text' : 'password'} value={value} onChange={(e) => onChange(e.target.value)} />
        <button type="button" className="eye-toggle" onClick={toggleShow} aria-label={show ? '隐藏密码' : '显示密码'}>
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
    </div>
  )
}

/* ---------- 监护与家庭 ---------- */
function GuardianSection({ state, setGuardian, setFamilyName, setNotice }: {
  state: ReturnType<typeof useAppState>['state']
  setGuardian: (g: GuardianInfo) => void
  setFamilyName: (n: string) => void
  setNotice: (s: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<GuardianInfo>(state.guardian)
  const [familyName, setFamilyNameLocal] = useState(state.familyName)

  function save() {
    setGuardian(form)
    setFamilyName(familyName)
    setEditing(false)
    setNotice('监护信息已更新')
  }

  if (editing) {
    return (
      <>
        <section className="detail-card">
          <h2>家庭名称</h2>
          <div className="dialog-field">
            <label>家庭标识（仅用于展示）</label>
            <input className="plain-input" value={familyName} onChange={(e) => setFamilyNameLocal(e.target.value)} placeholder="如：晨曦家庭" />
          </div>
        </section>
        <section className="choice-card">
          <h2>监护⼈信息</h2>
          <div className="dialog-field">
            <label>姓名</label>
            <input className="plain-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="监护⼈姓名" />
          </div>
          <div className="dialog-field">
            <label>与学⽣关系</label>
            <div className="segmented-choices">
              {(['father', 'mother', 'grandparent', 'other'] as GuardianInfo['relationship'][]).map((r) => (
                <button key={r} type="button" aria-pressed={form.relationship === r} onClick={() => setForm({ ...form, relationship: r })}>{RELATIONSHIP_LABEL[r]}</button>
              ))}
            </div>
          </div>
          <div className="dialog-field">
            <label>联系电话</label>
            <input className="plain-input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="手机号" />
          </div>
          <div className="switch-row">
            <span>授权监护⼈（接收学习报告）</span>
            <button type="button" className={`switch ${form.authorised ? 'on' : ''}`} aria-pressed={form.authorised} onClick={() => setForm({ ...form, authorised: !form.authorised })}><span /></button>
          </div>
        </section>
        <div className="dialog-actions wide">
          <button type="button" onClick={() => { setEditing(false); setForm(state.guardian); setFamilyNameLocal(state.familyName) }}>取消</button>
          <button type="button" onClick={save}>保存</button>
        </div>
      </>
    )
  }

  return (
    <>
      <section className="detail-card">
        <h2>{state.familyName}</h2>
        <p>家庭空间用于管理监护授权和学习报告接收。</p>
      </section>
      <section className="choice-card">
        <h2>监护⼈信息</h2>
        <div className="guardian-info">
          <div><strong>{state.guardian.name}</strong><small>{RELATIONSHIP_LABEL[state.guardian.relationship]}</small></div>
          <div><strong>{state.guardian.phone}</strong><small>联系电话</small></div>
          <div>
            <strong className={state.guardian.authorised ? 'ok' : 'muted'}>
              {state.guardian.authorised ? <><CheckCircle2 aria-hidden="true" size={14} />已授权</> : '未授权'}
            </strong>
            <small>学习报告接收</small>
          </div>
        </div>
        <button className="wide-secondary" type="button" onClick={() => setEditing(true)}>编辑监护⼈信息</button>
      </section>
    </>
  )
}

/* ---------- 学段与年级 ---------- */
function StageSection({ state, setStage, setGrade, setNotice }: {
  state: ReturnType<typeof useAppState>['state']
  setStage: (s: LearningStage) => void
  setGrade: (g: Grade[LearningStage]) => void
  setNotice: (s: string) => void
}) {
  const [pendingStage, setPendingStage] = useState<LearningStage | null>(null)

  const gradeOptions = state.stage === 'elementary' ? ELEMENTARY_GRADES : SECONDARY_GRADES

  return (
    <>
      <section className="choice-card">
        <h2>选择学习端</h2>
        <p>更改后，首页文案和临时视觉皮肤会一起调整。</p>
        <div className="segmented-choices">
          <button type="button" aria-pressed={state.stage === 'elementary'} onClick={() => setPendingStage('elementary')}>小学端</button>
          <button type="button" aria-pressed={state.stage === 'secondary'} onClick={() => setPendingStage('secondary')}>中学端</button>
        </div>
      </section>

      <section className="choice-card">
        <h2>年级</h2>
        <p>选择当前年级，学习内容会对应调整。</p>
        <div className="grade-grid">
          {gradeOptions.map(([id, label]) => (
            <button key={id} type="button" aria-pressed={state.grade === id} onClick={() => {
              setGrade(id)
              setNotice(`年级已切换为 ${label}`)
            }}>{label}</button>
          ))}
        </div>
      </section>

      {pendingStage && (
        <div className="settings-dialog-backdrop">
          <section className="settings-dialog" role="dialog" aria-modal="true" aria-label="确认更改学段">
            <ShieldCheck aria-hidden="true" />
            <h2>确认更改学习端？</h2>
            <p>布局位置保持一致，文案和临时视觉皮肤会切换为对应学段，年级也会重置为默认值。</p>
            <div className="dialog-actions">
              <button type="button" onClick={() => setPendingStage(null)}>暂不更改</button>
              <button type="button" onClick={() => {
                setStage(pendingStage)
                const defaultGrade = pendingStage === 'elementary' ? 'grade5' : 'grade8'
                setGrade(defaultGrade as Grade[LearningStage])
                setPendingStage(null)
                setNotice(`已切换至${pendingStage === 'elementary' ? '小学端' : '中学端'}`)
              }}>确认更改</button>
            </div>
          </section>
        </div>
      )}
    </>
  )
}

/* ---------- AI 伙伴：伙伴与互动 ---------- */
const PERSONALITY_OPTIONS: Array<[AiPersonality, string, string]> = [
  ['gentle', '温柔陪伴', '轻声细语，耐心引导'],
  ['playful', '活泼有趣', '充满活力，爱玩爱闹'],
  ['serious', '认真严谨', '专注知识，少开玩笑'],
  ['encouraging', '鼓励成长', '肯定进步，激发信心'],
]
const SKIN_OPTIONS = ['🤖', '🐱', '🦊', '🐻', '🐼', '🦄']

function CompanionSection({ state, setAiName, setAiPersonality, setAiSkin, resetAiPosition, setNotice }: {
  state: ReturnType<typeof useAppState>['state']
  setAiName: (v: string) => void
  setAiPersonality: (v: AiPersonality) => void
  setAiSkin: (v: number) => void
  resetAiPosition: () => void
  setNotice: (s: string) => void
}) {
  const [nameInput, setNameInput] = useState(state.aiName)

  return (
    <>
      <section className="detail-card">
        <div className="ai-preview">
          <div className="ai-avatar-lg">{SKIN_OPTIONS[state.aiSkin]}</div>
          <div>
            <strong>{state.aiName}</strong>
            <small>{PERSONALITY_OPTIONS.find(([k]) => k === state.aiPersonality)?.[1] ?? '鼓励成长'}</small>
          </div>
        </div>
      </section>

      <section className="choice-card">
        <h2>AI 的名字</h2>
        <div className="dialog-field">
          <label>给 AI 伙伴起个名字</label>
          <input className="plain-input" value={nameInput} maxLength={8} onChange={(e) => setNameInput(e.target.value)} onBlur={() => { if (nameInput.trim()) { setAiName(nameInput.trim()); setNotice('AI 名字已更新') } }} />
        </div>
      </section>

      <section className="choice-card">
        <h2>性格风格</h2>
        <p>AI 伙伴说话的语气和方式。</p>
        <div className="personality-grid">
          {PERSONALITY_OPTIONS.map(([key, label, desc]) => (
            <button key={key} type="button" className={`personality-card ${state.aiPersonality === key ? 'active' : ''}`} aria-pressed={state.aiPersonality === key} onClick={() => { setAiPersonality(key); setNotice('AI 性格已切换') }}>
              <strong>{label}</strong>
              <small>{desc}</small>
            </button>
          ))}
        </div>
      </section>

      <section className="choice-card">
        <h2>AI 形象</h2>
        <p>选择一个你喜欢的 AI 伙伴形象。</p>
        <div className="skin-grid">
          {SKIN_OPTIONS.map((emoji, i) => (
            <button key={i} type="button" className={`skin-btn ${state.aiSkin === i ? 'active' : ''}`} aria-pressed={state.aiSkin === i} onClick={() => { setAiSkin(i); setNotice('AI 形象已更换') }}>{emoji}</button>
          ))}
        </div>
      </section>

      <section className="choice-card">
        <h2>悬浮位置</h2>
        <p>在主页面拖动 AI 入口后，可以在这里恢复默认位置。</p>
        <button className="wide-secondary" type="button" onClick={() => { resetAiPosition(); setNotice('AI 入口位置已恢复') }}><RotateCcw aria-hidden="true" size={18} />恢复默认位置</button>
      </section>
    </>
  )
}

/* ---------- AI 伙伴：语音与应用控制 ---------- */
const VOICE_MODE_LABEL: Record<VoiceMode, string> = { warm: '温暖', bright: '明亮', calm: '沉稳' }

function VoiceSection({ state, setVoiceEnabled, setAutoListen, setVoiceMode, setNotice }: {
  state: ReturnType<typeof useAppState>['state']
  setVoiceEnabled: (v: boolean) => void
  setAutoListen: (v: boolean) => void
  setVoiceMode: (v: VoiceMode) => void
  setNotice: (s: string) => void
}) {
  return (
    <>
      <section className="detail-card">
        <div className="security-row">
          <Mic aria-hidden="true" size={22} />
          <div>
            <strong>语音回应</strong>
            <small>AI 用语音回答你的问题</small>
          </div>
          <button type="button" className={`switch ${state.voiceEnabled ? 'on' : ''}`} aria-pressed={state.voiceEnabled} onClick={() => { setVoiceEnabled(!state.voiceEnabled); setNotice(state.voiceEnabled ? '语音已关闭' : '语音已开启') }}><span /></button>
        </div>
        <div className="security-row">
          <Sparkles aria-hidden="true" size={22} />
          <div>
            <strong>自动聆听</strong>
            <small>AI 伙伴常驻待命，听到你说话就回应</small>
          </div>
          <button type="button" className={`switch ${state.autoListenEnabled ? 'on' : ''}`} aria-pressed={state.autoListenEnabled} onClick={() => { setAutoListen(!state.autoListenEnabled); setNotice(state.autoListenEnabled ? '自动聆听已关闭' : '自动聆听已开启') }}><span /></button>
        </div>
      </section>

      {state.voiceEnabled && (
        <section className="choice-card">
          <h2>语音风格</h2>
          <div className="segmented-choices">
            {(['warm', 'bright', 'calm'] as VoiceMode[]).map((mode) => (
              <button key={mode} type="button" aria-pressed={state.voiceMode === mode} onClick={() => { setVoiceMode(mode); setNotice(`语音风格：${VOICE_MODE_LABEL[mode]}`) }}>{VOICE_MODE_LABEL[mode]}</button>
            ))}
          </div>
        </section>
      )}

      <section className="choice-card">
        <h2>使用提示</h2>
        <p>语音功能需要麦克风权限。首次使用时，浏览器会请求权限，你可以随时在系统设置中更改。</p>
      </section>
    </>
  )
}

/* ---------- AI 伙伴：对话记录与长期记忆 ---------- */
function MemorySection({ state, setSaveHistory, setAiMemory, clearHistory, setNotice }: {
  state: ReturnType<typeof useAppState>['state']
  setSaveHistory: (v: boolean) => void
  setAiMemory: (v: boolean) => void
  clearHistory: () => void
  setNotice: (s: string) => void
}) {
  const [showClear, setShowClear] = useState(false)

  return (
    <>
      <section className="detail-card">
        <MessageSquare aria-hidden="true" size={22} />
        <h2>对话记录</h2>
        <p>已保存 <strong>{state.historyCount}</strong> 条对话记录，保存在本机。</p>
      </section>

      <section className="choice-card">
        <h2>保存对话记录</h2>
        <p>关闭后，新的对话不会保存到本地。</p>
        <div className="switch-row">
          <span>{state.saveHistory ? '已保存' : '未保存'}</span>
          <button type="button" className={`switch ${state.saveHistory ? 'on' : ''}`} aria-pressed={state.saveHistory} onClick={() => setSaveHistory(!state.saveHistory)}><span /></button>
        </div>
      </section>

      <section className="choice-card">
        <h2>长期记忆</h2>
        <p>AI 伙伴记住你的偏好和学习情况，下次对话更懂你。</p>
        <div className="switch-row">
          <span>{state.aiMemoryEnabled ? '已开启' : '未开启'}</span>
          <button type="button" className={`switch ${state.aiMemoryEnabled ? 'on' : ''}`} aria-pressed={state.aiMemoryEnabled} onClick={() => setAiMemory(!state.aiMemoryEnabled)}><span /></button>
        </div>
      </section>

      {state.historyCount > 0 && (
        <section className="choice-card">
          <h2>清除数据</h2>
          <p>删除所有对话记录和长期记忆，此操作不可恢复。</p>
          <button className="wide-secondary danger-btn" type="button" onClick={() => setShowClear(true)}><Trash2 aria-hidden="true" size={18} />清除所有记录</button>
        </section>
      )}

      {showClear && (
        <div className="settings-dialog-backdrop" role="dialog" aria-modal="true" aria-label="确认清除">
          <section className="settings-dialog">
            <ShieldOff aria-hidden="true" />
            <h2>确认清除？</h2>
            <p>将删除全部 {state.historyCount} 条对话记录和长期记忆，AI 伙伴会从零开始认识你。</p>
            <div className="dialog-actions">
              <button type="button" onClick={() => setShowClear(false)}>取消</button>
              <button type="button" onClick={() => { clearHistory(); setShowClear(false); setNotice('所有记录已清除') }}>确认清除</button>
            </div>
          </section>
        </div>
      )}
    </>
  )
}

/* ---------- AI 伙伴：操作确认与安全 ---------- */
const SAFE_MODE_LABEL: Record<SafeMode, { label: string; desc: string }> = {
  strict: { label: '严格保护', desc: '所有敏感操作都需要确认' },
  standard: { label: '标准保护', desc: '常用操作自动放行，敏感操作需确认' },
  relaxed: { label: '轻松模式', desc: '仅最危险的操作需要确认' },
}

function OperationSection({ state, setConfirmDangerous, setGuardianApprove, setSafeMode, setNotice }: {
  state: ReturnType<typeof useAppState>['state']
  setConfirmDangerous: (v: boolean) => void
  setGuardianApprove: (v: boolean) => void
  setSafeMode: (v: SafeMode) => void
  setNotice: (s: string) => void
}) {
  return (
    <>
      <section className="choice-card">
        <h2>安全级别</h2>
        <p>选择适合你的保护程度。</p>
        <div className="safe-mode-list">
          {(['strict', 'standard', 'relaxed'] as SafeMode[]).map((mode) => (
            <button key={mode} type="button" className={`safe-mode-card ${state.safeMode === mode ? 'active' : ''}`} aria-pressed={state.safeMode === mode} onClick={() => { setSafeMode(mode); setNotice(`安全级别：${SAFE_MODE_LABEL[mode].label}`) }}>
              <strong>{SAFE_MODE_LABEL[mode].label}</strong>
              <small>{SAFE_MODE_LABEL[mode].desc}</small>
            </button>
          ))}
        </div>
      </section>

      <section className="choice-card">
        <h2>确认操作</h2>
        <div className="switch-row">
          <span>危险操作前弹出确认</span>
          <button type="button" className={`switch ${state.confirmDangerous ? 'on' : ''}`} aria-pressed={state.confirmDangerous} onClick={() => setConfirmDangerous(!state.confirmDangerous)}><span /></button>
        </div>
        <div className="switch-row">
          <span>消费/付费需监护⼈同意</span>
          <button type="button" className={`switch ${state.guardianApprove ? 'on' : ''}`} aria-pressed={state.guardianApprove} onClick={() => setGuardianApprove(!state.guardianApprove)}><span /></button>
        </div>
      </section>

      <section className="choice-card">
        <h2>保护范围</h2>
        <ul className="safe-list">
          <li><CheckCircle2 aria-hidden="true" size={14} />防止访问不适宜内容</li>
          <li><CheckCircle2 aria-hidden="true" size={14} />限制第三方数据收集</li>
          <li><CheckCircle2 aria-hidden="true" size={14} />AI 生成内容经过安全筛选</li>
        </ul>
      </section>
    </>
  )
}

/* ---------- 声音与触感 ---------- */
function SoundSection({ state, setSoundEnabled, setSoundVolume, setHapticEnabled, setNotice }: {
  state: ReturnType<typeof useAppState>['state']
  setSoundEnabled: (v: boolean) => void
  setSoundVolume: (v: number) => void
  setHapticEnabled: (v: boolean) => void
  setNotice: (s: string) => void
}) {
  return (
    <>
      <section className="detail-card">
        <div className="security-row">
          <Volume2 aria-hidden="true" size={22} />
          <div>
            <strong>应用声音</strong>
            <small>点击、完成任务等音效</small>
          </div>
          <button type="button" className={`switch ${state.soundEnabled ? 'on' : ''}`} aria-pressed={state.soundEnabled} onClick={() => { setSoundEnabled(!state.soundEnabled); setNotice(state.soundEnabled ? '声音已关闭' : '声音已开启') }}><span /></button>
        </div>
        <div className="security-row">
          <Headphones aria-hidden="true" size={22} />
          <div>
            <strong>触感反馈</strong>
            <small>操作时轻微震动（需设备支持）</small>
          </div>
          <button type="button" className={`switch ${state.hapticEnabled ? 'on' : ''}`} aria-pressed={state.hapticEnabled} onClick={() => { setHapticEnabled(!state.hapticEnabled); setNotice(state.hapticEnabled ? '触感已关闭' : '触感已开启') }}><span /></button>
        </div>
      </section>

      {state.soundEnabled && (
        <section className="choice-card">
          <h2>音量</h2>
          <div className="volume-control">
            <input type="range" min={0} max={100} value={state.soundVolume} onChange={(e) => setSoundVolume(Number(e.target.value))} />
            <span className="volume-value">{state.soundVolume}%</span>
          </div>
          <p className="muted small">调整应用内音效的音量大小，不会影响系统音量。</p>
        </section>
      )}
    </>
  )
}

/* ---------- 隐私设置 ---------- */
function PrivacySection({ state, setShowStats, setFriendFind, setDataCollection, setNotice }: {
  state: ReturnType<typeof useAppState>['state']
  setShowStats: (v: boolean) => void
  setFriendFind: (v: boolean) => void
  setDataCollection: (v: boolean) => void
  setNotice: (s: string) => void
}) {
  return (
    <>
      <section className="choice-card">
        <h2>可见范围</h2>
        <div className="switch-row">
          <span>在主页展示学习统计</span>
          <button type="button" className={`switch ${state.showLearningStats ? 'on' : ''}`} aria-pressed={state.showLearningStats} onClick={() => setShowStats(!state.showLearningStats)}><span /></button>
        </div>
        <div className="switch-row">
          <span>允许同学通过手机号找到你</span>
          <button type="button" className={`switch ${state.allowFriendFind ? 'on' : ''}`} aria-pressed={state.allowFriendFind} onClick={() => { setFriendFind(!state.allowFriendFind); setNotice(state.allowFriendFind ? '已关闭好友查找' : '已开启好友查找') }}><span /></button>
        </div>
      </section>

      <section className="choice-card">
        <h2>数据收集</h2>
        <p>帮助我们改进产品体验，不会收集你的具体学习内容。</p>
        <div className="switch-row">
          <span>允许收集使用统计</span>
          <button type="button" className={`switch ${state.dataCollection ? 'on' : ''}`} aria-pressed={state.dataCollection} onClick={() => setDataCollection(!state.dataCollection)}><span /></button>
        </div>
      </section>

      <section className="choice-card">
        <h2>数据导出</h2>
        <p>你可以随时导出或删除与你账号相关的数据。</p>
        <button className="wide-secondary" type="button" onClick={() => setNotice('导出请求已发送（演示）')}><Database aria-hidden="true" size={18} />申请数据导出</button>
      </section>
    </>
  )
}

/* ---------- 相机、麦克风与相册 ---------- */
const PERMISSION_LABEL: Record<PermissionStatus, string> = { granted: '已授权', denied: '已拒绝', prompt: '未设置' }
const PERMISSION_ICON: Record<PermissionStatus, string> = { granted: '✓', denied: '✕', prompt: '…' }

function PermissionsSection({ state, setCameraPermission, setMicPermission, setAlbumPermission, setNotice }: {
  state: ReturnType<typeof useAppState>['state']
  setCameraPermission: (v: PermissionStatus) => void
  setMicPermission: (v: PermissionStatus) => void
  setAlbumPermission: (v: PermissionStatus) => void
  setNotice: (s: string) => void
}) {
  const perms = [
    { key: 'camera' as const, label: '相机', desc: '拍照上传作业、AI 拍照解题', icon: <Camera aria-hidden="true" size={22} />, status: state.cameraPermission, set: setCameraPermission },
    { key: 'mic' as const, label: '麦克风', desc: '语音对话、口语测评', icon: <Mic aria-hidden="true" size={22} />, status: state.micPermission, set: setMicPermission },
    { key: 'album' as const, label: '相册', desc: '查看和选择本地图片', icon: <LayoutDashboard aria-hidden="true" size={22} />, status: state.albumPermission, set: setAlbumPermission },
  ]

  return (
    <>
      {perms.map((p) => (
        <section className="choice-card" key={p.key}>
          <div className="security-row">
            {p.icon}
            <div style={{ flex: 1 }}>
              <strong>{p.label}</strong>
              <small>{p.desc}</small>
            </div>
            <span className={`perm-badge perm-${p.status}`}>{PERMISSION_ICON[p.status]} {PERMISSION_LABEL[p.status]}</span>
          </div>
          <div className="segmented-choices" style={{ marginTop: 10 }}>
            <button type="button" aria-pressed={p.status === 'granted'} onClick={() => { p.set('granted'); setNotice(`${p.label}：已授权`) }}>允许</button>
            <button type="button" aria-pressed={p.status === 'prompt'} onClick={() => { p.set('prompt'); setNotice(`${p.label}：使用时询问`) }}>询问</button>
            <button type="button" aria-pressed={p.status === 'denied'} onClick={() => { p.set('denied'); setNotice(`${p.label}：已拒绝`) }}>拒绝</button>
          </div>
        </section>
      ))}

      <section className="choice-card">
        <h2>提示</h2>
        <p>部分权限需在浏览器或系统设置中开启。应用内设置仅作为首次访问时的默认选择。</p>
      </section>
    </>
  )
}

/* ---------- 个性化与内容保护 ---------- */
const CONTENT_LEVEL_OPTIONS: Array<[ContentLevel, string, string]> = [
  ['child', '儿童模式', '适合 6-10 岁，内容最纯净'],
  ['teen', '青少年模式', '适合 11-15 岁，平衡保护与探索'],
  ['general', '标准模式', '适合 16 岁以上，完整功能'],
]

function ContentSection({ state, setContentLevel, setPersonalizedRec, setNotice }: {
  state: ReturnType<typeof useAppState>['state']
  setContentLevel: (v: ContentLevel) => void
  setPersonalizedRec: (v: boolean) => void
  setNotice: (s: string) => void
}) {
  return (
    <>
      <section className="choice-card">
        <h2>内容级别</h2>
        <p>根据年龄适配学习内容和推荐。</p>
        <div className="content-level-list">
          {CONTENT_LEVEL_OPTIONS.map(([key, label, desc]) => (
            <button key={key} type="button" className={`content-level-card ${state.contentLevel === key ? 'active' : ''}`} aria-pressed={state.contentLevel === key} onClick={() => { setContentLevel(key); setNotice(`内容级别：${label}`) }}>
              <strong>{label}</strong>
              <small>{desc}</small>
            </button>
          ))}
        </div>
      </section>

      <section className="choice-card">
        <h2>个性化推荐</h2>
        <p>根据你的学习记录推荐课程和练习。关闭后只展示统一内容。</p>
        <div className="switch-row">
          <span>{state.personalizedRec ? '已开启' : '已关闭'}</span>
          <button type="button" className={`switch ${state.personalizedRec ? 'on' : ''}`} aria-pressed={state.personalizedRec} onClick={() => setPersonalizedRec(!state.personalizedRec)}><span /></button>
        </div>
      </section>

      <section className="choice-card">
        <h2>内容保护</h2>
        <ul className="safe-list">
          <li><CheckCircle2 aria-hidden="true" size={14} />AI 生成内容经过安全筛选</li>
          <li><CheckCircle2 aria-hidden="true" size={14} />不适宜话题自动过滤</li>
          <li><CheckCircle2 aria-hidden="true" size={14} />消费行为需监护人确认</li>
        </ul>
      </section>
    </>
  )
}

/* ---------- 下载与存储 ---------- */
function StorageSection({ state, setAutoClean, clearCache, setNotice }: {
  state: ReturnType<typeof useAppState>['state']
  setAutoClean: (v: number) => void
  clearCache: () => void
  setNotice: (s: string) => void
}) {
  const usedPct = Math.round((state.storageUsed / state.storageTotal) * 100)
  const autoCleanOptions = [7, 14, 30, 60, 90]

  return (
    <>
      <section className="detail-card">
        <Database aria-hidden="true" size={22} />
        <h2>存储概览</h2>
        <div className="storage-bar">
          <div className="storage-bar-fill" style={{ width: `${usedPct}%` }} />
        </div>
        <p className="muted small">{state.storageUsed} MB / {state.storageTotal} MB（{usedPct}% 已使用）</p>
      </section>

      <section className="choice-card">
        <h2>自动清理</h2>
        <p>自动删除超过指定天数的离线课程缓存。</p>
        <div className="segmented-choices">
          {autoCleanOptions.map((days) => (
            <button key={days} type="button" aria-pressed={state.autoCleanDays === days} onClick={() => { setAutoClean(days); setNotice(`自动清理：${days} 天`) }}>{days} 天</button>
          ))}
        </div>
      </section>

      <section className="choice-card">
        <h2>立即清理</h2>
        <p>清理缓存文件，不会删除你的学习进度和收藏。</p>
        <button className="wide-secondary danger-btn" type="button" onClick={() => { clearCache(); setNotice('缓存已清理') }}><Trash2 aria-hidden="true" size={18} />清理缓存（约 120 MB）</button>
      </section>
    </>
  )
}

/* ---------- 帮助与意见反馈 ---------- */
function HelpSection() {
  const faqs = [
    { q: '如何切换学习端？', a: '进入「设置 → 账号与学段 → 学段与年级」，选择小学端或中学端。' },
    { q: 'AI 伙伴的对话记录存放在哪里？', a: '所有对话记录保存在本机浏览器存储中，不会上传到服务器。' },
    { q: '忘记密码怎么办？', a: '点击登录页的「忘记密码」，通过绑定的监护人手机号重置。' },
    { q: '如何让监护人查看我的学习报告？', a: '在「设置 → 监护与家庭」中确保监护⼈已授权，报告将定期发送。' },
  ]
  return (
    <>
      <section className="detail-card">
        <HelpCircle aria-hidden="true" size={22} />
        <h2>需要帮助？</h2>
        <p>常见问题解答，或通过下方渠道联系我们。</p>
      </section>

      <section className="choice-card">
        <h2>常见问题</h2>
        <div className="faq-list">
          {faqs.map((f, i) => (
            <details key={i}>
              <summary>{f.q}</summary>
              <p>{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="choice-card">
        <h2>联系我们</h2>
        <div className="contact-list">
          <div><strong>客服邮箱</strong><small>support@shuzhi-edu.example</small></div>
          <div><strong>服务时间</strong><small>工作日 9:00 - 18:00</small></div>
        </div>
      </section>
    </>
  )
}

/* ---------- 关于与规则 ---------- */
function AboutSection() {
  return (
    <>
      <section className="detail-card about-card">
        <div className="about-logo">📚</div>
        <h2>数智学习世界</h2>
        <p className="muted">学生端 v1.0.0</p>
        <p className="muted small">© 2026 数智教育 · 让每个孩子都拥有专属 AI 学习伙伴</p>
      </section>

      <section className="choice-card">
        <h2>用户协议</h2>
        <p>使用本应用即代表同意《用户服务协议》和《隐私政策》。</p>
        <button className="wide-secondary" type="button">查看完整协议</button>
      </section>

      <section className="choice-card">
        <h2>青少年保护</h2>
        <p>本应用严格遵守《未成年人保护法》，为青少年提供安全、健康的学习环境。</p>
        <ul className="safe-list">
          <li><CheckCircle2 aria-hidden="true" size={14} />符合未成年人网络保护条例</li>
          <li><CheckCircle2 aria-hidden="true" size={14} />消费行为监护人可追溯</li>
          <li><CheckCircle2 aria-hidden="true" size={14} />内容经严格审核上线</li>
        </ul>
      </section>
    </>
  )
}
