export type CompanionBubbleState = 'idle' | 'listening' | 'transcribing' | 'thinking' | 'speaking' | 'error'

const STATE_COPY: Record<CompanionBubbleState, string> = {
  idle: '',
  listening: '请说，我在听',
  transcribing: '我听到了',
  thinking: '我想一想',
  speaking: '正在回答',
  error: '这次没有听清，可以再试一次',
}

export function CompanionBubble({
  state,
  message,
  onCancel,
  className = '',
}: {
  state: CompanionBubbleState
  message?: string
  onCancel?: () => void
  className?: string
}) {
  const copy = message || STATE_COPY[state]
  if (!copy) return null

  return (
    <div className={className} role="status" data-bubble-state={state}>
      <span>{copy}</span>
      {onCancel && (
        <button type="button" aria-label="收起伙伴提示" onClick={onCancel}>×</button>
      )}
    </div>
  )
}
