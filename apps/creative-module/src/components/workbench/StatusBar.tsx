// ============================================================
// StatusBar —— 底部状态栏：链路状态 / 实时检测 / 提示
// ============================================================
import { Activity, Camera, Sun, GitBranch, Lightbulb, Circle } from 'lucide-react'
import { useCircuit } from '../../store/circuitStore'
import { isSignalActive } from '../../types/circuit'

export function StatusBar() {
  const running = useCircuit((s) => s.running)
  const nodes = useCircuit((s) => s.nodes)
  const modelStatus = useCircuit((s) => s.modelStatus)
  const modelMessage = useCircuit((s) => s.modelMessage)

  // 找到各关键节点的实时状态
  const cam = nodes.find((n) => n.data.moduleType === 'camera')
  const sensor = nodes.find((n) => n.data.moduleType === 'imageClassifier')
  const ifN = nodes.find((n) => n.data.moduleType === 'if')
  const out = nodes.find((n) => n.data.moduleType === 'output')

  const brightnessPct = sensor?.data.aiState?.brightnessPct as number | undefined
  const sensorLabel = sensor?.data.aiState?.label as string | undefined
  const sigActive = isSignalActive(out?.data.inputs.signal)
  const ifTriggered = isSignalActive(ifN?.data.outputs.signal)

  // 感光器状态显示文案
  const sensorText = brightnessPct !== undefined
    ? `${sensorLabel ?? ''} ${brightnessPct}%`
    : '感光'

  return (
    <footer className="app-status flex h-9 items-center gap-4 border-t-[2.5px] border-ink bg-surface/80 px-4 font-mono text-[11px] text-text-dim backdrop-blur">
      <div className="flex items-center gap-1.5">
        <Activity size={12} className={running ? 'text-green-sig blink' : 'text-text-faint'} />
        <span className={running ? 'font-bold text-green-sig' : 'text-text-faint'}>
          {running ? '运行中' : '已停止'}
        </span>
      </div>

      <div className="h-4 w-[2px] bg-ink/40" />

      {/* 链路实时状态 */}
      <ChainItem icon={Camera} color="#6ba3c3" label="摄像头" on={!!cam} active={running && !!cam} />
      <ChainArrow />
      <ChainItem
        icon={Sun}
        color="#d4a04a"
        label={sensorText}
        on={!!sensor}
        active={sensor?.data.aiState?.status === 'running'}
      />
      <ChainArrow />
      <ChainItem
        icon={GitBranch}
        color="#8aab6e"
        label={ifTriggered ? '触发' : '未触发'}
        on={!!ifN}
        active={ifTriggered}
      />
      <ChainArrow />
      <ChainItem icon={Lightbulb} color="#d4825a" label={sigActive ? '亮灯' : '灭灯'} on={!!out} active={sigActive} />

      <div className="ml-auto flex items-center gap-4">
        {modelStatus === 'ready' && modelMessage && (
          <span className="flex items-center gap-1.5 text-text-faint">
            <Circle size={7} className="fill-green-sig text-green-sig" />
            {modelMessage}
          </span>
        )}
        {modelStatus === 'loading' && (
          <span className="flex items-center gap-1.5 text-amber-dim">
            <Circle size={7} className="fill-amber text-amber blink" />
            {modelMessage || '模型加载中…'}
          </span>
        )}
        {modelStatus === 'error' && (
          <span
            className="flex max-w-[280px] items-center gap-1.5 text-red-sig"
            title={modelMessage}
          >
            <Circle size={7} className="fill-red-sig text-red-sig" />
            <span className="truncate">目标检测不可用：模型未加载</span>
          </span>
        )}
        <span className="text-text-faint">
          提示：点击市场添加模块 · 长按元件查看详情
        </span>
      </div>
    </footer>
  )
}

function ChainItem({
  icon: Icon,
  color,
  label,
  on,
  active,
}: {
  icon: typeof Camera
  color: string
  label: string
  on: boolean
  active: boolean
}) {
  return (
    <span className="flex items-center gap-1.5" style={{ color: on ? (active ? color : '#6b5d3f') : '#9a8a6a' }}>
      <Icon size={12} style={{ opacity: on ? 1 : 0.4 }} className={active ? 'blink' : ''} />
      <span className="font-semibold" style={{ opacity: on ? 1 : 0.6 }}>{on ? label : '—'}</span>
    </span>
  )
}

function ChainArrow() {
  return <span className="text-text-faint">→</span>
}
