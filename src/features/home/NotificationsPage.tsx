import { ArrowLeft, Award, Heart, MessageCircle } from 'lucide-react'

type NotificationItem = {
  id: number
  type: 'like' | 'comment' | 'badge'
  icon: typeof Heart
  text: string
  time: string
}

const notifications: NotificationItem[] = [
  { id: 1, type: 'like', icon: Heart, text: '有同学赞了你的公开作品', time: '5分钟前' },
  { id: 2, type: 'comment', icon: MessageCircle, text: '你的公开作品收到了一条友好留言', time: '20分钟前' },
  { id: 3, type: 'badge', icon: Award, text: '恭喜获得新徽章「灵感探索者」', time: '1小时前' },
  { id: 4, type: 'like', icon: Heart, text: '你的创意作品又被两位同学收藏了', time: '2小时前' },
  { id: 5, type: 'comment', icon: MessageCircle, text: '你的作品收到了一条新的鼓励', time: '昨天' },
  { id: 6, type: 'badge', icon: Award, text: '本周学习达成 5 天，获得「坚持之星」徽章', time: '昨天' },
]

const grouped = [
  { label: '今天', items: notifications.slice(0, 4) },
  { label: '昨天', items: notifications.slice(4, 6) },
]

export function NotificationsPage({ onBack }: { onBack: () => void }) {
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
            {group.items.map(({ id, icon: Icon, text, time, type }) => (
              <li key={id} className={`notifications-item notifications-${type}`}>
                <span className="notifications-icon"><Icon aria-hidden="true" size={18} /></span>
                <div className="notifications-body">
                  <p>{text}</p>
                  <small>{time}</small>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <p className="notifications-service-notice">仅显示近期的点赞、评论与徽章消息</p>
    </div>
  )
}
