import { ArrowLeft, BookOpenCheck, ClipboardCheck, Trophy } from 'lucide-react'
import { useAppState } from '../../app/AppState'
import { getGradeBand } from '../../app/learning'
import { getCourseForBand } from '../knowledge/courseCatalog'
import './profile.css'

type HistoryStatus = '已完成' | '进行中' | '未开始'

type CurriculumHistoryItem = {
  id: string
  title: string
  number: number
  status: HistoryStatus
}

function statusFor(completed: boolean, current: boolean): HistoryStatus {
  if (completed) return '已完成'
  return current ? '进行中' : '未开始'
}

export function HistoryPage({ onBack }: { onBack: () => void }) {
  const { state } = useAppState()
  const band = getGradeBand(state.grade)
  const course = getCourseForBand(band)
  const progress = state.learningProgress[band]

  const knowledge: CurriculumHistoryItem[] = course.parts.map((part, index) => {
    const completed = progress.knowledgeCompleted.includes(part.id)
    const firstIncomplete = course.parts.findIndex((candidate) => !progress.knowledgeCompleted.includes(candidate.id))
    return {
      id: `knowledge-${part.id}`,
      title: part.title,
      number: part.number,
      status: statusFor(completed, index === firstIncomplete),
    }
  })

  const tests: CurriculumHistoryItem[] = course.quizzes.map((quiz, index) => {
    const completed = progress.testsPassed.includes(quiz.partId)
    const firstIncomplete = course.quizzes.findIndex((candidate) => !progress.testsPassed.includes(candidate.partId))
    return {
      id: `test-${quiz.partId}`,
      title: quiz.title,
      number: index + 1,
      status: statusFor(completed, index === firstIncomplete),
    }
  })

  const completedCount = [...knowledge, ...tests].filter((item) => item.status === '已完成').length

  const renderSection = (
    title: string,
    items: CurriculumHistoryItem[],
    type: 'knowledge' | 'test',
  ) => (
    <section className="history-group" aria-label={title}>
      <div className="history-group-header">
        <strong>{title}</strong>
        <span>共 {items.length} 项</span>
      </div>
      <div className={`history-curriculum-list history-curriculum-list--${type}`}>
        {items.map((item) => {
          const Icon = type === 'knowledge' ? BookOpenCheck : ClipboardCheck
          return (
            <article key={item.id} className={`history-curriculum-card is-${item.status}`}>
              <span className="history-curriculum-icon"><Icon aria-hidden="true" size={16} /></span>
              <div>
                <small>{type === 'knowledge' ? `知识第 ${item.number} 部分` : `测试第 ${item.number} 关`}</small>
                <strong>{item.title}</strong>
              </div>
              <span className="history-status">{item.status}</span>
            </article>
          )
        })}
      </div>
    </section>
  )

  return (
    <div className="rewards-page history-page">
      <header className="profile-page-header">
        <button className="profile-back" type="button" onClick={onBack} aria-label="返回">
          <ArrowLeft size={20} />
        </button>
        <h1>学习记录</h1>
      </header>

      <div className="history-course-summary">
        <div>
          <span>当前课程</span>
          <strong>{course.name}</strong>
          <small>{course.motto}</small>
        </div>
        <Trophy aria-hidden="true" size={28} />
      </div>

      <div className="rewards-summary">
        <div className="rewards-stat">
          <BookOpenCheck size={24} />
          <div><strong>{knowledge.length}</strong><span>知识部分</span></div>
        </div>
        <div className="rewards-stat">
          <ClipboardCheck size={24} />
          <div><strong>{tests.length}</strong><span>测试关卡</span></div>
        </div>
        <div className="rewards-stat">
          <Trophy size={24} />
          <div><strong>{completedCount}</strong><span>已完成</span></div>
        </div>
      </div>

      <div className="history-flow">
        {renderSection('知识学习', knowledge, 'knowledge')}
        {renderSection('闯关测试', tests, 'test')}
      </div>
    </div>
  )
}
