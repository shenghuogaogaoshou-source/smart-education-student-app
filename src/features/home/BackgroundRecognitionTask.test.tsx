import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { BackgroundRecognitionTask } from './BackgroundRecognitionTask'

const result = {
  title: '物品观察卡',
  output: '图片中有一台白色机器人和一盆幼苗。',
  evidence: ['白色机器人'],
  steps: [{ title: '观察', detail: '看清主要物体' }],
  uncertainty: '请对照原图。',
  introduction: {
    overview: '机器人可以辅助完成重复任务。',
    funFact: '机器人也需要传感器感知环境。',
    question: '机器人需要哪些传感器？',
  },
}

describe('BackgroundRecognitionTask', () => {
  afterEach(() => {
    localStorage.clear()
    delete (window as Window & { Capacitor?: unknown }).Capacitor
  })

  it('restores a completed background recognition task and opens its result', async () => {
    Object.defineProperty(window, 'Capacitor', {
      configurable: true,
      value: { isNativePlatform: () => true },
    })
    localStorage.setItem('zhiya.mobileApiOrigin', 'https://api.zhiya.test')
    const user = userEvent.setup()
    const pollTaskImpl = vi.fn().mockResolvedValue({
      taskId: 'task-1',
      kind: 'vision',
      status: 'succeeded',
      result,
      createdAt: '2026-10-28T23:00:00.000Z',
      updatedAt: '2026-10-28T23:00:20.000Z',
      elapsedMs: 20_000,
    })
    render(
      <BackgroundRecognitionTask
        task={{ taskId: 'task-1', tool: 'object', title: '拍照识物', createdAt: '2026-10-28T23:00:00.000Z' }}
        onDismiss={vi.fn()}
        pollTaskImpl={pollTaskImpl}
      />,
    )

    expect(await screen.findByText('识别完成')).toBeInTheDocument()
    expect(pollTaskImpl).toHaveBeenCalledWith(
      'task-1',
      expect.objectContaining({ baseUrl: 'https://api.zhiya.test' }),
    )
    await user.click(screen.getByRole('button', { name: '查看拍照识物结果' }))
    expect(screen.getByRole('dialog', { name: '拍照识物结果' })).toBeVisible()
    expect(screen.getByText(result.output)).toBeVisible()
  })
})
