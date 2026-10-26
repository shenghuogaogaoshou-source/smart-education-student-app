import {
  ArrowLeft,
  BookOpenCheck,
  Brain,
  CalendarClock,
  ChevronRight,
  NotebookPen,
  Palette,
  Trophy,
} from 'lucide-react'
import type { WorkRecord } from '../works/types'

export type NotificationTarget =
  | { kind: 'schedule' }
  | { kind: 'knowledge' }
  | { kind: 'wrong-book' }
  | { kind: 'medals' }
  | { kind: 'work'; workId: string }
  | { kind: 'ai-advice' }

type NotificationItem = {
  id: string
  type: 'plan' | 'knowledge' | 'wrong-book' | 'reward' | 'work' | 'ai-advice'
  icon: typeof CalendarClock
  text: string
  time: string
  target: NotificationTarget
}

const notifications: NotificationItem[] = [
  {
    id: 'plan',
    type: 'plan',
    icon: CalendarClock,
    text: '今天 19:00 的「AI 小小观察家」学习安排还在等你',
    time: '5 分钟前',
    target: { kind: 'schedule' },
  },
  {
    id: 'knowledge',
    type: 'knowledge',
    icon: BookOpenCheck,
    text: '知识进度已更新：继续「声音的旅行」',
    time: '20 分钟前',
    target: { kind: 'knowledge' },
  },
  {
    id: 'wrong-book',
    type: 'wrong-book',
    icon: NotebookPen,
    text: '错题本新增 2 道题，去回顾一下思路吧',
    time: '1 小时前',
    target: { kind: 'wrong-book' },
  },
  {
    id: 'reward',
    type: 'reward',
    icon: Trophy,
    text: '积分到账 +20，新的成长徽章可以领取了',
    time: '2 小时前',
    target: { kind: 'medals' },
  },
  {
    id: 'work',
    type: 'work',
    icon: Palette,
    text: '乐乐赞了你的作品《会呼吸的时钟》',
    time: '昨天',
    target: { kind: 'work', workId: 'demo-video-1' },
  },
  {
    id: 'ai-advice',
    type: 'ai-advice',
    icon: Brain,
    text: 'AI 建议：今晚可以先用 10 分钟复习错题',
    time: '昨天',
    target: { kind: 'ai-advice' },
  },
]

const grouped = [
  { label: '今天', items: notifications.slice(0, 4) },
  { label: '昨天', items: notifications.slice(4, 6) },
]

export function resolveNotificationWorkId(works: WorkRecord[], reference: string) {
  return works.find((work) => work.id === reference || work.sourceDraftId === reference)?.id
}

export function NotificationsPage({
  onBack,
  onOpenTarget,
}: {
  onBack: () => void
  onOpenTarget?: (target: NotificationTarget) => void
}) {
  return (
    <div className="notifications-page">
      <header className="notifications-header">
        <button className="notifications-back" type="button" onClick={onBack} aria-label="返回">
          <ArrowLeft size={20} />
        </button>
        <h1>消息通知</h1>
      </header>

      {grouped.map((group) => (
        <section key={group.label} className="notifications-group">
          <p className="notifications-group-label">{group.label}</p>
          <ul className="notifications-list">
            {group.items.map(({ id, icon: Icon, text, time, type, target }) => (
              <li key={id}>
                <button
                  className={`notifications-item notifications-${type}`}
                  type="button"
                  onClick={() => onOpenTarget?.(target)}
                >
                  <span className="notifications-icon"><Icon aria-hidden="true" size={18} /></span>
                  <span className="notifications-body">
                    <p>{text}</p>
                    <small>{time}</small>
                  </span>
                  <ChevronRight className="notifications-chevron" aria-hidden="true" size={16} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <p className="notifications-service-notice">涵盖学习安排、知识、错题、奖励、作品与 AI 建议</p>
    </div>
  )
}
