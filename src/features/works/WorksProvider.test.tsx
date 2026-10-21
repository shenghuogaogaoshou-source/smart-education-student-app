import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { createMemoryWorkRepository } from './memoryRepository'
import type { SaveWorkDraftInput } from './types'
import { useWorks, WorksProvider } from './WorksProvider'

const makeDraft = (title: string): SaveWorkDraftInput => ({
  source: 'external-upload',
  title,
  description: '',
  aiTools: ['测试工具'],
  fileName: `${title}.txt`,
  blob: new Blob([title], { type: 'text/plain' }),
})

function Probe() {
  const { works, loading } = useWorks()
  return (
    <>
      <span>{loading ? '加载中' : '加载完成'}</span>
      {works.map((work) => <span key={work.id}>{work.title}</span>)}
    </>
  )
}

describe('WorksProvider', () => {
  it('账号变化时只显示该账号作品', async () => {
    const repository = createMemoryWorkRepository()
    await repository.saveDraft('a', makeDraft('A 的作品'))
    await repository.saveDraft('b', makeDraft('B 的作品'))
    const { rerender } = render(
      <WorksProvider accountId="a" repository={repository}><Probe /></WorksProvider>,
    )

    expect(await screen.findByText('A 的作品')).toBeInTheDocument()
    rerender(<WorksProvider accountId="b" repository={repository}><Probe /></WorksProvider>)
    expect(await screen.findByText('B 的作品')).toBeInTheDocument()
    expect(screen.queryByText('A 的作品')).not.toBeInTheDocument()
  })
})
