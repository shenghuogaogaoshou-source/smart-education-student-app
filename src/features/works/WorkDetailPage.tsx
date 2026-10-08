import { ArrowLeft, Bookmark, Eye, Heart, MessageCircle, Send } from 'lucide-react'
import { useState } from 'react'
import { useAppState } from '../../app/AppState'
import './works.css'

type WorkDetail = {
    id: string
    title: string
    author: string
    tag: string
    description: string
    likes: number
    comments: number
    status?: string
    completedAt?: string
}

type Comment = {
    id: number
    author: string
    content: string
    time: string
}

const workDetails: Record<string, WorkDetail> = {
    'work-camera': {
        id: 'work-camera',
        title: '会分类的照相机',
        author: '星河同学',
        tag: '创意实验',
        description: '这是一个充满创意的 AI 作品，展示了作者对人工智能技术的理解和应用。通过这个项目，作者探索了 AI 在实际场景中的可能性，让照相机能够智能识别和分类不同的物体。',
        likes: 105,
        comments: 30,
    },
    'work-library': {
        id: 'work-library',
        title: '未来图书馆',
        author: '小羽同学',
        tag: '空间设计',
        description: '这是一个充满创意的 AI 作品，展示了作者对人工智能技术的理解和应用。通过这个项目，作者探索了 AI 在实际场景中的可能性，设计了未来的智能图书馆空间。',
        likes: 89,
        comments: 25,
    },
    'work-campus': {
        id: 'work-campus',
        title: '未来校园小设计',
        author: '林川同学',
        tag: '本周人气',
        description: '这是一个充满创意的 AI 作品，展示了作者对人工智能技术的理解和应用。通过这个项目，作者探索了 AI 在实际场景中的可能性，设计了未来的智能校园。',
        likes: 156,
        comments: 42,
        status: '已发布',
        completedAt: '周六',
    },
    'work-voice': {
        id: 'work-voice',
        title: '声音地图',
        author: '清禾同学',
        tag: '科学表达',
        description: '这是一个充满创意的 AI 作品，展示了作者对人工智能技术的理解和应用。通过这个项目，作者探索了 AI 在实际场景中的可能性，创建了声音与空间的映射关系。',
        likes: 78,
        comments: 19,
    },
    'work-ocean': {
        id: 'work-ocean',
        title: 'AI 海洋观察站',
        author: '远帆同学',
        tag: '年度灵感',
        description: '这是一个充满创意的 AI 作品，展示了作者对人工智能技术的理解和应用。通过这个项目，作者探索了 AI 在实际场景中的可能性，建立了海洋生物的智能观察系统。',
        likes: 234,
        comments: 67,
    },
    'work-city': {
        id: 'work-city',
        title: '会思考的绿色城市',
        author: '若安同学',
        tag: '实践创造',
        description: '这是一个充满创意的 AI 作品，展示了作者对人工智能技术的理解和应用。通过这个项目，作者探索了 AI 在实际场景中的可能性，设计了可持续发展的智能城市模型。',
        likes: 198,
        comments: 53,
    },
}

const sampleComments: Comment[] = [
    { id: 1, author: '小明同学', content: '这个作品太棒了！AI 识别功能很实用', time: '2小时前' },
    { id: 2, author: '小红同学', content: '创意很好，继续加油！', time: '5小时前' },
    { id: 3, author: '小刚同学', content: '学习了，我也想做类似的作品', time: '1天前' },
]

export function WorkDetailPage({ workId, onBack }: { workId: string; onBack: () => void }) {
    const { state, toggleLike, toggleFavorite } = useAppState()
    const work = workDetails[workId]
    const [commentText, setCommentText] = useState('')
    const [comments, setComments] = useState<Comment[]>(sampleComments)

    if (!work) {
        return (
            <div className="work-detail-page">
                <header className="work-detail-header">
                    <button className="back-button" type="button" onClick={onBack}>
                        <ArrowLeft size={20} />
                    </button>
                    <h1>作品详情</h1>
                </header>
                <div className="work-detail-content">
                    <p>作品不存在或已被删除</p>
                    <button className="detail-btn secondary" type="button" onClick={onBack}>
                        返回列表
                    </button>
                </div>
            </div>
        )
    }

    const liked = state.likes.includes(work.id)
    const saved = state.favorites.includes(work.id)

    const handleLike = () => {
        toggleLike(work.id)
    }

    const handleComment = () => {
        if (!commentText.trim()) return

        const newComment: Comment = {
            id: comments.length + 1,
            author: '晨曦同学',
            content: commentText,
            time: '刚刚',
        }

        setComments([newComment, ...comments])
        setCommentText('')
    }

    return (
        <div className="work-detail-page">
            <header className="work-detail-header">
                <button className="back-button" type="button" onClick={onBack}>
                    <ArrowLeft size={20} />
                </button>
                <h1>{work.tag}</h1>
            </header>

            <div className="work-detail-content">
                <h2 className="work-title">{work.title}</h2>
                <p className="work-author">作者：{work.author}</p>

                <div className="work-preview">
                    <div className="preview-placeholder">
                        <Eye size={40} />
                        <span>作品展示区域</span>
                    </div>
                </div>

                <div className="work-info-section">
                    <h3>作品简介</h3>
                    <p>{work.description}</p>
                </div>

                <div className="work-stats">
                    <button className="stat-button" type="button" onClick={handleLike}>
                        <Heart size={18} fill={liked ? 'currentColor' : 'none'} />
                        <span>{liked ? work.likes + 1 : work.likes}</span>
                    </button>
                    <button className="stat-button" type="button">
                        <MessageCircle size={18} />
                        <span>{work.comments + comments.length}</span>
                    </button>
                    <button className="stat-button" type="button" onClick={() => toggleFavorite(work.id)}>
                        <Bookmark size={18} fill={saved ? 'currentColor' : 'none'} />
                        <span>收藏</span>
                    </button>
                </div>

                {work.status && (
                    <div className="work-meta">
                        <div className="meta-row">
                            <span>状态</span>
                            <strong>{work.status}</strong>
                        </div>
                        {work.completedAt && (
                            <div className="meta-row">
                                <span>完成时间</span>
                                <strong>{work.completedAt}</strong>
                            </div>
                        )}
                    </div>
                )}

                <div className="comment-section">
                    <h3 className="comment-section-title">评论 ({comments.length})</h3>

                    <div className="comment-list-inline">
                        {comments.map((comment) => (
                            <div key={comment.id} className="comment-item-inline">
                                <div className="comment-avatar-inline">
                                    {comment.author.charAt(0)}
                                </div>
                                <div className="comment-content-inline">
                                    <div className="comment-author-inline">{comment.author}</div>
                                    <div className="comment-text-inline">{comment.content}</div>
                                    <div className="comment-time-inline">{comment.time}</div>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="comment-input-inline">
                        <input
                            type="text"
                            placeholder="写下你的评论..."
                            value={commentText}
                            onChange={(e) => setCommentText(e.target.value)}
                            maxLength={100}
                        />
                        <button
                            className="comment-submit-inline"
                            type="button"
                            onClick={handleComment}
                            disabled={!commentText.trim()}
                        >
                            <Send size={18} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
