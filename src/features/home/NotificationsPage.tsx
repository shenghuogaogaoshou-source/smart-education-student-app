import { ArrowLeft, Award, Heart, MessageCircle } from 'lucide-react'

type NotificationItem = {
  id: number
  type: 'like' | 'comment' | 'badge'
  icon: typeof Heart
  text: string
  time: string
}

const notifications: NotificationItem[] = [
  { id: 1, type: 'like', icon: Heart, text: '星河同学点赞了你的作品《会分类的照相机》', time: '5分钟前' },
  { id: 2, type: 'comment', icon: MessageCircle, text: '小明同学评论了你的作品《未来图书馆》', time: '20分钟前' },
  { id: 3, type: 'badge', icon: Award, text: '恭喜获得新徽章「灵感探索者」', time: '1小时前' },
  { id: 4, type: 'like', icon: Heart, text: '林川同学、清禾同学点赞了你的作品《未来校园小设计》', time: '2小时前' },
  { id: 5, type: 'comment', icon: MessageCircle, text: '远帆同学评论了你的作品《声音地图》', time: '昨天' },
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
