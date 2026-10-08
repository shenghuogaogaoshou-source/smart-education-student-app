import { ArrowLeft, BookOpen, Bookmark, Edit3, FileText, History, NotebookPen, Search, Sparkles } from 'lucide-react'
import './profile.css'

const tools = [
  { id: 'notes', title: '错题本', desc: '收集做错的题目，支持重做和查看解析', Icon: NotebookPen, count: 12 },
  { id: 'favorites', title: '我的收藏', desc: '保存感兴趣的知识卡片和作品', Icon: Bookmark, count: 6 },
  { id: 'history', title: '学习记录', desc: '回顾最近的学习轨迹和停留点', Icon: History, count: 48 },
  { id: 'translate', title: '智能翻译', desc: '多语言互译，支持拍照和文本输入', Icon: FileText, count: 0 },
  { id: 'search', title: '知识搜索', desc: '快速查找 AI 通识相关内容', Icon: Search, count: 0 },
  { id: 'summarize', title: '内容摘要', desc: '长文本一键生成摘要和要点', Icon: Sparkles, count: 3 },
]

export function LearningToolsDetailPage({ onBack }: { onBack: () => void }) {
  return (
    <div className="detail-page">
      <header className="detail-header">
        <button className="back-button" type="button" onClick={onBack}>
          <ArrowLeft size={20} />
        </button>
        <h1>学习工具</h1>
      </header>

      <div className="detail-content">
        <div className="detail-summary-card">
          <div className="summary-icon"><BookOpen size={28} /></div>
          <div>
            <span>累计使用</span>
            <strong>84 次</strong>
          </div>
          <div>
            <span>本周新增</span>
            <em>12 条</em>
          </div>
        </div>

        <div className="detail-grid">
          {tools.map(({ id, title, desc, Icon, count }) => (
            <button key={id} className="detail-grid-item" type="button">
              <div className="detail-grid-icon">
                <Icon size={22} />
              </div>
              <div className="detail-grid-text">
                <strong>{title}</strong>
                <small>{desc}</small>
              </div>
              <span className="detail-grid-count">{count}</span>
            </button>
          ))}
        </div>

        <div className="detail-hint-card">
          <Edit3 size={20} />
          <div>
            <strong>小贴士</strong>
            <p>长按工具可以将其固定到首页快捷入口</p>
          </div>
        </div>
      </div>
    </div>
  )
}
