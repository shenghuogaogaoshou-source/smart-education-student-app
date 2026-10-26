import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { WorkRecord } from './types'
import { WorkMediaThumbnail } from './WorkMediaThumbnail'

function demoWork(overrides: Partial<WorkRecord> = {}): WorkRecord {
  return {
    id: 'demo-record',
    ownerId: 'chenxi_2026',
    creatorId: '123',
    creatorName: '晨曦同学',
    source: 'brain-film',
    sourceDraftId: 'demo-video-1',
    title: '会呼吸的时钟',
    description: '',
    aiTools: ['智芽创意助手'],
    status: 'published',
    assetId: 'asset-1',
    fileName: 'clockwork-morning.mp4',
    mimeType: 'video/mp4',
    byteSize: 100,
    previewKind: 'video',
    createdAt: '2026-10-26T00:00:00.000Z',
    updatedAt: '2026-10-26T00:00:00.000Z',
    publishedAt: '2026-10-26T00:00:00.000Z',
    likes: 0,
    favorites: 0,
    likedBy: [],
    favoritedBy: [],
    comments: [],
    ...overrides,
  }
}

describe('WorkMediaThumbnail', () => {
  it('uses the generated poster instead of decoding every demo video in the list', () => {
    render(<WorkMediaThumbnail work={demoWork()} />)

    expect(screen.getByRole('img', { name: '会呼吸的时钟' })).toHaveAttribute(
      'src',
      '/demo-works/posters/clockwork-morning.jpg',
    )
    expect(screen.getByText('视频')).toBeInTheDocument()
  })

  it('renders the processed demo image directly', () => {
    render(<WorkMediaThumbnail work={demoWork({
      sourceDraftId: 'demo-image-1',
      title: '云朵里的种子',
      previewKind: 'image',
      mimeType: 'image/webp',
      fileName: 'cloud-seed.webp',
    })} />)

    expect(screen.getByRole('img', { name: '云朵里的种子' })).toHaveAttribute(
      'src',
      '/demo-works/images/cloud-seed.webp',
    )
  })
})
