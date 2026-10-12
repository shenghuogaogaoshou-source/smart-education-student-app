import { ArrowLeft, ArrowUpRight, BookOpen, Clock, FlaskConical, GraduationCap, Lightbulb, PenTool, Send, Sparkles, Target, Wand2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useAppState } from '../../app/AppState'

type Shortcut = { icon: typeof Sparkles; title: string; desc: string }

const SHORTCUTS_BY_STAGE: Record<'elementary' | 'secondary', Shortcut[]> = {
  elementary: [
    { icon: BookOpen, title: '认识 AI', desc: '发现身边的 AI 超能力' },
    { icon: PenTool, title: '提示词练习', desc: '把话说清楚，让 AI 听懂' },
    { icon: FlaskConical, title: '教 AI 认世界', desc: '收集样本，试试图像分类' },
    { icon: Sparkles, title: '真相侦探社', desc: '查证 AI 回答，保护小秘密' },
  ],
  secondary: [
    { icon: BookOpen, title: 'AI 原理答疑', desc: '理解数据、模型与算法' },
    { icon: GraduationCap, title: '数据侦探营', desc: '采集、清洗、标注与分割' },
    { icon: FlaskConical, title: 'AI 实验助手', desc: '从采集到训练，再到测试' },
    { icon: Target, title: '模型评估复盘', desc: '用准确率与错误案例找问题' },
  ],
}

const SUGGESTIONS_BY_STAGE: Record<'elementary' | 'secondary', string[]> = {
  elementary: [
    '语音助手是怎么听懂我说话的？',
    '怎样教 AI 分清苹果和香蕉？',
    '使用 AI 时，哪些个人信息不能告诉它？',
  ],
  secondary: [
    'AI 与按固定规则运行的程序有什么区别？',
    '训练数据中的偏差会怎样影响 AI 的判断？',
    '推荐算法为什么总给我推送相似的内容？',
  ],
}

const TOOL_CHIPS: Array<{ icon: typeof Lightbulb; label: string }> = [
  { icon: Lightbulb, label: '知识答疑' },
  { icon: PenTool, label: '题目解析' },
  { icon: Wand2, label: '学习规划' },
]

export function AiPanel({ onClose }: { onClose: () => void }) {
  const { state } = useAppState()
  const [input, setInput] = useState('')

  useEffect(() => {
    const original = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = original
    }
  }, [])

  const shortcuts = SHORTCUTS_BY_STAGE[state.stage]
  const suggestions = SUGGESTIONS_BY_STAGE[state.stage]

  const portal = (
    <div className="ai-panel-root" role="presentation">
      <section className="ai-panel-full" role="dialog" aria-modal="true" aria-label="AI 学习伙伴">
        {/* 顶部栏 */}
        <header className="ai-panel-header">
          <button type="button" aria-label="关闭" onClick={onClose} className="ai-header-btn">
            <ArrowLeft aria-hidden="true" size={22} />
          </button>
          <div className="ai-header-actions">
            <button type="button" className="ai-header-btn" aria-label="历史"><Clock aria-hidden="true" size={20} /></button>
            <button type="button" className="ai-header-btn" aria-label="设置"><GraduationCap aria-hidden="true" size={20} /></button>
          </div>
        </header>

        {/* 标题区 */}
        <div className="ai-panel-title">
          <h1>
            <span className="ai-name-accent">{state.aiName}</span>
            <span className="ai-name-suffix"> - 你的智能学习助教</span>
          </h1>
          <p>{state.stage === 'elementary' ? '认识 AI、动手尝试，一起发现智能世界的奥秘' : '理解数据与模型，在实验中探索 AI 的原理与边界'}</p>
        </div>

        {/* 快捷入口 */}
        <section className="ai-section">
          <h2 className="ai-section-title">AI 学习探索</h2>
          <div className="ai-shortcut-grid">
            {shortcuts.map((s, i) => {
              const Icon = s.icon
              return (
                <button key={i} type="button" className="ai-shortcut-card">
                  <div>
                    <strong>{s.title}</strong>
                    <small>{s.desc}</small>
                  </div>
                  <Icon aria-hidden="true" size={28} className="ai-shortcut-icon" />
                </button>
              )
            })}
          </div>
        </section>

        {/* 推荐问题 */}
        <section className="ai-section">
          <h2 className="ai-section-title">你也许想问</h2>
          <div className="ai-suggestion-list">
            {suggestions.map((q, i) => (
              <button key={i} type="button" className="ai-panel-question" onClick={() => setInput(q)}>
                <span className="ai-question-number">0{i + 1}</span>
                <span>{q}</span>
                <ArrowUpRight aria-hidden="true" size={15} />
              </button>
            ))}
          </div>
        </section>

        <div className="ai-panel-spacer" />

        {/* 工具条 */}
        <div className="ai-toolbar">
          {TOOL_CHIPS.map((t, i) => {
            const Icon = t.icon
            return (
              <button key={i} type="button" className="ai-tool-chip">
                <Icon aria-hidden="true" size={14} />
                <span>{t.label}</span>
              </button>
            )
          })}
        </div>

        {/* 输入区 */}
        <form className="ai-input-bar" onSubmit={(e) => { e.preventDefault(); if (input.trim()) setInput('') }}>
          <input
            className="ai-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="发消息..."
          />
          <div className="ai-input-actions">
            <button type="button" className="ai-input-extra">
              <span className="ai-reasoning-tag">R1 · 深度思考</span>
            </button>
            <button type="button" className="ai-input-cam" aria-label="拍照">
              <PenTool aria-hidden="true" size={22} />
            </button>
            <button type="submit" className="ai-input-send" aria-label="发送" disabled={!input.trim()}>
              <Send aria-hidden="true" size={20} />
            </button>
          </div>
        </form>
      </section>
    </div>
  )

  return createPortal(portal, document.body)
}
