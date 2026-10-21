// ============================================================
// TextDisplayNode —— 文字显示（带"小显示屏"硬件外观）
// 显示模式：气泡框 / 纯文字 / 打字机
// ============================================================
import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { NodeProps } from 'reactflow'
import { Monitor, MessageSquare, Type, PenLine } from 'lucide-react'
import { NodeShell } from './NodeShell'
import { getModule } from '../../lib/moduleRegistry'
import type { CircuitNodeData } from '../../types/circuit'

function TextDisplayNodeComp({ data, selected }: NodeProps<CircuitNodeData>) {
  const module = getModule(data.moduleType)!
  const inPkt = data.inputs.text
  const rawText = inPkt?.type === 'text' ? String(inPkt.value) : ''
  const maxChars = Math.max(1, Number(data.params.maxChars ?? 50))
  const displayMode = String(data.params.displayMode ?? 'bubble')
  const fontSize = Math.max(12, Math.min(72, Number(data.params.fontSize ?? 24)))
  const textColor = String(data.params.textColor ?? '#FFFFFF')
  const bgColor = String(data.params.bgColor ?? '#1A0F2E')
  const fontStyle = String(data.params.fontStyle ?? 'normal')
  const duration = Number(data.params.duration ?? 3)

  const showText = rawText.length > maxChars ? rawText.slice(0, maxChars) + '…' : rawText
  const [typedText, setTypedText] = useState('')
  const clearTimerRef = useRef<number | null>(null)
  const typeTimerRef = useRef<number | null>(null)
  const lastKeyRef = useRef('')

  // ---------- 显示内容的生命周期（打字机 / 定时消失） ----------
  useEffect(() => {
    if (!showText) {
      // 缺陷#4修复：空输入时重置lastKey & 清空内容，保证 空→实→空→实 能重触发
      lastKeyRef.current = ''
      if (typeTimerRef.current) { clearInterval(typeTimerRef.current); typeTimerRef.current = null }
      if (clearTimerRef.current) { clearTimeout(clearTimerRef.current); clearTimerRef.current = null }
      setTypedText('')
      return
    }
    const key = `${showText}|${displayMode}|${inPkt?.ts ?? 0}`
    if (key === lastKeyRef.current) return
    lastKeyRef.current = key

    if (typeTimerRef.current) { clearInterval(typeTimerRef.current); typeTimerRef.current = null }
    if (clearTimerRef.current) { clearTimeout(clearTimerRef.current); clearTimerRef.current = null }

    if (displayMode === 'typewriter') {
      setTypedText('')
      let i = 0
      // 打字速度跟字体大小反相关：大字体慢一点，默认每字 28~62ms
      const stepMs = Math.max(18, Math.min(80, Math.round(62 - (fontSize - 12) * 0.9)))
      typeTimerRef.current = window.setInterval(() => {
        i++
        setTypedText(showText.slice(0, i))
        if (i >= showText.length) {
          if (typeTimerRef.current) { clearInterval(typeTimerRef.current); typeTimerRef.current = null }
          if (duration > 0) {
            clearTimerRef.current = window.setTimeout(() => {
              setTypedText('')
              lastKeyRef.current = ''
            }, duration * 1000)
          }
        }
      }, stepMs)
    } else {
      setTypedText(showText)
      if (duration > 0) {
        clearTimerRef.current = window.setTimeout(() => {
          setTypedText('')
          lastKeyRef.current = ''
        }, duration * 1000)
      }
    }

    return () => {
      if (typeTimerRef.current) clearInterval(typeTimerRef.current)
      if (clearTimerRef.current) clearTimeout(clearTimerRef.current)
    }
  }, [showText, displayMode, duration, inPkt?.ts, fontSize])

  // ---------- 模式图标 ----------
  const modeIcon = useMemo(() => {
    if (displayMode === 'bubble') return <MessageSquare size={13} className="text-[color:var(--purple)]" />
    if (displayMode === 'typewriter') return <PenLine size={13} className="text-[color:var(--purple)]" />
    return <Type size={13} className="text-[color:var(--purple)]" />
  }, [displayMode])

  const modeLabel = displayMode === 'bubble' ? '气泡' : displayMode === 'plain' ? '纯文字' : '打字机'

  const fontCss = useMemo<React.CSSProperties>(() => ({
    fontSize: `${fontSize}px`,
    color: textColor,
    fontWeight: fontStyle === 'bold' ? 700 : fontStyle === 'italic' ? 500 : 400,
    fontStyle: fontStyle === 'italic' ? 'italic' : 'normal',
    lineHeight: 1.25,
    wordBreak: 'break-word',
    overflowWrap: 'anywhere',
  }), [fontSize, textColor, fontStyle])

  const placeHolder = typedText ? null : (
    <span style={{ opacity: 0.38, color: textColor, whiteSpace: 'nowrap' }}>
      {displayMode === 'typewriter' ? '✍️  等待输入文字…' : '文字显示区域…'}
    </span>
  )

  // ---------- 屏幕内的内容：三种模式 ----------
  const renderScreenContent = () => {
    // 打字机 / 纯文字 → 缺陷#1修复：用 bgColor，不再写死 surface-3
    if (displayMode !== 'bubble') {
      return (
        <div
          className="relative h-full w-full overflow-hidden rounded-[3px] p-3"
          style={{
            background: bgColor,
            color: textColor, // 缺陷#2修复：显式传 color
          }}
        >
          {/* 像素屏扫描线（30%强度，只在深色底明显） */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage:
                'repeating-linear-gradient(to bottom, rgba(255,255,255,0.04) 0 1px, transparent 1px 3px)',
              mixBlendMode: 'overlay',
            }}
          />
          <div style={fontCss}>
            {typedText || placeHolder}
          </div>
          {/* 打字机光标 — 缺陷#3修复：加 px 单位 */}
          {displayMode === 'typewriter' && typedText.length < (showText || '').length && (
            <span
              aria-hidden
              className="inline-block"
              style={{
                width: 2,
                height: `${Math.ceil(fontSize * 1.1)}px`,
                background: textColor,
                marginLeft: 3,
                verticalAlign: '-0.08em',
                animation: 'blink 1s steps(2) infinite',
              }}
            />
          )}
        </div>
      )
    }

    // 气泡模式 → 让气泡"飘浮"在屏幕中央
    return (
      <div
        className="relative flex h-full w-full items-end overflow-hidden rounded-[3px] p-3 pb-5"
        style={{ background: bgColor, color: textColor }}
      >
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              'repeating-linear-gradient(to bottom, rgba(255,255,255,0.04) 0 1px, transparent 1px 3px)',
            mixBlendMode: 'overlay',
          }}
        />
        <div
          className="relative inline-block max-w-full rounded-2xl px-3 py-2"
          style={{
            background: bgColor === '#1A0F2E' ? '#2e1b4f' : bgColor,
            border: '2px solid rgba(255,255,255,0.25)',
            boxShadow: '2px 2px 0 rgba(0,0,0,0.25)',
          }}
        >
          <span
            aria-hidden
            className="absolute -bottom-2 left-5 h-4 w-4 rotate-45"
            style={{
              background: 'inherit',
              borderRight: '2px solid rgba(255,255,255,0.25)',
              borderBottom: '2px solid rgba(255,255,255,0.25)',
            }}
          />
          <div style={fontCss}>
            {typedText || placeHolder}
          </div>
        </div>
      </div>
    )
  }

  // ---------- 占位字符 ----------
  void (Monitor)
  return (
    <NodeShell module={module} selected={selected} status={typedText ? 'ready' : 'idle'}>
      <style>{`@keyframes blink { 50% { opacity: 0; } }`}</style>
      <div className="space-y-2">
        {/* 状态条 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Monitor size={13} className="text-[color:var(--purple)]" />
            {modeIcon}
            <span className="chip text-text-dim">{modeLabel}</span>
            <span className="chip text-text-faint" style={{ fontFamily: 'monospace' }}>{fontSize}px</span>
          </div>
          <span className="chip text-text-faint">
            {typedText ? `${typedText.length}/${maxChars}` : rawText ? '接收中…' : '等待文本'}
          </span>
        </div>

        {/* ========== 小显示屏 ========== */}
        <div
          className="mx-auto"
          style={{
            width: '100%',
            maxWidth: 320,
          }}
        >
          {/* ① 屏幕外壳（塑料壳，含四角螺丝 + 品牌条 + 玻璃屏） */}
          <div
            className="relative rounded-xl p-2"
            style={{
              background:
                'linear-gradient(160deg,#3c3a44 0%, #262533 45%, #1a1826 100%)',
              border: '2px solid #0d0b15',
              boxShadow:
                '0 4px 0 rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.12)',
            }}
          >
            {/* 四角螺丝孔 */}
            {[
              { t: 5, l: 6 }, { t: 5, r: 6 },
              { b: 5, l: 6 }, { b: 5, r: 6 },
            ].map((p, i) => (
              <span
                key={i}
                aria-hidden
                className="absolute h-2 w-2 rounded-full"
                style={{
                  top: p.t,
                  left: p.l,
                  right: p.r,
                  bottom: p.b,
                  background:
                    'radial-gradient(circle at 30% 30%, #6b6779 0%, #2e2c3a 70%)',
                  border: '1px solid #0d0b15',
                  boxShadow: 'inset 0 0 1px rgba(0,0,0,0.8)',
                }}
              />
            ))}

            {/* 顶部品牌条 + 电源灯 */}
            <div className="mb-2 flex items-center justify-between px-2 pt-1">
              <span
                className="font-mono text-[9px] tracking-[0.2em]"
                style={{ color: '#a8a4bf' }}
              >
                AI · LCD-2048
              </span>
              <div className="flex items-center gap-1.5">
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{
                    background: typedText ? '#10B981' : '#64748B',
                    boxShadow: typedText ? '0 0 5px #10B981' : 'none',
                  }}
                />
                <span
                  className="rounded-sm px-1"
                  style={{
                    fontFamily: 'monospace',
                    fontSize: 9,
                    letterSpacing: 1,
                    color: typedText ? '#10B981' : '#64748B',
                    background: typedText ? 'rgba(16,185,129,0.12)' : 'transparent',
                  }}
                >
                  {typedText ? 'ON' : 'STBY'}
                </span>
              </div>
            </div>

            {/* ② 玻璃屏幕（内嵌黑框 + 反光） */}
            <div
              className="relative mx-auto overflow-hidden rounded-[6px]"
              style={{
                width: '100%',
                height: `${Math.max(110, 72 + fontSize * 1.2)}px`,
                padding: 3,
                background: '#0a0912',
                border: '1.5px solid #050408',
                boxShadow:
                  'inset 0 0 0 1px rgba(255,255,255,0.06), inset 0 6px 18px rgba(0,0,0,0.7)',
              }}
            >
              {/* 屏幕玻璃反光（左上高光） */}
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0 z-20"
                style={{
                  background:
                    'linear-gradient(125deg, rgba(255,255,255,0.11) 0%, rgba(255,255,255,0) 32%)',
                  mixBlendMode: 'screen',
                }}
              />
              {renderScreenContent()}
            </div>

            {/* 底部按键（装饰用，2 颗） */}
            <div className="mt-2 flex items-center justify-between px-2 pb-1">
              <span className="flex items-center gap-1">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{
                    background: 'radial-gradient(circle at 30% 30%, #8a8a9a, #35343e)',
                    border: '1px solid #0d0b15',
                  }}
                />
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{
                    background: 'radial-gradient(circle at 30% 30%, #c65c5c, #5c1d1d)',
                    border: '1px solid #0d0b15',
                  }}
                />
              </span>
              <span
                className="font-mono text-[9px]"
                style={{ color: '#8a86a5', letterSpacing: 1 }}
              >
                TEXT · DISPLAY
              </span>
            </div>
          </div>

          {/* ③ 屏幕颈 + 底座 */}
          <div className="mx-auto flex w-1/3 flex-col items-center">
            <div
              aria-hidden
              style={{
                width: '34%',
                height: 10,
                background:
                  'linear-gradient(180deg, #2e2c3a 0%, #1a1826 100%)',
                borderLeft: '2px solid #0d0b15',
                borderRight: '2px solid #0d0b15',
              }}
            />
            <div
              aria-hidden
              className="rounded-b-lg"
              style={{
                width: '100%',
                height: 8,
                background:
                  'linear-gradient(180deg, #3a3848 0%, #1d1c29 100%)',
                border: '2px solid #0d0b15',
                borderTop: '1.5px solid #0d0b15',
                boxShadow:
                  '0 3px 0 rgba(0,0,0,0.35)',
              }}
            />
          </div>
        </div>

        {/* 参数条（只读概览） */}
        <div
          className="grid grid-cols-3 gap-1 rounded-md p-1 text-center font-mono text-[10px]"
          style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
        >
          <div
            className="rounded"
            title="字体样式"
            style={{ padding: '2px 4px' }}
          >
            <div className="text-text-faint">样式</div>
            <div className="font-bold">
              {fontStyle === 'bold' ? '粗体' : fontStyle === 'italic' ? '斜体' : '常规'}
            </div>
          </div>
          <div className="rounded" style={{ padding: '2px 4px' }}>
            <div className="text-text-faint">时长</div>
            <div className="font-bold">
              {duration <= 0 ? '永久' : `${duration}s`}
            </div>
          </div>
          <div className="flex items-center justify-center gap-1 rounded" style={{ padding: '2px 4px' }}>
            <div className="flex flex-col">
              <div className="text-text-faint">配色</div>
              <div className="mx-auto flex gap-0.5 pt-0.5">
                <span
                  title="文字颜色"
                  className="inline-block h-3 w-3 rounded-sm"
                  style={{ background: textColor, border: '1px solid var(--ink)' }}
                />
                <span
                  title="背景颜色"
                  className="inline-block h-3 w-3 rounded-sm"
                  style={{ background: bgColor, border: '1px solid var(--ink)' }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </NodeShell>
  )
}

export const TextDisplayNode = memo(TextDisplayNodeComp)
