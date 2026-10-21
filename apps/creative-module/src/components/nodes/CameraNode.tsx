// ============================================================
// CameraNode —— 真实摄像头 / 屏幕共享采集
// 摄像头：getUserMedia(video) ｜ 屏幕：getDisplayMedia()
// 采集 → canvas → emitPacket；支持 Picture-in-Picture 小窗监视屏幕
// ============================================================
import { useEffect, useRef, useState } from 'react'
import { memo } from 'react'
import { NodeProps } from 'reactflow'
import {
  Camera,
  CameraOff,
  AlertTriangle,
  Loader2,
  Monitor,
  PictureInPicture2,
  Square,
} from 'lucide-react'
import { NodeShell } from './NodeShell'
import { getModule } from '../../lib/moduleRegistry'
import { useCircuit } from '../../store/circuitStore'
import { FloatMonitor } from './FloatMonitor'
import type { CircuitNodeData } from '../../types/circuit'

type Source = 'camera' | 'screen'

function CameraNodeComp({ id, data, selected }: NodeProps<CircuitNodeData>) {
  const module = getModule(data.moduleType)!
  const running = useCircuit((s) => s.running)
  const emitPacket = useCircuit((s) => s.emitPacket)

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const timerRef = useRef<number | null>(null)
  // 已卸载标记：getUserMedia / getDisplayMedia 可能在卸载后才 resolve，
  // 此时若照常写入 streamRef 就再也没人 stop()，摄像头指示灯会长亮不灭
  const disposedRef = useRef(false)

  const [source, setSource] = useState<Source>('camera')
  const [camState, setCamState] = useState<'off' | 'starting' | 'on' | 'error'>('off')
  const [errMsg, setErrMsg] = useState('')
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [monitorOpen, setMonitorOpen] = useState(false)

  const fps = Number(data.params.fps ?? 2)

  const stopCam = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    setMonitorOpen(false)
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    setStream(null)
    if (videoRef.current) videoRef.current.srcObject = null
    setCamState('off')
  }

  const startCam = async (src: Source = source) => {
    setCamState('starting')
    setErrMsg('')
    // 切换源前先关掉旧的
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    try {
      let stream: MediaStream
      if (src === 'screen') {
        // 屏幕共享：getDisplayMedia
        stream = await navigator.mediaDevices.getDisplayMedia({
          video: { frameRate: 30 },
          audio: false,
        })
        // 用户在浏览器共享选择框里点了"停止共享" → 监听 track 结束
        stream.getVideoTracks()[0]?.addEventListener('ended', () => {
          stopCam()
        })
      } else {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 320, height: 240, facingMode: 'user' },
          audio: false,
        })
      }
      // 拿流的过程中节点可能已被删除 / 电路已清空：立刻把轨道关掉，绝不写进 streamRef
      if (disposedRef.current) {
        stream.getTracks().forEach((t) => t.stop())
        return
      }
      streamRef.current = stream
      setStream(stream)
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      if (disposedRef.current) {
        stream.getTracks().forEach((t) => t.stop())
        return
      }
      setCamState('on')
    } catch (e) {
      // 失败路径（如 video.play() 被拒）也必须先关掉已拿到的流，
      // 否则 streamRef 里留着一条活着的轨道，UI 却只显示错误、没有关闭入口
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
      if (videoRef.current) videoRef.current.srcObject = null
      if (disposedRef.current) return
      setStream(null)
      setCamState('error')
      setErrMsg((e as Error).message || '无法访问媒体设备')
    }
  }

  // 切换源：若正在运行则重启
  const switchSource = (src: Source) => {
    if (src === source) return
    setSource(src)
    if (camState === 'on' || camState === 'starting') {
      startCam(src)
    }
  }

  // 采集循环：仅在运行中 + 开启时
  useEffect(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    if (!running || camState !== 'on') return
    const interval = Math.max(80, 1000 / fps)
    const tick = () => {
      const v = videoRef.current
      const c = canvasRef.current
      if (!v || !c || v.readyState < 2) return
      const ctx = c.getContext('2d')
      if (!ctx) return
      // 镜像绘制（仅前置摄像头镜像，屏幕共享不镜像）
      ctx.save()
      if (source === 'camera') {
        ctx.translate(c.width, 0)
        ctx.scale(-1, 1)
      }
      ctx.drawImage(v, 0, 0, c.width, c.height)
      ctx.restore()
      emitPacket(id, 'image', { type: 'image', canvas: c, ts: Date.now() })
    }
    timerRef.current = window.setInterval(tick, interval)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, camState, fps, id, emitPacket, source])

  useEffect(() => {
    disposedRef.current = false
    return () => {
      disposedRef.current = true
      stopCam()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const status = camState === 'on' ? (running ? 'running' : 'ready') : camState === 'error' ? 'error' : 'idle'
  const accent = source === 'screen' ? 'var(--amber)' : 'var(--cyan)'

  return (
    <NodeShell module={module} selected={selected} status={status}>
      <div className="space-y-2">
        {/* 源切换 */}
        <div
          className="flex items-center gap-1 rounded-lg p-0.5"
          style={{ border: '1.5px solid var(--ink)', background: 'var(--surface-2)' }}
        >
          <button
            onClick={() => switchSource('camera')}
            className="flex flex-1 items-center justify-center gap-1 rounded-md py-1 font-mono text-[11px] font-bold transition"
            style={{
              background: source === 'camera' ? 'var(--surface)' : 'transparent',
              color: source === 'camera' ? 'var(--cyan)' : 'var(--text-faint)',
              border: source === 'camera' ? '1.5px solid var(--ink)' : '1.5px solid transparent',
            }}
          >
            <Camera size={12} />
            摄像头
          </button>
          <button
            onClick={() => switchSource('screen')}
            className="flex flex-1 items-center justify-center gap-1 rounded-md py-1 font-mono text-[11px] font-bold transition"
            style={{
              background: source === 'screen' ? 'var(--surface)' : 'transparent',
              color: source === 'screen' ? 'var(--amber)' : 'var(--text-faint)',
              border: source === 'screen' ? '1.5px solid var(--ink)' : '1.5px solid transparent',
            }}
          >
            <Monitor size={12} />
            屏幕共享
          </button>
        </div>

        {/* 预览 */}
        <div
          className="relative aspect-[4/3] w-full overflow-hidden rounded-lg"
          style={{ border: '2px solid var(--ink)', background: 'var(--surface-3)' }}
        >
          <video ref={videoRef} className="h-full w-full object-cover" playsInline muted />
          <canvas ref={canvasRef} width={224} height={224} className="hidden" />
          {camState !== 'on' && (
            <div className="absolute inset-0 grid place-items-center">
              {camState === 'starting' ? (
                <div className="flex flex-col items-center gap-2 text-text-dim">
                  <Loader2 size={22} className="spin-slow" />
                  <span className="chip">
                    {source === 'screen' ? '选择共享窗口…' : '连接摄像头…'}
                  </span>
                </div>
              ) : camState === 'error' ? (
                <div className="flex flex-col items-center gap-1.5 px-3 text-center">
                  <AlertTriangle size={20} className="text-red-sig" />
                  <span className="text-[12px] text-red-sig">{errMsg}</span>
                </div>
              ) : (
                <button
                  onClick={() => startCam()}
                  className="flex flex-col items-center gap-1.5 rounded-lg px-3 py-2 text-text-dim transition"
                  style={{ color: accent }}
                >
                  {source === 'screen' ? <Monitor size={22} /> : <Camera size={22} />}
                  <span className="chip">
                    {source === 'screen' ? '共享屏幕' : '启用摄像头'}
                  </span>
                </button>
              )}
            </div>
          )}
          {/* 扫描线效果 */}
          {camState === 'on' && running && (
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
              <div
                className="scanline absolute left-0 right-0 h-8"
                style={{
                  background: `linear-gradient(180deg, transparent, ${source === 'screen' ? 'rgba(212,160,74,0.22)' : 'rgba(107,163,195,0.22)'}, transparent)`,
                }}
              />
            </div>
          )}
          {/* 源标签 + 浮动监视窗按钮 */}
          {camState === 'on' && (
            <>
              <div
                className="pointer-events-none absolute left-1 top-1 flex items-center gap-1 rounded px-1.5 py-0.5 chip font-bold"
                style={{ background: 'rgba(253,246,227,0.9)', border: '1.5px solid var(--ink)', color: accent }}
              >
                {source === 'screen' ? <Monitor size={10} /> : <Camera size={10} />}
                {source === 'screen' ? 'SCREEN' : 'CAM'}
              </div>
              <button
                onClick={() => setMonitorOpen((v) => !v)}
                className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded transition"
                style={{
                  background: monitorOpen ? accent : 'rgba(253,246,227,0.9)',
                  border: '1.5px solid var(--ink)',
                  color: monitorOpen ? 'var(--surface)' : 'var(--text-dim)',
                }}
                title={monitorOpen ? '关闭浮动监视窗' : '浮动监视小窗'}
              >
                {monitorOpen ? <Square size={12} /> : <PictureInPicture2 size={12} />}
              </button>
              <Corner className="left-1 bottom-1" c={accent} />
              <Corner className="right-1 bottom-1 rotate-180" c={accent} />
            </>
          )}
        </div>

        {/* 状态行 */}
        <div className="flex items-center justify-between">
          <span className="chip text-text-faint">
            {camState === 'on'
              ? `${fps} fps · ${running ? '采集中' : '已就绪'}${monitorOpen ? ' · 监视中' : ''}`
              : '未连接'}
          </span>
          {camState === 'on' && (
            <button
              onClick={stopCam}
              className="flex items-center gap-1 rounded px-1.5 py-0.5 text-text-faint transition hover:text-red-sig"
            >
              <CameraOff size={12} />
              <span className="chip">关闭</span>
            </button>
          )}
        </div>
      </div>
      {monitorOpen && stream && (
        <FloatMonitor
          stream={stream}
          title={source === 'screen' ? '屏幕监视' : '摄像头监视'}
          accent={source === 'screen' ? '#d4a04a' : '#6ba3c3'}
          onClose={() => setMonitorOpen(false)}
        />
      )}
    </NodeShell>
  )
}

function Corner({ className = '', c }: { className?: string; c: string }) {
  return (
    <span
      className={`pointer-events-none absolute h-3 w-3 border-l-2 border-t-2 ${className}`}
      style={{ borderColor: c }}
    />
  )
}

export const CameraNode = memo(CameraNodeComp)
