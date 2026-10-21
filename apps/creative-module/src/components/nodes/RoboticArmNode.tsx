// ============================================================
// RoboticArmNode —— 机械臂
// 收到真信号时通知场景抓取，收到假信号时放行
// ============================================================
import { useEffect, memo } from 'react'
import { NodeProps } from 'reactflow'
import { Armchair } from 'lucide-react'
import { NodeShell } from './NodeShell'
import { getModule } from '../../lib/moduleRegistry'
import { isSignalActive, type CircuitNodeData } from '../../types/circuit'
import { useScene } from '../../levels/SceneContext'

void Armchair // icon 通过 module.icon 映射

function RoboticArmNodeComp({ data, selected }: NodeProps<CircuitNodeData>) {
  const module = getModule(data.moduleType)!
  const scene = useScene()
  const active = isSignalActive(data.inputs.signal)
  const hasInput = !!data.inputs.signal

  // 信号变化时通知场景
  useEffect(() => {
    if (hasInput && scene) {
      scene.onArmSignal(active)
    }
  }, [active, hasInput, scene])

  const status = hasInput ? (active ? 'running' : 'ready') : 'idle'

  return (
    <NodeShell module={module} selected={selected} status={status}>
      <div className="space-y-2">
        {/* 机械臂状态 */}
        <div
          className="grid h-[72px] place-items-center rounded-lg"
          style={{
            border: '2px solid var(--ink)',
            background: active ? 'rgba(212,130,90,0.18)' : 'var(--surface-3)',
          }}
        >
          <div className="flex flex-col items-center gap-1">
            <div
              className="grid h-9 w-9 place-items-center rounded-xl transition-transform"
              style={{
                background: active ? 'rgba(212,130,90,0.3)' : 'rgba(122,106,74,0.15)',
                border: '2px solid var(--ink)',
                transform: active ? 'rotate(-15deg) scale(1.1)' : 'rotate(0deg)',
              }}
            >
              <Armchair size={18} className={active ? 'text-orange-sig' : 'text-text-faint'} />
            </div>
            <span className="chip" style={{ color: active ? 'var(--orange)' : 'var(--text-faint)' }}>
              {active ? '抓取中' : hasInput ? '放行' : '等待信号'}
            </span>
          </div>
        </div>

        {/* 信号状态 */}
        <div
          className="flex items-center justify-center gap-2 rounded-md py-1.5 font-mono text-[12px] font-bold"
          style={{
            background: active ? 'rgba(138,171,110,0.18)' : 'rgba(198,107,90,0.12)',
            border: `2px solid ${active ? 'var(--green)' : 'var(--red)'}`,
            color: active ? 'var(--green)' : 'var(--red)',
          }}
        >
          {active ? '◉ 抓取 ON' : '◯ 待机 OFF'}
        </div>
      </div>
    </NodeShell>
  )
}

export const RoboticArmNode = memo(RoboticArmNodeComp)
