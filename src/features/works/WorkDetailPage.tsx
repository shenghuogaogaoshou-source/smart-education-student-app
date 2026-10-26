import { ArrowLeft, Bookmark, Heart, Send } from 'lucide-react'
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
        <button className="back-button" type="button" onClick={onBack} aria-label="返回"><ArrowLeft size={20} /></button>
        <h1>{work.source === 'brain-film' ? '脑洞放映厅' : work.source === 'creative-module' ? '创造模块' : 'AI 创作'}</h1>
      </header>

      <div className="work-detail-content">
        <h2 className="work-title">{work.title}</h2>
        <p className="work-author">作者：{work.creatorName || state.nickname}</p>
        <div className="work-preview"><WorkAssetPreview work={work} getAsset={worksState!.getAsset} /></div>

        <div className="work-info-section"><h3>作品简介</h3><p>{work.description || '作者还没有填写作品介绍。'}</p></div>
        <div className="work-tools-line">使用过：{work.aiTools.join(' · ')}</div>
        <div className="work-stats">
          <button className="stat-button" type="button" aria-label="点赞作品" aria-pressed={liked} onClick={() => worksState?.toggleLike(work.id)}>
            <Heart size={18} fill={liked ? 'currentColor' : 'none'} /><span>{work.likes}</span>
          </button>
          <button className="stat-button" type="button" aria-label="收藏作品" aria-pressed={saved} onClick={() => worksState?.toggleFavorite(work.id)}>
            <Bookmark size={18} fill={saved ? 'currentColor' : 'none'} /><span>{work.favorites}</span>
          </button>
          <span className="stat-button"><span>{work.comments.length} 条留言</span></span>
        </div>

        <div className="comment-section">
          <h3 className="comment-section-title">留言 ({work.comments.length})</h3>
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
            {!work.comments.length && <p className="work-preview-loading">还没有留言，来送上一句鼓励吧。</p>}
          </div>

          <div className="comment-input-inline">
            <input aria-label="写留言" type="text" placeholder="写一句友好的留言…" value={commentText} onChange={(event) => setCommentText(event.target.value)} maxLength={80} />
            <button className="comment-submit-inline" type="button" aria-label="提交留言" onClick={submitComment} disabled={!commentText.trim()}><Send size={18} /></button>
          </div>
          {commentError && <p className="work-preview-error" role="alert">{commentError}</p>}
        </div>
      </div>
    </div>
  )
}
