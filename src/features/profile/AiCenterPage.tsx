import { ArrowLeft, Bell, Bot, Brain, MessageCircle, Sparkles, Star, UserCheck } from 'lucide-react'
import { useState } from 'react'
import './profile.css'

export function AiCenterPage({ onBack }: { onBack: () => void }) {
  const [voiceOn, setVoiceOn] = useState(true)
  const [proactiveOn, setProactiveOn] = useState(true)
  const [memoryOn, setMemoryOn] = useState(true)

  const growthCards = [
    { id: 'g1', title: '累计对话', value: '248 次', Icon: MessageCircle, color: '#A8C8E4' },
    { id: 'g2', title: 'AI 推荐采纳', value: '36 次', Icon: Star, color: '#F5C7A5' },
    { id: 'g3', title: '成长解锁记忆', value: '12 条', Icon: Brain, color: '#CFBDE8' },
    { id: 'g4', title: '个性化匹配度', value: '87%', Icon: Sparkles, color: '#8BC4A8' },
  ]

  const memoryItems = [
    '你喜欢用「图像类比」来理解新概念 ✨',
    '数学的几何部分最让你兴奋 📐',
    '你偏好晚上 7-9 点进行深度学习 🌙',
    '上次 AI 推荐的「机器学习入门」已学习 80%',
    '你的作品常被收藏，继续保持创作热情！',
  ]

  return (
    <div className="rewards-page ai-center-page">
      <header className="profile-page-header">
        <button className="profile-back" type="button" onClick={onBack} aria-label="返回">
          <ArrowLeft size={20} />
        </button>
        <h1>AI 伙伴中心</h1>
      </header>

      <div className="ai-center-hero">
        <div className="ai-hero-icon">
          <Bot size={28} color="#fff" />
        </div>
        <div className="ai-hero-copy">
          <strong>AI 小助手 · 你的学习伙伴</strong>
          <small>根据你的互动偏好，提供个性化学习支持与成长陪伴</small>
        </div>
      </div>

      <h3 className="detail-section-title">互动偏好</h3>
      <div className="ai-setting-list">
        <div className="ai-setting-row">
          <div className="ai-setting-icon" style={{ background: '#A8C8E4' }}><MessageCircle size={18} color="#fff" /></div>
          <div className="ai-setting-copy">
            <strong>语音对话</strong>
            <small>长按伙伴图标自动开启语音</small>
          </div>
          <button
            type="button"
            className={`ai-toggle ${voiceOn ? 'on' : ''}`}
            onClick={() => setVoiceOn(!voiceOn)}
            aria-pressed={voiceOn}
          >
            <span className="ai-toggle-thumb" />
          </button>
        </div>

        <div className="ai-setting-row">
          <div className="ai-setting-icon" style={{ background: '#F5C7A5' }}><Bell size={18} color="#fff" /></div>
          <div className="ai-setting-copy">
            <strong>主动提醒</strong>
            <small>AI 根据你的学习节奏推荐下一个内容</small>
          </div>
          <button
            type="button"
            className={`ai-toggle ${proactiveOn ? 'on' : ''}`}
            onClick={() => setProactiveOn(!proactiveOn)}
            aria-pressed={proactiveOn}
          >
            <span className="ai-toggle-thumb" />
          </button>
        </div>

        <div className="ai-setting-row">
          <div className="ai-setting-icon" style={{ background: '#CFBDE8' }}><Brain size={18} color="#fff" /></div>
          <div className="ai-setting-copy">
            <strong>记忆学习偏好</strong>
            <small>记住你感兴趣的领域和学习节奏</small>
          </div>
          <button
            type="button"
            className={`ai-toggle ${memoryOn ? 'on' : ''}`}
            onClick={() => setMemoryOn(!memoryOn)}
            aria-pressed={memoryOn}
          >
            <span className="ai-toggle-thumb" />
          </button>
        </div>
      </div>

      <h3 className="detail-section-title">AI 成长记录</h3>
      <div className="ai-growth-grid">
        {growthCards.map(({ id, title, value, Icon, color }) => (
          <div key={id} className="ai-growth-card">
            <div className="ai-growth-icon" style={{ background: color }}>
              <Icon size={20} color="#fff" />
            </div>
            <div className="ai-growth-copy">
              <strong>{value}</strong>
              <span>{title}</span>
            </div>
          </div>
        ))}
      </div>

      <h3 className="detail-section-title">AI 记住了你</h3>
      <div className="ai-memory-card">
        <div className="ai-memory-header">
          <UserCheck size={16} />
          <strong>个性化记忆</strong>
        </div>
        <ul className="ai-memory-list">
          {memoryItems.map((m, i) => (
            <li key={i}>{m}</li>
          ))}
        </ul>
      </div>
    </div>
  )
}
