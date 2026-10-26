import { Download, FileQuestion } from 'lucide-react'
import { useEffect, useState } from 'react'
import { getDemoWorkSpec } from './demoWorks'
import type { WorkRecord } from './types'
import './works.css'

type AssetLoader = (assetId: string) => Promise<Blob | undefined>

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function WorkAssetPreview({
  work,
  getAsset,
}: {
  work: WorkRecord
  getAsset: AssetLoader
}) {
  const demo = getDemoWorkSpec(work.sourceDraftId)
  const [blob, setBlob] = useState<Blob | null>(null)
  const [url, setUrl] = useState('')
  const [text, setText] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (demo) return undefined
    let cancelled = false
    let objectUrl = ''
    setError('')
    getAsset(work.assetId).then(async (asset) => {
      if (!asset) {
        if (!cancelled) setError('暂时读不到这个作品文件')
        return
      }
      if (cancelled) return
      setBlob(asset)
      if (work.previewKind === 'text') {
        setText((await asset.text()).slice(0, 12000))
      } else if (work.previewKind !== 'generic') {
        objectUrl = URL.createObjectURL(asset)
        setUrl(objectUrl)
      }
    }).catch(() => {
      if (!cancelled) setError('暂时读不到这个作品文件')
    })
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
      setUrl('')
    }
  }, [demo, getAsset, work.assetId, work.previewKind])

  if (error) return <p className="work-preview-error">{error}</p>

  switch (work.previewKind) {
    case 'image':
      return demo?.previewKind === 'image'
        ? <img className="work-asset-media" src={demo.assetPath} alt={work.title} />
        : url ? <img className="work-asset-media" src={url} alt={work.title} /> : <p className="work-preview-loading">正在读取图片…</p>
    case 'video':
      return demo?.previewKind === 'video'
        ? <video className="work-asset-media" src={demo.assetPath} poster={demo.posterPath} controls />
        : url ? <video className="work-asset-media" src={url} controls /> : <p className="work-preview-loading">正在读取视频…</p>
    case 'audio':
      return url ? <audio className="work-asset-audio" src={url} controls /> : <p className="work-preview-loading">正在读取声音…</p>
    case 'pdf':
      return url ? <iframe className="work-asset-pdf" src={url} title={`${work.title} PDF 预览`} /> : <p className="work-preview-loading">正在读取 PDF…</p>
    case 'text':
      return <pre className="work-asset-text">{text || '文本内容为空'}</pre>
    default:
      return (
        <div className="work-file-card">
          <FileQuestion aria-hidden="true" />
          <div><strong>{work.fileName}</strong><small>{Math.max(1, Math.round(work.byteSize / 1024))} KB · 该格式只提供安全下载</small></div>
          <button type="button" disabled={!blob} onClick={() => blob && downloadBlob(blob, work.fileName)}>
            <Download aria-hidden="true" />下载
          </button>
        </div>
      )
  }
}
