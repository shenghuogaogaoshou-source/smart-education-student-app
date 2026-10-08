import { Bookmark, Heart, MessageCircle, Send } from 'lucide-react'
import { useState } from 'react'
import { useAppState } from '../../app/AppState'
import { worksByPeriod } from './homeData'

type Period = keyof typeof worksByPeriod

const periodLabels: Array<{ id: Period; label: string }> = [
  { id: 'day', label: '每天' },
  { id: 'week', label: '每周' },
  { id: 'year', label: '每年' },
]

function reviewComment(value: string) {
  if (!value.trim()) return '先写下一句想说的话吧'
  if (/(笨|蠢|讨厌|垃圾|滚)/i.test(value)) return '这句话可能让别人不舒服，可以换一种更友好的表达'
  return '留言已通过本地演示检查，仅保存在当前浏览器'
}

export function AchievementShowcase({ onWorkClick, onMoreWorks }: { onWorkClick?: (workId: string) => void; onMoreWorks?: () => void }) {
  const [period, setPeriod] = useState<Period>('day')
  const [commentFor, setCommentFor] = useState<string | null>(null)
  const [comment, setComment] = useState('')
  const [review, setReview] = useState('')
  const { state, toggleLike, toggleFavorite } = useAppState()

  return (
    <section className="showcase section-block" aria-labelledby="showcase-title">
      <div className="section-heading-row">
        <div><p className="section-kicker">灵感成果</p><h2 id="showcase-title">看看大家的新作品</h2></div>
        <button className="text-action" type="button" onClick={() => onMoreWorks?.()}>更多作品</button>
      </div>
      <div className="period-tabs" aria-label="作品热度时间范围">
        {periodLabels.map(({ id, label }) => <button key={id} type="button" aria-pressed={period === id} onClick={() => setPeriod(id)}>{label}</button>)}
      </div>
      <div className="work-list">
        {worksByPeriod[period].map((work, index) => {
          const liked = state.likes.includes(work.id)
          const saved = state.favorites.includes(work.id)
          return (
            <article className="showcase-card" key={work.id}>
              <div className="work-index">{String(index + 1).padStart(2, '0')}</div>
              <div className="work-copy" onClick={() => onWorkClick?.(work.id)} style={{ cursor: onWorkClick ? 'pointer' : 'default' }}><span>{work.tag}</span><h3>{work.title}</h3><p>{work.author}</p></div>
              <div className="work-actions">
                <button type="button" aria-label="点赞作品" aria-pressed={liked} onClick={() => toggleLike(work.id)}><Heart aria-hidden="true" size={18} fill={liked ? 'currentColor' : 'none'} /></button>
                <button type="button" aria-label="收藏作品" aria-pressed={saved} onClick={() => toggleFavorite(work.id)}><Bookmark aria-hidden="true" size={18} fill={saved ? 'currentColor' : 'none'} /></button>
                <button type="button" aria-label="留言" onClick={() => { setCommentFor(commentFor === work.id ? null : work.id); setReview('') }}><MessageCircle aria-hidden="true" size={18} /></button>
              </div>
              {commentFor === work.id && (
                <div className="comment-box">
                  <label htmlFor={`comment-${work.id}`}>写一句友好的留言</label>
                  <div><input id={`comment-${work.id}`} value={comment} maxLength={80} onChange={(event) => setComment(event.target.value)} /><button type="button" aria-label="提交留言" onClick={() => setReview(reviewComment(comment))}><Send aria-hidden="true" size={17} /></button></div>
                  {review && <p role="status">{review}</p>}
                </div>
              )}
            </article>
          )
        })}
      </div>
    </section>
  )
}
