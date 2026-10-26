import { ArrowLeft, Bookmark, Heart, MessageCircle, Send, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { useAppState } from '../../app/AppState'
import { WorkAssetPreview } from './WorkAssetPreview'
import { useOptionalWorks } from './WorksProvider'
import './works.css'

export function WorkDetailPage({ workId, onBack }: { workId: string; onBack: () => void }) {
  const { state } = useAppState()
  const worksState = useOptionalWorks()
  const work = worksState?.works.find((item) => item.id === workId)
  const [commentText, setCommentText] = useState('')
  const [commentError, setCommentError] = useState('')

  if (!work) {
    return (
      <div className="work-detail-page">
        <header className="work-detail-header">
          <button className="back-button" type="button" onClick={onBack} aria-label="返回"><ArrowLeft size={20} /></button>
          <h1>作品详情</h1>
        </header>
        <div className="work-detail-content">
          <p>{worksState?.loading ? '正在读取作品…' : '作品不存在或已被删除'}</p>
          <button className="detail-btn subtle" type="button" onClick={onBack}>返回列表</button>
        </div>
      </div>
    )
  }

  const liked = work.likedBy.includes(state.accountId)
  const saved = work.favoritedBy.includes(state.accountId)
  const sourceName = work.source === 'brain-film'
    ? '脑洞放映厅'
    : work.source === 'creative-module' ? '创造模块' : 'AI 创作'
  const submitComment = async () => {
    setCommentError('')
    try {
      await worksState?.addComment(work.id, state.nickname, commentText)
      setCommentText('')
    } catch (error) {
      setCommentError(error instanceof Error ? error.message : '这条留言暂时不能发布')
    }
  }

  return (
    <div className="work-detail-page">
      <header className="work-detail-header">
        <button className="work-detail-back" type="button" onClick={onBack} aria-label="返回"><ArrowLeft size={20} /></button>
        <div><small>同学作品</small><h1>{sourceName}</h1></div>
      </header>

      <div className="work-detail-content">
        <section className="work-detail-intro">
          <span className="work-source-pill"><Sparkles size={13} aria-hidden="true" />{sourceName}</span>
          <h2 className="work-title">{work.title}</h2>
          <p className="work-author"><span>{(work.creatorName || state.nickname).charAt(0)}</span>作者：{work.creatorName || state.nickname}</p>
        </section>
        <div className="work-preview"><WorkAssetPreview work={work} getAsset={worksState!.getAsset} /></div>

        <section className="work-info-section"><h3>作品简介</h3><p>{work.description || '作者还没有填写作品介绍。'}</p><small>使用工具：{work.aiTools.join(' · ') || '自主创作'}</small></section>

        <section className="work-interaction-section">
          <div className="work-section-heading"><div><small>为喜欢的创意加油</small><h3>作品互动</h3></div><MessageCircle aria-hidden="true" size={20} /></div>
          <div className="work-stats">
            <button className="stat-button" type="button" aria-label="点赞作品" aria-pressed={liked} onClick={() => worksState?.toggleLike(work.id)}>
              <Heart size={19} fill={liked ? 'currentColor' : 'none'} /><span><strong>{work.likes}</strong><small>{liked ? '已点赞' : '点赞'}</small></span>
            </button>
            <button className="stat-button" type="button" aria-label="收藏作品" aria-pressed={saved} onClick={() => worksState?.toggleFavorite(work.id)}>
              <Bookmark size={19} fill={saved ? 'currentColor' : 'none'} /><span><strong>{work.favorites}</strong><small>{saved ? '已收藏' : '收藏'}</small></span>
            </button>
            <div className="stat-button stat-display"><MessageCircle size={19} /><span><strong>{work.comments.length}</strong><small>留言</small></span></div>
          </div>
        </section>

        <div className="comment-section">
          <div className="comment-section-heading"><div><small>友好交流，一起发现好点子</small><h3 className="comment-section-title">同学们的留言</h3></div><span>{work.comments.length}</span></div>
          <div className="comment-list-inline">
            {work.comments.map((comment) => (
              <div key={comment.id} className="comment-item-inline">
                <div className="comment-avatar-inline">{comment.authorName.charAt(0)}</div>
                <div className="comment-content-inline">
                  <div className="comment-author-inline">{comment.authorName}</div>
                  <div className="comment-text-inline">{comment.text}</div>
                </div>
              </div>
            ))}
            {!work.comments.length && <p className="comment-empty">还没有留言，来送上一句鼓励吧。</p>}
          </div>

          <div className="comment-input-inline">
            <input aria-label="写留言" type="text" placeholder="写一句友好的留言…" value={commentText} onChange={(event) => setCommentText(event.target.value)} maxLength={80} />
            <button className="comment-submit-inline" type="button" aria-label="提交留言" onClick={submitComment} disabled={!commentText.trim()}><Send size={17} /><span>发送</span></button>
          </div>
          {commentError && <p className="work-preview-error" role="alert">{commentError}</p>}
        </div>
      </div>
    </div>
  )
}
