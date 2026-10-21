// ============================================================
// LevelSelect —— 关卡选择页面（独立入口）
// 展示 5 个递进式关卡，按解锁状态/最佳成绩呈现
// 手绘水彩漫画分镜风格
// ============================================================
import {
  ArrowLeft,
  Lock,
  CheckCircle2,
  Waves,
  Trees,
  Building2,
  TrafficCone,
  Sparkles,
  Star,
  Play,
} from 'lucide-react'
import { LEVELS } from './levelData'
import { useLevelProgress } from './levelStore'
import type { Level, SceneType } from './types'

interface LevelSelectProps {
  onBack: () => void
  onEnter: (levelId: number) => void
}

const SCENE_ICON: Record<SceneType, typeof Waves> = {
  ocean: Waves,
  forest: Trees,
  city: Building2,
  crossroad: TrafficCone,
  ecocity: Building2,
}

const DIFFICULTY_COLOR: Record<string, string> = {
  入门: '#8aab6e',
  简单: '#6ba3c3',
  中等: '#d4a04a',
  中高: '#d4825a',
  挑战: '#c66b5a',
}

export function LevelSelect({ onBack, onEnter }: LevelSelectProps) {
  const maxUnlocked = useLevelProgress((s) => s.maxUnlocked)
  const bestScores = useLevelProgress((s) => s.bestScores)

  return (
    <div className="paper-bg flex h-full w-full flex-col overflow-hidden" style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}>
      {/* 顶部栏 */}
      <header className="lab-aurora relative z-20 flex min-h-14 shrink-0 items-center gap-4 border-b-[2.5px] border-ink bg-surface/80 px-4 pb-3 backdrop-blur">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-mono text-[12px] font-bold text-text-dim transition hover:text-ink"
          style={{ border: '2px solid var(--ink)', boxShadow: '2px 2px 0 0 var(--ink)', background: 'var(--surface)' }}
        >
          <ArrowLeft size={13} />
          自由实验
        </button>

        <div className="h-7 w-[2.5px] bg-ink" />

        <div className="flex items-center gap-2.5">
          <div
            className="grid h-9 w-9 place-items-center rounded-lg"
            style={{ border: '2.5px solid var(--ink)', background: 'var(--green)' }}
          >
            <Sparkles size={17} className="text-ink" strokeWidth={2.2} />
          </div>
          <div className="leading-tight">
            <div className="handwritten text-[22px] font-bold leading-none text-ink">
              关卡 <span className="text-green-sig">探险</span>
            </div>
            <div className="chip text-text-faint">从海洋到城市 · 5 关递进式 AI 学习</div>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2 font-mono text-[12px] text-text-dim">
          <Star size={13} className="text-amber-dim" />
          <span>
            已通关 <span className="font-bold text-amber-dim">{Object.keys(bestScores).length}</span> / {LEVELS.length}
          </span>
        </div>
      </header>

      {/* 关卡卡片列表 */}
      <div className="level-adventure-scroll flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto max-w-5xl">
          {/* 主线说明 */}
          <div
            className="mb-6 rounded-xl p-4"
            style={{ border: '2.5px solid var(--ink)', background: 'var(--surface)', boxShadow: '4px 4px 0 0 var(--ink)' }}
          >
            <div className="flex items-start gap-3">
              <div
                className="grid h-10 w-10 shrink-0 place-items-center rounded-lg"
                style={{ background: 'rgba(212,160,74,0.18)', border: '2px solid var(--ink)' }}
              >
                <Sparkles size={18} className="text-amber-dim" />
              </div>
              <div className="flex-1">
                <div className="handwritten text-[20px] font-bold text-ink">从一个故事开始</div>
                <p className="mt-0.5 text-[13px] leading-relaxed text-text-dim">
                  每个关卡是一个真实世界的问题——海洋有垃圾、森林可能着火、城市需要无障碍。
                  你需要用 AI 模块搭出一条电路来解决它。通关后解锁新模块，像获得新能力一样成长。
                </p>
              </div>
            </div>
          </div>

          {/* 关卡时间线 */}
          <div className="space-y-4">
            {LEVELS.map((level, idx) => {
              const unlocked = level.id <= maxUnlocked
              const best = bestScores[level.id]
              const passed = best !== undefined
              const isNext = level.id === maxUnlocked && !passed
              return (
                <LevelCard
                  key={level.id}
                  level={level}
                  index={idx}
                  unlocked={unlocked}
                  passed={passed}
                  best={best}
                  isNext={isNext}
                  onEnter={() => unlocked && onEnter(level.id)}
                />
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

function LevelCard({
  level,
  index,
  unlocked,
  passed,
  best,
  isNext,
  onEnter,
}: {
  level: Level
  index: number
  unlocked: boolean
  passed: boolean
  best: number | undefined
  isNext: boolean
  onEnter: () => void
}) {
  const SceneIcon = SCENE_ICON[level.sceneType]
  const diffColor = DIFFICULTY_COLOR[level.difficulty] ?? '#9a8a6a'

  return (
    <div
      onClick={onEnter}
      className={`relative grid grid-cols-[48px_minmax(0,1fr)] items-start gap-x-3 gap-y-3 rounded-xl p-4 transition-all ${
        unlocked ? 'cursor-pointer hover:-translate-y-0.5' : 'cursor-not-allowed'
      }`}
      style={{
        border: `2.5px solid var(--ink)`,
        background: unlocked ? 'var(--surface)' : 'var(--surface-3)',
        boxShadow: isNext
          ? '5px 5px 0 0 var(--green)'
          : unlocked
            ? '4px 4px 0 0 var(--ink)'
            : '4px 4px 0 0 var(--border-bright)',
        opacity: unlocked ? 1 : 0.65,
      }}
    >
      {/* 关卡编号 + 场景图标 */}
      <div className="flex shrink-0 flex-col items-center self-start">
        <div
          className="grid h-12 w-12 place-items-center rounded-xl"
          style={{
            background: unlocked ? `${diffColor}26` : 'var(--surface-2)',
            border: `2.5px solid var(--ink)`,
          }}
        >
          {unlocked ? (
            <SceneIcon size={30} style={{ color: diffColor }} strokeWidth={2.2} />
          ) : (
            <Lock size={26} className="text-text-faint" strokeWidth={2.2} />
          )}
        </div>
        <span
          className="mt-1.5 handwritten text-[16px] font-bold"
          style={{ color: unlocked ? diffColor : 'var(--text-faint)' }}
        >
          L{level.id}
        </span>
      </div>

      {/* 主体内容 */}
      <div className="flex min-w-0 flex-col">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="w-full handwritten text-[22px] font-bold leading-snug text-ink" style={{ writingMode: 'horizontal-tb', wordBreak: 'keep-all' }}>{level.name}</h3>
          <span className="chip text-text-faint">{level.subtitle}</span>
          {isNext && (
            <span
              className="chip rounded px-1.5 py-0.5 text-[10px] font-bold text-ink"
              style={{ background: 'var(--green)', border: '1.5px solid var(--ink)' }}
            >
              下一步
            </span>
          )}
        </div>

        <p className="mt-1.5 line-clamp-2 text-[13px] leading-relaxed text-text-dim">
          {level.story}
        </p>

        {/* 标签行 */}
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <Tag color={diffColor}>{level.difficulty}</Tag>
          <Tag color="#6b5d3f">{level.grade}</Tag>
          {level.concepts.slice(0, 3).map((c) => (
            <Tag key={c} color="#a888c7">{c}</Tag>
          ))}
        </div>
      </div>

      {/* 右侧状态 */}
      <div className="col-span-2 flex flex-wrap items-center justify-end gap-2">
        {passed ? (
          <div className="flex items-center gap-1.5">
            <CheckCircle2 size={18} className="text-green-sig" />
            <div className="text-right">
              <div className="handwritten text-[18px] font-bold leading-none text-green-sig">已通关</div>
              <div className="font-mono text-[11px] text-text-faint">
                最佳正确率 <span className="font-bold text-amber-dim">{Math.round((best ?? 0) * 100)}%</span>
              </div>
            </div>
          </div>
        ) : unlocked ? (
          <div
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 font-mono text-[12px] font-bold text-ink"
            style={{ border: '2px solid var(--ink)', background: 'var(--green)', boxShadow: '2px 2px 0 0 var(--ink)' }}
          >
            <Play size={13} />
            开始挑战
          </div>
        ) : (
          <div className="flex items-center gap-1.5 font-mono text-[11px] text-text-faint">
            <Lock size={12} />
            通关 L{level.id - 1} 解锁
          </div>
        )}
      </div>

      {/* 序号竖线装饰 */}
      {index < LEVELS.length - 1 && (
        <div className="pointer-events-none absolute -bottom-4 left-12 h-4 w-[2.5px] bg-ink/30" />
      )}
    </div>
  )
}

function Tag({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <span
      className="chip rounded px-1.5 py-0.5 text-[10px] font-bold"
      style={{ border: '1.5px solid var(--ink)', color, background: `${color}1a` }}
    >
      {children}
    </span>
  )
}
