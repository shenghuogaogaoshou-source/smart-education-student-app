import { ChevronRight, Settings, UserRound } from 'lucide-react'
import { useAppState } from '../../app/AppState'
import { GrowthSection } from './GrowthSection'
import { LearningOverview } from './LearningOverview'
import { LearningTools } from './LearningTools'
import { RewardsSection } from './RewardsSection'
import { WorksWorkbench } from './WorksWorkbench'
import './profile.css'

export function ProfilePage({
  onOpenSettings,
  onOpenProfileDetail,
  onWorkClick,
  onOpenTools,
  onOpenMedals,
  onOpenPoints,
  onOpenMall,
  onOpenRanking,
  onStartLearning,
  onOpenSchedule,
  onOpenCalendar,
  onOpenWrongBook,
  onOpenFavorites,
  onOpenHistory,
  onOpenAiCenter,
  onOpenWorksManage,
  onContinueCreate,
  onOpenWorksManageWithFilter,
}: {
  onOpenSettings: () => void
  onOpenProfileDetail: () => void
  onWorkClick?: (workId: string) => void
  onOpenTools?: () => void
  onOpenMedals?: () => void
  onOpenPoints?: () => void
  onOpenMall?: () => void
  onOpenRanking?: () => void
  onStartLearning?: () => void
  onOpenSchedule?: () => void
  onOpenCalendar?: () => void
  onOpenWrongBook?: () => void
  onOpenFavorites?: () => void
  onOpenHistory?: () => void
  onOpenAiCenter?: () => void
  onOpenWorksManage?: () => void
  onContinueCreate?: () => void
  onOpenWorksManageWithFilter?: (filter: string) => void
}) {
  const { state } = useAppState()

  return (
    <div className="profile-page">
      <header className="identity-card" onClick={onOpenProfileDetail} style={{ cursor: 'pointer' }}>
        <div className={`avatar avatar-${state.avatar % 5}`}><UserRound aria-hidden="true" size={29} /></div>
        <div className="identity-copy"><p>{state.stage === 'elementary' ? '小学端 · 五年级' : '中学端 · 初二'}</p><h1>{state.nickname}</h1><span>Lv. 7 · 灵感探索者</span></div>
        <button type="button" aria-label="查看个人资料" onClick={(e) => { e.stopPropagation(); onOpenProfileDetail() }}><ChevronRight aria-hidden="true" /></button>
      </header>
      <LearningOverview />
      <GrowthSection
        onStartLearning={onStartLearning ?? (() => { })}
        onAdjustSchedule={onOpenSchedule ?? (() => { })}
        onOpenCalendar={onOpenCalendar ?? (() => { })}
      />
      <RewardsSection onOpenMedals={onOpenMedals} onOpenPoints={onOpenPoints} onOpenMall={onOpenMall} onOpenRanking={onOpenRanking} />
      <LearningTools
        onOpenTools={onOpenTools}
        onOpenWrongBook={onOpenWrongBook}
        onOpenFavorites={onOpenFavorites}
        onOpenHistory={onOpenHistory}
        onOpenAiCenter={onOpenAiCenter}
      />
      <WorksWorkbench
        onWorkClick={onWorkClick}
        onOpenManage={onOpenWorksManage}
        onContinueCreate={onContinueCreate}
        onOpenManageWithFilter={onOpenWorksManageWithFilter}
      />
      <button className="settings-entry" type="button" aria-label="进入设置" onClick={onOpenSettings}><Settings aria-hidden="true" /><span><strong>设置</strong><small>账号、安全、隐私与使用体验</small></span><ChevronRight aria-hidden="true" /></button>
    </div>
  )
}
