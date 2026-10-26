import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AppStateProvider } from '../../app/AppState'
import { loadAccountState } from '../../app/companionAccountRepository'
import { defaultState } from '../../app/model'
import { getPointsBalance } from '../../app/points'
import { saveState } from '../../app/storage'
import { AiCompanion } from '../ai_companion/AiCompanion'
import { LoginCompanion } from '../ai_companion/LoginCompanion'
import { MallPage } from './MallPage'

function renderMall(balance = 1280) {
  saveState({
    ...defaultState,
    transactions: [{
      id: 'test-balance',
      eventId: 'test:balance',
      kind: 'starter',
      title: '测试积分余额',
      amount: balance,
      occurredAt: '2026-10-13',
    }],
    processedRewardIds: ['test:balance'],
  })
  return render(<AppStateProvider><MallPage onBack={() => undefined} /></AppStateProvider>)
}

function renderOwnedPrimaryWardrobe() {
  saveState({
    ...defaultState,
    companion: {
      owned: {
        appearance: ['momo', 'yunduo'],
        outfit: ['cloud-backpack'],
        decoration: ['cloud-flower-lamp'],
      },
      equipped: {
        appearance: 'momo',
        outfit: 'cloud-backpack',
        decoration: 'cloud-flower-lamp',
      },
      version: 1,
    },
  })
  return render(<AppStateProvider><MallPage onBack={() => undefined} /></AppStateProvider>)
}

describe('points mall companion catalogue', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('shows only the four elementary companion pets in the image catalogue', () => {
    renderMall()

    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual(['形象', '服饰', '装饰', '我的'])

    for (const name of ['绒桃 Momo', '云朵 Yunduo', '云绽 Cloudbloom', '云贝儿 Cloudbelle']) {
      expect(screen.getByText(name)).toBeInTheDocument()
    }
    expect(screen.queryByText(/星空精灵/)).not.toBeInTheDocument()
    expect(screen.queryByText('云宝 Nimbo')).not.toBeInTheDocument()
  })

  it('uses the centered front portrait from the pet sheet for appearance cards', () => {
    renderMall()

    const yunduoCard = screen.getByRole('button', { name: '查看 云朵 Yunduo' })
    const portrait = within(yunduoCard).getByTestId('mall-front-portrait-yunduo')

    expect(yunduoCard.querySelector('.companion-2d')).toBeNull()
    expect(portrait).toHaveAttribute('src', '/pets/front/yunduo-card-v2.png')
    expect(portrait).toHaveAttribute('alt', '')
  })

  it('shows elementary 3D companion clothing instead of the forthcoming placeholder', async () => {
    const user = userEvent.setup()
    renderMall()

    await user.click(screen.getByRole('tab', { name: '服饰' }))
    expect(screen.getByText('云朵小背包')).toBeInTheDocument()
    expect(screen.getByText('晨光云杖')).toBeInTheDocument()
    expect(screen.queryByText('服饰正在准备中')).not.toBeInTheDocument()
  })

  it('shows four elementary 3D learning-space decorations', async () => {
    const user = userEvent.setup()
    renderMall()

    await user.click(screen.getByRole('tab', { name: '装饰' }))
    for (const name of ['云光花灯', '彩虹云门', '花云风铃', '云朵花椅']) {
      expect(screen.getByText(name)).toBeInTheDocument()
    }
    expect(screen.queryByText('装饰正在准备中')).not.toBeInTheDocument()
  })

  it('opens a large preview before offering purchase', async () => {
    const user = userEvent.setup()
    renderMall()

    await user.click(screen.getByRole('button', { name: '查看 云朵 Yunduo' }))

    expect(screen.getByRole('dialog', { name: '云朵 Yunduo 商品预览' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '购买 云朵 Yunduo' })).toBeInTheDocument()
  })

  it('tries an unowned item on the rotatable companion without spending points or granting ownership', async () => {
    const user = userEvent.setup()
    renderMall()

    await user.click(screen.getByRole('tab', { name: '服饰' }))
    await user.click(screen.getByRole('button', { name: '查看 云朵小背包' }))

    const preview = screen.getByRole('region', { name: '商品试穿八方向预览' })
    expect(within(preview).getByTestId('companion-attachment-cloud-backpack')).toBeInTheDocument()
    expect(within(preview).getByRole('button', { name: '向右转动伙伴' })).toBeInTheDocument()
    expect(screen.getByText('当前积分').parentElement).toHaveTextContent('1,280')
    expect(loadAccountState(defaultState.accountId).companion.owned.outfit).toEqual([])
  })

  it('offers a clear purchase button on every unowned product card', async () => {
    const user = userEvent.setup()
    renderMall()

    expect(screen.getByRole('button', { name: '购买 云朵 Yunduo，360 积分' })).toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: '服饰' }))
    expect(screen.getByRole('button', { name: '购买 云朵小背包，160 积分' })).toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: '装饰' }))
    expect(screen.getByRole('button', { name: '购买 云光花灯，180 积分' })).toBeInTheDocument()
  })

  it('waits for explicit confirmation before spending points or granting an item', async () => {
    const user = userEvent.setup()
    renderMall(1280)

    await user.click(screen.getByRole('button', { name: '购买 云朵 Yunduo，360 积分' }))

    expect(screen.getByRole('dialog', { name: '确认购买云朵 Yunduo' })).toBeInTheDocument()
    expect(screen.getByText('当前积分').parentElement).toHaveTextContent('1,280')
    expect(loadAccountState(defaultState.accountId).companion.owned.appearance).not.toContain('yunduo')

    await user.click(screen.getByRole('button', { name: '先不买' }))

    expect(screen.queryByRole('dialog', { name: '确认购买云朵 Yunduo' })).not.toBeInTheDocument()
    expect(screen.getByText('当前积分').parentElement).toHaveTextContent('1,280')
    expect(loadAccountState(defaultState.accountId).companion.owned.appearance).not.toContain('yunduo')
  })

  it.each([
    ['形象', '云朵 Yunduo', 920, '920'],
    ['服饰', '云朵小背包', 1120, '1,120'],
    ['装饰', '云光花灯', 1100, '1,100'],
  ])('buys a %s from its card after confirmation and deducts the correct points', async (category, name, expectedBalance, expectedDisplay) => {
    const user = userEvent.setup()
    renderMall()

    await user.click(screen.getByRole('tab', { name: category }))
    await user.click(screen.getByRole('button', { name: `购买 ${name}，${1280 - expectedBalance} 积分` }))
    await user.click(screen.getByRole('button', { name: '确认购买' }))

    expect(screen.getByRole('dialog', { name: '现在换上吗？' })).toBeInTheDocument()
    expect(screen.getByText('当前积分').parentElement).toHaveTextContent(expectedDisplay)
  })

  it('keeps the current appearance when purchase equip confirmation is declined', async () => {
    const user = userEvent.setup()
    renderMall()

    await user.click(screen.getByRole('button', { name: '查看 云朵 Yunduo' }))
    await user.click(screen.getByRole('button', { name: '购买 云朵 Yunduo' }))
    await user.click(screen.getByRole('button', { name: '确认购买' }))
    expect(screen.getByRole('dialog', { name: '现在换上吗？' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '暂不更换' }))

    expect(screen.getByText('当前伙伴：绒桃 Momo')).toBeInTheDocument()
  })

  it('equips a purchased appearance after confirmation', async () => {
    const user = userEvent.setup()
    renderMall()

    await user.click(screen.getByRole('button', { name: '查看 云朵 Yunduo' }))
    await user.click(screen.getByRole('button', { name: '购买 云朵 Yunduo' }))
    await user.click(screen.getByRole('button', { name: '确认购买' }))
    await user.click(screen.getByRole('button', { name: '现在换上' }))

    expect(screen.getByText('当前伙伴：云朵 Yunduo')).toBeInTheDocument()
  })

  it('preserves purchased and equipped primary items and ledger debits after reloading', async () => {
    const user = userEvent.setup()
    const view = renderMall()
    for (const [category, name, price] of [
      ['形象', '云朵 Yunduo', 360],
      ['服饰', '云朵小背包', 160],
      ['装饰', '云光花灯', 180],
    ] as const) {
      await user.click(screen.getByRole('tab', { name: category }))
      await user.click(screen.getByRole('button', { name: `购买 ${name}，${price} 积分` }))
      await user.click(screen.getByRole('button', { name: '确认购买' }))
      await user.click(screen.getByRole('button', { name: '现在换上' }))
    }
    view.unmount()
    expect(loadAccountState(defaultState.accountId).companion).toMatchObject({
      owned: { appearance: ['momo', 'yunduo'], outfit: ['cloud-backpack'], decoration: ['cloud-flower-lamp'] },
      equipped: { appearance: 'yunduo', outfit: 'cloud-backpack', decoration: 'cloud-flower-lamp' },
    })
    render(<AppStateProvider><MallPage onBack={() => undefined} /></AppStateProvider>)
    expect(screen.getByText('当前伙伴：云朵 Yunduo')).toBeInTheDocument()
    expect(screen.getByTestId('companion-outfit')).toBeInTheDocument()
    expect(screen.getByTestId('companion-decoration')).toBeInTheDocument()
    expect(screen.getByText('当前积分').parentElement).toHaveTextContent('580')
    expect(loadAccountState(defaultState.accountId).transactions.filter((entry) => entry.kind === 'purchase')).toHaveLength(3)
  })

  it('deducts the item price from the account balance after purchase', async () => {
    const user = userEvent.setup()
    renderMall()

    await user.click(screen.getByRole('button', { name: '查看 云朵 Yunduo' }))
    await user.click(screen.getByRole('button', { name: '购买 云朵 Yunduo' }))
    await user.click(screen.getByRole('button', { name: '确认购买' }))

    expect(screen.getByText('当前积分').parentElement).toHaveTextContent('920')
  })

  it('keeps the default 2,000-point ledger consistent after a direct purchase', async () => {
    const user = userEvent.setup()
    saveState(defaultState)
    render(<AppStateProvider><MallPage onBack={() => undefined} /></AppStateProvider>)

    expect(screen.getByText('当前积分').parentElement).toHaveTextContent('2,000')
    await user.click(screen.getByRole('button', { name: '购买 云朵 Yunduo，360 积分' }))
    await user.click(screen.getByRole('button', { name: '确认购买' }))

    const saved = loadAccountState(defaultState.accountId)
    expect(screen.getByText('当前积分').parentElement).toHaveTextContent('1,640')
    expect(getPointsBalance(saved.transactions)).toBe(1640)
    expect(saved.transactions.filter((entry) => entry.kind === 'purchase')).toMatchObject([
      { amount: -360, title: '积分商城购买：云朵 Yunduo' },
    ])
  })

  it('keeps an unaffordable item locked and explains that points are insufficient', async () => {
    const user = userEvent.setup()
    renderMall(300)

    await user.click(screen.getByRole('button', { name: '查看 云朵 Yunduo' }))
    await user.click(screen.getByRole('button', { name: '购买 云朵 Yunduo' }))

    expect(screen.getByRole('status')).toHaveTextContent('积分不够')
    expect(screen.getByRole('dialog', { name: '云朵 Yunduo 商品预览' })).toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: '现在换上吗？' })).not.toBeInTheDocument()
  })

  it('collects purchased appearances, outfits, and decorations in My without showing unowned products', async () => {
    const user = userEvent.setup()
    renderOwnedPrimaryWardrobe()

    await user.click(screen.getByRole('tab', { name: '我的' }))

    const wardrobe = screen.getByRole('region', { name: '我的 AI 伙伴衣橱' })
    for (const name of ['绒桃 Momo', '云朵 Yunduo', '云朵小背包', '云光花灯']) {
      expect(within(wardrobe).getAllByText(name).length).toBeGreaterThan(0)
    }
    expect(within(wardrobe).queryByText('云绽 Cloudbloom')).not.toBeInTheDocument()
    expect(within(wardrobe).queryByText('晨光云杖')).not.toBeInTheDocument()
  })

  it('shows the equipped loadout on a rotatable dressing stage in My', async () => {
    const user = userEvent.setup()
    renderOwnedPrimaryWardrobe()

    await user.click(screen.getByRole('tab', { name: '我的' }))

    const stage = screen.getByRole('region', { name: '当前搭配八方向预览' })
    expect(within(stage).getByTestId('companion-attachment-cloud-backpack')).toBeInTheDocument()
    expect(within(stage).getByTestId('companion-attachment-cloud-flower-lamp')).toBeInTheDocument()
    await user.click(within(stage).getByRole('button', { name: '向右转动伙伴' }))
    expect(within(stage).getByTestId('companion-2d')).toHaveAttribute('data-direction', 'front-right')
  })

  it('switches to another owned appearance from My while keeping the base appearance non-removable', async () => {
    const user = userEvent.setup()
    renderOwnedPrimaryWardrobe()

    await user.click(screen.getByRole('tab', { name: '我的' }))
    expect(screen.queryByRole('button', { name: '卸下 绒桃 Momo' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '装上 云朵 Yunduo' }))

    expect(screen.getByText('当前伙伴：云朵 Yunduo')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '卸下 云朵 Yunduo' })).not.toBeInTheDocument()
  })

  it.each([
    ['服饰', '云朵小背包', 'companion-outfit'],
    ['装饰', '云光花灯', 'companion-decoration'],
  ])('lets the player remove and re-equip an owned %s from My', async (_category, name, testId) => {
    const user = userEvent.setup()
    renderOwnedPrimaryWardrobe()

    await user.click(screen.getByRole('tab', { name: '我的' }))
    expect(screen.getAllByTestId(testId).length).toBeGreaterThan(0)
    await user.click(screen.getByRole('button', { name: `卸下 ${name}` }))

    expect(screen.queryByTestId(testId)).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: `装上 ${name}` }))
    expect(screen.getAllByTestId(testId).length).toBeGreaterThan(0)
  })

  it('restores Momo with no outfit or decoration while keeping purchased items in My', async () => {
    const user = userEvent.setup()
    saveState({
      ...defaultState,
      companion: {
        owned: {
          appearance: ['momo', 'yunduo'],
          outfit: ['cloud-backpack'],
          decoration: ['cloud-flower-lamp'],
        },
        equipped: {
          appearance: 'yunduo',
          outfit: 'cloud-backpack',
          decoration: 'cloud-flower-lamp',
        },
        version: 3,
      },
    })
    render(<AppStateProvider><MallPage onBack={() => undefined} /></AppStateProvider>)

    await user.click(screen.getByRole('tab', { name: '我的' }))
    await user.click(screen.getByRole('button', { name: '恢复默认搭配' }))

    const stage = screen.getByRole('region', { name: '当前搭配八方向预览' })
    expect(within(stage).getByTestId('companion-2d')).toHaveAttribute('data-companion-id', 'momo')
    expect(within(stage).queryByTestId('companion-outfit')).not.toBeInTheDocument()
    expect(within(stage).queryByTestId('companion-decoration')).not.toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: '我的 AI 伙伴衣橱' })).getByText('云朵 Yunduo')).toBeInTheDocument()
    expect(loadAccountState(defaultState.accountId).companion).toMatchObject({
      owned: {
        appearance: ['momo', 'yunduo'],
        outfit: ['cloud-backpack'],
        decoration: ['cloud-flower-lamp'],
      },
      equipped: { appearance: 'momo', outfit: null, decoration: null },
    })
  })

  it('keeps one equipped loadout in login, floating, and mall previews after remounting', async () => {
    const user = userEvent.setup()
    const renderSurfaces = () => render(
      <AppStateProvider>
        <section aria-label="登录页伙伴预览">
          <LoginCompanion onBoundsChange={() => undefined} />
        </section>
        <section aria-label="应用内悬浮伙伴预览" className="app-frame">
          <AiCompanion />
        </section>
        <MallPage onBack={() => undefined} />
      </AppStateProvider>,
    )
    saveState({
      ...defaultState,
      transactions: [{
        id: 'sync-balance',
        eventId: 'sync:balance',
        kind: 'starter',
        title: '跨页面同步测试积分',
        amount: 1280,
        occurredAt: '2026-10-13',
      }],
      processedRewardIds: ['sync:balance'],
    })

    const view = renderSurfaces()
    await user.click(screen.getByRole('tab', { name: '服饰' }))
    await user.click(screen.getByRole('button', { name: '购买 云朵小背包，160 积分' }))
    await user.click(screen.getByRole('button', { name: '确认购买' }))
    await user.click(screen.getByRole('button', { name: '现在换上' }))

    expect(within(screen.getByRole('region', { name: '登录页伙伴预览' })).getByTestId('companion-attachment-cloud-backpack')).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: '应用内悬浮伙伴预览' })).getByTestId('companion-attachment-cloud-backpack')).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: '当前搭配八方向预览' })).getByTestId('companion-attachment-cloud-backpack')).toBeInTheDocument()

    view.unmount()
    renderSurfaces()
    await user.click(screen.getByRole('tab', { name: '我的' }))
    expect(within(screen.getByRole('region', { name: '登录页伙伴预览' })).getByTestId('companion-attachment-cloud-backpack')).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: '应用内悬浮伙伴预览' })).getByTestId('companion-attachment-cloud-backpack')).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: '当前搭配八方向预览' })).getByTestId('companion-attachment-cloud-backpack')).toBeInTheDocument()
  })
})
