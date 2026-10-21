import { requestDraftSave } from '@zhiya/works-bridge'

export function creativeDraftId(nodes: Array<{ id: string }>, edges: Array<{ source: string; target: string }>) {
  const source = [
    ...nodes.map((node) => node.id).sort(),
    ...edges.map((edge) => `${edge.source}>${edge.target}`).sort(),
  ].join('|')
  let hash = 2166136261
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return `circuit-${(hash >>> 0).toString(36)}`
}

export function saveArtworkToZhiya({
  draftId,
  title,
  description,
  artwork,
}: {
  draftId: string
  title: string
  description: string
  artwork: unknown
}) {
  const safeTitle = title.trim() || '我的智能发明'
  return requestDraftSave({
    source: 'creative-module',
    draftId,
    title: safeTitle,
    description: description.slice(0, 500),
    fileName: `${safeTitle}.json`,
    blob: new Blob([JSON.stringify(artwork, null, 2)], { type: 'application/json' }),
  })
}
