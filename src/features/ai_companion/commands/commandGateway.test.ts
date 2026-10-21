import { describe, expect, it } from 'vitest'
import { evaluateCommand } from './commandGateway'
import type { CommandGatewayState, CompanionCommand } from './commandTypes'

const readyState: CommandGatewayState = {
  pointsBalance: 900,
  ownedItemIds: ['momo'],
  catalog: [
    { id: 'cloud-backpack', name: '云朵小背包', category: 'outfit', price: 160 },
    { id: 'cloudbelle', name: '云贝儿 Cloudbelle', category: 'appearance', price: 980 },
  ],
}

describe('companion command gateway', () => {
  it('executes only a whitelisted low-risk navigation command immediately', () => {
    expect(evaluateCommand({ type: 'navigate', target: 'knowledge' }, readyState)).toMatchObject({
      kind: 'execute',
      command: { type: 'navigate', target: 'knowledge' },
    })
  })

  it('requires an on-screen confirmation before spending points', () => {
    expect(evaluateCommand({ type: 'purchase', itemId: 'cloud-backpack' }, readyState)).toMatchObject({
      kind: 'confirm',
      title: '确认使用 160 积分购买云朵小背包',
    })
  })

  it('requires the current session password for high-risk account operations', () => {
    expect(evaluateCommand({ type: 'clear-account-data' }, readyState)).toMatchObject({
      kind: 'password',
      title: '清空学习账号数据',
    })
  })

  it('rejects a purchase that cannot be fulfilled instead of opening a misleading confirmation', () => {
    expect(evaluateCommand({ type: 'purchase', itemId: 'cloudbelle' }, readyState)).toMatchObject({ kind: 'reject' })
  })

  it('rejects an unknown command even when an untrusted caller bypasses TypeScript', () => {
    const untrusted = { type: 'open-url', url: 'https://example.com' } as unknown as CompanionCommand
    expect(evaluateCommand(untrusted, readyState)).toMatchObject({ kind: 'reject' })
  })

  it('rejects a known command whose required parameters are missing', () => {
    const malformed = { type: 'navigate' } as unknown as CompanionCommand
    expect(evaluateCommand(malformed, readyState)).toMatchObject({ kind: 'reject' })
  })
})
