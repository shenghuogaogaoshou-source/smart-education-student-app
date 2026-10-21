// ============================================================
// FloatMonitor —— 可拖拽移动 + 可缩放尺寸的浮动监视小窗
// 通过 createPortal 渲染到 body，脱离 React Flow 画布层级
// 共享同一条 MediaStream，手绘水彩漫画风格
// ============================================================
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Move, Maximize2 } from 'lucide-react'

type Pos = { x: number; y: number }
type Size = { w: number; h: number }

interface Props {
  stream: MediaStream
  title: string
  accent: string // 主题色（摄像头=靛蓝 / 屏幕=姜黄）
  onClose: () => void
}

export function FloatMonitor({ stream, title, accent, onClose }: Props) {
  // 初始位置：屏幕右下角，留出边距
  const [pos, setPos] = useState<Pos>(() => ({
    x: window.innerWidth - 300,
    y: window.innerHeight - 320,
  }))
  // 初始尺寸
  const [size, setSize] = useState<Size>({ w: 264, h: 200 })

  const videoRef = useRef<HTMLVideoElement>(null)
  // 拖拽状态
  const dragRef = useRef<{ dx: number; dy: number } | null>(null)
  // 缩放状态
  const resizeRef = useRef<{ sw: number; sh: number; mx: number; my: number } | null>(null)

  // 把 stream 接到 video
  useEffect(() => {
    const v = videoRef.current
    if (v && v.srcObject !== stream) {
      v.srcObject = stream
      v.play().catch(() => {})
    }
  }, [stream])

  // 全局 mousemove/mouseup：拖拽 + 缩放
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (dragRef.current) {
        const nx = Math.max(0, Math.min(window.innerWidth - size.w, e.clientX - dragRef.current.dx))
        const ny = Math.max(0, Math.min(window.innerHeight - 40, e.clientY - dragRef.current.dy))
        setPos({ x: nx, y: ny })
      }
      if (resizeRef.current) {
        const dw = e.clientX - resizeRef.current.mx
        const dh = e.clientY - resizeRef.current.my
        setSize({
          w: Math.max(180, Math.min(window.innerWidth - pos.x - 8, resizeRef.current.sw + dw)),
          h: Math.max(140, Math.min(window.innerHeight - pos.y - 8, resizeRef.current.sh + dh)),
        })
      }
    }
    const onUp = () => {
      dragRef.current = null
      resizeRef.current = null
      document.body.style.userSelect = ''
      document.body.style.cursor = ''
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [size.w, pos.x, pos.y])

  const startDrag = (e: React.MouseEvent) => {
    dragRef.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y }
    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'grabbing'
  }

  const startResize = (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    resizeRef.current = { sw: size.w, sh: size.h, mx: e.clientX, my: e.clientY }
    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'nwse-resize'
  }

  return createPortal(
    <div
      style={{
        position: 'fixed',
        left: pos.x,
        top: pos.y,
        width: size.w,
        zIndex: 9999,
        border: '2.5px solid var(--ink)',
        borderRadius: '12px',
        boxShadow: '4px 4px 0 0 var(--ink)',
        background: 'var(--surface)',
        overflow: 'hidden',
      }}
    >
      {/* 标题栏 —— 可拖拽移动 */}
      <div
        onMouseDown={startDrag}
        className="flex cursor-grab items-center justify-between px-2.5 py-1.5 active:cursor-grabbing"
        style={{
          background: `linear-gradient(180deg, ${accent}26, ${accent}10)`,
          borderBottom: '2px solid var(--ink)',
        }}
      >
        <span className="flex items-center gap-1.5">
          <Move size={12} style={{ color: accent }} />
          <span className="handwritten text-[14px] font-bold text-ink">{title}</span>
        </span>
        <button
          onClick={onClose}
          className="grid h-5 w-5 place-items-center rounded text-text-faint transition hover:text-red-sig"
          style={{ border: '1.5px solid var(--ink)', background: 'var(--surface)' }}
        >
          <X size={11} />
        </button>
      </div>

      {/* 视频画面 */}
      <div style={{ height: size.h, background: 'var(--surface-3)' }}>
        <video
          ref={videoRef}
          className="h-full w-full object-cover"
          muted
          playsInline
          autoPlay
        />
      </div>

      {/* 底部信息 + 缩放手柄 */}
      <div
        className="flex items-center justify-between px-2 py-1"
        style={{ background: 'var(--surface-2)', borderTop: '2px solid var(--ink)' }}
      >
        <span className="chip font-mono text-text-faint">
          {size.w}×{size.h}
        </span>
        <span className="chip text-text-faint">拖边角缩放</span>
        <div
          onMouseDown={startResize}
          className="grid h-4 w-4 cursor-nwse-resize place-items-center"
          title="拖拽缩放"
        >
          <Maximize2 size={11} style={{ color: accent }} />
        </div>
      </div>

      {/* 右下角缩放热区（更大更易抓取） */}
      <div
        onMouseDown={startResize}
        style={{
          position: 'absolute',
          right: 0,
          bottom: 0,
          width: 18,
          height: 18,
          cursor: 'nwse-resize',
        }}
      />
    </div>,
    document.body,
  )
}
