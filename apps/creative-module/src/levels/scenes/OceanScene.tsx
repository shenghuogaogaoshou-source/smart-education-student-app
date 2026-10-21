// ============================================================
// OceanScene —— 关卡1 海洋场景（真实图片滚动版）
// 真实鱼/海洋垃圾照片以传送带方式从右滑入"抓取区"，
// 场景相机采集画面 → 垃圾分类器(COCO-SSD)识别 → 机械臂抓取/放行
// 暴露 canvas 给场景相机节点，暴露 onArmSignal 给机械臂节点
// ============================================================
import { useEffect, useRef, useCallback, memo } from 'react'
import type { LevelStats } from '../types'

interface OceanSceneProps {
  running: boolean
  /** 场景 canvas 就绪回调 */
  onCanvasReady: (canvas: HTMLCanvasElement) => void
  /** 机械臂信号处理器就绪回调 */
  onArmSignalReady: (handler: (active: boolean) => void) => void
  /** 统计变化回调 */
  onStatsChange: (stats: LevelStats) => void
}

// 真实图片清单（已知 ground-truth，仅用于计分；分类器本身不知道标签）
const IMAGE_MANIFEST = [
  { src: '/images/ocean/fish_1.jpg', kind: '鱼' },
  { src: '/images/ocean/fish_2.jpg', kind: '鱼' },
  { src: '/images/ocean/fish_3.jpg', kind: '鱼' },
  { src: '/images/ocean/fish_4.jpg', kind: '鱼' },
  { src: '/images/ocean/trash_1.jpg', kind: '垃圾' },
  { src: '/images/ocean/trash_2.jpg', kind: '垃圾' },
  { src: '/images/ocean/trash_3.jpg', kind: '垃圾' },
  { src: '/images/ocean/trash_4.jpg', kind: '垃圾' },
]

// ---- 时序参数（秒）----
const ENTER_DURATION = 0.4 // 图片滑入耗时
const HOLD_DURATION = 3.0 // 图片停留抓取区耗时
const ARM_IGNORE = 1.5 // 停留前 N 秒忽略机械臂信号（等待相机采集+分类器重评估）
const LEAVE_DURATION = 0.4 // 图片离场耗时

// ---- 画布尺寸 ----
const CW = 640
const CH = 360
// 图片绘制尺寸（16:9）
const IMG_W = 500
const IMG_H = 281
// 图片停留时中心 x（相对画布宽度）
const HOLD_X = 0.5

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// roundRect 兼容：部分浏览器无原生 CanvasRenderingContext2D.roundRect
function pathRoundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  if (typeof (ctx as unknown as { roundRect?: unknown }).roundRect === 'function') {
    ;(ctx as CanvasRenderingContext2D).roundRect(x, y, w, h, r)
    return
  }
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

interface CurrentItem {
  img: HTMLImageElement
  kind: string
}

function OceanSceneComp({ running, onCanvasReady, onArmSignalReady, onStatsChange }: OceanSceneProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const imagesRef = useRef<HTMLImageElement[]>([])
  const loadedRef = useRef(false)
  const queueRef = useRef<number[]>([])
  const queuePosRef = useRef(0)
  const currentRef = useRef<CurrentItem | null>(null)
  const phaseRef = useRef<'entering' | 'holding' | 'leaving'>('entering')
  const phaseTimeRef = useRef(0)
  const imageXRef = useRef(1.3)
  const armActiveRef = useRef(false)
  const armExtendRef = useRef(0)
  const grabbedRef = useRef(false)
  const leaveModeRef = useRef<'grabbed' | 'passed'>('passed')
  const resultRef = useRef<'correct' | 'wrong' | 'miss' | null>(null)
  const statsRef = useRef<LevelStats>({ correct: 0, wrong: 0, missed: 0, total: 0, handled: 0 })
  const rafRef = useRef<number | null>(null)
  const lastTimeRef = useRef(0)

  // 用 ref 存储回调，避免主循环 useEffect 因回调引用变化而频繁重启
  const onStatsChangeRef = useRef(onStatsChange)
  onStatsChangeRef.current = onStatsChange
  const onCanvasReadyRef = useRef(onCanvasReady)
  onCanvasReadyRef.current = onCanvasReady
  const onArmSignalReadyRef = useRef(onArmSignalReady)
  onArmSignalReadyRef.current = onArmSignalReady

  // 暴露机械臂信号处理器（仅挂载时执行一次）
  useEffect(() => {
    onArmSignalReadyRef.current((active: boolean) => {
      armActiveRef.current = active
    })
  }, [])

  // 暴露 canvas（仅挂载时执行一次）
  useEffect(() => {
    if (canvasRef.current) onCanvasReadyRef.current(canvasRef.current)
  }, [])

  // 加载真实图片
  useEffect(() => {
    if (loadedRef.current) return
    loadedRef.current = true
    Promise.all(
      IMAGE_MANIFEST.map(
        (m) =>
          new Promise<HTMLImageElement>((resolve) => {
            const img = new Image()
            img.onload = () => resolve(img)
            img.onerror = () => resolve(img) // 失败也 resolve，避免阻塞流程
            img.src = m.src
          }),
      ),
    ).then((imgs) => {
      imagesRef.current = imgs
    })
  }, [])

  // 选取下一张图片
  const pickNext = useCallback(() => {
    const imgs = imagesRef.current
    if (imgs.length === 0) {
      currentRef.current = null
      return
    }
    if (queueRef.current.length === 0 || queuePosRef.current >= queueRef.current.length) {
      queueRef.current = shuffle(imgs.map((_, i) => i))
      queuePosRef.current = 0
    }
    const idx = queueRef.current[queuePosRef.current++]
    currentRef.current = { img: imgs[idx], kind: IMAGE_MANIFEST[idx].kind }
    grabbedRef.current = false
    resultRef.current = null
    statsRef.current.total++
  }, [])

  // 绘制函数
  const draw = useCallback((ctx: CanvasRenderingContext2D) => {
    const w = CW
    const h = CH

    // 海水背景（水彩蓝渐变）
    const grad = ctx.createLinearGradient(0, 0, 0, h)
    grad.addColorStop(0, '#a8d4e8')
    grad.addColorStop(0.5, '#7ab8d4')
    grad.addColorStop(1, '#5a9ec4')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, w, h)

    // 波浪纹理
    ctx.strokeStyle = 'rgba(255,255,255,0.18)'
    ctx.lineWidth = 1.5
    const t = Date.now() / 1000
    for (let i = 0; i < 4; i++) {
      ctx.beginPath()
      const yBase = h * (0.12 + i * 0.24)
      for (let x = 0; x <= w; x += 8) {
        const y = yBase + Math.sin(x * 0.02 + t * 1.2 + i) * 4
        if (x === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()
    }

    // 当前图片
    const cur = currentRef.current
    if (cur && cur.img.complete && cur.img.naturalWidth > 0) {
      const cx = imageXRef.current * w
      let dw = IMG_W
      let dh = IMG_H
      // 被抓离场时缩小
      if (phaseRef.current === 'leaving' && leaveModeRef.current === 'grabbed') {
        const p = Math.min(1, phaseTimeRef.current / LEAVE_DURATION)
        dw = IMG_W * (1 - p * 0.45)
        dh = IMG_H * (1 - p * 0.45)
      }
      const dx = cx - dw / 2
      const dy = h / 2 - dh / 2

      // 照片白框（手绘纸质感）
      ctx.fillStyle = '#fdf6e3'
      ctx.strokeStyle = '#3d3422'
      ctx.lineWidth = 2.5
      const pad = 6
      ctx.beginPath()
      pathRoundRect(ctx, dx - pad, dy - pad, dw + pad * 2, dh + pad * 2, 8)
      ctx.fill()
      ctx.stroke()

      // 图片本体
      ctx.save()
      ctx.beginPath()
      pathRoundRect(ctx, dx, dy, dw, dh, 4)
      ctx.clip()
      ctx.drawImage(cur.img, dx, dy, dw, dh)
      ctx.restore()

      // 取景器四角L标
      ctx.strokeStyle = 'rgba(58,52,34,0.55)'
      ctx.lineWidth = 2
      const cl = 14
      const corners: [number, number, number, number][] = [
        [dx, dy, 1, 1],
        [dx + dw, dy, -1, 1],
        [dx, dy + dh, 1, -1],
        [dx + dw, dy + dh, -1, -1],
      ]
      for (const [px, py, sx, sy] of corners) {
        ctx.beginPath()
        ctx.moveTo(px, py + sy * cl)
        ctx.lineTo(px, py)
        ctx.lineTo(px + sx * cl, py)
        ctx.stroke()
      }

      // 结果标记
      if (resultRef.current) {
        const mc =
          resultRef.current === 'correct'
            ? '#8aab6e'
            : resultRef.current === 'wrong'
              ? '#c66b5a'
              : '#d4a04a'
        ctx.fillStyle = mc
        ctx.font = 'bold 30px sans-serif'
        ctx.textAlign = 'center'
        const mark = resultRef.current === 'correct' ? '✓' : resultRef.current === 'wrong' ? '✗' : '!'
        ctx.fillText(mark, cx, dy - 14)
      }
    } else if (!cur) {
      ctx.fillStyle = 'rgba(58,52,34,0.5)'
      ctx.font = 'bold 16px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('加载真实海洋照片中…', w / 2, h / 2)
    }

    // 清理机器人底座（左侧）
    const baseX = w * 0.05
    const baseY = h * 0.5
    ctx.fillStyle = '#7a6a4a'
    ctx.strokeStyle = '#3d3422'
    ctx.lineWidth = 2.5
    ctx.beginPath()
    pathRoundRect(ctx, baseX - 18, baseY - 22, 36, 44, 6)
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = '#3d3422'
    ctx.beginPath()
    ctx.arc(baseX, baseY - 8, 4, 0, Math.PI * 2)
    ctx.fill()

    // 机械臂（伸出动画）
    const extend = armExtendRef.current
    if (extend > 0.01) {
      const armLen = extend * 52
      ctx.strokeStyle = '#7a6a4a'
      ctx.lineWidth = 5
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(baseX + 8, baseY)
      ctx.lineTo(baseX + 8 + armLen, baseY)
      ctx.stroke()
      // 抓取爪
      ctx.lineWidth = 3
      const clawX = baseX + 8 + armLen
      ctx.beginPath()
      ctx.moveTo(clawX, baseY - 6)
      ctx.lineTo(clawX + 8, baseY - 10)
      ctx.moveTo(clawX, baseY + 6)
      ctx.lineTo(clawX + 8, baseY + 10)
      ctx.stroke()
    }
  }, [])

  // 主循环
  useEffect(() => {
    if (!running) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      return
    }

    // 运行开始：重置状态
    statsRef.current = { correct: 0, wrong: 0, missed: 0, total: 0, handled: 0 }
    queueRef.current = []
    queuePosRef.current = 0
    currentRef.current = null
    phaseRef.current = 'entering'
    phaseTimeRef.current = 0
    imageXRef.current = 1.3
    grabbedRef.current = false
    resultRef.current = null
    onStatsChangeRef.current({ ...statsRef.current })

    lastTimeRef.current = performance.now()

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - lastTimeRef.current) / 1000)
      lastTimeRef.current = now

      const canvas = canvasRef.current
      if (!canvas) {
        rafRef.current = requestAnimationFrame(tick)
        return
      }
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        rafRef.current = requestAnimationFrame(tick)
        return
      }

      // 图片未加载完：仅绘制背景+加载提示
      if (imagesRef.current.length === 0) {
        draw(ctx)
        rafRef.current = requestAnimationFrame(tick)
        return
      }

      // 无当前图片则选取
      if (!currentRef.current) pickNext()

      phaseTimeRef.current += dt

      // 机械臂伸出插值
      const targetExtend = armActiveRef.current ? 1 : 0
      armExtendRef.current += (targetExtend - armExtendRef.current) * 0.2

      let statsChanged = false

      switch (phaseRef.current) {
        case 'entering': {
          const p = Math.min(1, phaseTimeRef.current / ENTER_DURATION)
          imageXRef.current = 1.3 + (HOLD_X - 1.3) * p
          if (p >= 1) {
            phaseRef.current = 'holding'
            phaseTimeRef.current = 0
          }
          break
        }
        case 'holding': {
          imageXRef.current = HOLD_X
          // 前 ARM_IGNORE 秒忽略信号（等待相机采集 + 分类器重新评估当前画面）
          if (phaseTimeRef.current > ARM_IGNORE && armActiveRef.current && !grabbedRef.current) {
            // 抓取
            grabbedRef.current = true
            const cur = currentRef.current!
            if (cur.kind === '垃圾') {
              resultRef.current = 'correct'
              statsRef.current.correct++
            } else {
              resultRef.current = 'wrong'
              statsRef.current.wrong++
            }
            statsRef.current.handled++
            statsChanged = true
            phaseRef.current = 'leaving'
            leaveModeRef.current = 'grabbed'
            phaseTimeRef.current = 0
          } else if (phaseTimeRef.current >= HOLD_DURATION && !grabbedRef.current) {
            // 超时放行
            const cur = currentRef.current!
            if (cur.kind === '垃圾') {
              resultRef.current = 'miss'
              statsRef.current.missed++
            } else {
              // 鱼放行是正确的
              resultRef.current = 'correct'
              statsRef.current.correct++
            }
            statsRef.current.handled++
            statsChanged = true
            phaseRef.current = 'leaving'
            leaveModeRef.current = 'passed'
            phaseTimeRef.current = 0
          }
          break
        }
        case 'leaving': {
          const p = Math.min(1, phaseTimeRef.current / LEAVE_DURATION)
          if (leaveModeRef.current === 'grabbed') {
            // 被抓：移向机械臂（左侧）
            imageXRef.current = HOLD_X + (0.08 - HOLD_X) * p
          } else {
            // 放行：滑出左侧
            imageXRef.current = HOLD_X + (-0.3 - HOLD_X) * p
          }
          if (p >= 1) {
            pickNext()
            phaseRef.current = 'entering'
            phaseTimeRef.current = 0
            imageXRef.current = 1.3
          }
          break
        }
      }

      draw(ctx)

      if (statsChanged) {
        onStatsChangeRef.current({ ...statsRef.current })
      }

      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [running, draw, pickNext])

  return (
    <div className="relative h-full w-full">
      <canvas
        ref={canvasRef}
        width={CW}
        height={CH}
        className="h-full w-full"
        style={{ imageRendering: 'auto' }}
      />
    </div>
  )
}

export const OceanScene = memo(OceanSceneComp)
