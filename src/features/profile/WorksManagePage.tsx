import { ArrowLeft, Check, Clock3, Eye, FileText, FolderKanban, Loader, Plus, Send, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { UploadWorkDialog } from '../works/UploadWorkDialog'
import { WorkMediaThumbnail } from '../works/WorkMediaThumbnail'
import { useOptionalWorks } from '../works/WorksProvider'
import type { WorkRecord, WorkStatus } from '../works/types'
import './profile.css'

type WorkFilter = '全部' | '草稿' | '审核中' | '已发布' | '仅自己'

const filters: WorkFilter[] = ['全部', '草稿', '审核中', '已发布', '仅自己']
const statusLabels: Record<WorkStatus, WorkFilter> = {
  draft: '草稿',
  reviewing: '审核中',
  published: '已发布',
  private: '仅自己',
}
const statusMeta: Record<WorkStatus, { color: string; dot: string; Icon: typeof FileText }> = {
  draft: { color: '#F5C7A5', dot: '#F5A060', Icon: FileText },
  reviewing: { color: '#FFD97D', dot: '#E8B347', Icon: Loader },
  published: { color: '#8BC4A8', dot: '#5DA886', Icon: Check },
  private: { color: '#A8C8E4', dot: '#6FA6CF', Icon: Eye },
}
const sourceLabels: Record<WorkRecord['source'], string> = {
  'brain-film': '脑洞放映厅',
  'creative-module': '创造模块',
  'external-upload': 'AI 创作',
}

function displayDate(value: string) {
  return new Intl.DateTimeFormat('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value))
}

export function WorksManagePage({
  onBack,
  onContinueCreate,
  initialFilter,
  onWorkClick,
}: {
  onBack: () => void
  onContinueCreate?: (work?: WorkRecord) => void
  initialFilter?: string
  onWorkClick?: (workId: string) => void
}) {
  const worksState = useOptionalWorks()
  const works = (worksState?.works ?? []).filter((work) => (
    (work.creatorId || work.ownerId) === worksState?.accountId
  ))
  const [filter, setFilter] = useState<WorkFilter>(() => filters.includes(initialFilter as WorkFilter) ? initialFilter as WorkFilter : '全部')
  const [uploadOpen, setUploadOpen] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState('')
  const [actionError, setActionError] = useState('')

  const counts = useMemo(() => ({
    draft: works.filter((work) => work.status === 'draft').length,
    reviewing: works.filter((work) => work.status === 'reviewing').length,
    published: works.filter((work) => work.status === 'published').length,
    private: works.filter((work) => work.status === 'private').length,
  }), [works])

  const filtered = filter === '全部'
    ? works
    : works.filter((work) => statusLabels[work.status] === filter)

  const runAction = async (action: () => Promise<unknown>) => {
    setActionError('')
    try {
      await action()
    } catch {
      setActionError('操作没有完成，请稍后再试。')
    }
  }

  return (
    <div className="rewards-page works-manage-page">
      <header className="profile-page-header">
        <button className="profile-back" type="button" onClick={onBack} aria-label="返回"><ArrowLeft size={20} /></button>
        <h1>作品管理</h1>
        <button className="wm-header-upload" type="button" onClick={() => setUploadOpen(true)}><Plus size={15} />上传作品</button>
      </header>

      <div className="rewards-summary">
        <button className={`rewards-stat clickable ${filter === '全部' ? 'active' : ''}`} type="button" onClick={() => setFilter('全部')}>
          <FolderKanban size={24} /><div><strong>{works.length}</strong><span>全部作品</span></div>
        </button>
        <button className={`rewards-stat clickable ${filter === '已发布' ? 'active' : ''}`} type="button" onClick={() => setFilter('已发布')}>
          <Check size={24} /><div><strong>{counts.published}</strong><span>已发布</span></div>
        </button>
        <button className={`rewards-stat clickable ${filter === '草稿' ? 'active' : ''}`} type="button" onClick={() => setFilter('草稿')}>
          <FileText size={24} /><div><strong>{counts.draft}</strong><span>草稿中</span></div>
        </button>
      </div>

      <div className="wb-filter-row" aria-label="作品状态筛选">
        {filters.map((status) => (
          <button key={status} type="button" className={`wb-filter-chip ${filter === status ? 'active' : ''}`} aria-pressed={filter === status} onClick={() => setFilter(status)}>
            {status}{status !== '全部' && ` ${counts[status === '草稿' ? 'draft' : status === '审核中' ? 'reviewing' : status === '已发布' ? 'published' : 'private']}`}
          </button>
        ))}
      </div>

      {actionError && <p className="inline-notice" role="alert">{actionError}</p>}
      {worksState?.loading && <p className="work-preview-loading">正在加载作品…</p>}

      <div className="wm-list">
        {filtered.map((work) => {
          const meta = statusMeta[work.status]
          const StatusIcon = meta.Icon
          return (
            <article key={work.id} className={`wm-card wm-status-card-${work.status}`}>
              <button className="wm-thumb" type="button" style={{ background: meta.color }} onClick={() => onWorkClick?.(work.id)} aria-label={`查看${work.title}`}>
                <WorkMediaThumbnail work={work} className="wm-card-media" />
                <span className="wm-thumb-status" style={{ background: meta.dot }}><StatusIcon size={11} color="#fff" /></span>
              </button>
              <div className="wm-body">
                <div className="wm-title-row">
                  <strong>{work.title}</strong>
                  <span className={`wm-status-badge wm-status-${statusLabels[work.status]}`}><i style={{ background: meta.dot }} />{statusLabels[work.status]}</span>
                </div>
                <small>{sourceLabels[work.source]} · {displayDate(work.updatedAt)}</small>
                <div className="wm-meta-line"><Clock3 size={12} />{work.previewKind === 'generic' ? '文件作品' : `${work.previewKind.toUpperCase()} · ${Math.max(1, Math.round(work.byteSize / 1024))} KB`}</div>
                {work.reviewMessage && <p className="wm-review-message">{work.reviewMessage}</p>}
                {work.status === 'published' && <div className="wm-stats-row"><span>❤️ {work.likes}</span><span>⭐ {work.favorites}</span><span>💬 {work.comments.length}</span></div>}
              </div>
              <div className="wm-actions">
                {work.status === 'draft' && <button type="button" className="wm-action-primary" onClick={() => onContinueCreate?.(work)}><Eye size={14} />继续</button>}
                {work.status === 'draft' && <button type="button" className="wm-action-ghost" onClick={() => runAction(() => worksState!.submitForReview(work.id))}><Send size={14} />发布</button>}
                {work.status === 'reviewing' && <button type="button" className="wm-action-ghost" onClick={() => runAction(() => worksState!.withdraw(work.id))}><Send size={14} />撤回</button>}
                {work.status === 'published' && <button type="button" className="wm-action-ghost" onClick={() => onWorkClick?.(work.id)}><Eye size={14} />查看</button>}
                {work.status === 'published' && <button type="button" className="wm-action-ghost" onClick={() => runAction(() => worksState!.makePrivate(work.id))}><Eye size={14} />仅自己</button>}
                {work.status === 'private' && <button type="button" className="wm-action-primary" onClick={() => runAction(() => worksState!.submitForReview(work.id))}><Send size={14} />发布</button>}
                {confirmDeleteId === work.id ? (
                  <>
                    <button type="button" className="wm-action-danger" onClick={() => runAction(async () => { await worksState!.remove(work.id); setConfirmDeleteId('') })}>确认删除</button>
                    <button type="button" className="wm-action-ghost" onClick={() => setConfirmDeleteId('')}>取消</button>
                  </>
                ) : (
                  <button type="button" className="wm-action-danger" aria-label="删除作品" onClick={() => setConfirmDeleteId(work.id)}><Trash2 size={14} /></button>
                )}
              </div>
            </article>
          )
        })}
      </div>

      {!worksState?.loading && filtered.length === 0 && (
        <div className="wm-empty">
          <FileText size={32} />
          <strong>{filter === '全部' ? '还没有作品，去创造第一件吧' : `暂无${filter}作品`}</strong>
          <small>游戏作品或上传的 AI 创作都会保存在这里。</small>
          <div><button type="button" className="wm-action-primary" onClick={() => onContinueCreate?.()}>去创作</button><button type="button" className="wm-action-ghost" onClick={() => setUploadOpen(true)}>上传 AI 作品</button></div>
        </div>
      )}

      <UploadWorkDialog open={uploadOpen} onClose={() => setUploadOpen(false)} />
    </div>
  )
}
