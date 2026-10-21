import { useEffect, useRef, useState } from 'react'
import { useAppState } from '../../app/AppState'
import { getGradeBand } from '../../app/learning'
import { AiCompanion } from '../ai_companion/AiCompanion'
import { AppCommandProvider, useAppCommand, useOptionalAppCommand } from '../ai_companion/commands/AppCommandContext'
import type { CompanionCommand } from '../ai_companion/commands/commandTypes'
import { EmbeddedGamePage } from '../games/EmbeddedGamePage'
import type { GameId } from '../games/gameRegistry'
import { HomePage } from '../home/HomePage'
import { NotificationsPage } from '../home/NotificationsPage'
import { AiCenterPage } from '../profile/AiCenterPage'
import { CalendarPage } from '../profile/CalendarPage'
import { ContinueCreatePage } from '../profile/ContinueCreatePage'
import { FavoritesPage } from '../profile/FavoritesPage'
import { HistoryPage } from '../profile/HistoryPage'
import { LearningSchedulePage } from '../profile/LearningSchedulePage'
import { LearningToolsDetailPage } from '../profile/LearningToolsDetailPage'
import { MallPage } from '../profile/MallPage'
import { MedalsPage } from '../profile/MedalsPage'
import { PointsPage } from '../profile/PointsPage'
import { ProfileDetailPage } from '../profile/ProfileDetailPage'
import { ProfileEditPage } from '../profile/ProfileEditPage'
import { ProfilePage } from '../profile/ProfilePage'
import { RankingPage } from '../profile/RankingPage'
import { WrongBookPage } from '../profile/WrongBookPage'
import { WorksManagePage } from '../profile/WorksManagePage'
import { SettingsPage } from '../settings/SettingsPage'
import { WorksGalleryPage } from '../works/WorksGalleryPage'
import { WorkDetailPage } from '../works/WorkDetailPage'
import { CourseContentPage } from '../knowledge/CourseContentPage'
import { KnowledgePage } from '../knowledge/KnowledgePage'
import { getCourseForBand } from '../knowledge/courseCatalog'
import { TestPage } from '../test/TestPage'
import { BottomNavigation, type MainTab } from './BottomNavigation'
import './shell.css'

// 导航栈中的视图。每个实例携带唯一 id，用于按实例记忆/恢复滚动位置。
type View =
  | { kind: 'tab'; id: number }
  | { kind: 'settings'; id: number; initialDetail?: string }
  | { kind: 'work'; id: number; workId: string }
  | { kind: 'tools'; id: number }
  | { kind: 'medals'; id: number }
  | { kind: 'points'; id: number }
  | { kind: 'mall'; id: number }
  | { kind: 'ranking'; id: number }
  | { kind: 'works-gallery'; id: number }
  | { kind: 'notifications'; id: number }
  | { kind: 'profile-detail'; id: number }
  | { kind: 'profile-edit'; id: number }
  | { kind: 'schedule'; id: number }
  | { kind: 'calendar'; id: number }
  | { kind: 'wrong-book'; id: number }
  | { kind: 'favorites'; id: number }
  | { kind: 'history'; id: number }
  | { kind: 'ai-center'; id: number }
  | { kind: 'works-manage'; id: number; filter?: string }
  | { kind: 'continue-create'; id: number }
  | { kind: 'embedded-game'; id: number; gameId: GameId }
  | { kind: 'course-content'; id: number; courseId: string; chapterNum: number }

export function MainShell() {
  const inheritedCommands = useOptionalAppCommand()
  if (inheritedCommands) return <MainShellBody />
  return (
    <AppCommandProvider>
      <MainShellBody />
    </AppCommandProvider>
  )
}

function MainShellBody() {
  const { state } = useAppState()
  const commandContext = useAppCommand()
  const shellClassName = `main-shell main-shell--${getGradeBand(state.grade)}`
  const [activeTab, setActiveTab] = useState<MainTab>('home')
  const [stack, setStack] = useState<View[]>([{ kind: 'tab', id: 0 }])
  const view = stack[stack.length - 1]
  const companionScene = view.kind === 'mall'
    ? 'mall'
    : activeTab === 'knowledge' || view.kind === 'course-content'
      ? 'knowledge'
      : 'home'
  const nextIdRef = useRef(1)
  // 每个视图实例的滚动位置：push 时在点击现场保存（此时旧视图仍挂载，
  // scrollY 准确），pop 后恢复，使返回回到进入前的地方。
  const scrollMemories = useRef(new Map<number, number>())

  useEffect(() => {
    window.scrollTo(0, scrollMemories.current.get(view.id) ?? 0)
  }, [view.id])

  // Omit 对联合类型不分发，会让 workId/courseId 等分支独有字段被丢弃，需要分布式 Omit
  type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never

  const push = (v: DistributiveOmit<View, 'id'>) => {
    scrollMemories.current.set(view.id, window.scrollY)
    setStack([...stack, { ...v, id: nextIdRef.current++ } as View])
  }

  const pop = () => setStack(stack.length > 1 ? stack.slice(0, -1) : stack)

  const selectTab = (tab: MainTab) => {
    setActiveTab(tab)
    setStack([{ kind: 'tab', id: nextIdRef.current++ }])
  }

  const openKnowledgeContent = (courseId: string, chapterNum: number) => {
    scrollMemories.current.set(view.id, window.scrollY)
    setActiveTab('knowledge')
    setStack([
      { kind: 'tab', id: nextIdRef.current++ },
      { kind: 'course-content', id: nextIdRef.current++, courseId, chapterNum },
    ])
  }

  const openProfileView = (nextView: DistributiveOmit<View, 'id'>) => {
    setActiveTab('profile')
    push(nextView)
  }

  const executeCompanionCommand = (command: CompanionCommand) => {
    const band = getGradeBand(state.grade)
    const course = getCourseForBand(band)

    switch (command.type) {
      case 'navigate':
        if (command.target === 'home' || command.target === 'knowledge' || command.target === 'test' || command.target === 'profile') {
          selectTab(command.target)
        } else if (command.target === 'settings') {
          push({ kind: 'settings' })
        } else if (command.target === 'mall') {
          openProfileView({ kind: 'mall' })
        } else if (command.target === 'points') {
          openProfileView({ kind: 'points' })
        } else if (command.target === 'medals') {
          openProfileView({ kind: 'medals' })
        } else {
          openProfileView({ kind: 'schedule' })
        }
        return
      case 'continue-learning': {
        const completedPartIds = state.learningProgress[band].knowledgeCompleted
        const latestPartId = completedPartIds[completedPartIds.length - 1]
        const latestPart = course.parts.find((part) => part.id === latestPartId)
        if (latestPart) openKnowledgeContent(course.id, latestPart.number)
        else selectTab('knowledge')
        return
      }
      case 'resume-game':
        push({ kind: 'continue-create' })
        return
      case 'search-course':
        selectTab('knowledge')
        return
      case 'play-course': {
        const requestedPart = course.id === command.courseId
          ? course.parts.find((part) => part.number === (command.chapterNum ?? 1))
          : undefined
        if (requestedPart) openKnowledgeContent(course.id, requestedPart.number)
        else selectTab('knowledge')
        return
      }
      case 'show-points':
        openProfileView({ kind: 'points' })
        return
      case 'show-medals':
        openProfileView({ kind: 'medals' })
        return
      case 'submit-test':
        selectTab('test')
        return
      case 'publish-work':
        openProfileView({ kind: 'works-manage' })
        return
      case 'post-comment':
        push({ kind: 'work', workId: command.workId })
        return
      case 'update-schedule':
        openProfileView({ kind: 'schedule' })
        return
      case 'replace-progress': {
        const partMatch = /^([a-z0-9]+)-(\d+)$/i.exec(command.partId)
        const requestedPart = partMatch?.[1] === course.id
          ? course.parts.find((part) => part.number === Number(partMatch[2]))
          : undefined
        if (requestedPart) openKnowledgeContent(course.id, requestedPart.number)
        else selectTab('knowledge')
        return
      }
      case 'update-account-security':
      case 'sign-out-devices':
      case 'delete-account':
        push({ kind: 'settings', initialDetail: 'security' })
        return
      case 'view-guardian':
      case 'update-guardian':
        push({ kind: 'settings', initialDetail: 'guardian' })
        return
      case 'clear-account-data':
        push({ kind: 'settings', initialDetail: 'storage' })
        return
      case 'purchase':
      case 'equip':
      case 'unequip':
        return
    }
  }

  useEffect(() => commandContext.registerExecutor(executeCompanionCommand))

  if (view.kind === 'settings') {
    return (
      <main className={shellClassName}>
        <SettingsPage
          initialDetail={view.initialDetail}
          onBack={pop}
          onOpenMall={() => push({ kind: 'mall' })}
        />
        <AiCompanion scene={companionScene} />
      </main>
    )
  }

  if (view.kind === 'notifications') {
    return <NotificationsPage onBack={pop} />
  }

  if (view.kind === 'profile-detail') {
    return (
      <ProfileDetailPage
        onBack={pop}
        onEdit={() => push({ kind: 'profile-edit' })}
      />
    )
  }

  if (view.kind === 'profile-edit') {
    return (
      <ProfileEditPage onBack={pop} onDone={pop} />
    )
  }

  if (view.kind === 'schedule') {
    return (
      <main className={shellClassName}>
        <LearningSchedulePage onBack={pop} />
        <AiCompanion scene={companionScene} />
        <BottomNavigation activeTab={activeTab} onSelect={selectTab} />
      </main>
    )
  }

  if (view.kind === 'calendar') {
    return (
      <main className={shellClassName}>
        <CalendarPage onBack={pop} />
        <AiCompanion scene={companionScene} />
        <BottomNavigation activeTab={activeTab} onSelect={selectTab} />
      </main>
    )
  }

  if (view.kind === 'works-gallery') {
    return (
      <main className={shellClassName}>
        <WorksGalleryPage onBack={pop} onWorkClick={(workId) => push({ kind: 'work', workId })} />
        <AiCompanion scene={companionScene} />
        <BottomNavigation activeTab={activeTab} onSelect={selectTab} />
      </main>
    )
  }

  if (view.kind === 'work') {
    return (
      <main className={shellClassName}>
        <WorkDetailPage workId={view.workId} onBack={pop} />
        <AiCompanion scene={companionScene} />
        <BottomNavigation activeTab={activeTab} onSelect={selectTab} />
      </main>
    )
  }

  if (view.kind === 'tools') {
    return (
      <main className={shellClassName}>
        <LearningToolsDetailPage onBack={pop} />
        <AiCompanion scene={companionScene} />
        <BottomNavigation activeTab={activeTab} onSelect={selectTab} />
      </main>
    )
  }

  if (view.kind === 'medals') {
    return (
      <main className={shellClassName}>
        <MedalsPage onBack={pop} />
        <AiCompanion scene={companionScene} />
        <BottomNavigation activeTab={activeTab} onSelect={selectTab} />
      </main>
    )
  }

  if (view.kind === 'points') {
    return (
      <main className={shellClassName}>
        <PointsPage onBack={pop} />
        <AiCompanion scene={companionScene} />
        <BottomNavigation activeTab={activeTab} onSelect={selectTab} />
      </main>
    )
  }

  if (view.kind === 'mall') {
    return (
      <main className={shellClassName}>
        <MallPage onBack={pop} />
        <AiCompanion scene={companionScene} />
        <BottomNavigation activeTab={activeTab} onSelect={selectTab} />
      </main>
    )
  }

  if (view.kind === 'ranking') {
    return (
      <main className={shellClassName}>
        <RankingPage onBack={pop} />
        <AiCompanion scene={companionScene} />
        <BottomNavigation activeTab={activeTab} onSelect={selectTab} />
      </main>
    )
  }

  if (view.kind === 'wrong-book') {
    return (
      <main className={shellClassName}>
        <WrongBookPage onBack={pop} />
        <AiCompanion scene={companionScene} />
        <BottomNavigation activeTab={activeTab} onSelect={selectTab} />
      </main>
    )
  }

  if (view.kind === 'favorites') {
    return (
      <main className={shellClassName}>
        <FavoritesPage onBack={pop} />
        <AiCompanion scene={companionScene} />
        <BottomNavigation activeTab={activeTab} onSelect={selectTab} />
      </main>
    )
  }

  if (view.kind === 'history') {
    return (
      <main className={shellClassName}>
        <HistoryPage onBack={pop} />
        <AiCompanion scene={companionScene} />
        <BottomNavigation activeTab={activeTab} onSelect={selectTab} />
      </main>
    )
  }

  if (view.kind === 'ai-center') {
    return (
      <main className={shellClassName}>
        <AiCenterPage onBack={pop} />
        <AiCompanion scene={companionScene} />
        <BottomNavigation activeTab={activeTab} onSelect={selectTab} />
      </main>
    )
  }

  if (view.kind === 'works-manage') {
    return (
      <main className={shellClassName}>
        <WorksManagePage
          onBack={pop}
          onWorkClick={(workId) => push({ kind: 'work', workId })}
          onContinueCreate={(work) => {
            if (work?.source === 'brain-film' || work?.source === 'creative-module') {
              push({ kind: 'embedded-game', gameId: work.source })
            } else {
              push({ kind: 'continue-create' })
            }
          }}
          initialFilter={view.filter}
        />
        <AiCompanion scene={companionScene} />
        <BottomNavigation activeTab={activeTab} onSelect={selectTab} />
      </main>
    )
  }

  if (view.kind === 'continue-create') {
    return (
      <main className={shellClassName}>
        <ContinueCreatePage onBack={pop} />
        <AiCompanion scene={companionScene} />
        <BottomNavigation activeTab={activeTab} onSelect={selectTab} />
      </main>
    )
  }

  if (view.kind === 'embedded-game') {
    return (
      <main className={shellClassName}>
        <EmbeddedGamePage gameId={view.gameId} onBack={pop} />
      </main>
    )
  }

  if (view.kind === 'course-content') {
    return (
      <main className={shellClassName}>
        <CourseContentPage
          courseId={view.courseId}
          chapterNum={view.chapterNum}
          onBack={pop}
          onStartTest={() => selectTab('test')}
        />
        <AiCompanion scene={companionScene} />
        <BottomNavigation activeTab={activeTab} onSelect={selectTab} />
      </main>
    )
  }

  return (
    <main className={shellClassName}>
      <div className="tab-content">
        {activeTab === 'home' && (
          <HomePage
            onWorkClick={(workId) => push({ kind: 'work', workId })}
            onMoreWorks={() => push({ kind: 'works-gallery' })}
            onOpenNotifications={() => push({ kind: 'notifications' })}
            onNavigateToKnowledge={() => selectTab('knowledge')}
            onOpenContent={(courseId, chapterNum) => push({ kind: 'course-content', courseId, chapterNum })}
            onOpenGame={(gameId) => push({ kind: 'embedded-game', gameId })}
          />
        )}
        {activeTab === 'knowledge' && (
          <KnowledgePage onOpenContent={(courseId, chapterNum) => push({ kind: 'course-content', courseId, chapterNum })} />
        )}
        {activeTab === 'test' && <TestPage onReviewKnowledge={openKnowledgeContent} />}
        {activeTab === 'profile' && (
          <ProfilePage
            onOpenSettings={() => push({ kind: 'settings' })}
            onOpenProfileDetail={() => push({ kind: 'profile-detail' })}
            onWorkClick={(workId) => push({ kind: 'work', workId })}
            onOpenTools={() => push({ kind: 'tools' })}
            onOpenMedals={() => push({ kind: 'medals' })}
            onOpenPoints={() => push({ kind: 'points' })}
            onOpenMall={() => push({ kind: 'mall' })}
            onOpenRanking={() => push({ kind: 'ranking' })}
            onStartLearning={() => selectTab('knowledge')}
            onOpenSchedule={() => push({ kind: 'schedule' })}
            onOpenCalendar={() => push({ kind: 'calendar' })}
            onOpenWrongBook={() => push({ kind: 'wrong-book' })}
            onOpenFavorites={() => push({ kind: 'favorites' })}
            onOpenHistory={() => push({ kind: 'history' })}
            onOpenAiCenter={() => push({ kind: 'ai-center' })}
            onOpenWorksManage={() => push({ kind: 'works-manage' })}
            onContinueCreate={() => push({ kind: 'continue-create' })}
            onOpenWorksManageWithFilter={(filter) => push({ kind: 'works-manage', filter })}
          />
        )}
      </div>
      {activeTab !== 'test' && <AiCompanion placement="floating" scene={companionScene} />}
      <BottomNavigation activeTab={activeTab} onSelect={selectTab} />
    </main>
  )
}
