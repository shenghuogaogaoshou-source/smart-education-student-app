// ============================================================
// SceneCameraNode —— 关卡场景相机
// 从关卡场景 canvas 采集画面，按设定频率 emitPacket
// ============================================================
import { useEffect, useRef, memo } from 'react'
import { NodeProps } from 'reactflow'
import { Camera } from 'lucide-react'
import { NodeShell } from './NodeShell'
import { getModule } from '../../lib/moduleRegistry'
import { useCircuit } from '../../store/circuitStore'
import { useScene } from '../../levels/SceneContext'
import type { CircuitNodeData } from '../../types/circuit'

function SceneCameraNodeComp({ id, data, selected }: NodeProps<CircuitNodeData>) {
  const module = getModule(data.moduleType)!
  const running = useCircuit((s) => s.running)
  const emitPacket = useCircuit((s) => s.emitPacket)
  const scene = useScene()
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  const fps = Number(data.params.fps ?? 0.5)

  useEffect(() => {
    if (!running || !scene?.sceneCanvas) return
    // 离屏画布：把场景画面拷贝过来作为 image packet
    if (!canvasRef.current) {
      canvasRef.current = document.createElement('canvas')
      canvasRef.current.width = 320
      canvasRef.current.height = 180
    }
    const out = canvasRef.current
    const outCtx = out.getContext('2d')
    if (!outCtx) return

    let cancelled = false
    const interval = setInterval(() => {
      if (cancelled || !scene.sceneCanvas) return
      outCtx.drawImage(scene.sceneCanvas, 0, 0, out.width, out.height)
      emitPacket(id, 'image', {
        type: 'image',
        canvas: out,
        ts: Date.now(),
      })
    }, 1000 / fps)

    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [running, scene, id, emitPacket, fps])

  const status = running && scene?.sceneCanvas ? 'running' : 'idle'

  return (
    <NodeShell module={module} selected={selected} status={status}>
      <div className="space-y-2">
        {/* 场景预览 */}
        <div
          className="grid h-[72px] place-items-center rounded-lg"
          style={{ border: '2px solid var(--ink)', background: 'var(--surface-3)' }}
        >
          {scene?.sceneCanvas ? (
            <div className="flex flex-col items-center gap-1">
              <Camera size={20} className="text-cyan-sig" />
              <span className="chip text-text-faint">
                {running ? `采集中 · ${fps}帧/秒` : '已就绪'}
              </span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1">
              <Camera size={20} className="text-text-faint" />
              <span className="chip text-text-faint">等待场景</span>
            </div>
          )}
        </div>
        {/* 采样率显示 */}
        <div className="flex items-center justify-between">
          <span className="chip text-text-faint">采样率</span>
          <span className="font-mono text-[12px] font-bold text-cyan-sig">{fps} 帧/秒</span>
        </div>
      </div>
    </NodeShell>
  )
}

export const SceneCameraNode = memo(SceneCameraNodeComp)
