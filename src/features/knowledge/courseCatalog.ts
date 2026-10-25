import { getGradeBand, type CourseId, type CoursePartId, type GradeBand, type PrimaryGrade } from '../../app/learning'
import { elementaryHigh, elementaryLow } from './knowledgeData'
import { GRADE56_PARTS } from './content/grade56Content'
import { quizCxd, quizQmx } from '../test/quizData'
import type { QuizChapter as LegacyQuizChapter, QuizQuestion as LegacyQuizQuestion } from '../test/quizData'
import { GRADE56_QUIZZES } from '../test/grade56QuizData'

export type CoursePart = {
  id: CoursePartId
  number: number
  title: string
  summary: string
  concept: string
  experiment: string
  safety: string
  challenge: string
  keyConcepts: KeyConcept[]
}

export type KeyConcept = {
  term: string
  explanation: string
  analogy: string
}

export type QuizQuestion = {
  id: string
  type: 'choice' | 'judgment' | 'scenario'
  prompt: string
  options: string[]
  answerIndex: number
  explanation: string
}

export type QuizChapter = { partId: CoursePartId; title: string; questions: QuizQuestion[] }
export type CourseMedal = { partId: CoursePartId; name: string; icon: string; description: string }
export type CoursePackage = {
  id: CourseId
  band: GradeBand
  name: string
  subtitle: string
  motto: string
  parts: CoursePart[]
  quizzes: QuizChapter[]
  medals: CourseMedal[]
  finaleMedal: { id: string; name: string; description: string }
}

const qmxParts: CoursePart[] = (elementaryLow.days ?? []).map((day, index) => ({
  id: day.id,
  number: index + 1,
  title: day.island,
  summary: day.activities[0]?.desc ?? '',
  concept: day.activities[1]?.desc ?? '',
  experiment: day.activities[0]?.title ?? '',
  safety: elementaryLow.safetyTips[index % elementaryLow.safetyTips.length]?.text ?? '',
  challenge: day.unlockText,
  keyConcepts: [],
}))

const cxdParts: CoursePart[] = (elementaryHigh.chapters ?? []).map((chapter) => ({
  id: chapter.id,
  number: chapter.num,
  title: chapter.title,
  summary: chapter.summary,
  concept: chapter.activities.find((activity) => activity.type === 'knowledge')?.desc ?? chapter.summary,
  experiment: chapter.tryIt,
  safety: elementaryHigh.safetyTips[(chapter.num - 1) % elementaryHigh.safetyTips.length]?.text ?? '',
  challenge: chapter.tryIt,
  keyConcepts: [],
}))

const qmxMedals: CourseMedal[] = elementaryLow.gems.map((gem, index) => ({
  partId: qmxParts[index].id,
  name: gem.name,
  icon: gem.icon,
  description: gem.desc,
}))

const cxdMedals: CourseMedal[] = elementaryHigh.gems.map((gem, index) => ({
  partId: cxdParts[index].id,
  name: gem.name,
  icon: gem.icon,
  description: gem.desc,
}))

const grade56MedalDetails = [
  ['拆解徽章', '🧩', '看懂 AI 系统各部分怎样合作。'],
  ['数据徽章', '🔎', '会整理安全、干净又均衡的数据。'],
  ['算法徽章', '🧰', '会为生活问题选择合适的算法工具。'],
  ['实验徽章', '🧪', '完成采集、训练、测试与改进。'],
  ['评委徽章', '📋', '会用测试和错误案例评价 AI。'],
  ['生成徽章', '✨', '会清楚提示、查证事实并尊重原创。'],
  ['产品徽章', '🛠️', '把真实需求做成可测试的产品原型。'],
  ['安全徽章', '🛡️', '能识别风险并使用 AI 安全三步法。'],
  ['项目徽章', '🏁', '完成一个安全、可测试的小项目计划。'],
] as const

const grade56Medals: CourseMedal[] = GRADE56_PARTS.map((part, index) => ({
  partId: part.id,
  name: grade56MedalDetails[index][0],
  icon: grade56MedalDetails[index][1],
  description: grade56MedalDetails[index][2],
}))

export const COURSE_PACKAGES: Record<GradeBand, CoursePackage> = {
  'grade1-2': {
    id: 'qmx',
    band: 'grade1-2',
    name: elementaryLow.courseName,
    subtitle: elementaryLow.subtitle,
    motto: elementaryLow.motto,
    parts: qmxParts,
    quizzes: quizQmx.map(toCatalogQuizChapter),
    medals: qmxMedals,
    finaleMedal: { id: 'qmx-finale', name: '启明星守护者', description: '集齐八颗宝石，点亮启明星。' },
  },
  'grade3-4': {
    id: 'cxd',
    band: 'grade3-4',
    name: elementaryHigh.courseName,
    subtitle: elementaryHigh.subtitle,
    motto: elementaryHigh.motto,
    parts: cxdParts,
    quizzes: quizCxd.map(toCatalogQuizChapter),
    medals: cxdMedals,
    finaleMedal: { id: 'cxd-finale', name: '创想大陆之星', description: '集齐六枚徽章，完成创想大陆旅程。' },
  },
  'grade5-6': {
    id: 'ael',
    band: 'grade5-6',
    name: 'AI 探索实验室',
    subtitle: '探索 AI：会拆解 · 会实验 · 会评价 · 会创造',
    motto: '9 个探究部分 · 9 枚课程徽章',
    parts: GRADE56_PARTS,
    quizzes: GRADE56_QUIZZES,
    medals: grade56Medals,
    finaleMedal: { id: 'ael-finale', name: 'AI 探索小导师', description: '完成九个探究部分和对应挑战。' },
  },
}

export function getCourseForBand(band: GradeBand): CoursePackage {
  return COURSE_PACKAGES[band]
}

export function getCourseForGrade(grade: PrimaryGrade): CoursePackage {
  return getCourseForBand(getGradeBand(grade))
}

export function getQuizForPart(partId: CoursePartId): QuizChapter | undefined {
  return Object.values(COURSE_PACKAGES)
    .flatMap((course) => course.quizzes)
    .find((quiz) => quiz.partId === partId)
}

function toCatalogQuizChapter(chapter: LegacyQuizChapter): QuizChapter {
  return {
    partId: chapter.partId,
    title: chapter.title,
    questions: chapter.questions.map((question, index) => toCatalogQuestion(chapter.partId, question, index)),
  }
}

function toCatalogQuestion(partId: CoursePartId, question: LegacyQuizQuestion, index: number): QuizQuestion {
  if (question.kind === 'sel') {
    return {
      id: `${partId}-q${index + 1}`,
      type: 'choice',
      prompt: question.q,
      options: question.opts,
      answerIndex: question.ans,
      explanation: `正确答案是“${question.opts[question.ans]}”。`,
    }
  }

  if (question.kind === 'jud') {
    return {
      id: `${partId}-q${index + 1}`,
      type: 'judgment',
      prompt: question.q,
      options: ['对', '错'],
      answerIndex: question.ans ? 0 : 1,
      explanation: question.ans ? '这句话说得对。' : '这句话说得不对。',
    }
  }

  return {
    id: `${partId}-q${index + 1}`,
    type: 'scenario',
    prompt: question.q,
    options: [question.ans, '我还需要回顾本章知识再作答'],
    answerIndex: 0,
    explanation: question.ans,
  }
}
