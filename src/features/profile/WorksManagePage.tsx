import { ArrowLeft, Check, Edit3, Eye, FileText, FolderKanban, Loader, Send, Trash2 } from 'lucide-react'
import { useState } from 'react'
import './profile.css'

type WorkStatus = '全部' | '草稿' | '审核中' | '已发布' | '仅自己'

const statusTabs: WorkStatus[] = ['全部', '草稿', '审核中', '已发布', '仅自己']

const statusMeta: Record<string, { color: string; dot: string; Icon: typeof FileText }> = {
  '草稿': { color: '#F5C7A5', dot: '#F5A060', Icon: FileText },
  '审核中': { color: '#FFD97D', dot: '#E8B347', Icon: Loader },
  '已发布': { color: '#8BC4A8', dot: '#5DA886', Icon: Check },
  '仅自己': { color: '#A8C8E4', dot: '#6FA6CF', Icon: Eye },
}

const myWorks = [
  { id: 'w-camera', title: '会分类的照相机', subtitle: 'AI 创意实验室', status: '草稿', date: '今天 16:20', progress: 3, total: 5 },
  { id: 'w-campus', title: '未来校园小设计', subtitle: 'AI 创意实验室', status: '已发布', date: '周六完成', likes: 18, collects: 7 },
  { id: 'w-forest', title: '森林里的发光蘑菇', subtitle: 'AI 自然探索', status: '已发布', date: '上周三', likes: 32, collects: 11 },
  { id: 'w-galaxy', title: '银河中的漫游者', subtitle: 'AI 科幻', status: '审核中', date: '昨天' },
  { id: 'w-dream', title: '梦境里的糖果屋', subtitle: 'AI 创意绘画', status: '审核中', date: '2 天前' },
  { id: 'w-secret', title: '只给自己看的小诗', subtitle: 'AI 灵感随笔', status: '仅自己', date: '4 天前' },
  { id: 'w-draft2', title: '未完成的机械城市', subtitle: 'AI 创意实验室', status: '草稿', date: '5 天前', progress: 1, total: 4 },
  { id: 'w-draft3', title: '海洋深处的秘密', subtitle: 'AI 自然探索', status: '草稿', date: '1 周前', progress: 2, total: 5 },
]

export function WorksManagePage({ onBack, onContinueCreate, initialFilter }: { onBack: () => void; onContinueCreate?: () => void; initialFilter?: string }) {
  const [filter, setFilter] = useState<WorkStatus>((initialFilter as WorkStatus) || '全部')

  const filtered = filter === '全部' ? myWorks : myWorks.filter((w) => w.status === filter)

  const counts = {
    草稿: myWorks.filter((w) => w.status === '草稿').length,
    审核中: myWorks.filter((w) => w.status === '审核中').length,
    已发布: myWorks.filter((w) => w.status === '已发布').length,
    仅自己: myWorks.filter((w) => w.status === '仅自己').length,
  }

  return (
    <div className="rewards-page works-manage-page">
      <header className="profile-page-header">
        <button className="profile-back" type="button" onClick={onBack} aria-label="返回">
          <ArrowLeft size={20} />
        </button>
        <h1>作品管理</h1>
      </header>

      <div className="rewards-summary">
        <div
          className={`rewards-stat clickable ${filter === '全部' ? 'active' : ''}`}
          role="button"
          tabIndex={0}
          onClick={() => setFilter('全部')}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setFilter('全部') }}
        >
          <FolderKanban size={24} />
          <div>
            <strong>{myWorks.length}</strong>
            <span>全部作品</span>
          </div>
        </div>
        <div
          className={`rewards-stat clickable ${filter === '已发布' ? 'active' : ''}`}
          role="button"
          tabIndex={0}
          onClick={() => setFilter('已发布')}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setFilter('已发布') }}
        >
          <Check size={24} />
          <div>
            <strong>{counts['已发布']}</strong>
            <span>已发布</span>
          </div>
        </div>
        <div
          className={`rewards-stat clickable ${filter === '草稿' ? 'active' : ''}`}
          role="button"
          tabIndex={0}
          onClick={() => setFilter('草稿')}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setFilter('草稿') }}
        >
          <FileText size={24} />
          <div>
            <strong>{counts['草稿']}</strong>
            <span>草稿中</span>
          </div>
        </div>
      </div>

      <div className="wb-filter-row">
        {statusTabs.map((s) => (
          <button
            key={s}
            type="button"
            className={`wb-filter-chip ${filter === s ? 'active' : ''}`}
            onClick={() => setFilter(s)}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="wm-list">
        {filtered.map((w) => {
          const meta = statusMeta[w.status]
          const StatusIcon = meta.Icon
          const isDraft = w.status === '草稿'
          return (
            <div key={w.id} className={`wm-card wm-${w.status}`}>
              <div className="wm-thumb" style={{ background: meta.color }}>
                <StatusIcon size={22} color="#fff" />
              </div>
              <div className="wm-body">
                <div className="wm-title-row">
                  <strong>{w.title}</strong>
                  <span className={`wm-status-badge wm-status-${w.status}`}><i style={{ background: meta.dot }} />{w.status}</span>
                </div>
                <small>{w.subtitle} · {w.date}</small>

                {isDraft && typeof w.progress === 'number' && (
                  <div className="wm-progress">
                    <div className="wm-progress-bar"><span style={{ width: `${(w.progress / w.total) * 100}%` }} /></div>
                    <span>{w.progress} / {w.total} 步</span>
                  </div>
                )}

                {w.status === '已发布' && (
                  <div className="wm-stats-row">
                    <span>❤️ {w.likes}</span>
                    <span>⭐ {w.collects}</span>
                  </div>
                )}
              </div>
              <div className="wm-actions">
                {isDraft && (
                  <button type="button" className="wm-action-primary" onClick={onContinueCreate}>
                    <Edit3 size={14} /> 继续
                  </button>
                )}
                {w.status === '审核中' && (
                  <button type="button" className="wm-action-ghost">
                    <Send size={14} /> 撤回
                  </button>
                )}
                {w.status === '仅自己' && (
                  <button type="button" className="wm-action-ghost">
                    <Send size={14} /> 发布
                  </button>
                )}
                <button type="button" className="wm-action-danger">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {filtered.length === 0 && (
        <div className="wm-empty">
          <FileText size={32} />
          <strong>暂无 {filter} 作品</strong>
          <small>试试换个分类看看～</small>
        </div>
      )}
    </div>
  )
}
