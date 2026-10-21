import { requestDraftSave } from '@zhiya/works-bridge'

type FilmExport = {
  id: string
  title?: string
  idea?: string
  synopsis?: string
}

export function saveFilmToZhiya(film: FilmExport) {
  const title = film.title?.trim() || '我的脑洞电影'
  return requestDraftSave({
    source: 'brain-film',
    draftId: film.id,
    title,
    description: (film.synopsis || film.idea || '').slice(0, 500),
    fileName: `《${title}》.bhfilm`,
    blob: new Blob([JSON.stringify(film, null, 2)], { type: 'application/json' }),
  })
}
