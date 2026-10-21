// ============================================================
// Inspector —— 右侧检视器
// 选中节点 → 调参 / 看说明 / 查看真实代码 / 删除
// 空选 → 数据类型图例 + 使用提示
// ============================================================
import { useState, useEffect } from 'react'
import * as Icons from 'lucide-react'
import { Code2, Trash2, Info, ChevronRight, X, Layers, RotateCcw, Pencil } from 'lucide-react'
import { useCircuit } from '../../store/circuitStore'
import { getModule, isPreview } from '../../lib/moduleRegistry'
import { TYPE_COLOR, TYPE_LABEL, type CircuitNodeData } from '../../types/circuit'
import type { ParamDef } from '../../types/circuit'

export function Inspector() {
  const selectedId = useCircuit((s) => s.selectedNodeId)
  const node = useCircuit((s) => s.nodes.find((n) => n.id === selectedId))

  if (!node) return <EmptyInspector />

  const mod = getModule(node.data.moduleType)!
  return <NodeInspector key={node.id} nodeId={node.id} data={node.data} />
}

function NodeInspector({ nodeId, data }: { nodeId: string; data: CircuitNodeData }) {
  const mod = getModule(data.moduleType)!
  const updateParam = useCircuit((s) => s.updateParam)
  const updateCode = useCircuit((s) => s.updateCode)
  const resetCode = useCircuit((s) => s.resetCode)
  const deleteNode = useCircuit((s) => s.deleteNode)
  const selectNode = useCircuit((s) => s.selectNode)
  const [showCode, setShowCode] = useState(false)

  const Icon = (Icons as unknown as Record<string, Icons.LucideIcon>)[mod.icon] ?? Icons.Box

  return (
    <aside className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden border-l-[2.5px] border-ink bg-surface/60">
      {/* 头部 */}
      <div className="flex items-center justify-between border-b-[2px] border-ink px-3.5 py-3">
        <div className="flex items-center gap-2">
          <Layers size={14} className="text-amber-dim" />
          <span className="handwritten text-[18px] font-bold text-ink">元件检视器</span>
        </div>
        <button
          aria-label="关闭元件检视器"
          onClick={() => selectNode(null)}
          className="text-text-faint transition hover:text-red-sig"
        >
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* 模块卡片 */}
        <div className="px-3.5 py-3">
          <div
            className="flex items-center gap-2.5 rounded-lg p-2.5"
            style={{ border: '2px solid var(--ink)', background: `${mod.accent}14` }}
          >
            <div
              className="grid h-9 w-9 place-items-center rounded-lg"
              style={{ background: `${mod.accent}26`, border: `2px solid var(--ink)` }}
            >
              <Icon size={17} style={{ color: mod.accent }} strokeWidth={2.2} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="handwritten text-[18px] font-bold leading-none text-ink">{mod.name}</div>
              <div className="text-[12px] text-text-dim">{mod.subtitle}</div>
            </div>
          </div>
          {mod.model && (
            <div
              className="mt-2 flex items-center gap-1.5 rounded-md px-2 py-1.5"
              style={{ border: '1.5px solid var(--ink)', background: 'var(--amber)' + '1a' }}
            >
              <span className="chip text-text-faint">真实模型</span>
              <span className="font-mono text-[11px] font-bold text-amber-dim">{mod.model}</span>
            </div>
          )}
        </div>

        {/* 端口信息 */}
        <Section title="接口" icon={ChevronRight}>
          <div className="space-y-1.5">
            {mod.inputs.length > 0 && (
              <PortRow label="输入" ports={mod.inputs.map((p) => ({ ...p, dir: 'in' }))} />
            )}
            {mod.outputs.length > 0 && (
              <PortRow label="输出" ports={mod.outputs.map((p) => ({ ...p, dir: 'out' }))} />
            )}
            {mod.inputs.length === 0 && mod.outputs.length === 0 && (
              <span className="text-[12px] text-text-faint">纯输入端 / 终端</span>
            )}
          </div>
        </Section>

        {/* 参数 */}
        {mod.params.length > 0 && (
          <Section title="参数" icon={ChevronRight}>
            <div className="space-y-3">
              {mod.params.map((p) => (
                <ParamControl
                  key={p.id}
                  def={p}
                  value={data.params[p.id]}
                  onChange={(v) => updateParam(nodeId, p.id, v)}
                />
              ))}
            </div>
          </Section>
        )}

        {/* 说明 */}
        <Section title="这块元件在做什么" icon={Info}>
          <p className="text-[13px] leading-relaxed text-text-dim">{mod.explanation}</p>
        </Section>

        {/* 查看真实代码 */}
        <Section title="透视：真实代码" icon={Code2}>
          <button
            onClick={() => setShowCode((v) => !v)}
            className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 font-mono text-[12px] font-bold text-text-dim transition hover:text-amber-dim"
            style={{ border: '2px solid var(--ink)', background: 'var(--surface-2)', boxShadow: '2px 2px 0 0 var(--ink)' }}
          >
            <span className="flex items-center gap-1.5">
              <Pencil size={12} />
              {showCode ? '隐藏代码' : '查看并编辑代码'}
            </span>
            <ChevronRight
              size={13}
              className={`transition-transform ${showCode ? 'rotate-90' : ''}`}
            />
          </button>
          {showCode && (
            <CodeEditor
              defaultCode={mod.code(data.params)}
              override={data.codeOverride}
              onChange={(v) => updateCode(nodeId, v)}
              onReset={() => resetCode(nodeId)}
            />
          )}
          <p className="mt-2 text-[11px] leading-relaxed text-text-faint">
            学生看到的是积木，但点开就能看见并修改系统背后真实运行的代码与模型调用。
          </p>
        </Section>

        {/* 删除 */}
        <div className="px-3.5 py-3">
          <button
            onClick={() => deleteNode(nodeId)}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg py-2 font-mono text-[12px] font-bold text-text-dim transition hover:text-red-sig"
            style={{ border: '2px solid var(--ink)', boxShadow: '2px 2px 0 0 var(--ink)', background: 'var(--surface)' }}
          >
            <Trash2 size={13} />
            移除该元件
          </button>
        </div>
      </div>
    </aside>
  )
}

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string
  icon: Icons.LucideIcon
  children: React.ReactNode
}) {
  return (
    <div className="border-t border-ink/30 px-3.5 py-3">
      <div className="mb-2 flex items-center gap-1.5">
        <Icon size={13} className="text-text-faint" />
        <span className="chip font-bold text-text-dim">{title}</span>
      </div>
      {children}
    </div>
  )
}

function PortRow({
  label,
  ports,
}: {
  label: string
  ports: ({ id: string; label: string; type: keyof typeof TYPE_COLOR; dir: string })[]
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="chip w-10 shrink-0 text-text-faint">{label}</span>
      <div className="flex flex-1 flex-wrap gap-1.5">
        {ports.map((p) => (
          <span
            key={p.id}
            className="flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[10px] font-bold"
            style={{ borderColor: 'var(--ink)', color: TYPE_COLOR[p.type], background: `${TYPE_COLOR[p.type]}1a` }}
          >
            <span className="h-2 w-2 rounded-full" style={{ background: TYPE_COLOR[p.type], border: '1px solid var(--ink)' }} />
            {p.label} · {TYPE_LABEL[p.type]}
          </span>
        ))}
      </div>
    </div>
  )
}

function ParamControl({
  def,
  value,
  onChange,
}: {
  def: ParamDef
  value: string | number
  onChange: (v: string | number) => void
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <label className="font-kalam text-[13px] text-text-dim">{def.label}</label>
        {def.type === 'number' && (
          <span className="font-mono text-[12px] font-bold text-amber-dim">{String(value)}</span>
        )}
      </div>
      {def.type === 'select' ? (
        <select
          value={String(value)}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-md px-2 py-1.5 font-mono text-[12px] text-text focus:outline-none"
          style={{ border: '1.5px solid var(--ink)', background: 'var(--surface)' }}
        >
          {def.options?.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ) : def.type === 'number' ? (
        <input
          type="range"
          min={def.min}
          max={def.max}
          step={def.step}
          value={Number(value)}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full accent-amber"
        />
      ) : (
        <input
          type="text"
          value={String(value)}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-md px-2 py-1.5 font-mono text-[12px] text-text focus:outline-none"
          style={{ border: '1.5px solid var(--ink)', background: 'var(--surface)' }}
        />
      )}
    </div>
  )
}

// -------------------- 可编辑代码块 --------------------
function CodeEditor({
  defaultCode,
  override,
  onChange,
  onReset,
}: {
  defaultCode: string
  override?: string
  onChange: (v: string) => void
  onReset: () => void
}) {
  // 本地草稿：未确认提交前的内容。以 override 为准（若已编辑），否则 defaultCode
  const current = override ?? defaultCode
  const [draft, setDraft] = useState(current)
  const isDirty = draft !== current

  // 外部 defaultCode 变化（如参数变化导致模板刷新）时同步草稿，但仅当未自定义时
  useEffect(() => {
    if (!override) setDraft(defaultCode)
  }, [defaultCode, override])

  // override 被重置时同步
  useEffect(() => {
    if (!override && draft !== defaultCode) setDraft(defaultCode)
  }, [override, defaultCode, draft])

  return (
    <div className="mt-2">
      <div className="mb-1 flex items-center justify-between">
        <span className="flex items-center gap-1.5 chip font-bold text-text-dim">
          <Pencil size={11} />
          {override ? '已自定义' : '默认模板'}
          {isDirty && <span className="text-amber-dim">· 未保存</span>}
        </span>
        {override && (
          <button
            onClick={() => {
              onReset()
              setDraft(defaultCode)
            }}
            className="flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[10px] text-text-faint transition hover:text-red-sig"
            style={{ border: '1px solid var(--border)' }}
          >
            <RotateCcw size={10} />
            重置
          </button>
        )}
      </div>
      <textarea
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value)
          onChange(e.target.value)
        }}
        spellCheck={false}
        rows={Math.min(14, Math.max(5, draft.split('\n').length + 1))}
        className="code-block w-full resize-y overflow-auto p-2.5 font-mono text-[11px] leading-relaxed text-text focus:outline-none"
        style={{
          border: `2px solid ${override ? 'var(--amber)' : 'var(--ink)'}`,
          background: 'var(--surface)',
        }}
      />
    </div>
  )
}

function EmptyInspector() {
  const types = Object.entries(TYPE_LABEL) as [keyof typeof TYPE_LABEL, string][]
  return (
    <aside className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden border-l-[2.5px] border-ink bg-surface/60">
      <div className="border-b-[2px] border-ink px-3.5 py-3">
        <div className="flex items-center gap-2">
          <Layers size={14} className="text-text-faint" />
          <span className="handwritten text-[18px] font-bold text-ink">元件检视器</span>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-3.5 py-3">
        <div
          className="grid place-items-center rounded-lg py-10 text-center"
          style={{ border: '2px dashed var(--border-bright)' }}
        >
          <div>
            <Info size={22} className="mx-auto text-text-faint" />
            <p className="mt-2 px-4 text-[13px] leading-relaxed text-text-dim">
              点击画布上的元件查看它的接口、参数与真实代码。
            </p>
          </div>
        </div>

        <div className="mt-4">
          <span className="chip font-bold text-text-faint">数据类型图例</span>
          <div className="mt-2 space-y-1.5">
            {types.map(([t, label]) => (
              <div
                key={t}
                className="flex items-center gap-2 rounded-md px-2.5 py-1.5"
                style={{ border: '1.5px solid var(--border)', background: 'var(--surface-2)' }}
              >
                <span
                  className="h-3 w-3 rounded-full"
                  style={{ background: TYPE_COLOR[t], border: '1.5px solid var(--ink)' }}
                />
                <span className="font-kalam text-[13px] text-text-dim">{label}</span>
                <span className="chip ml-auto text-text-faint">{t}</span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-text-faint">
            连线必须类型匹配——摄像头输出"图像"，不能直接接"信号"输出，必须先经过 AI 与逻辑。
          </p>
        </div>

        <div
          className="mt-4 rounded-lg p-2.5"
          style={{ border: '2px solid var(--ink)', background: 'var(--amber)' + '14', boxShadow: '2px 2px 0 0 var(--ink)' }}
        >
          <span className="chip font-bold text-amber-dim">学习闭环</span>
          <div className="mt-1.5 handwritten text-[18px] leading-relaxed text-text-dim">
            搭建 → 运行 → 观察 → 调试 → 解释 → 重构
          </div>
        </div>
      </div>
    </aside>
  )
}
