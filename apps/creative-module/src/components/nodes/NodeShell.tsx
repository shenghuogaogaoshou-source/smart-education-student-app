// ============================================================
// NodeShell —— 所有 AI 元件的统一外壳（手绘漫画分镜风）
// 粗墨线边框 + 硬偏移阴影 + 水彩色块标题栏 + 手写体
// ============================================================
import { Handle, Position } from 'reactflow'
import * as Icons from 'lucide-react'
import type { AIModule, ParamDef } from '../../types/circuit'
import { TYPE_COLOR } from '../../types/circuit'
import { useNodeMeta } from './NodeChrome'
import { useCircuit } from '../../store/circuitStore'

/** 这些参数由元件自己画了控件（避免重复出现两个输入框） */
const SELF_EDITED_PARAMS: Record<string, string[]> = {
  textInput: ['text'],
}

/** 元件上最多直接显示几个参数（更多的点右上角 🔧 进检视器） */
const INLINE_PARAM_LIMIT = 3

function InlineParam({
  def,
  value,
  onChange,
}: {
  def: ParamDef
  value: string | number | undefined
  onChange: (v: string | number) => void
}) {
  const current = value === undefined || value === null ? def.default : value
  const num = Number(current)
  const ranged =
    def.min !== undefined && def.max !== undefined
      ? Math.min(def.max, Math.max(def.min, Number.isFinite(num) ? num : Number(def.default)))
      : Number.isFinite(num)
        ? num
        : Number(def.default)
  const style = { border: '1.5px solid var(--ink)', background: 'var(--surface)' } as const
  const cls = 'nodrag nopan min-w-0 flex-1 rounded px-1.5 py-[3px] font-mono text-[11px] text-text focus:outline-none'
  return (
    <label className="flex items-center gap-1.5">
      <span className="max-w-[74px] shrink-0 truncate font-kalam text-[11px] text-text-dim" title={def.label}>
        {def.label}
      </span>
      {def.type === 'select' ? (
        <select className={cls} style={style} value={String(current)} onChange={(e) => onChange(e.target.value)}>
          {def.options?.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ) : def.type === 'number' ? (
        <input
          type="number"
          className={cls}
          style={style}
          value={ranged}
          min={def.min}
          max={def.max}
          step={def.step}
          onChange={(e) => onChange(e.target.value === '' ? def.default : Number(e.target.value))}
        />
      ) : (
        <input
          type="text"
          className={cls}
          style={style}
          value={String(current)}
          placeholder="点这里输入…"
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </label>
  )
}

interface NodeShellProps {
  module: AIModule
  selected?: boolean
  status?: 'idle' | 'running' | 'ready' | 'error'
  /** 顶部右侧额外徽标 */
  badge?: React.ReactNode
  children?: React.ReactNode
  /** 内容区底部自定义（如 AI 概率条） */
  footer?: React.ReactNode
}

function StatusDot({ status }: { status?: NodeShellProps['status'] }) {
  if (!status || status === 'idle') return null
  const map = {
    running: { c: '#d4a04a', label: '推理中', pulse: true },
    ready: { c: '#8aab6e', label: '就绪', pulse: false },
    error: { c: '#c66b5a', label: '出错', pulse: false },
  } as const
  const s = map[status]
  if (!s) return null
  return (
    <span className="flex items-center gap-1.5">
      <span
        className={`inline-block h-2.5 w-2.5 rounded-full border-[1.5px] border-ink ${s.pulse ? 'blink' : ''}`}
        style={{ background: s.c }}
      />
      <span className="chip text-text-dim">{s.label}</span>
    </span>
  )
}

export function NodeShell({ module, selected, status, badge, children, footer }: NodeShellProps) {
  const IconComp = (Icons as unknown as Record<string, Icons.LucideIcon>)[module.icon] ?? Icons.Box
  const catLabel = { input: 'INPUT', perception: 'AI', logic: 'LOGIC', output: 'OUTPUT' }[
    module.category
  ]
  // 节点 id / 参数由 NodeChrome 通过 Context 提供；不在画布里时为 null
  const meta = useNodeMeta()
  const updateParam = useCircuit((s) => s.updateParam)
  const ownParams = new Set(SELF_EDITED_PARAMS[module.type] ?? [])
  const inlineParams = module.params.filter((p) => p.editable !== false && !ownParams.has(p.id))
  const shownParams = inlineParams.slice(0, INLINE_PARAM_LIMIT)

  return (
    <div
      className="relative w-[252px] rounded-[16px] bg-surface text-text transition-all"
      style={{
        border: `2.5px solid var(--ink)`,
        borderRadius: '16px',
        // 漫画分镜硬阴影：选中时用模块色阴影，否则用墨色
        boxShadow: selected
          ? `5px 5px 0 0 ${module.accent}, 0 0 0 2.5px var(--ink)`
          : `4px 4px 0 0 var(--ink)`,
        // 选中时轻微倾斜，手绘活泼感
        transform: selected ? 'rotate(-0.3deg)' : 'none',
      }}
    >
      {/* 左侧 accent 竖条 —— 蜡笔色水彩条 */}
      <div
        className="absolute left-0 top-3 bottom-3 w-[4px] rounded-full"
        style={{ background: module.accent }}
      />

      {/* 标题栏：水彩色块 */}
      <div
        className="node-header flex items-center gap-2.5 rounded-t-[13px] px-3 py-2.5"
        style={{
          background: `linear-gradient(180deg, ${module.accent}26, ${module.accent}12)`,
          borderBottom: '2.5px solid var(--ink)',
        }}
      >
        <div
          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg"
          style={{
            background: `${module.accent}26`,
            border: `2px solid var(--ink)`,
          }}
        >
          <IconComp size={17} style={{ color: module.accent }} strokeWidth={2.2} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="handwritten truncate text-[19px] font-bold leading-none text-ink">
              {module.name}
            </span>
            <span
              className="chip rounded px-1.5 py-px"
              style={{ color: module.accent, background: `${module.accent}1f`, border: `1px solid ${module.accent}55` }}
            >
              {catLabel}
            </span>
          </div>
          <div className="truncate text-[12px] text-text-dim">{module.subtitle}</div>
        </div>
        <StatusDot status={status} />
      </div>

      {/* 入端口 */}
      {module.inputs.length > 0 && (
        <div className="px-3 pt-2.5">
          {module.inputs.map((p) => (
            <div key={p.id} className="relative flex items-center gap-2 py-1">
              <Handle
                type="target"
                id={p.id}
                position={Position.Left}
                className={`handle-${p.type}`}
              />
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: TYPE_COLOR[p.type], border: '1.5px solid var(--ink)' }}
              />
              <span className="font-kalam text-[13px] text-text-dim">{p.label}</span>
            </div>
          ))}
        </div>
      )}

      {/* 内容区 */}
      {children && (
        <div className="px-3 py-2.5">
          {children}
        </div>
      )}

      {/* 出端口 */}
      {module.outputs.length > 0 && (
        <div className={`px-3 ${module.inputs.length || children ? 'pt-1' : 'pt-2.5'} pb-2.5`}>
          {module.outputs.map((p) => (
            <div key={p.id} className="relative flex items-center justify-end gap-2 py-1">
              <span className="font-kalam text-[13px] text-text-dim">{p.label}</span>
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: TYPE_COLOR[p.type], border: '1.5px solid var(--ink)' }}
              />
              <Handle
                type="source"
                id={p.id}
                position={Position.Right}
                className={`handle-${p.type}`}
              />
            </div>
          ))}
        </div>
      )}

      {/* 参数直接改：不用打开检视器（最多 3 个，更多的点右上角 🔧） */}
      {meta && shownParams.length > 0 && (
        <div
          className="nodrag nopan space-y-1 px-3 pb-2.5 pt-1.5"
          style={{ borderTop: '2px solid rgba(42,36,21,0.18)' }}
        >
          {shownParams.map((p) => (
            <InlineParam
              key={p.id}
              def={p}
              value={meta.params?.[p.id]}
              onChange={(v) => updateParam(meta.id, p.id, v)}
            />
          ))}
          {inlineParams.length > shownParams.length && (
            <p className="text-[10px] leading-tight text-text-faint">
              还有 {inlineParams.length - shownParams.length} 个参数，点右上角 🔧 打开检视器
            </p>
          )}
        </div>
      )}

      {footer && <div className="border-t-2 border-ink/30 px-3 py-2">{footer}</div>}

      {badge}
    </div>
  )
}
