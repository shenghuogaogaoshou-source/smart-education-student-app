import { FileImage, Play } from 'lucide-react'
import { getDemoWorkSpec } from './demoWorks'
import type { WorkRecord } from './types'

export function WorkMediaThumbnail({
  work,
  className = '',
}: {
  work: WorkRecord
  className?: string
}) {
  const demo = getDemoWorkSpec(work.sourceDraftId)
  const source = work.thumbnailUrl
    ?? (demo?.previewKind === 'video' ? demo.posterPath : demo?.assetPath)
  const isVideo = work.previewKind === 'video'

  return (
    <div className={`work-media-thumbnail ${className}`.trim()}>
      {source ? (
        <img src={source} alt={work.title} loading="lazy" decoding="async" />
      ) : (
        <span className="work-media-placeholder" aria-hidden="true"><FileImage /></span>
      )}
      {isVideo && (
        <span className="work-media-kind"><Play aria-hidden="true" size={11} fill="currentColor" />视频</span>
      )}
    </div>
  )
}
