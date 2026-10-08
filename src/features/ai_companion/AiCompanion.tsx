import { Bot } from 'lucide-react'
import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { useAppState } from '../../app/AppState'
import { AiPanel } from './AiPanel'
import './ai-companion.css'

const LONG_PRESS_MS = 600

export function AiCompanion() {
  const { state, setAiPosition } = useAppState()
  const [open, setOpen] = useState(false)
  const [dragPosition, setDragPosition] = useState(state.aiPositions[state.stage])
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const startRef = useRef({ x: 0, y: 0 })
  const movedRef = useRef(false)
  const longPressedRef = useRef(false)

  function pointerDown(event: ReactPointerEvent<HTMLButtonElement>) {
    startRef.current = { x: event.clientX, y: event.clientY }
    movedRef.current = false
    longPressedRef.current = false
    timerRef.current = setTimeout(() => {
      if (!movedRef.current) {
        longPressedRef.current = true
        // 长按也打开 AI 面板
        setOpen(true)
      }
    }, LONG_PRESS_MS)
  }

  function pointerMove(event: ReactPointerEvent<HTMLButtonElement>) {
    const dx = event.clientX - startRef.current.x
    const dy = event.clientY - startRef.current.y
    if (Math.hypot(dx, dy) < 8) return
    movedRef.current = true
    if (timerRef.current) clearTimeout(timerRef.current)
    const width = Math.max(window.innerWidth, 320)
    const height = Math.max(window.innerHeight, 568)
    setDragPosition({ x: Math.min(.92, Math.max(.08, event.clientX / width)), y: Math.min(.78, Math.max(.12, event.clientY / height)) })
  }

  function pointerUp() {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (movedRef.current) {
      const snapped = { ...dragPosition, x: dragPosition.x < .5 ? .08 : .92 }
      setDragPosition(snapped)
      setAiPosition(snapped)
    }
  }

  function click() {
    if (longPressedRef.current || movedRef.current) return
    setOpen(true)
  }

  return (
    <>
      <button
        className="ai-companion-control"
        type="button"
        aria-label="AI伙伴"
        style={{ left: `${dragPosition.x * 100}%`, top: `${dragPosition.y * 100}%` }}
        onPointerDown={pointerDown}
        onPointerMove={pointerMove}
        onPointerUp={pointerUp}
        onClick={click}
      >
        <span>AI</span><Bot aria-hidden="true" size={22} />
      </button>
      {open && <AiPanel onClose={() => setOpen(false)} />}
    </>
  )
}
