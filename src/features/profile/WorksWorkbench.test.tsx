import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_DEMO_WORK_ACCOUNT } from '../works/demoWorks'
import { createMemoryWorkRepository } from '../works/memoryRepository'
import { WorksProvider } from '../works/WorksProvider'
import { WorksWorkbench } from './WorksWorkbench'

describe('WorksWorkbench', () => {
  it('shows the complete demo status counts and real recent artwork', async () => {
    const repository = createMemoryWorkRepository()
    render(
      <WorksProvider
        accountId={DEFAULT_DEMO_WORK_ACCOUNT}
        repository={repository}
        demoAssetLoader={async (path) => new Blob([path], {
          type: path.endsWith('.mp4') ? 'video/mp4' : 'image/webp',
        })}
      >
        <WorksWorkbench onOpenManage={vi.fn()} />
      </WorksProvider>,
    )

    const section = await screen.findByRole('region', { name: '我的作品' })
    expect(within(section).getByRole('button', { name: /3\s*草稿/ })).toBeInTheDocument()
    expect(within(section).getByRole('button', { name: /3\s*审核中/ })).toBeInTheDocument()
    expect(within(section).getByRole('button', { name: /17\s*已发布/ })).toBeInTheDocument()
    expect(within(section).getByRole('button', { name: /2\s*仅自己/ })).toBeInTheDocument()
    const previews = within(section).getAllByRole('img')
    expect(previews).toHaveLength(2)
    expect(previews.every((preview) => preview.getAttribute('src')?.startsWith('/demo-works/'))).toBe(true)
  })
})
