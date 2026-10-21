import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type PropsWithChildren } from 'react'
import { useAppState } from '../../../app/AppState'
import { getPointsBalance } from '../../../app/points'
import { useOptionalSessionCredential } from '../../auth/sessionCredential'
import { COMPANION_CATALOG } from '../companionCatalog'
import { CommandConfirmationDialog } from './CommandConfirmationDialog'
import { evaluateCommand } from './commandGateway'
import { interpretLocalCommand } from './localCommandInterpreter'
import type {
  CommandDecision,
  CommandSource,
  CommandSubmissionResult,
  CompanionCommand,
  ExecutableCommand,
  InterpretedIntent,
} from './commandTypes'

type PendingDecision = Extract<CommandDecision, { kind: 'confirm' | 'password' }>
type CommandExecutor = (command: CompanionCommand) => void | Promise<void>

type AppCommandContextValue = {
  message: string
  pending: PendingDecision | null
  submitText: (text: string, source: CommandSource) => Promise<CommandSubmissionResult>
  confirm: () => Promise<void>
  cancel: () => void
  verifyPassword: (password: string) => Promise<boolean>
  registerExecutor: (executor: CommandExecutor) => () => void
}

type AppCommandProviderProps = PropsWithChildren<{
  interpret?: (text: string, source: CommandSource, companionId: string) => Promise<InterpretedIntent>
  onExecute?: CommandExecutor
}>

const AppCommandContext = createContext<AppCommandContextValue | null>(null)

async function requestCompanionIntent(text: string, _source: CommandSource, companionId: string): Promise<InterpretedIntent> {
  const localIntent = interpretLocalCommand(text)
  if (localIntent) return localIntent
  const response = await fetch('/api/companion/interpret', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ companionId, text: text.trim().replace(/\s+/g, ' ').slice(0, 160) }),
  })
  if (!response.ok) throw new Error('intent_request_failed')
  const payload = await response.json() as Partial<InterpretedIntent>
  if ((payload.kind === 'clarify' || payload.kind === 'reject') && typeof payload.reply === 'string') {
    return { kind: payload.kind, reply: payload.reply }
  }
  if (payload.kind === 'command' && typeof payload.reply === 'string' && payload.command) {
    return { kind: 'command', reply: payload.reply, command: payload.command }
  }
  return { kind: 'reject', reply: '这个操作没有通过安全检查。' }
}

export function AppCommandProvider({ children, interpret = requestCompanionIntent, onExecute }: AppCommandProviderProps) {
  const app = useAppState()
  const sessionCredential = useOptionalSessionCredential()
  const executorRef = useRef<CommandExecutor | undefined>(onExecute)
  const [message, setMessage] = useState('')
  const [pending, setPending] = useState<PendingDecision | null>(null)
  const [passwordError, setPasswordError] = useState('')

  useEffect(() => {
    if (onExecute) executorRef.current = onExecute
  }, [onExecute])

  const registerExecutor = useCallback((executor: CommandExecutor) => {
    executorRef.current = executor
    return () => {
      if (executorRef.current === executor) executorRef.current = onExecute
    }
  }, [onExecute])

  const execute = useCallback(async (command: ExecutableCommand) => {
    if (command.type === 'purchase' && command.resolvedItem) {
      const item = command.resolvedItem
      app.purchaseCompanionItem(item.category, item.id, item.price, item.name)
    } else if (command.type === 'equip' && command.resolvedItem) {
      app.equipCompanionItem(command.resolvedItem.category, command.resolvedItem.id)
    } else if (command.type === 'unequip') {
      app.unequipCompanionItem(command.category)
    } else {
      await executorRef.current?.(command)
    }
  }, [app])

  const submitText = useCallback(async (rawText: string, source: CommandSource): Promise<CommandSubmissionResult> => {
    const text = rawText.trim().replace(/\s+/g, ' ').slice(0, 160)
    if (!text) {
      const nextMessage = '我还没听到具体内容，可以再说一次吗？'
      setMessage(nextMessage)
      return { kind: 'empty', message: nextMessage }
    }
    if (pending && source === 'voice' && /^(确认|确定|可以|好)$/.test(text)) {
      const nextMessage = '请点击屏幕上的确认按钮；重要操作还需要输入密码。'
      setMessage(nextMessage)
      return { kind: 'screen-confirmation', message: nextMessage }
    }
    try {
      const intent = await interpret(text, source, app.state.companion.equipped.appearance ?? 'momo')
      if (intent.kind !== 'command') {
        setMessage(intent.reply)
        return { kind: intent.kind, message: intent.reply }
      }
      const ownedItemIds = Object.values(app.state.companion.owned).flat()
      const decision = evaluateCommand(intent.command, {
        pointsBalance: getPointsBalance(app.state.transactions),
        ownedItemIds,
        catalog: COMPANION_CATALOG.map(({ id, name, category, price }) => ({ id, name, category, price })),
      })
      const nextMessage = decision.kind === 'execute' ? intent.reply : decision.message
      setMessage(nextMessage)
      setPasswordError('')
      if (decision.kind === 'execute') {
        setPending(null)
        await execute(decision.command)
      } else if (decision.kind === 'confirm' || decision.kind === 'password') {
        setPending(decision)
      } else {
        setPending(null)
      }
      return { kind: decision.kind, message: nextMessage }
    } catch {
      const nextMessage = '这次没有理解好你的操作，可以换一种说法再试一次。'
      setMessage(nextMessage)
      return { kind: 'error', message: nextMessage }
    }
  }, [app.state.companion, app.state.transactions, execute, interpret, pending])

  const confirm = useCallback(async () => {
    if (!pending || pending.kind !== 'confirm') return
    await execute(pending.command)
    setMessage('已经按你的确认完成啦。')
    setPending(null)
  }, [execute, pending])

  const cancel = useCallback(() => {
    setPending(null)
    setPasswordError('')
    setMessage('好的，这次操作已经取消。')
  }, [])

  const verifyPassword = useCallback(async (password: string) => {
    if (!pending || pending.kind !== 'password') return false
    if (!sessionCredential?.verify(password)) {
      setPasswordError('密码不正确，请再试一次。')
      return false
    }
    await execute(pending.command)
    setMessage('密码验证成功，操作已经完成。')
    setPasswordError('')
    setPending(null)
    return true
  }, [execute, pending, sessionCredential])

  const value = useMemo<AppCommandContextValue>(() => ({
    message,
    pending,
    submitText,
    confirm,
    cancel,
    verifyPassword,
    registerExecutor,
  }), [cancel, confirm, message, pending, registerExecutor, submitText, verifyPassword])

  return (
    <AppCommandContext.Provider value={value}>
      {children}
      {pending && (
        <CommandConfirmationDialog
          decision={pending}
          passwordError={passwordError}
          onConfirm={() => void confirm()}
          onCancel={cancel}
          onVerifyPassword={(password) => void verifyPassword(password)}
        />
      )}
    </AppCommandContext.Provider>
  )
}

export function useAppCommand() {
  const value = useContext(AppCommandContext)
  if (!value) throw new Error('useAppCommand must be used inside AppCommandProvider')
  return value
}

export function useOptionalAppCommand() {
  return useContext(AppCommandContext)
}
