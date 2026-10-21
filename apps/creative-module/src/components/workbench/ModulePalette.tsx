// ============================================================
// ModulePalette —— AI 模块市场（左侧）
// 自由模式：四大核心分类 + 自定义模块专栏
// 关卡模式：四大核心分类（全部可用）+「关卡专用」专栏（按本关解锁过滤）
// ============================================================
import * as Icons from 'lucide-react'
import { Search, Sparkles, Zap, Wand2, Plus, Code2 } from 'lucide-react'
import { useMemo, useState, useEffect } from 'react'
import {
  MODULES_BY_CATEGORY,
  CATEGORY_META,
  LEVEL_MODULES,
  LEVEL_CATEGORY_META,
  isPreview,
} from '../../lib/moduleRegistry'
import { useCircuit } from '../../store/circuitStore'
import type { AIModule, ModuleCategory } from '../../types/circuit'
import {
  getCustomModules,
  toAIModule,
  subscribeCustomModules,
} from '../../lib/customModules'
import { CustomModuleCreator } from './CustomModuleCreator'

const CORE_CATEGORY_ORDER: ModuleCategory[] = ['input', 'perception', 'logic', 'output']

interface Section {
  key: string
  meta: { label: string; icon: string; accent: string }
  mods: AIModule[]
}

export function ModulePalette({ onAdd, onClose }: { onAdd?: (type: string) => void; onClose?: () => void }) {
  const [query, setQuery] = useState('')
  const [showCreator, setShowCreator] = useState(false)
  const [customTick, setCustomTick] = useState(0)
  const addModule = useCircuit((s) => s.addModule)
  const loadDemo = useCircuit((s) => s.loadDemoChain)
  const paletteFilter = useCircuit((s) => s.paletteFilter)

  const isLevel = !!paletteFilter

  // 订阅自定义模块变化
  useEffect(() => {
    return subscribeCustomModules(() => setCustomTick((t) => t + 1))
  }, [])

  // 构建分栏：核心分类恒显示；关卡模式追加「关卡专用」专栏
  const sections = useMemo<Section[]>(() => {
    const q = query.toLowerCase()
    const match = (m: AIModule) =>
      !query || m.name.toLowerCase().includes(q) || m.subtitle.toLowerCase().includes(q)

    const core: Section[] = CORE_CATEGORY_ORDER.map((cat) => ({
      key: cat,
      meta: CATEGORY_META[cat],
      mods: MODULES_BY_CATEGORY[cat].filter(match),
    }))

    if (paletteFilter) {
      const levelMods = LEVEL_MODULES.filter(
        (m) => paletteFilter.includes(m.type),
      ).filter(match)
      core.push({ key: 'level', meta: LEVEL_CATEGORY_META, mods: levelMods })
    }

    // 自定义模块专栏（仅自由模式）
    if (!paletteFilter) {
      const customMods = getCustomModules()
        .map(toAIModule)
        .filter(match)
      if (customMods.length > 0) {
        core.push({
          key: 'custom',
          meta: { label: '我的自定义模块', icon: 'Code2', accent: '#a888c7' },
          mods: customMods,
        })
      }
    }

    return core
  }, [paletteFilter, query, customTick])

  const onDragStart = (e: React.DragEvent, type: string) => {
    e.dataTransfer.setData('application/aicircuit', type)
    e.dataTransfer.effectAllowed = 'move'
  }

  return (
    <aside className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden border-r-[2.5px] border-ink bg-surface/60">
      {/* 标题 */}
      <div className="flex items-center justify-between border-b-[2px] border-ink px-3.5 py-3">
        <div>
          <div className="flex items-center gap-1.5 handwritten text-[20px] font-bold text-ink">
            <Sparkles size={15} className="text-amber-dim" />
            AI 模块市场
          </div>
          <div className="chip text-text-faint">
            {onAdd ? '点击添加，将元件放入画布' : isLevel ? '核心元件 + 本关设备' : '拖拽元件到画布'}
          </div>
        </div>
        {onClose && <button className="app-button" onClick={onClose}>返回画布</button>}
      </div>

      {/* 搜索 */}
      <div className="px-3 py-2.5">
        <div
          className="flex items-center gap-2 rounded-lg px-2.5 py-1.5"
          style={{ border: '1.5px solid var(--ink)', background: 'var(--surface)' }}
        >
          <Search size={13} className="text-text-faint" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索模块…"
            className="w-full bg-transparent font-kalam text-[13px] text-text placeholder:text-text-faint focus:outline-none"
          />
        </div>
      </div>

      {/* 操作按钮 */}
      <div className="px-3 pb-2 space-y-2">
        {/* 创建自定义模块（仅自由模式） */}
        {!isLevel && (
          <button
            onClick={() => setShowCreator(true)}
            className="flex w-full items-center justify-center gap-2 rounded-lg py-2 font-mono text-[12px] font-bold text-violet-sig transition hover:brightness-95"
            style={{ border: '2px solid var(--ink)', background: 'rgba(168,136,199,0.12)', boxShadow: '2px 2px 0 0 var(--ink)' }}
          >
            <Code2 size={13} />
            创建自定义模块
          </button>
        )}
        {/* 一键加载演示链路（仅自由模式） */}
        {!isLevel && (
          <button
            onClick={() => { loadDemo(); onClose?.() }}
            className="flex w-full items-center justify-center gap-2 rounded-lg py-2 font-mono text-[12px] font-bold text-amber-dim transition hover:bg-amber/25"
            style={{ border: '2px solid var(--ink)', background: 'var(--amber)' + '1a', boxShadow: '2px 2px 0 0 var(--ink)' }}
          >
            <Wand2 size={13} />
            加载示例链路
          </button>
        )}
      </div>

      {/* 模块列表 */}
      <div className="flex-1 overflow-y-auto px-3 pb-4">
        {sections.map((sec) => {
          if (!sec.mods.length) return null
          const CatIcon =
            (Icons as unknown as Record<string, Icons.LucideIcon>)[sec.meta.icon] ?? Icons.Box
          const isLevelSec = sec.key === 'level'
          const isCustomSec = sec.key === 'custom'
          return (
            <div key={sec.key} className="mb-3">
              <div className="mb-1.5 flex items-center gap-1.5 px-0.5">
                <CatIcon size={13} style={{ color: sec.meta.accent }} strokeWidth={2.2} />
                <span className="chip font-bold" style={{ color: sec.meta.accent }}>
                  {sec.meta.label}
                </span>
                {isLevelSec && (
                  <span
                    className="chip rounded px-1 py-px text-[9px] text-violet-sig"
                    style={{ border: '1px solid var(--ink)', background: 'rgba(168,136,199,0.14)' }}
                  >
                    本关
                  </span>
                )}
                {isCustomSec && (
                  <span
                    className="chip rounded px-1 py-px text-[9px] text-violet-sig"
                    style={{ border: '1px solid var(--ink)', background: 'rgba(168,136,199,0.14)' }}
                  >
                    自定义
                  </span>
                )}
              </div>
              <div className="space-y-1.5">
                {sec.mods.map((m) => {
                  const Icon = (Icons as unknown as Record<string, Icons.LucideIcon>)[m.icon] ?? Icons.Box
                  const preview = isPreview(m.type)
                  const draggable = !preview
                  return (
                    <div
                      key={m.type}
                      draggable={draggable && !onAdd}
                      onDragStart={(e) => onDragStart(e, m.type)}
                      onDoubleClick={() => !onAdd && !preview && addModule(m.type, 0, 0)}
                      className={`group relative flex cursor-grab items-center gap-2.5 rounded-lg px-2.5 py-2 transition-all ${
                        draggable
                          ? 'hover:-translate-y-px active:cursor-grabbing'
                          : 'cursor-not-allowed opacity-60'
                      }`}
                      style={{
                        border: `1.5px solid ${draggable ? 'var(--ink)' : 'var(--border-bright)'}`,
                        borderStyle: draggable ? 'solid' : 'dashed',
                        background: draggable ? `${m.accent}12` : 'var(--surface-2)',
                      }}
                    >
                      <div
                        className="grid h-7 w-7 shrink-0 place-items-center rounded-md"
                        style={{ background: `${m.accent}26`, border: `1.5px solid var(--ink)` }}
                      >
                        <Icon size={14} style={{ color: m.accent }} strokeWidth={2.2} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate handwritten text-[16px] font-bold leading-none text-ink">
                            {m.name}
                          </span>
                          {preview && (
                            <span className="chip rounded bg-surface-3 px-1 py-px text-[9px] text-text-faint">
                              预览
                            </span>
                          )}
                        </div>
                        <div className="truncate text-[11px] text-text-dim">{m.subtitle}</div>
                      </div>
                      {onAdd && <button className="app-button" disabled={preview} aria-label={`添加${m.name}`} onClick={() => onAdd(m.type)}><Plus size={16} />添加</button>}
                      {/* 端口类型小点 */}
                      <div className="flex flex-col items-end gap-0.5">
                        {m.inputs.slice(0, 2).map((p) => (
                          <span
                            key={'i' + p.id}
                            className="h-1.5 w-1.5 rounded-full"
                            style={{ background: portColor(p.type), border: '1px solid var(--ink)' }}
                          />
                        ))}
                        {m.outputs.slice(0, 2).map((p) => (
                          <span
                            key={'o' + p.id}
                            className="h-1.5 w-1.5 rounded-full"
                            style={{ background: portColor(p.type), border: '1px solid var(--ink)' }}
                          />
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}

        {sections.every((section) => section.mods.length === 0) && <p className="p-4 text-center text-text-dim">没有找到匹配的模块，试试其他名称。</p>}
        {!isLevel && (
          <div
            className="mt-3 rounded-lg p-2.5"
            style={{ border: '2px dashed var(--border-bright)' }}
          >
            <div className="flex items-center gap-1.5 text-text-faint">
              <Zap size={12} />
              <span className="chip font-bold">开放架构</span>
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-text-faint">
              任何符合统一接口的 AI 功能都可成为元件。点击上方「创建自定义模块」编写你自己的 AI 逻辑。
            </p>
          </div>
        )}
      </div>

      {/* 自定义模块创建器 */}
      {showCreator && (
        <CustomModuleCreator
          onClose={() => setShowCreator(false)}
          onCreated={() => {
            // 创建成功后由 subscribe 自动刷新
          }}
        />
      )}
    </aside>
  )
}

function portColor(type: string) {
  return {
    image: '#6ba3c3',
    label: '#d4a04a',
    confidence: '#a888c7',
    signal: '#8aab6e',
    text: '#d4825a',
    number: '#9a8a6a',
  }[type] ?? '#9a8a6a'
}
