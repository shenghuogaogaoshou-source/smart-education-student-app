// ============================================================
// ImageInputNode —— 静态图片输入
// 上传图片 → 绘制到 canvas → emitPacket 推入电路（与摄像头同 image 类型）
// ============================================================
import { useEffect, useRef, useState } from 'react'
import { memo } from 'react'
import { NodeProps } from 'reactflow'
import { ImagePlus, Upload, RefreshCw } from 'lucide-react'
import { NodeShell } from './NodeShell'
import { getModule } from '../../lib/moduleRegistry'
import { useCircuit } from '../../store/circuitStore'
import type { CircuitNodeData } from '../../types/circuit'

// 内置示例图（picsum 随机图，作为无上传时的默认输入）
const SAMPLE_IMAGES = [
  'https://picsum.photos/seed/cat/240/180',
  'https://picsum.photos/seed/dog/240/180',
  'https://picsum.photos/seed/flower/240/180',
]

function ImageInputNodeComp({ id, data, selected }: NodeProps<CircuitNodeData>) {
  const module = getModule(data.moduleType)!
  const running = useCircuit((s) => s.running)
  const emitPacket = useCircuit((s) => s.emitPacket)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [loaded, setLoaded] = useState(false)
  const [sampleIdx, setSampleIdx] = useState(0)

  // 把一张图绘制到 canvas
  const drawImage = (src: string) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const c = canvasRef.current
      if (!c) return
      const ctx = c.getContext('2d')
      if (!ctx) return
      // 等比裁剪填充
      const cr = c.width / c.height
      const ir = img.width / img.height
      let sw = img.width, sh = img.height, sx = 0, sy = 0
      if (ir > cr) { sw = img.height * cr; sx = (img.width - sw) / 2 }
      else { sh = img.width / cr; sy = (img.height - sh) / 2 }
      ctx.clearRect(0, 0, c.width, c.height)
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, c.width, c.height)
      setLoaded(true)
      if (running) {
        emitPacket(id, 'image', { type: 'image', canvas: c, ts: Date.now() })
      }
    }
    img.onerror = () => setLoaded(false)
    img.src = src
  }

  // 首次挂载加载示例图
  useEffect(() => {
    drawImage(SAMPLE_IMAGES[0])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // running 切换为 true 时重新发出当前图
  useEffect(() => {
    if (running && loaded) {
      const c = canvasRef.current
      if (c) emitPacket(id, 'image', { type: 'image', canvas: c, ts: Date.now() })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running])

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => drawImage(reader.result as string)
    reader.readAsDataURL(file)
  }

  const nextSample = () => {
    const next = (sampleIdx + 1) % SAMPLE_IMAGES.length
    setSampleIdx(next)
    drawImage(SAMPLE_IMAGES[next])
  }

  const status = loaded ? (running ? 'running' : 'ready') : 'idle'

  return (
    <NodeShell module={module} selected={selected} status={status}>
      <div className="space-y-2">
        {/* 图片预览 */}
        <div
          className="relative aspect-[4/3] w-full overflow-hidden rounded-lg"
          style={{ border: '2px solid var(--ink)', background: 'var(--surface-3)' }}
        >
          <canvas ref={canvasRef} width={224} height={168} className="h-full w-full object-cover" />
          {!loaded && (
            <div className="absolute inset-0 grid place-items-center">
              <ImagePlus size={22} className="text-text-faint" />
            </div>
          )}
          {loaded && running && (
            <div className="pointer-events-none absolute right-1 top-1 rounded px-1.5 py-0.5 chip font-bold text-cyan-sig"
              style={{ background: 'rgba(253,246,227,0.9)', border: '1.5px solid var(--ink)' }}
            >
              输出中
            </div>
          )}
        </div>

        {/* 操作按钮 */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => fileRef.current?.click()}
            className="flex flex-1 items-center justify-center gap-1 rounded-md px-2 py-1.5 font-mono text-[11px] font-bold text-text-dim transition hover:text-cyan-sig"
            style={{ border: '1.5px solid var(--ink)', background: 'var(--surface-2)' }}
          >
            <Upload size={12} />
            上传图片
          </button>
          <button
            onClick={nextSample}
            className="flex items-center justify-center gap-1 rounded-md px-2 py-1.5 font-mono text-[11px] font-bold text-text-dim transition hover:text-cyan-sig"
            style={{ border: '1.5px solid var(--ink)', background: 'var(--surface-2)' }}
          >
            <RefreshCw size={12} />
            换示例
          </button>
        </div>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />

        <div className="flex items-center justify-between">
          <span className="chip text-text-faint">
            {loaded ? (running ? '正在输出图像' : '已就绪') : '未加载'}
          </span>
        </div>
      </div>
    </NodeShell>
  )
}

export const ImageInputNode = memo(ImageInputNodeComp)
