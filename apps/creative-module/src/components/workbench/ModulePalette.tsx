// ============================================================
// ModulePalette —— AI 模块市场（左侧）
// 自由模式：四大核心分类 + 自定义模块专栏
// 关卡模式：四大核心分类（只保留本关允许的元件）+「关卡专用」专栏
// 点一行看模块详情；「添加」按钮或拖拽才把元件放进画布
// ============================================================
import * as Icons from 'lucide-react'
import { Search, Sparkles, Zap, Wand2, Plus, Code2, ArrowLeft, ChevronRight } from 'lucide-react'
import { useMemo, useState, useEffect } from 'react'
import {
  MODULES,
  MODULES_BY_CATEGORY,
  CATEGORY_META,
  LEVEL_MODULES,
  LEVEL_CATEGORY_META,
  getModule,
  isPreview,
} from '../../lib/moduleRegistry'
import { useCircuit } from '../../store/circuitStore'
import { canConnect, TYPE_LABEL } from '../../types/circuit'
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
  const [detailType, setDetailType] = useState<string | null>(null)
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

    // 关卡模式下四大核心分类也只保留本关允许的元件，
    // 否则会摆出「摄像头/感光器」这种永远通不了关的选择。
    // 空数组代表本关还没限定元件（占位关卡），这时不额外收紧。
    const allowCore = (m: AIModule) =>
      !paletteFilter || paletteFilter.length === 0 || paletteFilter.includes(m.type)

    const core: Section[] = CORE_CATEGORY_ORDER.map((cat) => ({
      key: cat,
      meta: CATEGORY_META[cat],
      mods: MODULES_BY_CATEGORY[cat].filter(match).filter(allowCore),
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

  // 详情：先查内置注册表，再查自定义模块（自定义模块可能还没注册到 MODULES）
  const detail = useMemo<AIModule | null>(() => {
    if (!detailType) return null
    const builtin = getModule(detailType)
    if (builtin) return builtin
    return getCustomModules().map(toAIModule).find((m) => m.type === detailType) ?? null
  }, [detailType, customTick])

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
            {onAdd
              ? '点一行看详情，点「添加」放进画布'
              : isLevel
                ? '核心元件 + 本关设备'
                : '点一行看详情，或拖到画布'}
          </div>
        </div>
        {onClose && <button className="app-button" onClick={onClose}>返回画布</button>}
      </div>

      {/* 搜索（看详情时收起，避免和详情打架） */}
      {!detail && (
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
      )}

      {/* 操作按钮 */}
      {!detail && (
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
      )}

      {/* 模块列表 / 模块详情 */}
      <div className="flex-1 overflow-y-auto px-3 pb-4">
        {detail ? (
          <ModuleDetail
            key={detail.type}
            mod={detail}
            onAdd={onAdd}
            onBack={() => setDetailType(null)}
          />
        ) : (
          <>
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
                          role="button"
                          tabIndex={0}
                          title={`${m.name} · 点击看详情`}
                          draggable={draggable && !onAdd}
                          onDragStart={(e) => onDragStart(e, m.type)}
                          onClick={() => setDetailType(m.type)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                              setDetailType(m.type)
                            }
                          }}
                          className={`group relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 transition-all ${
                            draggable
                              ? 'cursor-grab hover:-translate-y-px active:cursor-grabbing'
                              : 'cursor-pointer opacity-60'
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
                          {onAdd && (
                            <button
                              className="app-button"
                              disabled={preview}
                              aria-label={`添加${m.name}`}
                              onClick={(e) => {
                                e.stopPropagation()
                                onAdd(m.type)
                              }}
                            >
                              <Plus size={16} />添加
                            </button>
                          )}
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
          </>
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

// -------------------- 模块详情（市场内联视图）--------------------
function ModuleDetail({
  mod,
  onBack,
  onAdd,
}: {
  mod: AIModule
  onBack: () => void
  onAdd?: (type: string) => void
}) {
  const [showCode, setShowCode] = useState(false)
  const Icon = (Icons as unknown as Record<string, Icons.LucideIcon>)[mod.icon] ?? Icons.Box
  const preview = isPreview(mod.type)

  // 「怎么组合」直接问注册表：谁的输出能接进这块元件（上游）、这块元件的输出能接进谁（下游）
  const registry: AIModule[] = [...Object.values(MODULES)]
  for (const def of getCustomModules()) {
    if (!registry.some((m) => m.type === def.type)) registry.push(toAIModule(def))
  }
  const others = registry.filter((m) => m.type !== mod.type && !isPreview(m.type))
  const upstream = others.filter((m) =>
    m.outputs.some((o) => mod.inputs.some((i) => canConnect(o.type, i.type))),
  )
  const downstream = others.filter((m) =>
    mod.outputs.some((o) => m.inputs.some((i) => canConnect(o.type, i.type))),
  )

  // 代码模板用模块自己的默认参数渲染出来
  const defaultParams = Object.fromEntries(mod.params.map((p) => [p.id, p.default] as const))

  return (
    <div className="space-y-2.5">
      {/* 头部：返回 + 加入画布 / 拖到画布 */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={onBack}
          className="flex items-center gap-1 rounded-lg px-2 py-1 font-mono text-[11px] font-bold text-text-dim transition hover:text-ink"
          style={{ border: '1.5px solid var(--ink)', background: 'var(--surface)' }}
        >
          <ArrowLeft size={12} />
          返回列表
        </button>
        {onAdd ? (
          <button
            className="ml-auto flex items-center gap-1 rounded-lg px-2.5 py-1 font-mono text-[11px] font-bold text-ink transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
            style={{ border: '1.5px solid var(--ink)', background: 'var(--amber)', boxShadow: '2px 2px 0 0 var(--ink)' }}
            disabled={preview}
            onClick={() => onAdd(mod.type)}
          >
            <Plus size={13} />
            加入画布
          </button>
        ) : (
          <span className="chip ml-auto text-text-faint">拖到画布使用</span>
        )}
      </div>

      {/* 标题 */}
      <div
        className="flex items-start gap-2.5 rounded-lg p-2.5"
        style={{ border: '2px solid var(--ink)', background: `${mod.accent}14` }}
      >
        <div
          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg"
          style={{ background: `${mod.accent}26`, border: '2px solid var(--ink)' }}
        >
          <Icon size={17} style={{ color: mod.accent }} strokeWidth={2.2} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="handwritten text-[18px] font-bold leading-none text-ink">{mod.name}</div>
          <div className="text-[12px] text-text-dim">{mod.subtitle}</div>
        </div>
        <span
          className="chip shrink-0 rounded px-1.5 py-px text-[10px]"
          style={{ color: mod.accent, background: `${mod.accent}1f`, border: `1px solid ${mod.accent}55` }}
        >
          {CATEGORY_META[mod.category].label}
        </span>
      </div>

      {/* 它做什么 */}
      <DetailBlock title="它做什么">
        <p className="text-[12.5px] leading-relaxed text-text-dim">{mod.description}</p>
      </DetailBlock>

      {/* 为什么有用 */}
      <DetailBlock title="为什么有用">
        <p className="text-[12.5px] leading-relaxed text-text-dim">{mod.explanation}</p>
      </DetailBlock>

      {/* 端口 */}
      <DetailBlock title="端口">
        {mod.inputs.length === 0 && mod.outputs.length === 0 ? (
          <p className="text-[11.5px] text-text-faint">这块元件没有端口（纯展示 / 纯终端）。</p>
        ) : (
          <div className="space-y-1.5">
            {mod.inputs.length > 0 && <PortList label="输入" ports={mod.inputs} />}
            {mod.outputs.length > 0 && <PortList label="输出" ports={mod.outputs} />}
          </div>
        )}
      </DetailBlock>

      {/* 可调参数 */}
      <DetailBlock title="可调参数">
        {mod.params.length === 0 ? (
          <p className="text-[11.5px] text-text-faint">没有可调参数，行为固定。</p>
        ) : (
          <div className="space-y-1">
            {mod.params.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-1.5 rounded-md px-2 py-1"
                style={{ border: '1.5px solid var(--border)', background: 'var(--surface-2)' }}
              >
                <span className="font-kalam text-[12px] text-text-dim">{p.label}</span>
                <span className="chip ml-auto text-[10px] text-text-faint">
                  默认 {String(p.default) === '' ? '（空）' : String(p.default)}
                </span>
                {p.type === 'number' && p.min !== undefined && p.max !== undefined && (
                  <span className="chip rounded px-1 py-px text-[9.5px] text-text-faint">
                    {p.min}~{p.max}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </DetailBlock>

      {/* 怎么组合 */}
      <DetailBlock title="怎么组合">
        <div className="space-y-1.5">
          <ComposeRow label="上游" hint="输出能接进这块元件" mods={upstream} />
          <ComposeRow label="下游" hint="能接住它的输出" mods={downstream} />
        </div>
        <p className="mt-1.5 text-[10.5px] leading-relaxed text-text-faint">
          连线会检查数据类型：类型一致才能连；数值(number)与置信度(confidence)可互换。
        </p>
      </DetailBlock>

      {/* 代码实现 */}
      <DetailBlock title="代码实现">
        <button
          onClick={() => setShowCode((v) => !v)}
          className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 font-mono text-[11.5px] font-bold text-text-dim transition hover:text-amber-dim"
          style={{ border: '1.5px solid var(--ink)', background: 'var(--surface-2)', boxShadow: '2px 2px 0 0 var(--ink)' }}
        >
          <span className="flex items-center gap-1.5">
            <Code2 size={12} />
            {showCode ? '隐藏代码' : '看看真实代码'}
          </span>
          <ChevronRight size={13} className={`transition-transform ${showCode ? 'rotate-90' : ''}`} />
        </button>
        {showCode && (
          <pre
            className="code-block mt-1.5 overflow-auto p-2.5 font-mono text-[10.5px] leading-relaxed text-text"
            style={{ border: '1.5px solid var(--ink)', background: 'var(--surface-2)' }}
          >
            {mod.code(defaultParams)}
          </pre>
        )}
      </DetailBlock>
    </div>
  )
}

function DetailBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-ink/30 pt-2">
      <div className="mb-1 chip font-bold text-text-dim">{title}</div>
      {children}
    </div>
  )
}

function PortList({ label, ports }: { label: string; ports: AIModule['inputs'] }) {
  return (
    <div>
      <div className="mb-0.5 chip text-[9.5px] text-text-faint">{label}</div>
      <div className="space-y-1">
        {ports.map((p) => (
          <div
            key={p.id}
            className="flex items-center gap-1.5 rounded-md px-2 py-1"
            style={{ border: '1.5px solid var(--border)', background: 'var(--surface-2)' }}
          >
            <span
              className="h-2 w-2 rounded-full"
              style={{ background: portColor(p.type), border: '1px solid var(--ink)' }}
            />
            <span className="font-kalam text-[12px] text-text-dim">{p.label}</span>
            {p.optional && <span className="chip text-[9.5px] text-text-faint">可选</span>}
            <span className="chip ml-auto text-[10px] text-text-faint">{TYPE_LABEL[p.type]}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function ComposeRow({ label, hint, mods }: { label: string; hint: string; mods: AIModule[] }) {
  return (
    <div>
      <div className="mb-0.5 flex items-center gap-1.5">
        <span className="chip rounded px-1 py-px text-[9.5px] font-bold" style={{ border: '1px solid var(--ink)' }}>
          {label}
        </span>
        <span className="text-[10px] text-text-faint">{hint}</span>
      </div>
      {mods.length === 0 ? (
        <p className="text-[11px] text-text-faint">暂时没有能直连的元件。</p>
      ) : (
        <div className="flex flex-wrap gap-1">
          {mods.map((m) => (
            <span
              key={m.type}
              className="chip rounded px-1.5 py-px text-[10px] text-text-dim"
              style={{ border: `1.5px solid ${m.accent}66`, background: `${m.accent}12` }}
              title={m.subtitle}
            >
              {m.name}
            </span>
          ))}
        </div>
      )}
    </div>
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
    audio: '#c66b5a',
  }[type] ?? '#9a8a6a'
}
