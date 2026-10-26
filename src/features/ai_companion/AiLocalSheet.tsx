import { X } from 'lucide-react'
import { useEffect, type PropsWithChildren, type RefObject, type ReactNode } from 'react'
import { useDialogFocus } from '../../app/useDialogFocus'

type AiLocalSheetProps = PropsWithChildren<{
  label: string
  eyebrow: string
  title: string
  triggerRef: RefObject<HTMLElement | null>
  onClose: () => void
  footer?: ReactNode
}>

export function AiLocalSheet({
  label,
  eyebrow,
  title,
  triggerRef,
  onClose,
  footer,
  children,
}: AiLocalSheetProps) {
  const sheetRef = useDialogFocus<HTMLElement>(true, onClose)

  useEffect(() => () => {
    if (triggerRef.current?.isConnected) triggerRef.current.focus()
  }, [triggerRef])

  return (
    <div className="ai-local-sheet-layer" data-testid="ai-local-sheet-layer">
      <button
        type="button"
        className="ai-local-sheet-backdrop"
        aria-label={`关闭${label}遮罩`}
        onClick={onClose}
      />
      <section
        ref={sheetRef}
        className="ai-local-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
      >
        <header className="ai-local-sheet__header">
          <span><small>{eyebrow}</small><strong>{title}</strong></span>
          <button type="button" aria-label={`关闭${label}`} onClick={onClose}>
            <X size={18} />
          </button>
        </header>
        <div className="ai-local-sheet__body">{children}</div>
        {footer && <footer className="ai-local-sheet__footer">{footer}</footer>}
      </section>
    </div>
  )
}
