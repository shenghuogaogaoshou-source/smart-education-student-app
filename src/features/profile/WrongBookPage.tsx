import { ArrowLeft, CheckCircle2, Filter, RotateCcw, XCircle } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useAppState } from '../../app/AppState'
import { getGradeBand } from '../../app/learning'
import type { WrongAnswerRecord } from '../../app/model'
import { getCourseForBand, type QuizQuestion } from '../knowledge/courseCatalog'
import './profile.css'

type QuestionTypeFilter = '全部' | '选择题' | '判断题' | '情境题'
type ReviewFilter = '全部' | '待复习' | '已复习'

type WrongQuestion = {
  record: WrongAnswerRecord
  type: Exclude<QuestionTypeFilter, '全部'>
  chapterTitle: string
  questionNumber: number
  reviewed: boolean
}

const TYPE_LABELS: Record<QuizQuestion['type'], Exclude<QuestionTypeFilter, '全部'>> = {
  choice: '选择题',
  judgment: '判断题',
  scenario: '情境题',
}

function toWrongQuestion(record: WrongAnswerRecord, course: ReturnType<typeof getCourseForBand>): WrongQuestion {
  const part = course.parts.find((candidate) => candidate.id === record.partId)
  let quizQuestion: QuizQuestion | undefined
  let questionNumber = 1
  for (const chapter of course.quizzes) {
    const index = chapter.questions.findIndex((question) => question.id === record.questionId)
    if (index >= 0) {
      quizQuestion = chapter.questions[index]
      questionNumber = index + 1
      break
    }
  }

  return {
    record,
    type: quizQuestion ? TYPE_LABELS[quizQuestion.type] : '选择题',
    chapterTitle: part?.title ?? record.partId,
    questionNumber,
    reviewed: Boolean(record.correctedAt),
  }
}

export function WrongBookPage({ onBack }: { onBack: () => void }) {
  const { state, completeCorrection } = useAppState()
  const course = useMemo(() => getCourseForBand(getGradeBand(state.grade)), [state.grade])
  const questions = useMemo(
    () => state.wrongAnswers.map((record) => toWrongQuestion(record, course)),
    [course, state.wrongAnswers],
  )
  const [typeFilter, setTypeFilter] = useState<QuestionTypeFilter>('全部')
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>('全部')
  const [expanded, setExpanded] = useState<string | null>(questions[0]?.record.id ?? null)
  const [retryingId, setRetryingId] = useState<string | null>(null)
  const [retryFeedback, setRetryFeedback] = useState<Record<string, string>>({})

  const pendingCount = questions.filter((question) => !question.reviewed).length
  const chapterCount = new Set(questions.map((question) => question.chapterTitle)).size
  const filters: QuestionTypeFilter[] = ['全部', '选择题', '判断题', '情境题']

  const filtered = questions.filter((question) => (
    (typeFilter === '全部' || question.type === typeFilter)
    && (reviewFilter === '全部'
      || (reviewFilter === '待复习' && !question.reviewed)
      || (reviewFilter === '已复习' && question.reviewed))
  ))

  function startRetry(id: string) {
    setExpanded(id)
    setRetryingId(id)
    setRetryFeedback((current) => ({ ...current, [id]: '' }))
  }

  function chooseRetryOption(question: WrongQuestion, optionIndex: number) {
    if (optionIndex !== question.record.answerIndex) {
      setRetryFeedback((current) => ({
        ...current,
        [question.record.id]: '再想一想，你已经更接近答案了',
      }))
      return
    }

    completeCorrection(question.record.id)
    setRetryingId(null)
    setRetryFeedback((current) => ({
      ...current,
      [question.record.id]: '订正成功，这次思考已经记录下来',
    }))
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
        {(['待复习', '已复习'] as const).map((item) => (
          <button
            key={item}
            type="button"
            className={`wb-filter-chip ${reviewFilter === item ? 'active' : ''}`}
            onClick={() => setReviewFilter(reviewFilter === item ? '全部' : item)}
          >
            {item}
          </button>
        ))}
      </div>

      <div className="wb-list">
        {filtered.map((question) => {
          const isOpen = expanded === question.record.id
          const isRetrying = retryingId === question.record.id
          const feedback = retryFeedback[question.record.id]
          const wrongAnswer = question.record.options[question.record.selectedIndex] ?? '未记录'
          const correctAnswer = question.record.options[question.record.answerIndex] ?? '未记录'

          return (
            <article
              key={question.record.id}
              className={`wb-card wb-card--interactive ${question.reviewed ? 'reviewed' : 'pending'}`}
              onClick={() => setExpanded(isOpen ? null : question.record.id)}
            >
              <button
                type="button"
                className="wb-card-header"
                aria-expanded={isOpen}
                onClick={() => setExpanded(isOpen ? null : question.record.id)}
              >
                <span className="wb-subject-tag">{question.type}</span>
                <span className="wb-tag">{question.chapterTitle}</span>
                <span className="wb-time">第 {question.questionNumber} 题</span>
              </button>

              <p className="wb-question">{question.record.prompt}</p>

              {isOpen && (
                <div className="wb-detail">
                  {isRetrying ? (
                    <div className="wb-retry-options" role="group" aria-label="重做选项">
                      {question.record.options.map((option, optionIndex) => (
                        <button
                          key={`${question.record.id}-${optionIndex}`}
                          type="button"
                          className="wb-filter-chip wb-retry-option"
                          onClick={(event) => {
                            event.stopPropagation()
                            chooseRetryOption(question, optionIndex)
                          }}
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <>
                      <div className="wb-answer wrong">
                        <small>你的答案</small>
                        <strong>{wrongAnswer}</strong>
                      </div>
                      <div className="wb-answer correct">
                        <small>正确答案</small>
                        <strong>{correctAnswer}</strong>
                      </div>
                      <p className="wb-explanation">
                        <CheckCircle2 size={15} />{question.record.explanation}
                      </p>
                    </>
                  )}
                  {feedback && (
                    <p className={`wb-retry-feedback ${question.reviewed ? 'success' : ''}`}>
                      {feedback}
                    </p>
                  )}
                </div>
              )}

              <div className="wb-card-footer">
                <button
                  type="button"
                  className="wb-action-btn"
                  onClick={(event) => {
                    event.stopPropagation()
                    startRetry(question.record.id)
                  }}
                >
                  <RotateCcw size={14} /> 重做
                </button>
                {question.reviewed && <span className="wb-reviewed-tag">已复习</span>}
              </div>
            </article>
          )
        })}
        {filtered.length === 0 && (
          <div className="wm-empty">
            <CheckCircle2 size={30} />
            <strong>{questions.length === 0 ? '还没有真实的测试错题' : '这个筛选下没有错题'}</strong>
            <small>{questions.length === 0 ? '完成一次挑战后，答错的题目会出现在这里。' : '换个筛选条件继续复习吧。'}</small>
          </div>
        )}
      </div>
    </div>
  )
}
