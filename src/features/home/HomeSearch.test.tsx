import { render, screen, within, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'
import { AppStateProvider } from '../../app/AppState'
import { createDefaultState } from '../../app/model'
import { createMemoryWorkRepository } from '../works/memoryRepository'
import { WorksProvider } from '../works/WorksProvider'
import { HomeSearch } from './HomeSearch'
afterEach(cleanup)
it('finds works, filters categories, opens a result and clears search', async () => {
 const user = userEvent.setup(); const open = vi.fn()
 const repository = createMemoryWorkRepository()
 const accountId = createDefaultState().accountId
 const work = await repository.saveDraft(accountId, { source: 'external-upload', title: '未来图书馆', description: '空间设计', aiTools: ['豆包'], fileName: 'library.txt', blob: new Blob(['library']) })
 await repository.setStatus(accountId, work.id, 'published')
 render(<AppStateProvider><WorksProvider accountId={accountId} repository={repository}><HomeSearch onWorkClick={open} /></WorksProvider></AppStateProvider>)
 const input = screen.getByRole('searchbox')
 await user.type(input, '未来图书馆')
 const results = within(screen.getByRole('region', { name: '搜索结果' }))
 await user.click(results.getByRole('button', { name: /未来图书馆/ }))
 expect(open).toHaveBeenCalledWith(work.id)
 await user.click(results.getByRole('button', { name: '游戏' }))
 expect(results.getByText(/没有找到相关内容/)).toBeInTheDocument()
 await user.click(screen.getByRole('button', { name: '清空搜索' }))
 expect(input).toHaveValue('')
 expect(screen.queryByRole('region', { name: '搜索结果' })).not.toBeInTheDocument()
})
it('searches course content case-insensitively and opens its chapter', async () => {
 const user = userEvent.setup(); const open = vi.fn()
 render(<AppStateProvider><HomeSearch onOpenContent={open} /></AppStateProvider>)
 await user.type(screen.getByRole('searchbox'), '  ai  {Enter}')
 const results = within(screen.getByRole('region', { name: '搜索结果' }))
 await user.click(results.getByRole('button', { name: '知识' }))
 await user.click(results.getAllByRole('button', { name: /查看内容/ })[0])
 expect(open).toHaveBeenCalledWith(expect.any(String), expect.any(Number))
})
it('handles unmatched and whitespace queries without fake results', async () => {
 const user = userEvent.setup()
 render(<AppStateProvider><HomeSearch /></AppStateProvider>)
 await user.type(screen.getByRole('searchbox'), 'zzzz不存在')
 expect(screen.getByText(/没有找到相关内容/)).toBeInTheDocument()
 await user.clear(screen.getByRole('searchbox')); await user.type(screen.getByRole('searchbox'), '   ')
 expect(screen.queryByRole('region', { name: '搜索结果' })).not.toBeInTheDocument()
})

