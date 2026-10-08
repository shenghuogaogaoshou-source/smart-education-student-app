import { Award, Heart, MessageCircle, X } from 'lucide-react'

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

export function NotificationsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null
  return (
    <div className="sheet-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="tool-sheet notification-sheet" role="dialog" aria-modal="true" aria-labelledby="notification-sheet-title" onMouseDown={(event) => event.stopPropagation()}>
        <div className="sheet-head"><div><p>最新动态</p><h2 id="notification-sheet-title">消息通知</h2></div><button type="button" aria-label="关闭消息面板" onClick={onClose}><X aria-hidden="true" /></button></div>
        <ul className="notification-list">
          {notifications.map(({ id, icon: Icon, text, time, type }) => (
            <li key={id} className={`notification-item notification-${type}`}>
              <span className="notification-icon"><Icon aria-hidden="true" size={18} /></span>
              <div className="notification-body"><p>{text}</p><small>{time}</small></div>
            </li>
          ))}
        </ul>
        <p className="service-notice">仅显示近期的点赞、评论与徽章消息</p>
      </section>
    </div>
  )
}
