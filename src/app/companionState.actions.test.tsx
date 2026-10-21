import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { AppStateProvider, useAppState } from './AppState'
import { createDefaultState } from './model'
import { getPointsBalance } from './points'
import { saveState } from './storage'
import { accountStorageKey } from './companionAccountRepository'

function CompanionStateHarness() {
  const context = useAppState()
  const loadout = context.state.companion
  const purchases = context.state.transactions.filter((transaction) => transaction.eventId === 'purchase:yunduo')
  const purchaseEvents = context.state.transactions
    .filter((transaction) => transaction.kind === 'purchase')
    .map((transaction) => transaction.eventId)
  return (
    <div>
      <output aria-label="balance">{getPointsBalance(context.state.transactions)}</output>
      <output aria-label="context has balance alias">{String('pointsBalance' in context)}</output>
      <output aria-label="purchase records">{purchases.length}</output>
      <output aria-label="purchase events">{purchaseEvents.join(',')}</output>
      <output aria-label="equipped appearance">{loadout.equipped.appearance}</output>
      <output aria-label="owned appearances">{loadout.owned.appearance.join(',')}</output>
      <output aria-label="owned outfits">{loadout.owned.outfit.join(',')}</output>
      <output aria-label="owned decorations">{loadout.owned.decoration.join(',')}</output>
      <output aria-label="equipped outfit">{loadout.equipped.outfit}</output>
      <output aria-label="ai position">{context.state.aiPosition.x},{context.state.aiPosition.y}</output>
      <button type="button" onClick={() => context.purchaseCompanionItem('appearance', 'yunduo', 360, '云朵')}>购买云朵</button>
      <button type="button" onClick={() => context.equipCompanionItem('appearance', 'yunduo')}>装备云朵</button>
      <button type="button" onClick={() => context.purchaseCompanionItem('outfit', 'invalid-price', Number.NaN, '坏价格')}>购买无效价格商品</button>
      <button type="button" onClick={() => context.purchaseCompanionItem('decoration', 'too-expensive', 2001, '太贵商品')}>购买余额不足商品</button>
      <button type="button" onClick={() => context.equipCompanionItem('outfit', 'not-owned')}>装备未拥有服饰</button>
      <button type="button" onClick={() => context.setAiPosition({ x: 0.2, y: 0.3 })}>移动伙伴</button>
      <button type="button" onClick={() => context.resetAiPosition()}>重置伙伴位置</button>
      <button type="button" onClick={() => context.login('luna_2026')}>切换露娜账号</button>
      <button type="button" onClick={() => context.login('chenxi_2026')}>切换晨曦账号</button>
    </div>
  )
}

describe('companion loadout actions', () => {
  beforeEach(() => localStorage.clear())

  it('purchases without equipping, then equips an owned item', async () => {
    const user = userEvent.setup()
    render(<AppStateProvider><CompanionStateHarness /></AppStateProvider>)

    await user.click(screen.getByRole('button', { name: '购买云朵' }))
    await user.click(screen.getByRole('button', { name: '购买云朵' }))
    expect(screen.getByLabelText('owned appearances')).toHaveTextContent('momo,yunduo')
    expect(screen.getByLabelText('context has balance alias')).toHaveTextContent('false')
    expect(screen.getByLabelText('equipped appearance')).toHaveTextContent('momo')
    expect(screen.getByLabelText('purchase records')).toHaveTextContent('1')
    expect(screen.getByLabelText('balance')).toHaveTextContent('1640')

    await user.click(screen.getByRole('button', { name: '装备云朵' }))
    expect(screen.getByLabelText('equipped appearance')).toHaveTextContent('yunduo')
  })

  it('renders safely and derives balance from valid transactions beside corrupt siblings', () => {
    localStorage.setItem('student-app-state', JSON.stringify({
      ...createDefaultState(),
      transactions: [
        {
          id: 'mixed-starter',
          eventId: 'mixed:starter',
          kind: 'starter',
          title: '保留的初始积分',
          amount: 1000,
          occurredAt: '2026-10-14',
        },
        null,
        {
          id: 'mixed-purchase',
          eventId: 'purchase:yunduo',
          kind: 'purchase',
          title: '保留的购买记录',
          amount: -360,
          occurredAt: '2026-10-14',
        },
      ],
    }))

    expect(() => render(<AppStateProvider><CompanionStateHarness /></AppStateProvider>)).not.toThrow()
    expect(screen.getByLabelText('balance')).toHaveTextContent('640')
  })

  it('does not mutate ownership, equipment, or ledger for rejected mall actions', async () => {
    const user = userEvent.setup()
    render(<AppStateProvider><CompanionStateHarness /></AppStateProvider>)

    await user.click(screen.getByRole('button', { name: '购买无效价格商品' }))
    await user.click(screen.getByRole('button', { name: '购买余额不足商品' }))
    await user.click(screen.getByRole('button', { name: '装备未拥有服饰' }))

    expect(screen.getByLabelText('owned outfits')).toBeEmptyDOMElement()
    expect(screen.getByLabelText('owned decorations')).toBeEmptyDOMElement()
    expect(screen.getByLabelText('equipped outfit')).toBeEmptyDOMElement()
    expect(screen.getByLabelText('purchase events')).toBeEmptyDOMElement()
    expect(screen.getByLabelText('balance')).toHaveTextContent('2000')
  })

  it('does not grant ownership when the purchase event was already processed', async () => {
    const initial = createDefaultState()
    saveState({
      ...initial,
      processedRewardIds: [...initial.processedRewardIds, 'purchase:yunduo'],
    })
    const user = userEvent.setup()
    render(<AppStateProvider><CompanionStateHarness /></AppStateProvider>)

    await user.click(screen.getByRole('button', { name: '购买云朵' }))

    expect(screen.getByLabelText('owned appearances')).toHaveTextContent('momo')
    expect(screen.getByLabelText('owned appearances')).not.toHaveTextContent('yunduo')
    expect(screen.getByLabelText('purchase records')).toHaveTextContent('0')
    expect(screen.getByLabelText('balance')).toHaveTextContent('2000')
  })

  it('resets the canonical AI position and persists the approved default', async () => {
    const user = userEvent.setup()
    render(<AppStateProvider><CompanionStateHarness /></AppStateProvider>)

    await user.click(screen.getByRole('button', { name: '移动伙伴' }))
    expect(screen.getByLabelText('ai position')).toHaveTextContent('0.2,0.3')
    await user.click(screen.getByRole('button', { name: '重置伙伴位置' }))

    expect(screen.getByLabelText('ai position')).toHaveTextContent('0.88,0.84')
    await waitFor(() => {
      const saved = JSON.parse(localStorage.getItem(accountStorageKey('chenxi_2026')) ?? '{}')
      expect(saved.aiPosition).toEqual({ x: 0.88, y: 0.84 })
    })
  })

  it('keeps purchases and equipped companions isolated by learning account', async () => {
    const user = userEvent.setup()
    render(<AppStateProvider><CompanionStateHarness /></AppStateProvider>)

    await user.click(screen.getByRole('button', { name: '购买云朵' }))
    await user.click(screen.getByRole('button', { name: '装备云朵' }))
    expect(screen.getByLabelText('equipped appearance')).toHaveTextContent('yunduo')

    await user.click(screen.getByRole('button', { name: '切换露娜账号' }))
    expect(screen.getByLabelText('equipped appearance')).toHaveTextContent('momo')
    expect(screen.getByLabelText('owned appearances')).toHaveTextContent('momo')
    expect(screen.getByLabelText('owned appearances')).not.toHaveTextContent('yunduo')
    expect(screen.getByLabelText('balance')).toHaveTextContent('2000')

    await user.click(screen.getByRole('button', { name: '切换晨曦账号' }))
    expect(screen.getByLabelText('equipped appearance')).toHaveTextContent('yunduo')
    expect(screen.getByLabelText('balance')).toHaveTextContent('1640')
  })
})
