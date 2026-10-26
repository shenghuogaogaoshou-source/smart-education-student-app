import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { NotificationTarget } from './NotificationsPage'
import { NotificationsPage, resolveNotificationWorkId } from './NotificationsPage'
import type { WorkRecord } from '../works/types'

describe('NotificationsPage', () => {
  it('shows six useful project notifications and opens the matching destination', async () => {
    const user = userEvent.setup()
    const onOpenTarget = vi.fn<(target: NotificationTarget) => void>()
    render(<NotificationsPage onBack={vi.fn()} onOpenTarget={onOpenTarget} />)

    const notifications = [
      ['今天 19:00 的「AI 小小观察家」学习安排还在等你', { kind: 'schedule' }],
      ['知识进度已更新：继续「声音的旅行」', { kind: 'knowledge' }],
      ['错题本新增 2 道题，去回顾一下思路吧', { kind: 'wrong-book' }],
      ['积分到账 +20，新的成长徽章可以领取了', { kind: 'medals' }],
      ['乐乐赞了你的作品《会呼吸的时钟》', { kind: 'work', workId: 'demo-video-1' }],
      ['AI 建议：今晚可以先用 10 分钟复习错题', { kind: 'ai-advice' }],
    ] as const

    for (const [label, target] of notifications) {
      await user.click(screen.getByRole('button', {
        name: (accessibleName) => accessibleName.includes(label),
      }))
      expect(onOpenTarget).toHaveBeenLastCalledWith(target)
    }
    expect(onOpenTarget).toHaveBeenCalledTimes(6)
  })

  it('resolves a stable demo source reference to the repository work id', () => {
    const work = {
      id: 'database-work-42',
      sourceDraftId: 'demo-video-1',
    } as WorkRecord

    expect(resolveNotificationWorkId([work], 'demo-video-1')).toBe('database-work-42')
  })
})
