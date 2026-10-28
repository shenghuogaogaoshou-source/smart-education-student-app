import { LoaderCircle } from 'lucide-react'
import { createPortal } from 'react-dom'
import { useDialogFocus } from '../app/useDialogFocus'
import './mobile-layout.css'

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  busy = false,
  danger = true,
  onConfirm,
  onCancel,
}: {
  open: boolean
  title: string
  description: string
  confirmLabel: string
  busy?: boolean
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  const dialog = useDialogFocus<HTMLElement>(open, busy ? undefined : onCancel)
  if (!open) return null

  return createPortal(
    <div className="mobile-confirm-backdrop" role="presentation" onMouseDown={(event) => {
      if (!busy && event.target === event.currentTarget) onCancel()
    }}>
      <section
        ref={dialog}
        className="mobile-confirm-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
      >
        <span className="mobile-confirm-dialog__mark" aria-hidden="true">!</span>
        <h2>{title}</h2>
        <p>{description}</p>
        <div className="mobile-confirm-dialog__actions">
          <button type="button" className="mobile-confirm-dialog__cancel" disabled={busy} onClick={onCancel}>
            取消
          </button>
          <button
            type="button"
            className={`mobile-confirm-dialog__confirm ${danger ? 'is-danger' : ''}`}
            disabled={busy}
            onClick={onConfirm}
          >
            {busy && <LoaderCircle aria-hidden="true" size={16} />}
            {busy ? '正在删除…' : confirmLabel}
          </button>
        </div>
      </section>
    </div>,
    document.body,
  )
}
