import { ArrowLeft, CheckCircle2, Filter, RotateCcw, Trash2, XCircle } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useAppState } from '../../app/AppState'
import { getGradeBand } from '../../app/learning'
import { getCourseForBand, type CoursePackage, type QuizQuestion } from '../knowledge/courseCatalog'
import './profile.css'

type QuestionTypeFilter = '全部' | '选择题' | '判断题' | '情境题'
type ReviewFilter = '全部' | '待复习'

type WrongQuestion = {
  id: string
  type: QuestionTypeFilter
  chapterTitle: string
  chapterNumber: number
  questionNumber: number
  question: string
  wrongAnswer: string
  correctAnswer: string
  explanation: string
  reviewed: boolean
}

const TYPE_LABELS: Record<QuizQuestion['type'], Exclude<QuestionTypeFilter, '全部'>> = {
  choice: '选择题',
  judgment: '判断题',
  scenario: '情境题',
}

function toWrongQuestion(
  question: QuizQuestion,
  chapterTitle: string,
  chapterNumber: number,
  questionNumber: number,
  reviewed: boolean,
): WrongQuestion {
  const wrongIndex = (question.answerIndex + 1) % question.options.length
  return {
    id: question.id,
    type: TYPE_LABELS[question.type],
    chapterTitle,
    chapterNumber,
    questionNumber,
    question: question.prompt,
    wrongAnswer: question.options[wrongIndex],
    correctAnswer: question.options[question.answerIndex],
    explanation: question.explanation,
    reviewed,
  }
}

function buildDemoWrongQuestions(course: CoursePackage): WrongQuestion[] {
  const questions = course.quizzes.flatMap((chapter, chapterIndex) => (
    chapter.questions.map((question, questionIndex) => ({
      question,
      chapterTitle: chapter.title,
      chapterIndex,
      questionIndex,
    }))
  ))
  const sampleIndexes = [0, 5, 10, 15, 20, 25]
  return sampleIndexes.flatMap((index, sampleIndex) => {
    const item = questions[index]
    if (!item) return []
    return [toWrongQuestion(
      item.question,
      item.chapterTitle,
      item.chapterIndex + 1,
      item.questionIndex + 1,
      sampleIndex % 3 === 0,
    )]
  })
}

export function WrongBookPage({ onBack }: { onBack: () => void }) {
  const { state } = useAppState()
  const course = useMemo(() => getCourseForBand(getGradeBand(state.grade)), [state.grade])
  const initialQuestions = useMemo(() => buildDemoWrongQuestions(course), [course])
  const [questions, setQuestions] = useState(initialQuestions)
  const [typeFilter, setTypeFilter] = useState<QuestionTypeFilter>('全部')
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>('全部')
  const [expanded, setExpanded] = useState<string | null>(initialQuestions[0]?.id ?? null)

  const pendingCount = questions.filter((question) => !question.reviewed).length
  const chapterCount = new Set(questions.map((question) => question.chapterTitle)).size
  const filters: QuestionTypeFilter[] = ['全部', '选择题', '判断题', '情境题']

  const filtered = questions.filter((question) => (
    (typeFilter === '全部' || question.type === typeFilter)
    && (reviewFilter === '全部' || !question.reviewed)
  ))

  const removeQuestion = (id: string) => {
    setQuestions((current) => current.filter((question) => question.id !== id))
    if (expanded === id) setExpanded(null)
  }

  return (
    <div className="rewards-page wrongbook-page">
      <header className="profile-page-header">
        <button className="profile-back" type="button" onClick={onBack} aria-label="返回">
          <ArrowLeft size={20} />
        </button>
        <h1>错题本</h1>
      </header>

      <div className="rewards-summary">
        <button
          className={`rewards-stat clickable ${typeFilter === '全部' && reviewFilter === '全部' ? 'active' : ''}`}
          type="button"
          onClick={() => { setTypeFilter('全部'); setReviewFilter('全部') }}
        >
          <XCircle size={24} />
          <div><strong>{questions.length}</strong><span>测试错题</span></div>
        </button>
        <button
          className={`rewards-stat clickable ${reviewFilter === '待复习' ? 'active' : ''}`}
          type="button"
          onClick={() => setReviewFilter(reviewFilter === '待复习' ? '全部' : '待复习')}
        >
          <RotateCcw size={24} />
          <div><strong>{pendingCount}</strong><span>待复习</span></div>
        </button>
        <button
          className={`rewards-stat clickable ${typeFilter !== '全部' ? 'active' : ''}`}
          type="button"
          onClick={() => setTypeFilter(typeFilter === '全部' ? '选择题' : '全部')}
        >
          <Filter size={24} />
          <div><strong>{chapterCount}</strong><span>测试章节</span></div>
        </button>
      </div>

      <div className="wb-filter-row">
        {filters.map((item) => (
          <button
            key={item}
            type="button"
            className={`wb-filter-chip ${typeFilter === item ? 'active' : ''}`}
            onClick={() => setTypeFilter(item)}
          >
            {item}
          </button>
        ))}
        <button
          type="button"
          className={`wb-filter-chip ${reviewFilter === '待复习' ? 'active' : ''}`}
          onClick={() => setReviewFilter(reviewFilter === '待复习' ? '全部' : '待复习')}
        >
          待复习
        </button>
      </div>

      <div className="wb-list">
        {filtered.map((question) => {
          const isOpen = expanded === question.id
          return (
            <article
              key={question.id}
              className={`wb-card wb-card--interactive ${question.reviewed ? 'reviewed' : 'pending'}`}
              onClick={() => setExpanded(isOpen ? null : question.id)}
            >
              <button
                type="button"
                className="wb-card-header"
                aria-expanded={isOpen}
                onClick={() => setExpanded(isOpen ? null : question.id)}
              >
                <span className="wb-subject-tag">{question.type}</span>
                <span className="wb-tag">{question.chapterTitle}</span>
                <span className="wb-time">第 {question.questionNumber} 题</span>
              </button>

              <p className="wb-question">{question.question}</p>

              {isOpen && (
                <div className="wb-detail">
                  <div className="wb-answer wrong">
                    <small>你的答案</small>
                    <strong>{question.wrongAnswer}</strong>
                  </div>
                  <div className="wb-answer correct">
                    <small>正确答案</small>
                    <strong>{question.correctAnswer}</strong>
                  </div>
                  <p className="wb-explanation"><CheckCircle2 size={15} />{question.explanation}</p>
                </div>
              )}

              <div className="wb-card-footer">
                <button type="button" className="wb-action-btn" onClick={(event) => { event.stopPropagation(); setExpanded(question.id) }}>
                  <RotateCcw size={14} /> 重做
                </button>
                <button type="button" className="wb-action-btn ghost" onClick={(event) => { event.stopPropagation(); removeQuestion(question.id) }}>
                  <Trash2 size={14} /> 删除
                </button>
                {question.reviewed && <span className="wb-reviewed-tag">已复习</span>}
              </div>
            </article>
          )
        })}
        {filtered.length === 0 && (
          <div className="wm-empty">
            <CheckCircle2 size={30} />
            <strong>这类测试错题已经清理好了</strong>
            <small>换个筛选条件，或者继续完成新的挑战吧。</small>
          </div>
        )}
      </div>
    </div>
  )
}
