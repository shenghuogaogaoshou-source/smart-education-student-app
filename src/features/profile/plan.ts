// 成长安排的共享数据：成长卡片、学习安排页与整月日历共用同一份计划。
export type PlanTask = {
  dayOffset: number // 0 = 今天
  time: string // HH:MM
  title: string
  minutes: number
}

export const PLAN_TASKS: PlanTask[] = [
  { dayOffset: 0, time: '19:00', title: '图片识别小探索', minutes: 15 },
  { dayOffset: 1, time: '19:00', title: '声音地图小任务', minutes: 10 },
  { dayOffset: 2, time: '10:30', title: '提示词小练习', minutes: 12 },
]

export function dateKey(d: Date) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

export function tasksForDate(d: Date) {
  const key = dateKey(d)
  const today = new Date()
  return PLAN_TASKS.filter((t) => {
    const target = new Date(today.getFullYear(), today.getMonth(), today.getDate() + t.dayOffset)
    return dateKey(target) === key
  })
}

export function formatMonthTitle(y: number, m: number) {
  return `${y} 年 ${m + 1} 月`
}
