import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { WorkRecord } from './types'
import { WorkAssetPreview } from './WorkAssetPreview'

const baseWork: WorkRecord = {
  id: 'work-1', ownerId: 'student-a', source: 'external-upload',
  title: '我的作品', description: '', aiTools: ['豆包'], status: 'draft',
  assetId: 'asset-1', fileName: 'story.txt', mimeType: 'text/plain', byteSize: 12,
  previewKind: 'text', createdAt: '2026-10-20T10:00:00Z', updatedAt: '2026-10-20T10:00:00Z',
  likes: 0, favorites: 0, likedBy: [], favoritedBy: [], comments: [],
}

describe('WorkAssetPreview', () => {
  afterEach(() => vi.restoreAllMocks())

  it('显示文本文件内容', async () => {
    render(<WorkAssetPreview work={baseWork} getAsset={async () => new Blob(['你好，未来']) } />)
    expect(await screen.findByText('你好，未来')).toBeInTheDocument()
  })

  it('不执行未知格式，只提供下载入口', async () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock')
    render(
      <WorkAssetPreview
        work={{ ...baseWork, fileName: 'model.custom-ai', previewKind: 'generic', byteSize: 2048 }}
        getAsset={async () => new Blob(['binary'])}
      />,
    )
    expect(await screen.findByText('model.custom-ai')).toBeInTheDocument()
    expect(screen.getByText(/该格式只提供安全下载/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /下载/ })).toBeEnabled()
  })

  it.each([
    ['image', 'png', (container: HTMLElement) => expect(container.querySelector('img')).toBeInTheDocument()],
    ['video', 'mp4', (container: HTMLElement) => expect(container.querySelector('video')).toBeInTheDocument()],
    ['audio', 'mp3', (container: HTMLElement) => expect(container.querySelector('audio')).toBeInTheDocument()],
    ['pdf', 'pdf', (container: HTMLElement) => expect(container.querySelector('iframe')).toBeInTheDocument()],
  ] as const)('使用 %s 专用预览器', async (previewKind, extension, assertElement) => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue(`blob:${previewKind}`)
    const { container } = render(
      <WorkAssetPreview
        work={{ ...baseWork, fileName: `work.${extension}`, previewKind }}
        getAsset={async () => new Blob(['media'])}
      />,
    )
    await vi.waitFor(() => assertElement(container))
  })
})
