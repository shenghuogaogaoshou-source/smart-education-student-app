import { Bookmark, Bot, ChevronRight, History, NotebookPen } from 'lucide-react'

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
          <em>还没有内容，慢慢积累就好</em>
        </span>
        <ChevronRight aria-hidden="true" />
      </button>
      <div className="tool-pair">
        <button type="button" onClick={onOpenFavorites}>
          <Bookmark aria-hidden="true" />
          <span>我的收藏</span>
          <strong>6 项</strong>
        </button>
        <button type="button" onClick={onOpenHistory}>
          <History aria-hidden="true" />
          <span>学习记录</span>
          <strong>本周 12 项</strong>
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
