import { ArrowLeft, BookOpen, Bookmark, Edit3, History, NotebookPen } from 'lucide-react'
import { useAppState } from '../../app/AppState'
import { getGradeBand } from '../../app/learning'
import { getCourseForBand } from '../knowledge/courseCatalog'
import { useOptionalWorks } from '../works/WorksProvider'
import './profile.css'

export function LearningToolsDetailPage({
  onBack,
  onOpenWrongBook,
  onOpenFavorites,
  onOpenHistory,
}: {
  onBack: () => void
  onOpenWrongBook?: () => void
  onOpenFavorites?: () => void
  onOpenHistory?: () => void
}) {
  const { state } = useAppState()
  const worksState = useOptionalWorks()
  const course = getCourseForBand(getGradeBand(state.grade))
  const wrongQuestionCount = state.wrongAnswers.length
  const pendingWrongCount = state.wrongAnswers.filter((answer) => !answer.correctedAt).length
  const learningRecordCount = course.parts.length + course.quizzes.length
  const favoriteCount = (worksState?.works ?? []).filter((work) => (
    work.status === 'published'
    && (work.creatorId || work.ownerId) !== worksState?.accountId
    && work.favoritedBy.includes(worksState?.accountId ?? '')
  )).length
  const tools = [
    {
      id: 'notes',
      title: '错题本',
      desc: '收集测试中的错题，支持重做和查看解析',
      Icon: NotebookPen,
      count: wrongQuestionCount,
      onClick: onOpenWrongBook,
    },
    {
      id: 'favorites',
      title: '我的收藏',
      desc: '收藏其他同学的创意作品',
      Icon: Bookmark,
      count: favoriteCount,
      onClick: onOpenFavorites,
    },
    {
      id: 'history',
      title: '学习记录',
      desc: '查看当前课程的知识和测试标题',
      Icon: History,
      count: learningRecordCount,
      onClick: onOpenHistory,
    },
  ]

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
            <span>待复习</span>
            <strong>{pendingWrongCount} 道</strong>
          </div>
          <div>
            <span>可用工具</span>
            <em>{tools.length} 个</em>
          </div>
        </div>

        <div className="detail-grid">
          {tools.map(({ id, title, desc, Icon, count, onClick }) => (
            <button key={id} className="detail-grid-item" type="button" onClick={onClick} disabled={!onClick}>
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
            <p>选择工具可以直接进入对应页面</p>
          </div>
        </div>
      </div>
    </div>
  )
}
