import { makeCoursePartId, type BandProgress, type CourseId, type CoursePartId } from '../../app/learning'
import type { CoursePackage } from '../knowledge/courseCatalog'

export type MapNode = {
  id: CoursePartId
  x: number
  y: number
  landmark: string
  detail: string
}

type NodeLayout = Omit<MapNode, 'id'>

const ROUTE_BOTTOM = 12
const ROUTE_TOP = 88
const ROUTE_LEFT = 28
const ROUTE_RIGHT = 72
const ROUTE_CENTER = 50

function createRouteLayout(nodes: Array<Pick<NodeLayout, 'landmark' | 'detail'>>): NodeLayout[] {
  const steps = Math.max(nodes.length - 1, 1)
  return nodes.map((node, index) => ({
    ...node,
    x: index === 0 || index === nodes.length - 1
      ? ROUTE_CENTER
      : index % 2 === 1 ? ROUTE_LEFT : ROUTE_RIGHT,
    y: ROUTE_BOTTOM + ((ROUTE_TOP - ROUTE_BOTTOM) * index) / steps,
  }))
}

const layouts: Record<CourseId, NodeLayout[]> = {
  qmx: createRouteLayout([
    { landmark: '✨', detail: '从认识 AI 开始，点亮第一颗启明星。' },
    { landmark: '🏠', detail: '发现藏在家里的 AI 小帮手。' },
    { landmark: '👀', detail: '看看 AI 怎样认出图片里的秘密。' },
    { landmark: '🎧', detail: '听一听 AI 怎样理解声音。' },
    { landmark: '🧠', detail: '用好多例子帮助 AI 学会新本领。' },
    { landmark: '⏳', detail: '沿着时间线认识 AI 的成长。' },
    { landmark: '🌫️', detail: '穿过迷雾，记住 AI 也会犯错。' },
    { landmark: '🏰', detail: '守护自己的秘密，完成启明星旅程。' },
  ]),
  cxd: createRouteLayout([
    { landmark: '🔭', detail: '认识 AI 的能力，也看见它的边界。' },
    { landmark: '💬', detail: '把目标和要求说清楚。' },
    { landmark: '🎨', detail: '先构思，再和 AI 一起完善创意。' },
    { landmark: '🔎', detail: '查来源、做比较，当真相侦探。' },
    { landmark: '🧪', detail: '用安全样本教 AI 认识世界。' },
    { landmark: '🛡️', detail: '负责任地使用 AI，完成创想旅程。' },
  ]),
  ael: createRouteLayout([
    { landmark: '🧩', detail: '拆开一个 AI 系统，认识输入、模型和输出。' },
    { landmark: '🔎', detail: '检查数据来源、标签和代表性。' },
    { landmark: '🧰', detail: '为分类、聚类和预测任务选择工具。' },
    { landmark: '🧪', detail: '动手完成采集、训练、测试和改进。' },
    { landmark: '📋', detail: '用准确率和错误案例给 AI 打分。' },
    { landmark: '✨', detail: '写清提示、核验事实并尊重原创。' },
    { landmark: '🛠️', detail: '从真实需求出发制作产品原型。' },
    { landmark: '🛡️', detail: '识别风险，练习安全三步法。' },
    { landmark: '🏁', detail: '完成一个安全、可测试的 AI 小项目。' },
  ]),
}

export function getMapNodes(courseId: CourseId): MapNode[] {
  return layouts[courseId].map((node, index) => ({
    ...node,
    id: makeCoursePartId(courseId, index + 1),
  }))
}

export function getCurrentPartId(course: CoursePackage, progress: BandProgress) {
  return course.parts.find((part) => !progress.testsPassed.includes(part.id) && progress.knowledgeCompleted.includes(part.id))?.id
    ?? course.parts.find((part) => !progress.knowledgeCompleted.includes(part.id))?.id
    ?? course.parts.at(-1)!.id
}
