import { Bookmark, Heart, MessageCircle, Send, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { useAppState } from '../../app/AppState'
import { rankPublishedWorks, type RankingPeriod } from '../works/moderation'
import { useOptionalWorks } from '../works/WorksProvider'

const periodLabels: Array<{ id: RankingPeriod; label: string }> = [
  { id: 'day', label: '每天' },
  { id: 'week', label: '每周' },
  { id: 'year', label: '每年' },
]

export function AchievementShowcase({ onWorkClick, onMoreWorks }: { onWorkClick?: (workId: string) => void; onMoreWorks?: () => void }) {
  const [period, setPeriod] = useState<RankingPeriod>('day')
  const [commentFor, setCommentFor] = useState<string | null>(null)
  const [comment, setComment] = useState('')
  const [review, setReview] = useState('')
  const { state } = useAppState()
  const worksState = useOptionalWorks()
  const works = rankPublishedWorks(worksState?.works ?? [], period)

  const submitComment = async (workId: string) => {
    try {
      await worksState?.addComment(workId, state.nickname, comment)
      setReview('留言已发布')
      setComment('')
    } catch (error) {
      setReview(error instanceof Error ? error.message : '这条留言暂时不能发布')
    }
  }

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
        {works.map((work, index) => {
          const liked = work.likedBy.includes(state.accountId)
          const saved = work.favoritedBy.includes(state.accountId)
          return (
            <article className="showcase-card" key={work.id}>
              <div className="work-index">{String(index + 1).padStart(2, '0')}</div>
              <div className="work-copy" onClick={() => onWorkClick?.(work.id)} style={{ cursor: onWorkClick ? 'pointer' : 'default' }}>
                <span>{work.source === 'brain-film' ? '脑洞放映厅' : work.source === 'creative-module' ? '创造模块' : 'AI 创作'}</span>
                <h3>{work.title}</h3>
                <p>{state.nickname} · {work.likes} 人喜欢</p>
              </div>
              <div className="work-actions">
                <button type="button" aria-label="点赞作品" aria-pressed={liked} onClick={() => worksState?.toggleLike(work.id)}><Heart aria-hidden="true" size={18} fill={liked ? 'currentColor' : 'none'} /></button>
                <button type="button" aria-label="收藏作品" aria-pressed={saved} onClick={() => worksState?.toggleFavorite(work.id)}><Bookmark aria-hidden="true" size={18} fill={saved ? 'currentColor' : 'none'} /></button>
                <button type="button" aria-label="留言" onClick={() => { setCommentFor(commentFor === work.id ? null : work.id); setReview(''); setComment('') }}><MessageCircle aria-hidden="true" size={18} /></button>
              </div>
              {commentFor === work.id && (
                <div className="comment-box">
                  <label htmlFor={`comment-${work.id}`}>写一句友好的留言</label>
                  <div>
                    <input id={`comment-${work.id}`} value={comment} maxLength={80} onChange={(event) => setComment(event.target.value)} />
                    <button type="button" aria-label="提交留言" onClick={() => submitComment(work.id)}><Send aria-hidden="true" size={17} /></button>
                  </div>
                  {review && <p role="status">{review}</p>}
                </div>
              )}
            </article>
          )
        })}
        {!worksState?.loading && works.length === 0 && (
          <div className="showcase-empty">
            <Sparkles aria-hidden="true" />
            <strong>还没有公开作品</strong>
            <small>完成一次创作并发布后，就会出现在这里。</small>
          </div>
        )}
      </div>
    </section>
  )
}
