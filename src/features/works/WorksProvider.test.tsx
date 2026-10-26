import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { DEFAULT_DEMO_WORK_ACCOUNT } from './demoWorks'
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
  const { works, loading, upload } = useWorks()
  return (
    <>
      <span>{loading ? '加载中' : '加载完成'}</span>
      <span aria-label="作品总数">{works.length}</span>
      {works.map((work) => <span key={work.id}>{work.title}</span>)}
      <button
        type="button"
        onClick={() => {
          void upload({
            title: '来自其他 AI 工具的成品',
            description: '已经完成，可以直接发布。',
            aiTools: ['豆包'],
            fileName: 'finished.txt',
            blob: new Blob(['finished'], { type: 'text/plain' }),
          })
        }}
      >
        上传成品
      </button>
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

  it('为默认演示账号自动载入完整示例作品', async () => {
    const repository = createMemoryWorkRepository()
    render(
      <WorksProvider
        accountId={DEFAULT_DEMO_WORK_ACCOUNT}
        repository={repository}
        demoAssetLoader={async (path) => new Blob([path], {
          type: path.endsWith('.mp4') ? 'video/mp4' : 'image/png',
        })}
      >
        <Probe />
      </WorksProvider>,
    )

    expect(await screen.findByText('会呼吸的时钟')).toBeInTheDocument()
    expect(screen.getByLabelText('作品总数')).toHaveTextContent('25')
  })

  it('为当前登录的非默认账号也自动载入完整示例作品', async () => {
    const repository = createMemoryWorkRepository()
    render(
      <WorksProvider
        accountId="student-custom"
        repository={repository}
        demoAssetLoader={async (path) => new Blob([path], {
          type: path.endsWith('.mp4') ? 'video/mp4' : 'image/webp',
        })}
      >
        <Probe />
      </WorksProvider>,
    )

    expect(await screen.findByText('会呼吸的时钟')).toBeInTheDocument()
    expect(screen.getByLabelText('作品总数')).toHaveTextContent('25')
  })

  it('外部上传的成品不会停留在继续创作草稿中', async () => {
    const user = userEvent.setup()
    const repository = createMemoryWorkRepository()
    render(
      <WorksProvider accountId="student-a" repository={repository}>
        <Probe />
      </WorksProvider>,
    )

    await screen.findByText('加载完成')
    await user.click(screen.getByRole('button', { name: '上传成品' }))

    expect(await screen.findByText('来自其他 AI 工具的成品')).toBeInTheDocument()
    const uploaded = (await repository.list('student-a'))
      .find((work) => work.title === '来自其他 AI 工具的成品')
    expect(uploaded).toMatchObject({
      source: 'external-upload',
      status: 'published',
    })
  })
})
