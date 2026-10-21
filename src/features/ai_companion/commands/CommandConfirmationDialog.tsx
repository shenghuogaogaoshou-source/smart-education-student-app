import { useState, type FormEvent } from 'react'
import type { CommandDecision } from './commandTypes'
import './commands.css'

type PendingDecision = Extract<CommandDecision, { kind: 'confirm' | 'password' }>

type CommandConfirmationDialogProps = {
  decision: PendingDecision
  passwordError: string
  onConfirm: () => void
  onCancel: () => void
  onVerifyPassword: (password: string) => void
}

export function CommandConfirmationDialog({
  decision,
  passwordError,
  onConfirm,
  onCancel,
  onVerifyPassword,
}: CommandConfirmationDialogProps) {
  const [password, setPassword] = useState('')
  const titleId = 'companion-command-dialog-title'
  const confirmLabel = decision.command.type === 'purchase' ? '确认购买' : '确认操作'

  const submitPassword = (event: FormEvent) => {
    event.preventDefault()
    onVerifyPassword(password)
  }

  return (
    <div className="command-dialog-backdrop">
      <section className="command-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <span className="command-dialog__eyebrow">智芽安全确认</span>
        <h2 id={titleId}>{decision.title}</h2>
        <p>{decision.message}</p>
        {decision.kind === 'password' ? (
          <form onSubmit={submitPassword}>
            <label htmlFor="companion-command-password">当前账号密码</label>
            <input
              id="companion-command-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              autoFocus
            />
            {passwordError && <p className="command-dialog__error" role="alert">{passwordError}</p>}
            <div className="command-dialog__actions">
              <button type="button" onClick={onCancel}>取消</button>
              <button type="submit" className="primary">验证并继续</button>
            </div>
          </form>
        ) : (
          <div className="command-dialog__actions">
            <button type="button" onClick={onCancel}>取消</button>
            <button type="button" className="primary" onClick={onConfirm}>{confirmLabel}</button>
          </div>
        )}
      </section>
    </div>
  )
}
