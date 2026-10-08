import { ArrowLeft, ArrowRight, Check, ChevronLeft, ChevronRight, FolderKanban, Save, Sparkles } from 'lucide-react'
import { useState } from 'react'
import './profile.css'

const steps = [
  { id: 1, title: '确定主题', desc: '想一个有趣的点子，让它变得特别', done: true },
  { id: 2, title: '生成草图', desc: '用 AI 生成几张草稿，挑一张最喜欢的', done: true },
  { id: 3, title: '调整细节', desc: '修改颜色、线条、构图', done: false, active: true },
  { id: 4, title: '添加故事', desc: '给作品写一个小故事或灵感说明', done: false },
  { id: 5, title: '提交发布', desc: '选择公开或仅自己可见', done: false },
]

export function ContinueCreatePage({ onBack }: { onBack: () => void }) {
  const [currentStep, setCurrentStep] = useState(3)
  const step = steps.find((s) => s.id === currentStep)!

  return (
    <div className="rewards-page continue-create-page">
      <header className="profile-page-header">
        <button className="profile-back" type="button" onClick={onBack} aria-label="返回">
          <ArrowLeft size={20} />
        </button>
        <h1>继续创作</h1>
      </header>

      <div className="cc-project-card">
        <div className="cc-project-icon">
          <Sparkles size={26} color="#fff" />
        </div>
        <div className="cc-project-copy">
          <strong>会分类的照相机</strong>
          <small>AI 创意实验室 · 今天 16:20 继续编辑</small>
        </div>
        <div className="cc-progress-circle">
          <svg viewBox="0 0 44 44">
            <circle cx="22" cy="22" r="18" stroke="#E5E7EB" strokeWidth="4" fill="none" />
            <circle cx="22" cy="22" r="18" stroke="#6FA6CF" strokeWidth="4" fill="none"
              strokeDasharray={`${(3 / 5) * 113} 113`} strokeLinecap="round" transform="rotate(-90 22 22)" />
          </svg>
          <span>3/5</span>
        </div>
      </div>

      <h3 className="detail-section-title">创作步骤</h3>
      <div className="cc-steps">
        {steps.map((s) => {
          const isDone = s.id < currentStep
          const isActive = s.id === currentStep
          return (
            <button
              key={s.id}
              type="button"
              className={`cc-step ${isDone ? 'done' : ''} ${isActive ? 'active' : ''}`}
              onClick={() => s.id <= currentStep && setCurrentStep(s.id)}
              disabled={s.id > currentStep}
            >
              <div className="cc-step-circle">
                {isDone ? <Check size={14} /> : s.id}
              </div>
              <div className="cc-step-body">
                <strong>{s.title}</strong>
                <small>{s.desc}</small>
              </div>
            </button>
          )
        })}
      </div>

      <h3 className="detail-section-title">当前步骤 · {step.title}</h3>
      <div className="cc-preview-card">
        <div className="cc-preview-placeholder">
          <Sparkles size={40} color="#6FA6CF" />
          <p>AI 草稿预览区域</p>
        </div>
        <div className="cc-preview-actions">
          <button type="button" className="wb-action-btn ghost">重新生成</button>
          <button type="button" className="wb-action-btn">AI 润色一下</button>
        </div>
      </div>

      <div className="cc-nav">
        <button
          type="button"
          className="cc-nav-btn"
          onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
          disabled={currentStep === 1}
        >
          <ChevronLeft size={18} /> 上一步
        </button>
        <button
          type="button"
          className="cc-nav-btn primary"
          onClick={() => setCurrentStep(Math.min(steps.length, currentStep + 1))}
          disabled={currentStep === steps.length}
        >
          下一步 <ChevronRight size={18} />
        </button>
      </div>

      <div className="cc-footer-actions">
        <button type="button" className="cc-footer-btn ghost" onClick={onBack}>
          <Save size={16} /> 保存草稿
        </button>
        <button type="button" className="cc-footer-btn" onClick={onBack}>
          <FolderKanban size={16} /> 返回作品管理
        </button>
      </div>
    </div>
  )
}
