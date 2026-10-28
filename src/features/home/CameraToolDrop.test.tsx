import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'
import { CameraToolSheet } from './CameraToolSheet'
import { cameraTools } from './homeData'
import { readImage } from './recognitionTools'
vi.mock('./recognitionTools', async importOriginal => ({ ...await importOriginal<typeof import('./recognitionTools')>(), readImage: vi.fn() }))
afterEach(() => { cleanup(); vi.resetAllMocks() })
it.each(cameraTools.map(t => t.title))('%s accepts a dropped image', async title => {
 vi.mocked(readImage).mockResolvedValue('data:image/png;base64,YQ==')
 const user = userEvent.setup(); render(<CameraToolSheet open onClose={() => {}} />)
 await user.click(screen.getByRole('button', { name: title }))
 const file = new File(['a'], 'image.png', { type: 'image/png' })
 const dataTransfer = { types: ['Files'], files: [file] }
 fireEvent.dragEnter(screen.getByRole('dialog'), { dataTransfer })
 expect(screen.getByText('松开鼠标，上传这张图片')).toBeInTheDocument()
 fireEvent.drop(screen.getByRole('dialog'), { dataTransfer })
 expect(await screen.findByAltText('待识别图片')).toBeInTheDocument()
  if (title === '扫码识别') expect(readImage).toHaveBeenCalledWith(file, { maxEdge: 1600, preserveOriginal: true })
  else expect(readImage).toHaveBeenCalledWith(file, expect.objectContaining({ preserveOriginal: false }))
})
it('rejects multiple files and displays image validation errors', async () => {
 const user = userEvent.setup(); render(<CameraToolSheet open onClose={() => {}} />)
 await user.click(screen.getByRole('button', { name: '文字提取' }))
 const file = new File(['a'], 'bad.txt', { type: 'text/plain' })
 fireEvent.drop(screen.getByRole('dialog'), { dataTransfer: { files: [file, file] } })
 expect(screen.getByRole('alert')).toHaveTextContent('请每次拖入一张图片')
 expect(readImage).not.toHaveBeenCalled()
 vi.mocked(readImage).mockRejectedValue(new Error('仅支持 JPG、PNG 或 WebP 图片'))
 fireEvent.drop(screen.getByRole('dialog'), { dataTransfer: { files: [file] } })
 await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('仅支持 JPG、PNG 或 WebP 图片'))
})
