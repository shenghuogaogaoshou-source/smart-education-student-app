import type { PreviewKind } from './types'

const TEXT_EXTENSIONS = new Set([
  'txt', 'md', 'markdown', 'json', 'csv', 'tsv', 'html', 'htm', 'css', 'js', 'ts', 'tsx', 'jsx', 'xml', 'yaml', 'yml',
])

function extensionOf(fileName: string) {
  const dot = fileName.lastIndexOf('.')
  return dot >= 0 ? fileName.slice(dot + 1).toLowerCase() : ''
}

export function detectPreviewKind(mimeType: string, fileName: string): PreviewKind {
  const mime = mimeType.toLowerCase()
  const extension = extensionOf(fileName)

  if (mime.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'svg'].includes(extension)) return 'image'
  if (mime.startsWith('video/') || ['mp4', 'webm', 'mov', 'm4v'].includes(extension)) return 'video'
  if (mime.startsWith('audio/') || ['mp3', 'wav', 'm4a', 'ogg', 'aac', 'flac'].includes(extension)) return 'audio'
  if (mime.startsWith('text/') || TEXT_EXTENSIONS.has(extension)) return 'text'
  if (mime === 'application/pdf' || extension === 'pdf') return 'pdf'
  return 'generic'
}
