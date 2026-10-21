import { ArrowRight, FolderKanban, Sparkles } from 'lucide-react'
import { useOptionalWorks } from '../works/WorksProvider'

export function WorksWorkbench({
  onWorkClick,
  onOpenManage,
  onContinueCreate,
  onOpenManageWithFilter,
}: {
  onWorkClick?: (workId: string) => void
  onOpenManage?: () => void
  onContinueCreate?: () => void
  onOpenManageWithFilter?: (filter: string) => void
}) {
  const works = useOptionalWorks()?.works ?? []
  const draft = works.find((work) => work.status === 'draft')
  const recent = works.find((work) => work.status === 'published') ?? works[0]
  const statuses = [
    { label: '草稿', value: works.filter((work) => work.status === 'draft').length },
    { label: '审核中', value: works.filter((work) => work.status === 'reviewing').length },
    { label: '已发布', value: works.filter((work) => work.status === 'published').length },
    { label: '仅自己', value: works.filter((work) => work.status === 'private').length },
  ]

  return (
    <section className="profile-section works-section" aria-labelledby="works-title">
      <div className="section-heading-row">
        <div>
          <p className="section-kicker">记录每一次灵感和完成</p>
          <h2 id="works-title">我的作品</h2>
        </div>
        <button className="text-action" type="button" onClick={onOpenManage}>作品管理</button>
      </div>
      <div className="works-workbench">
        <div className="work-statuses">
          {statuses.map((item) => (
            <button key={item.label} type="button" onClick={() => onOpenManageWithFilter?.(item.label)}>
              <strong>{item.value}</strong>
              <span>{item.label}</span>
            </button>
          ))}
        </div>

        {!works.length && (
          <button className="works-profile-empty" type="button" onClick={onContinueCreate}>
            <Sparkles aria-hidden="true" />
            <span><strong>第一件作品正在等你</strong><small>去脑洞放映厅或创造模块试试看</small></span>
            <ArrowRight aria-hidden="true" />
          </button>
        )}

        {draft && (
          <div className="draft-work" onClick={() => onWorkClick?.(draft.id)} style={{ cursor: onWorkClick ? 'pointer' : 'default' }}>
            <div className="draft-head"><span>正在创作</span><small>{draft.source === 'brain-film' ? '脑洞放映厅' : draft.source === 'creative-module' ? '创造模块' : '外部 AI 作品'}</small></div>
            <h3>{draft.title}</h3>
            <p>{draft.description || '这份草稿还在等你继续完成'}</p>
            <div className="draft-action">
              <small>灵感还在，继续完成它吧</small>
              <button type="button" onClick={(event) => { event.stopPropagation(); onContinueCreate?.() }}>
                继续创作<ArrowRight aria-hidden="true" size={16} />
              </button>
            </div>
          </div>
        )}

        {recent && (
          <div className="completed-work" onClick={() => onWorkClick?.(recent.id)} style={{ cursor: onWorkClick ? 'pointer' : 'default' }}>
            <FolderKanban aria-hidden="true" />
            <div><span>{recent.status === 'published' ? '最近发布' : '最近更新'}</span><h3>{recent.title}</h3><p>{recent.status === 'published' ? `❤️ ${recent.likes} · ⭐ ${recent.favorites}` : '继续打磨你的创意'}</p></div>
            <button type="button" onClick={(event) => { event.stopPropagation(); onWorkClick?.(recent.id) }}>查看作品</button>
          </div>
        )}
      </div>
    </section>
  )
}
