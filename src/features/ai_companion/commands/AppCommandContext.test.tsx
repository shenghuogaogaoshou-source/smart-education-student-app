import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useEffect } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AppStateProvider, useAppState } from '../../../app/AppState'
import { getPointsBalance } from '../../../app/points'
import { SessionCredentialProvider, useSessionCredential } from '../../auth/sessionCredential'
import { AppCommandProvider, useAppCommand } from './AppCommandContext'
import type { InterpretedIntent } from './commandTypes'

function CredentialSeed() {
  const credential = useSessionCredential()
  useEffect(() => credential.establish('chenxi_2026', 'demo-password'), [credential])
  return null
}

function CommandHarness() {
  const command = useAppCommand()
  const { state } = useAppState()
  return (
    <>
      <output aria-label="积分余额">{getPointsBalance(state.transactions)}</output>
      <output aria-label="伙伴消息">{command.message}</output>
      <button type="button" onClick={() => void command.submitText('帮我购买云朵小背包', 'voice')}>购买指令</button>
      <button type="button" onClick={() => void command.submitText('确认', 'voice')}>语音确认</button>
      <button type="button" onClick={() => void command.submitText('清空学习账号数据', 'voice')}>高风险指令</button>
      <button type="button" onClick={() => void command.submitText('打开知识', 'voice')}>导航指令</button>
    </>
  )
}

function renderCommands(
  interpret?: (text: string) => Promise<InterpretedIntent>,
  onExecute = vi.fn(),
) {
  return render(
    <SessionCredentialProvider>
      <CredentialSeed />
      <AppStateProvider>
        <AppCommandProvider {...(interpret ? { interpret } : {})} onExecute={onExecute}>
          <CommandHarness />
        </AppCommandProvider>
      </AppStateProvider>
    </SessionCredentialProvider>,
  )
}

describe('app command context', () => {
  beforeEach(() => localStorage.clear())

  it('previews a purchase and changes points only after an on-screen confirmation', async () => {
    const user = userEvent.setup()
    const interpret = vi.fn(async (): Promise<InterpretedIntent> => ({
      kind: 'command',
      reply: '云朵小背包需要 160 积分。',
      command: { type: 'purchase', itemId: 'cloud-backpack' },
    }))
    renderCommands(interpret)
    const before = Number(screen.getByLabelText('积分余额').textContent)

    await user.click(screen.getByRole('button', { name: '购买指令' }))

    expect(screen.getByRole('dialog', { name: '确认使用 160 积分购买云朵小背包' })).toBeInTheDocument()
    expect(Number(screen.getByLabelText('积分余额').textContent)).toBe(before)

    await user.click(screen.getByRole('button', { name: '确认购买' }))

    expect(Number(screen.getByLabelText('积分余额').textContent)).toBe(before - 160)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('does not treat a spoken confirmation as the required screen tap', async () => {
    const user = userEvent.setup()
    const interpret = vi.fn(async (text: string): Promise<InterpretedIntent> => text === '确认'
      ? { kind: 'clarify', reply: '请点击屏幕上的确认按钮。' }
      : {
          kind: 'command',
          reply: '准备购买云朵小背包。',
          command: { type: 'purchase', itemId: 'cloud-backpack' },
        })
    renderCommands(interpret)
    const before = Number(screen.getByLabelText('积分余额').textContent)

    await user.click(screen.getByRole('button', { name: '购买指令' }))
    await user.click(screen.getByRole('button', { name: '语音确认' }))

    expect(Number(screen.getByLabelText('积分余额').textContent)).toBe(before)
    expect(screen.getByRole('dialog', { name: '确认使用 160 积分购买云朵小背包' })).toBeInTheDocument()
    expect(screen.getByLabelText('伙伴消息')).toHaveTextContent('请点击屏幕上的确认按钮')
  })

  it('executes a high-risk operation only after the current session password matches', async () => {
    const user = userEvent.setup()
    const onExecute = vi.fn()
    renderCommands(async (): Promise<InterpretedIntent> => ({
      kind: 'command',
      reply: '这需要验证当前密码。',
      command: { type: 'clear-account-data' },
    }), onExecute)

    await user.click(screen.getByRole('button', { name: '高风险指令' }))
    const dialog = screen.getByRole('dialog', { name: '清空学习账号数据' })
    await user.type(screen.getByLabelText('当前账号密码'), 'wrong-password')
    await user.click(screen.getByRole('button', { name: '验证并继续' }))
    expect(onExecute).not.toHaveBeenCalled()
    expect(dialog).toHaveTextContent('密码不正确')

    await user.clear(screen.getByLabelText('当前账号密码'))
    await user.type(screen.getByLabelText('当前账号密码'), 'demo-password')
    await user.click(screen.getByRole('button', { name: '验证并继续' }))

    expect(onExecute).toHaveBeenCalledWith({ type: 'clear-account-data' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('executes a low-risk navigation without opening a dialog', async () => {
    const onExecute = vi.fn()
    renderCommands(async (): Promise<InterpretedIntent> => ({
      kind: 'command',
      reply: '我们去知识页。',
      command: { type: 'navigate', target: 'knowledge' },
    }), onExecute)

    await act(async () => screen.getByRole('button', { name: '导航指令' }).click())

    expect(onExecute).toHaveBeenCalledWith({ type: 'navigate', target: 'knowledge' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('executes a basic local command when the remote interpreter is unavailable', async () => {
    const user = userEvent.setup()
    const onExecute = vi.fn()
    const fetchMock = vi.fn(async () => { throw new Error('offline') })
    vi.stubGlobal('fetch', fetchMock)
    renderCommands(undefined, onExecute)

    await user.click(screen.getByRole('button', { name: '导航指令' }))

    expect(onExecute).toHaveBeenCalledWith({ type: 'navigate', target: 'knowledge' })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
