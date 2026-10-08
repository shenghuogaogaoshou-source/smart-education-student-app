import { ArrowRight, FolderKanban } from 'lucide-react'

const statuses = [
  { label: '草稿', value: 2 },
  { label: '审核中', value: 1 },
  { label: '已发布', value: 8 },
  { label: '仅自己', value: 3 },
]

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
            <button
              key={item.label}
              type="button"
              onClick={() => onOpenManageWithFilter?.(item.label)}
            >
              <strong>{item.value}</strong>
              <span>{item.label}</span>
            </button>
          ))}
        </div>
        <div className="draft-work" onClick={() => onWorkClick?.('work-camera')} style={{ cursor: onWorkClick ? 'pointer' : 'default' }}>
          <div className="draft-head">
            <span>正在创作</span>
            <small>今天 16:20 编辑</small>
          </div>
          <h3>会分类的照相机</h3>
          <p>AI 创意实验室</p>
          <div className="draft-progress"><span><i /></span><b>3 / 5</b></div>
          <div className="draft-action">
            <small>灵感还在，继续完成它吧</small>
            <button type="button" onClick={(e) => { e.stopPropagation(); onContinueCreate?.() }}>
              继续创作<ArrowRight aria-hidden="true" size={16} />
            </button>
          </div>
        </div>
        <div className="completed-work" onClick={() => onWorkClick?.('work-campus')} style={{ cursor: onWorkClick ? 'pointer' : 'default' }}>
          <FolderKanban aria-hidden="true" />
          <div>
            <span>最近完成</span>
            <h3>未来校园小设计</h3>
            <p>已发布 · 周六完成</p>
          </div>
          <button type="button">查看成果</button>
        </div>
      </div>
    </section>
  )
}
