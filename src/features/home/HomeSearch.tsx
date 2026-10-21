import { useState } from 'react'
import { Search, X } from 'lucide-react'
import { useAppState } from '../../app/AppState'
import { getGradeBand, type PrimaryGrade } from '../../app/learning'
import { getCourseForBand } from '../knowledge/courseCatalog'
import { useOptionalWorks } from '../works/WorksProvider'
import { games } from './homeData'

export function HomeSearch({ onOpenContent, onWorkClick }: { onOpenContent?: (courseId: string, chapterNum: number) => void; onWorkClick?: (id: string) => void }) {
  const { state } = useAppState()
  const works = useOptionalWorks()?.works.filter((work) => work.status === 'published') ?? []
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('全部')
  const course = getCourseForBand(getGradeBand(state.grade as PrimaryGrade))
  const entries = [
    ...course.parts.map(part => ({ id: part.id, title: part.title, category: '知识', description: part.concept || part.summary, searchable: [part.summary, part.experiment, part.safety, ...part.keyConcepts.map(k => `${k.term} ${k.explanation}`)].join(' '), open: onOpenContent ? () => onOpenContent(course.id, part.number) : undefined })),
    ...works.map(work => ({ id: work.id, title: work.title, category: '作品', description: `${work.aiTools.join(' · ')} · ${work.description}`, searchable: work.description, open: onWorkClick ? () => onWorkClick(work.id) : undefined })),
    ...games.map(game => ({ id: game.id, title: game.title, category: '游戏', description: game.note, searchable: '', open: undefined })),
  ]
  const words = query.normalize('NFKC').trim().toLocaleLowerCase().split(/\s+/).filter(Boolean)
  const results = entries.filter(entry => (filter === '全部' || entry.category === filter) && words.every(word => `${entry.title} ${entry.description} ${entry.searchable}`.normalize('NFKC').toLocaleLowerCase().includes(word)))
  return <div className="home-search">
    <form role="search" onSubmit={e => { e.preventDefault() }}>
      <Search size={19} aria-hidden="true" />
      <input type="search" aria-label="搜索知识、游戏或作品" placeholder="搜索你想探索的内容" maxLength={100} value={query} onChange={e => setQuery(e.target.value)} />
      {query && <button type="button" aria-label="清空搜索" onClick={() => { setQuery(''); setFilter('全部') }}><X size={16} /></button>}
    </form>
    {words.length > 0 && <section className="home-search-results" aria-label="搜索结果">
      <div className="home-search-filters">{['全部', '知识', '游戏', '作品'].map(label => <button key={label} type="button" aria-pressed={filter === label} onClick={() => setFilter(label)}>{label}</button>)}</div>
      <p role="status">找到 {results.length} 项内容 · 知识按当前年级匹配</p>
      {results.length ? <ul>{results.map(entry => <li key={entry.id}>{entry.open ? <button type="button" className="home-search-item" onClick={entry.open}><span>{entry.category}</span><strong>{entry.title}</strong><small>{entry.description}</small><em>查看内容 →</em></button> : <div className="home-search-item"><span>{entry.category}</span><strong>{entry.title}</strong><small>{entry.description}</small><em>{entry.category === '游戏' ? '游戏正在准备中' : '内容暂时无法打开'}</em></div>}</li>)}</ul> : <div className="home-search-empty">没有找到相关内容，试试“AI”“机器人”或“分类”，也可以换一个分类。</div>}
    </section>}
  </div>
}
