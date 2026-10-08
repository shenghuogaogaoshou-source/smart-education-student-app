import { ArrowLeft, BookOpen, Clock, FlaskConical, GraduationCap, Lightbulb, PenTool, Send, Sparkles, Target, Wand2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useAppState } from '../../app/AppState'

type Shortcut = { icon: typeof Sparkles; title: string; desc: string; color: string }

const SHORTCUTS_BY_STAGE: Record<'elementary' | 'secondary', Shortcut[]> = {
  elementary: [
    { icon: PenTool, title: '拍照答疑', desc: '不会的题扫一扫', color: 'from-sky-400/30 to-cyan-300/20' },
    { icon: Clock, title: '今日预习', desc: '跟着 AI 学新课', color: 'from-violet-400/30 to-fuchsia-300/20' },
    { icon: BookOpen, title: '字词闯关', desc: '拼音听写 · 成语接龙', color: 'from-amber-400/30 to-orange-300/20' },
    { icon: Sparkles, title: '故事陪读', desc: '和 AI 一起读故事', color: 'from-pink-400/30 to-rose-300/20' },
  ],
  secondary: [
    { icon: PenTool, title: '拍照答疑', desc: '掌握解题套路', color: 'from-sky-400/30 to-cyan-300/20' },
    { icon: GraduationCap, title: '名校真题', desc: '完整答案，详解解析', color: 'from-violet-400/30 to-fuchsia-300/20' },
    { icon: FlaskConical, title: '实验助手', desc: '理化实验模拟演示', color: 'from-emerald-400/30 to-teal-300/20' },
    { icon: Target, title: '错题复盘', desc: '把错题变成提分点', color: 'from-amber-400/30 to-orange-300/20' },
  ],
}

const SUGGESTIONS_BY_STAGE: Record<'elementary' | 'secondary', string[]> = {
  elementary: [
    '怎么写好看的排比句？',
    '30 ÷ 6 为什么等于 5？',
    '地球为什么是圆的？',
    '推荐几本适合我的课外书',
  ],
  secondary: [
    '什么是熵？',
    '洛必达法则怎么使用？',
    '我是文科生，想深入学习人工智能，应该怎么学习？',
    '工商管理专业是学什么的，好找工作吗？',
  ],
}

const TOOL_CHIPS: Array<{ icon: typeof Lightbulb; label: string; color: string }> = [
  { icon: Lightbulb, label: '知识答疑', color: 'amber' },
  { icon: PenTool, label: '题目解析', color: 'blue' },
  { icon: Wand2, label: '学习规划', color: 'emerald' },
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
          <p>{state.stage === 'elementary' ? '陪你一起探索，把学习变好玩~' : '直连名校精品内容，即刻获取可信权威的学习辅导服务'}</p>
        </div>

        {/* 快捷入口 */}
        <section className="ai-section">
          <h2 className="ai-section-title">期末真题复习</h2>
          <div className="ai-shortcut-grid">
            {shortcuts.map((s, i) => {
              const Icon = s.icon
              return (
                <button key={i} type="button" className={`ai-shortcut-card bg-gradient-to-br ${s.color}`}>
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
              <button key={i} type="button" className={`ai-suggestion ${i < 2 ? 'ai-suggestion-soft' : 'ai-suggestion-primary'}`} onClick={() => setInput(q)}>
                <Sparkles aria-hidden="true" size={14} />
                <span>{q}</span>
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
              <button key={i} type="button" className={`ai-tool-chip tool-${t.color}`}>
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
