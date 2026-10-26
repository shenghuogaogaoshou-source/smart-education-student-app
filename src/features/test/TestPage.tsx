import { useEffect, useRef, useState } from 'react'
import { ArrowRight, BookOpen, Map, Sparkles, X } from 'lucide-react'
import { useAppState } from '../../app/AppState'
import { GRADE_BAND_LABELS, getGradeBand, isTestUnlocked, type CoursePartId, type PrimaryGrade } from '../../app/learning'
import { useDialogFocus } from '../../app/useDialogFocus'
import { AiCompanion } from '../ai_companion/AiCompanion'
import { getCourseForBand, type CoursePart } from '../knowledge/courseCatalog'
import { QuizModal, type QuizResult } from './QuizModal'
import { TestLevelNode, type TestLevelStatus } from './TestLevelNode'
import { getCurrentPartId, getMapNodes } from './testMapData'
import './test.css'

type ChallengeResult = QuizResult & {
  passed: boolean
}

type Props = {
  onReviewKnowledge?: (courseId: string, chapterNum: number) => void
  initialPartId?: CoursePartId
}

export function TestPage({ onReviewKnowledge, initialPartId }: Props = {}) {
  const { state, submitQuizResult } = useAppState()
  const band = getGradeBand(state.grade as PrimaryGrade)
  const course = getCourseForBand(band)
  const progress = state.learningProgress[band]
  const nodes = getMapNodes(course.id)
  const currentPartId = getCurrentPartId(course, progress)
  const currentNode = nodes.find((node) => node.id === currentPartId) ?? nodes.at(-1)
  const routeRef = useRef<HTMLDivElement>(null)
  const [currentAnchor, setCurrentAnchor] = useState<HTMLButtonElement | null>(null)
  const [notice, setNotice] = useState('')
  const [introPart, setIntroPart] = useState<CoursePart | null>(null)
  const [activePart, setActivePart] = useState<CoursePart | null>(null)
  const [result, setResult] = useState<ChallengeResult | null>(null)
  const handledInitialPart = useRef<CoursePartId | null>(null)
  const introDialogRef = useDialogFocus<HTMLDivElement>(Boolean(introPart), () => setIntroPart(null))

  useEffect(() => {
    const route = routeRef.current
    if (!route || !currentNode) return
    const canvas = route.firstElementChild as HTMLElement | null
    if (!canvas) return
    const canvasHeight = canvas.clientHeight || 1100
    const centerFromTop = ((100 - currentNode.y) / 100) * canvasHeight
    route.scrollTop = Math.max(0, centerFromTop - route.clientHeight / 2)
  }, [currentNode?.id, currentNode?.y])

  useEffect(() => {
    handledInitialPart.current = null
  }, [initialPartId])

  useEffect(() => {
    if (!initialPartId || handledInitialPart.current === initialPartId) return
    const requestedPart = course.parts.find((part) => part.id === initialPartId)
    if (!requestedPart) {
      setNotice('没有找到这项学习安排，可以回到计划里重新选择。')
      handledInitialPart.current = initialPartId
      return
    }
    const requestedNode = nodes.find((node) => node.id === requestedPart.id)
    const route = routeRef.current
    if (route && requestedNode) {
      const canvas = route.firstElementChild as HTMLElement | null
      const canvasHeight = canvas?.clientHeight || 1100
      const centerFromTop = ((100 - requestedNode.y) / 100) * canvasHeight
      route.scrollTop = Math.max(0, centerFromTop - route.clientHeight / 2)
    }
    const anchor = routeRef.current?.querySelector<HTMLButtonElement>(
      `[data-node-anchor="${requestedPart.id}"]`,
    )
    anchor?.focus({ preventScroll: true })
    openChallenge(requestedPart)
    handledInitialPart.current = initialPartId
  }, [initialPartId, course.id])

  function nodeStatus(part: CoursePart): TestLevelStatus {
    if (progress.testsPassed.includes(part.id)) return 'completed'
    if (part.id === currentPartId) return 'current'
    if (isTestUnlocked(progress, part.id)) return 'available'
    return 'knowledge-locked'
  }

  function openChallenge(part: CoursePart) {
    setNotice('')
    if (!isTestUnlocked(progress, part.id)) {
      setNotice(`先完成第 ${part.number} 部分知识`)
      return
    }
    setResult(null)
    setIntroPart(part)
  }

  function startChallenge() {
    setActivePart(introPart)
    setIntroPart(null)
  }

  function closeChallenge() {
    setActivePart(null)
    setResult(null)
  }

  function handleComplete(quizResult: QuizResult) {
    const passed = quizResult.total > 0 && quizResult.score / quizResult.total >= 0.6
    if (activePart) submitQuizResult(activePart.id, activePart.title, quizResult)
    setResult({ ...quizResult, passed })
  }

  function reviewKnowledge() {
    const part = activePart
    closeChallenge()
    if (part) onReviewKnowledge?.(course.id, part.number)
  }

  const activeQuiz = activePart
    ? course.quizzes.find((quiz) => quiz.partId === activePart.id)
    : undefined
  const routeHeight = Math.max(840, course.parts.length * 128)

  return (
    <div className="test-page" data-band={band}>
      <header className="test-header test-adventure-header">
        <div className="test-unit">
          <span className="unit-num">{GRADE_BAND_LABELS[band]} · AI 闯关路线</span>
          <h2>{course.name}</h2>
          <p>{course.motto}</p>
        </div>
        <div className="test-progress-card" aria-label="闯关进度">
          <Sparkles size={18} aria-hidden="true" />
          <strong>{progress.testsPassed.length}</strong>
          <span>/ {course.parts.length}</span>
        </div>
      </header>

      <section className="test-route-card" aria-label="闯关地图">
        <div className="test-route-card__heading">
          <div>
            <span><Map size={16} aria-hidden="true" /> 完整冒险地图</span>
            <h3 id="test-route-title">沿着地标完成每个知识挑战</h3>
          </div>
          <small>上下滑动探索</small>
        </div>

        {notice && <p className="test-map-notice" role="status">{notice}</p>}

        <div
          ref={routeRef}
          className="test-route-scroll"
        >
          <div className="test-route-content" style={{ height: `${routeHeight}px` }}>
            <div
              className="test-route-canvas"
              role="region"
              aria-label="可上下滑动的完整闯关地图"
              tabIndex={0}
            >
              <svg className="test-route-line" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                <path
                  d={nodes.map((node, index) => `${index === 0 ? 'M' : 'L'} ${node.x} ${100 - node.y}`).join(' ')}
                  fill="none"
                  vectorEffect="non-scaling-stroke"
                />
              </svg>
              {course.parts.map((part) => {
                const node = nodes.find((candidate) => candidate.id === part.id)!
                return (
                  <TestLevelNode
                    key={part.id}
                    node={node}
                    part={part}
                    status={nodeStatus(part)}
                    onSelect={openChallenge}
                    buttonRef={part.id === currentNode?.id ? setCurrentAnchor : undefined}
                  />
                )
              })}
            </div>
            {currentNode && (
              <AiCompanion
                placement="test-map"
                mapTarget={{ ...currentNode, anchor: currentAnchor }}
              />
            )}
          </div>
        </div>
      </section>

      {introPart && (
        <div ref={introDialogRef} className="challenge-intro-overlay" role="dialog" aria-modal="true" aria-label={`${introPart.title}挑战介绍`}>
          <section className="challenge-intro-card">
            <button type="button" className="challenge-intro-close" aria-label="关闭挑战介绍" onClick={() => setIntroPart(null)}>
              <X size={20} />
            </button>
            <span className="challenge-intro-icon" aria-hidden="true">{nodes.find((node) => node.id === introPart.id)?.landmark}</span>
            <p>第 {introPart.number} 部分挑战</p>
            <h2>{introPart.title}</h2>
            <div className="challenge-intro-detail">
              <BookOpen size={18} aria-hidden="true" />
              <span>{introPart.challenge}</span>
            </div>
            <button type="button" className="challenge-start-button" onClick={startChallenge}>
              开始答题 <ArrowRight size={18} />
            </button>
          </section>
        </div>
      )}

      {activePart && activeQuiz && (
        <QuizModal
          levelTitle={activePart.title}
          chapter={activeQuiz}
          partNumber={activePart.number}
          result={result}
          onClose={closeChallenge}
          onComplete={handleComplete}
          onRetry={() => setResult(null)}
          onReviewKnowledge={reviewKnowledge}
        />
      )}
    </div>
  )
}
