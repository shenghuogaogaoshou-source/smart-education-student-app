import { getGradeBand, type LearningProgress } from '../../app/learning'
import {
  getTaskCompletion,
  getTaskTiming,
  type LearningPlanTask,
} from '../../app/learningPlan'

export type PlanTaskView = {
  task: LearningPlanTask
  kindLabel: '知识' | '测试'
  statusLabel: '已完成' | '待调整' | '今天' | '待开始'
  tone: 'complete' | 'overdue' | 'today' | 'upcoming'
  showReview: boolean
}

export function dateKey(date: Date | string): string {
  if (typeof date === 'string') return date
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function tasksForDate(tasks: LearningPlanTask[], date: Date | string): LearningPlanTask[] {
  const key = dateKey(date)
  return tasks
    .filter((task) => task.date === key)
    .sort((left, right) => left.order - right.order || left.time.localeCompare(right.time))
}

function scheduledTime(task: LearningPlanTask): number {
  const [year, month, day] = task.date.split('-').map(Number)
  const [hour, minute] = task.time.split(':').map(Number)
  return new Date(year, month - 1, day, hour, minute).getTime()
}

export function getNextPlanTask(
  tasks: LearningPlanTask[],
  progress: LearningProgress,
  now: Date = new Date(),
): LearningPlanTask | null {
  const currentMinute = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    now.getHours(),
    now.getMinutes(),
  ).getTime()
  const pending = tasks.filter((task) => getTaskCompletion(task, progress) === 'pending')
  const upcoming = pending
    .filter((task) => scheduledTime(task) >= currentMinute)
    .sort((left, right) => scheduledTime(left) - scheduledTime(right))
  if (upcoming.length) return upcoming[0]

  return pending.sort((left, right) => scheduledTime(right) - scheduledTime(left))[0] ?? null
}

export function getPlanTaskView(
  task: LearningPlanTask,
  progress: LearningProgress,
  now: Date = new Date(),
): PlanTaskView {
  const completion = getTaskCompletion(task, progress)
  const timing = getTaskTiming(task, now)
  if (completion === 'completed') {
    return {
      task,
      kindLabel: task.kind === 'knowledge' ? '知识' : '测试',
      statusLabel: '已完成',
      tone: 'complete',
      showReview: task.review,
    }
  }
  if (timing === 'overdue') {
    return {
      task,
      kindLabel: task.kind === 'knowledge' ? '知识' : '测试',
      statusLabel: '待调整',
      tone: 'overdue',
      showReview: task.review,
    }
  }
  return {
    task,
    kindLabel: task.kind === 'knowledge' ? '知识' : '测试',
    statusLabel: timing === 'today' ? '今天' : '待开始',
    tone: timing,
    showReview: task.review,
  }
}

export function formatPlanTaskDate(task: LearningPlanTask, now: Date = new Date()): string {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const [year, month, day] = task.date.split('-').map(Number)
  const target = new Date(year, month - 1, day)
  const offset = Math.round((target.getTime() - today.getTime()) / 86_400_000)
  if (offset === 0) return '今天'
  if (offset === 1) return '明天'
  return `${month} 月 ${day} 日`
}

export function formatMonthTitle(year: number, month: number) {
  return `${year} 年 ${month + 1} 月`
}

export function isActiveBandTask(task: LearningPlanTask, grade: LearningPlanTask['grade']): boolean {
  return getGradeBand(task.grade) === getGradeBand(grade)
}
