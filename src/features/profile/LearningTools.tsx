import { Bookmark, Bot, ChevronRight, History, NotebookPen } from 'lucide-react'
import { useAppState } from '../../app/AppState'
import { getGradeBand } from '../../app/learning'
import { getCourseForBand } from '../knowledge/courseCatalog'

export function LearningTools({
  onOpenTools,
  onOpenWrongBook,
  onOpenFavorites,
  onOpenHistory,
  onOpenAiCenter,
}: {
  onOpenTools?: () => void
  onOpenWrongBook?: () => void
  onOpenFavorites?: () => void
  onOpenHistory?: () => void
  onOpenAiCenter?: () => void
}) {
  const { state } = useAppState()
  const course = getCourseForBand(getGradeBand(state.grade))
  const wrongQuestionCount = Math.min(6, course.quizzes.length)
  const pendingWrongCount = Math.ceil(wrongQuestionCount * 2 / 3)

  return (
    <section className="profile-section tools-section" aria-labelledby="tools-title">
      <div className="section-heading-row">
        <div>
          <p className="section-kicker">随手可用</p>
          <h2 id="tools-title">学习工具</h2>
        </div>
        <button className="text-action" type="button" onClick={onOpenTools}>全部工具</button>
      </div>
      <button className="wrong-book" type="button" onClick={onOpenWrongBook}>
        <NotebookPen aria-hidden="true" />
        <span>
          <strong>错题本</strong>
          <small>知识和测试中的疑问会整理在这里</small>
          <em>{wrongQuestionCount} 道测试错题 · {pendingWrongCount} 道待复习</em>
        </span>
        <ChevronRight aria-hidden="true" />
      </button>
      <div className="tool-pair">
        <button type="button" onClick={onOpenFavorites}>
          <Bookmark aria-hidden="true" />
          <span>我的收藏</span>
          <strong>4 部作品</strong>
        </button>
        <button type="button" onClick={onOpenHistory}>
          <History aria-hidden="true" />
          <span>学习记录</span>
          <strong>{course.parts.length} 个知识 · {course.quizzes.length} 个测试</strong>
        </button>
      </div>
      <button className="ai-center" type="button" onClick={onOpenAiCenter}>
        <Bot aria-hidden="true" />
        <span>
          <strong>AI 伙伴中心</strong>
          <small>互动偏好、记忆与成长记录</small>
        </span>
        <ChevronRight aria-hidden="true" />
      </button>
    </section>
  )
}
