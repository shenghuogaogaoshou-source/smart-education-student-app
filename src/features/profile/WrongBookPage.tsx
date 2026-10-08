import { ArrowLeft, Filter, RotateCcw, Trash2, XCircle } from 'lucide-react'
import { useState } from 'react'
import './profile.css'

type Subject = '全部' | '语文' | '数学' | '英语' | '科学'
type StatFilter = '全部错题' | '待复习' | '学科覆盖'

const subjects: Subject[] = ['全部', '语文', '数学', '英语', '科学']

const wrongQuestions = [
  {
    id: 'w1', subject: '数学', question: '一个三角形的底边为 12cm，高为 8cm，求其面积。',
    wrongAnswer: '12 × 8 = 96 cm²', correctAnswer: '12 × 8 ÷ 2 = 48 cm²',
    tag: '几何·三角形面积', time: '2 天前', reviewed: false,
  },
  {
    id: 'w2', subject: '科学', question: '光合作用主要发生在植物细胞的哪个结构中？',
    wrongAnswer: '线粒体', correctAnswer: '叶绿体',
    tag: '生物·细胞结构', time: '3 天前', reviewed: true,
  },
  {
    id: 'w3', subject: '语文', question: '"春眠不觉晓"的下一句是？',
    wrongAnswer: '处处闻啼鸟', correctAnswer: '处处闻啼鸟 ✅（误判，已改为正确）',
    tag: '古诗·孟浩然', time: '5 天前', reviewed: true,
  },
  {
    id: 'w4', subject: '英语', question: 'Choose the correct form: He ___ to school every day.',
    wrongAnswer: 'go', correctAnswer: 'goes（第三人称单数）',
    tag: '语法·一般现在时', time: '本周', reviewed: false,
  },
  {
    id: 'w5', subject: '数学', question: '圆的周长公式是？（半径为 r）',
    wrongAnswer: 'πr²', correctAnswer: '2πr（πr² 是面积）',
    tag: '几何·圆', time: '上周', reviewed: true,
  },
]

export function WrongBookPage({ onBack }: { onBack: () => void }) {
  const [subjectFilter, setSubjectFilter] = useState<Subject>('全部')
  const [reviewFilter, setReviewFilter] = useState<'全部' | '待复习'>('全部')
  const [expanded, setExpanded] = useState<string | null>(null)

  // 学科覆盖：统计各学科错题数
  const subjectCounts = subjects.slice(1).map((s) => ({
    label: s,
    count: wrongQuestions.filter((q) => q.subject === s).length,
  }))
  const maxSubjectCount = Math.max(...subjectCounts.map((s) => s.count), 1)

  let filtered = wrongQuestions
  if (subjectFilter !== '全部') {
    filtered = filtered.filter((q) => q.subject === subjectFilter)
  }
  if (reviewFilter === '待复习') {
    filtered = filtered.filter((q) => !q.reviewed)
  }

  const reviewedCount = wrongQuestions.filter((q) => !q.reviewed).length

  return (
    <div className="rewards-page wrongbook-page">
      <header className="profile-page-header">
        <button className="profile-back" type="button" onClick={onBack} aria-label="返回">
          <ArrowLeft size={20} />
        </button>
        <h1>错题本</h1>
      </header>

      <div className="rewards-summary">
        <div
          className={`rewards-stat clickable ${subjectFilter !== '全部' || reviewFilter !== '全部' ? 'active' : ''}`}
          role="button" tabIndex={0}
          onClick={() => { setSubjectFilter('全部'); setReviewFilter('全部') }}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { setSubjectFilter('全部'); setReviewFilter('全部') } }}
          title="显示全部错题"
        >
          <XCircle size={24} />
          <div>
            <strong>{wrongQuestions.length}</strong>
            <span>累计错题</span>
          </div>
        </div>
        <div
          className={`rewards-stat clickable ${reviewFilter === '待复习' ? 'active' : ''}`}
          role="button" tabIndex={0}
          onClick={() => setReviewFilter(reviewFilter === '待复习' ? '全部' : '待复习')}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setReviewFilter(reviewFilter === '待复习' ? '全部' : '待复习') }}
          title="只看待复习"
        >
          <RotateCcw size={24} />
          <div>
            <strong>{reviewedCount}</strong>
            <span>待复习</span>
          </div>
        </div>
        <div
          className={`rewards-stat clickable ${subjectFilter !== '全部' ? 'active' : ''}`}
          role="button" tabIndex={0}
          onClick={() => {
            if (subjectFilter === '全部') {
              // 快速切到有错题的第一个学科
              const first = subjectCounts.find((s) => s.count > 0)
              if (first) setSubjectFilter(first.label as Subject)
            } else {
              setSubjectFilter('全部')
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              if (subjectFilter === '全部') {
                const first = subjectCounts.find((s) => s.count > 0)
                if (first) setSubjectFilter(first.label as Subject)
              } else {
                setSubjectFilter('全部')
              }
            }
          }}
          title="按学科快速筛选"
        >
          <Filter size={24} />
          <div>
            <strong>{subjects.length - 1}</strong>
            <span>学科覆盖</span>
          </div>
        </div>
      </div>

      {/* 学科覆盖柱状图（点击学科覆盖时显示，或始终显示） */}
      <div className="wb-subject-bars">
        {subjectCounts.map((s) => (
          <button
            key={s.label}
            type="button"
            className={`wb-subject-bar ${subjectFilter === s.label ? 'active' : ''}`}
            onClick={() => setSubjectFilter(subjectFilter === s.label ? '全部' : s.label)}
          >
            <strong>{s.count}</strong>
            <div className="wb-subject-bar-track">
              <span style={{ width: `${(s.count / maxSubjectCount) * 100}%` }} />
            </div>
            <small>{s.label}</small>
          </button>
        ))}
      </div>

      <div className="wb-filter-row">
        <button
          type="button"
          className={`wb-filter-chip ${reviewFilter === '全部' && subjectFilter === '全部' ? 'active' : ''}`}
          onClick={() => { setSubjectFilter('全部'); setReviewFilter('全部') }}
        >全部错题</button>
        <button
          type="button"
          className={`wb-filter-chip ${reviewFilter === '待复习' ? 'active' : ''}`}
          onClick={() => setReviewFilter(reviewFilter === '待复习' ? '全部' : '待复习')}
        >待复习</button>
        {subjects.slice(1).map((s) => (
          <button
            key={s}
            type="button"
            className={`wb-filter-chip ${subjectFilter === s ? 'active' : ''}`}
            onClick={() => setSubjectFilter(subjectFilter === s ? '全部' : s)}
          >{s}</button>
        ))}
      </div>

      <div className="wb-list">
        {filtered.map((q) => {
          const isOpen = expanded === q.id
          return (
            <div key={q.id} className={`wb-card ${q.reviewed ? 'reviewed' : 'pending'}`}>
              <div className="wb-card-header" onClick={() => setExpanded(isOpen ? null : q.id)} role="button" tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setExpanded(isOpen ? null : q.id) }}>
                <span className="wb-subject-tag">{q.subject}</span>
                <span className="wb-tag">{q.tag}</span>
                <span className="wb-time">{q.time}</span>
              </div>

              <p className="wb-question">{q.question}</p>

              {isOpen && (
                <div className="wb-detail">
                  <div className="wb-answer wrong">
                    <small>你的答案</small>
                    <strong>{q.wrongAnswer}</strong>
                  </div>
                  <div className="wb-answer correct">
                    <small>正确答案</small>
                    <strong>{q.correctAnswer}</strong>
                  </div>
                </div>
              )}

              <div className="wb-card-footer">
                <button type="button" className="wb-action-btn">
                  <RotateCcw size={14} /> 重做
                </button>
                <button type="button" className="wb-action-btn ghost" onClick={(e) => { e.stopPropagation() }}>
                  <Trash2 size={14} /> 删除
                </button>
                {q.reviewed && <span className="wb-reviewed-tag">已复习</span>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
