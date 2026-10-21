// ============================================================
// CustomModuleCreator —— 自定义 AI 模块创建器
// 用户可定义模块名称、图标、输入/输出端口类型、参数、自定义代码
// 创建后动态注册到模块市场，可拖入画布使用
// ============================================================
import { useState, useCallback } from 'react'
import { X, Plus, Trash2, ShieldCheck, ShieldAlert, Eye, Code2 } from 'lucide-react'
import {
  addCustomModule,
  validateCode,
  DEFAULT_USER_CODE,
  type CustomModuleDef,
} from '../../lib/customModules'
import type { PortDef, ParamDef, DataType, ModuleCategory } from '../../types/circuit'

const DATA_TYPES: DataType[] = ['image', 'label', 'confidence', 'signal', 'text', 'number', 'audio']
const TYPE_LABELS: Record<DataType, string> = {
  image: '图像',
  label: '标签',
  confidence: '置信度',
  signal: '信号',
  text: '文本',
  number: '数值',
  audio: '音频',
}

const ICON_OPTIONS = ['Cpu', 'Wrench', 'FlaskConical', 'Binary', 'Calculator', 'Boxes', 'CircuitBoard', 'Puzzle']
const CATEGORY_OPTIONS: { value: ModuleCategory; label: string }[] = [
  { value: 'perception', label: 'AI 感知' },
  { value: 'logic', label: '逻辑判断' },
  { value: 'output', label: '行动输出' },
  { value: 'input', label: '输入感知' },
]
const ACCENT_OPTIONS = ['#6ba3c3', '#d4a04a', '#8aab6e', '#d4825a', '#a888c7', '#c66b5a']

interface Props {
  onClose: () => void
  onCreated?: (mod: CustomModuleDef) => void
}

export function CustomModuleCreator({ onClose, onCreated }: Props) {
  const [name, setName] = useState('')
  const [subtitle, setSubtitle] = useState('')
  const [category, setCategory] = useState<ModuleCategory>('logic')
  const [icon, setIcon] = useState('Cpu')
  const [accent, setAccent] = useState('#a888c7')
  const [description, setDescription] = useState('')

  const [inputs, setInputs] = useState<PortDef[]>([{ id: 'label', label: '标签', type: 'label' }])
  const [outputs, setOutputs] = useState<PortDef[]>([{ id: 'signal', label: '信号', type: 'signal' }])
  const [params, setParams] = useState<ParamDef[]>([
    { id: 'targetLabel', label: '目标标签', type: 'string', default: '', editable: true },
  ])

  const [code, setCode] = useState(DEFAULT_USER_CODE)
  const [showPreview, setShowPreview] = useState(false)
  const [error, setError] = useState('')

  const validation = validateCode(code)

  const addInput = useCallback(() => {
    const id = `in_${Date.now().toString(36).slice(-4)}`
    setInputs((prev) => [...prev, { id, label: `输入${prev.length + 1}`, type: 'label' }])
  }, [])

  const addOutput = useCallback(() => {
    const id = `out_${Date.now().toString(36).slice(-4)}`
    setOutputs((prev) => [...prev, { id, label: `输出${prev.length + 1}`, type: 'signal' }])
  }, [])

  const addParam = useCallback(() => {
    const id = `param_${Date.now().toString(36).slice(-4)}`
    setParams((prev) => [...prev, { id, label: `参数${prev.length + 1}`, type: 'string', default: '', editable: true }])
  }, [])

  const updatePort = <T extends PortDef>(
    list: T[],
    setList: (l: T[]) => void,
    idx: number,
    field: keyof T,
    value: string,
  ) => {
    const next = [...list]
    next[idx] = { ...next[idx], [field]: value }
    setList(next)
  }

  const removePort = <T extends PortDef>(list: T[], setList: (l: T[]) => void, idx: number) => {
    setList(list.filter((_, i) => i !== idx))
  }

  const updateParam = (idx: number, field: keyof ParamDef, value: string | number | boolean) => {
    const next = [...params]
    next[idx] = { ...next[idx], [field]: value }
    setParams(next)
  }

  const removeParam = (idx: number) => {
    setParams(params.filter((_, i) => i !== idx))
  }

  const handleCreate = () => {
    setError('')
    if (!name.trim()) {
      setError('请填写模块名称')
      return
    }
    if (!validation.ok) {
      setError(validation.reason ?? '代码不安全')
      return
    }
    if (outputs.length === 0) {
      setError('至少需要一个输出端口')
      return
    }

    try {
      // 尝试编译用户代码，验证语法
      new Function('inputs', 'params', `"use strict";\n${code}`)
    } catch (err) {
      setError(`代码语法错误：${(err as Error).message}`)
      return
    }

    const mod = addCustomModule({
      name: name.trim(),
      subtitle: subtitle.trim() || name.trim(),
      category,
      icon,
      accent,
      description: description.trim() || '用户自定义模块',
      inputs,
      outputs,
      params,
      userCode: code,
    })

    onCreated?.(mod)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative max-h-[88vh] w-[640px] overflow-hidden rounded-2xl bg-surface"
        style={{ border: '3px solid var(--ink)', boxShadow: '6px 6px 0 0 var(--ink)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 标题栏 */}
        <div
          className="flex items-center justify-between px-5 py-3.5"
          style={{ borderBottom: '2.5px solid var(--ink)', background: 'var(--amber)' + '1a' }}
        >
          <div className="flex items-center gap-2">
            <Code2 size={18} className="text-amber-dim" />
            <span className="handwritten text-[20px] font-bold text-ink">创建自定义 AI 模块</span>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 transition hover:bg-ink/10">
            <X size={18} className="text-text-dim" />
          </button>
        </div>

        {/* 内容 */}
        <div className="max-h-[calc(88vh-120px)] overflow-y-auto px-5 py-4">
          {/* 基本信息 */}
          <Section title="基本信息">
            <div className="grid grid-cols-2 gap-3">
              <Field label="模块名称">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="如：温度报警器"
                  className="input-field"
                />
              </Field>
              <Field label="中文副名">
                <input
                  value={subtitle}
                  onChange={(e) => setSubtitle(e.target.value)}
                  placeholder="如：当温度超限"
                  className="input-field"
                />
              </Field>
              <Field label="分类">
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as ModuleCategory)}
                  className="input-field"
                >
                  {CATEGORY_OPTIONS.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </Field>
              <Field label="简介">
                <input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="模块功能描述"
                  className="input-field"
                />
              </Field>
            </div>
            <div className="mt-3 flex items-center gap-4">
              <Field label="图标" inline>
                <select value={icon} onChange={(e) => setIcon(e.target.value)} className="input-field w-40">
                  {ICON_OPTIONS.map((ic) => (
                    <option key={ic} value={ic}>{ic}</option>
                  ))}
                </select>
              </Field>
              <Field label="主题色" inline>
                <div className="flex gap-1.5">
                  {ACCENT_OPTIONS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setAccent(c)}
                      className="h-7 w-7 rounded-full border-2 transition"
                      style={{
                        background: c,
                        borderColor: accent === c ? 'var(--ink)' : 'transparent',
                        transform: accent === c ? 'scale(1.15)' : 'scale(1)',
                      }}
                    />
                  ))}
                </div>
              </Field>
            </div>
          </Section>

          {/* 输入端口 */}
          <Section title={`输入端口 (${inputs.length})`}>
            <div className="space-y-2">
              {inputs.map((p, i) => (
                <PortRow
                  key={p.id}
                  port={p}
                  onChange={(field, val) => updatePort(inputs, setInputs, i, field, val)}
                  onRemove={() => removePort(inputs, setInputs, i)}
                />
              ))}
            </div>
            <AddButton onClick={addInput} label="添加输入端口" />
          </Section>

          {/* 输出端口 */}
          <Section title={`输出端口 (${outputs.length})`}>
            <div className="space-y-2">
              {outputs.map((p, i) => (
                <PortRow
                  key={p.id}
                  port={p}
                  onChange={(field, val) => updatePort(outputs, setOutputs, i, field, val)}
                  onRemove={() => removePort(outputs, setOutputs, i)}
                />
              ))}
            </div>
            <AddButton onClick={addOutput} label="添加输出端口" />
          </Section>

          {/* 参数 */}
          <Section title={`参数 (${params.length})`}>
            <div className="space-y-2">
              {params.map((p, i) => (
                <ParamRow
                  key={p.id}
                  param={p}
                  onChange={(field, val) => updateParam(i, field, val)}
                  onRemove={() => removeParam(i)}
                />
              ))}
            </div>
            <AddButton onClick={addParam} label="添加参数" />
          </Section>

          {/* 代码编辑器 */}
          <Section title="自定义代码">
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                {validation.ok ? (
                  <ShieldCheck size={14} className="text-green-sig" />
                ) : (
                  <ShieldAlert size={14} className="text-red-sig" />
                )}
                <span className={`chip font-bold ${validation.ok ? 'text-green-sig' : 'text-red-sig'}`}>
                  {validation.ok ? '安全检查通过' : validation.reason}
                </span>
              </div>
              <button
                onClick={() => setShowPreview((v) => !v)}
                className="flex items-center gap-1 chip text-text-faint transition hover:text-text-dim"
              >
                <Eye size={12} />
                {showPreview ? '隐藏预览' : '查看接口说明'}
              </button>
            </div>
            {showPreview && (
              <div
                className="mb-2 rounded-lg p-3 font-mono text-[11px] leading-relaxed text-text-dim"
                style={{ border: '1.5px dashed var(--border-bright)', background: 'var(--surface-2)' }}
              >
                <div className="font-bold text-text">可用变量：</div>
                <div>inputs — 输入端口数据包，如 inputs.label.value</div>
                <div>params — 模块参数，如 params.threshold</div>
                <div className="mt-1.5 font-bold text-text">返回值格式：</div>
                <div>{'{ outputs: { 端口ID: { type, value/active } }, message: "状态" }'}</div>
                <div className="mt-1.5 font-bold text-text">Packet 类型：</div>
                <div>label/text: {`{ type: 'label', value: '文字' }`}</div>
                <div>number/confidence: {`{ type: 'number', value: 42 }`}</div>
                <div>signal: {`{ type: 'signal', active: true/false }`}</div>
              </div>
            )}
            <textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              spellCheck={false}
              className="h-[240px] w-full resize-none rounded-lg p-3 font-mono text-[12px] leading-relaxed text-text"
              style={{
                border: '2px solid var(--ink)',
                background: 'var(--surface-2)',
              }}
            />
          </Section>

          {/* 错误提示 */}
          {error && (
            <div
              className="mt-3 rounded-lg px-3 py-2 text-[12px] font-bold text-red-sig"
              style={{ border: '2px solid var(--red)', background: 'rgba(198,107,90,0.1)' }}
            >
              {error}
            </div>
          )}
        </div>

        {/* 底部操作 */}
        <div
          className="flex items-center justify-end gap-2 px-5 py-3"
          style={{ borderTop: '2.5px solid var(--ink)', background: 'var(--surface-2)' }}
        >
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 font-mono text-[12px] font-bold text-text-dim transition hover:bg-ink/5"
            style={{ border: '2px solid var(--ink)' }}
          >
            取消
          </button>
          <button
            onClick={handleCreate}
            disabled={!name.trim() || !validation.ok}
            className="flex items-center gap-1.5 rounded-lg px-4 py-2 font-mono text-[12px] font-bold text-surface transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
            style={{ border: '2px solid var(--ink)', background: 'var(--amber)', boxShadow: '2px 2px 0 0 var(--ink)' }}
          >
            <Plus size={14} />
            创建模块
          </button>
        </div>
      </div>
    </div>
  )
}

// -------------------- 子组件 --------------------

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <div className="mb-2 chip font-bold text-text-dim">{title}</div>
      {children}
    </div>
  )
}

function Field({ label, children, inline }: { label: string; children: React.ReactNode; inline?: boolean }) {
  return (
    <div className={inline ? 'flex items-center gap-2' : ''}>
      <label className={`chip text-text-faint ${inline ? '' : 'mb-1 block'}`}>{label}</label>
      {children}
    </div>
  )
}

function PortRow({
  port,
  onChange,
  onRemove,
}: {
  port: PortDef
  onChange: (field: keyof PortDef, value: string) => void
  onRemove: () => void
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        value={port.id}
        onChange={(e) => onChange('id', e.target.value)}
        className="input-field w-24 font-mono text-[11px]"
        placeholder="端口ID"
      />
      <input
        value={port.label}
        onChange={(e) => onChange('label', e.target.value)}
        className="input-field flex-1"
        placeholder="显示名"
      />
      <select
        value={port.type}
        onChange={(e) => onChange('type', e.target.value)}
        className="input-field w-28"
      >
        {DATA_TYPES.map((t) => (
          <option key={t} value={t}>{TYPE_LABELS[t]}</option>
        ))}
      </select>
      <button onClick={onRemove} className="rounded-md p-1 transition hover:bg-red-sig/15">
        <Trash2 size={14} className="text-text-faint" />
      </button>
    </div>
  )
}

function ParamRow({
  param,
  onChange,
  onRemove,
}: {
  param: ParamDef
  onChange: (field: keyof ParamDef, value: string | number | boolean) => void
  onRemove: () => void
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        value={param.id}
        onChange={(e) => onChange('id', e.target.value)}
        className="input-field w-24 font-mono text-[11px]"
        placeholder="参数ID"
      />
      <input
        value={param.label}
        onChange={(e) => onChange('label', e.target.value)}
        className="input-field flex-1"
        placeholder="参数名"
      />
      <select
        value={param.type}
        onChange={(e) => onChange('type', e.target.value)}
        className="input-field w-24"
      >
        <option value="string">文本</option>
        <option value="number">数值</option>
      </select>
      <input
        value={String(param.default)}
        onChange={(e) => onChange('default', e.target.value)}
        className="input-field w-20"
        placeholder="默认值"
      />
      <button onClick={onRemove} className="rounded-md p-1 transition hover:bg-red-sig/15">
        <Trash2 size={14} className="text-text-faint" />
      </button>
    </div>
  )
}

function AddButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className="mt-2 flex w-full items-center justify-center gap-1 rounded-lg py-1.5 font-mono text-[11px] font-bold text-text-faint transition hover:text-text-dim"
      style={{ border: '1.5px dashed var(--border-bright)' }}
    >
      <Plus size={12} />
      {label}
    </button>
  )
}
