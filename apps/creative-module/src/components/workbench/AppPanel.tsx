import { useEffect, useRef, type ReactNode } from 'react'

// Native modal dialogs provide focus trapping, Escape dismissal and inert background.
export function AppPanel({ children, onClose, label, sheet = false }: {
  children: ReactNode; onClose: () => void; label: string; sheet?: boolean
}) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = ref.current!
    dialog.showModal()
    return () => dialog.close()
  }, [])
  return <dialog ref={ref} aria-label={label} className={sheet ? 'app-panel inspector-sheet' : 'app-panel market-screen'}
    onCancel={(event) => { event.preventDefault(); onClose() }}
    onClick={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <div className="panel-content">{children}</div>
  </dialog>
}
