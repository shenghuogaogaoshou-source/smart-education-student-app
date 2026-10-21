import { AppPreferences } from '../../app/AppPreferences'
// ============================================================
// Toolbar —— 顶部工具栏：品牌 / 运行控制 / 模型状态 / 操作
// ============================================================
import { Play, Square, Trash2, Cpu, CircleCheck, CircleAlert, Loader2, Compass, ClipboardCheck } from 'lucide-react'
import { useCircuit } from '../../store/circuitStore'

interface ToolbarProps {
  onOpenLevels?: () => void
  onOpenWorks?: () => void
}

export function Toolbar({ onOpenLevels, onOpenWorks }: ToolbarProps) {
  const running = useCircuit((s) => s.running)
  const setRunning = useCircuit((s) => s.setRunning)
  const resetCircuit = useCircuit((s) => s.resetCircuit)
  const modelStatus = useCircuit((s) => s.modelStatus)
  const engine = useCircuit((s) => s.engine)
  const nodes = useCircuit((s) => s.nodes)
  const edges = useCircuit((s) => s.edges)

  return (
    <header className="app-toolbar lab-aurora relative z-20 flex h-14 items-center gap-4 border-b-[2.5px] border-ink bg-surface/80 px-4 backdrop-blur">
      {/* 品牌 */}
      <div className="flex items-center gap-2.5">
        <div
          className="grid h-9 w-9 place-items-center rounded-lg"
          style={{ border: '2.5px solid var(--ink)', background: 'var(--amber)' }}
        >
          <svg width="18" height="18" viewBox="0 0 32 32" fill="none">
            <rect x="6" y="6" width="7" height="7" rx="2" stroke="#2a2415" strokeWidth="2" />
            <rect x="19" y="6" width="7" height="7" rx="2" stroke="#2a2415" strokeWidth="2" />
            <rect x="6" y="19" width="7" height="7" rx="2" stroke="#2a2415" strokeWidth="2" />
            <rect x="19" y="19" width="7" height="7" rx="2" stroke="#2a2415" strokeWidth="2" />
            <circle cx="16" cy="16" r="2.4" fill="#2a2415" />
          </svg>
        </div>
        <div className="leading-tight">
          <div className="handwritten text-[22px] font-bold leading-none text-ink">
            AI Circuit <span className="text-amber-dim">Lab</span>
          </div>
          <div className="chip text-text-faint">AI 数字电路实验室</div>
        </div>
      </div>

      <div className="h-7 w-[2.5px] bg-ink" />

      {/* 进入关卡探险 */}
      {onOpenLevels && (
        <button
          onClick={onOpenLevels}
          className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-mono text-[12px] font-bold text-ink transition hover:brightness-95"
          style={{
            border: '2.5px solid var(--ink)',
            background: 'var(--green)',
            boxShadow: '2px 2px 0 0 var(--ink)',
          }}
          title="进入关卡探险：5 个递进式 AI 学习关卡"
        >
          <Compass size={13} />
          关卡探险
        </button>
      )}

      {onOpenWorks && (
        <button
          onClick={onOpenWorks}
          className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-mono text-[12px] font-bold text-ink transition hover:brightness-95"
          style={{
            border: '2.5px solid var(--ink)',
            background: 'var(--cyan)',
            boxShadow: '2px 2px 0 0 var(--ink)',
          }}
        >
          <ClipboardCheck size={13} />
          作品与导出
        </button>
      )}

      {/* 运行控制 */}
      <button
        onClick={() => setRunning(!running)}
        className="flex items-center gap-2 rounded-lg px-3 py-1.5 font-mono text-[13px] font-bold transition-all"
        style={{
          border: '2.5px solid var(--ink)',
          background: running ? 'rgba(198,107,90,0.2)' : 'rgba(138,171,110,0.2)',
          color: running ? 'var(--red)' : 'var(--green)',
          boxShadow: '3px 3px 0 0 var(--ink)',
        }}
      >
        {running ? <Square size={13} /> : <Play size={13} />}
        {running ? '停止' : '运行'}
      </button>

      {/* 模型状态 */}
      <ModelBadge status={modelStatus} engine={engine} />

      {/* 右侧统计 + 清空 */}
      <div className="ml-auto flex items-center gap-4">
        <AppPreferences storageKey="circuit-appearance" />
        <div className="flex items-center gap-3 font-mono text-[12px] text-text-dim">
          <span>
            <span className="text-text-faint">节点</span> {nodes.length}
          </span>
          <span>
            <span className="text-text-faint">连线</span> {edges.length}
          </span>
        </div>
        <button
          onClick={() => {
            if (confirm('清空当前电路？所有节点和连线将被移除。')) {
              // 用 resetCircuit 而不是裸 setState：它还会停止运行并清理求值器状态，
              // 否则清空后仍处于 running，自动保存会被跳过、刷新后旧电路又回来了
              resetCircuit()
            }
          }}
          className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-mono text-[12px] text-text-dim transition hover:text-red-sig"
          style={{ border: '2px solid var(--ink)', boxShadow: '2px 2px 0 0 var(--ink)', background: 'var(--surface)' }}
        >
          <Trash2 size={12} />
          清空
        </button>
      </div>
    </header>
  )
}

function ModelBadge({
  status,
  engine,
}: {
  status: 'idle' | 'loading' | 'ready' | 'error'
  engine: 'coco-ssd' | 'none'
}) {
  const readyLabel = engine === 'coco-ssd' ? 'COCO-SSD 目标检测就绪' : '就绪'
  const readyColor = engine === 'coco-ssd' ? '#d4a04a' : '#9a8a6a'
  const map = {
    idle: { icon: Cpu, color: '#9a8a6a', label: '引擎初始化…' },
    loading: { icon: Loader2, color: '#d4a04a', label: '加载 COCO-SSD…' },
    ready: { icon: CircleCheck, color: readyColor, label: readyLabel },
    error: { icon: CircleAlert, color: '#c66b5a', label: 'COCO-SSD 加载失败' },
  }[status]
  const Icon = map.icon
  return (
    <div
      className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-mono text-[12px] font-semibold"
      style={{
        border: '2px solid var(--ink)',
        color: map.color,
        background: `${map.color}18`,
        boxShadow: '2px 2px 0 0 var(--ink)',
      }}
      title={engine === 'coco-ssd' ? '真实 COCO-SSD 模型在浏览器本地推理 · 数据不离开设备' : '引擎未就绪'}
    >
      <Icon size={13} className={status === 'loading' ? 'spin-slow' : ''} />
      {map.label}
    </div>
  )
}
