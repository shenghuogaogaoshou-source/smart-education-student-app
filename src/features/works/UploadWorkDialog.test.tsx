import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { createMemoryWorkRepository } from './memoryRepository'
import { UploadWorkDialog } from './UploadWorkDialog'
import { WorksProvider } from './WorksProvider'
import type { WorkRepository } from './types'

function renderDialog(repository = createMemoryWorkRepository()) {
  return render(
    <WorksProvider accountId="student-a" repository={repository}>
      <UploadWorkDialog open onClose={() => {}} />
    </WorksProvider>,
  )
}

describe('UploadWorkDialog', () => {
  it('接受任意外部成品并直接进入发布流程', async () => {
    const user = userEvent.setup()
    const repository = createMemoryWorkRepository()
    renderDialog(repository)

    const input = screen.getByLabelText('选择作品文件')
    expect(input).not.toHaveAttribute('accept')
    await user.upload(input, new File(['binary'], 'model.custom-ai', { type: '' }))
    await user.type(screen.getByLabelText('作品名称'), '我的 AI 模型作品')
    await user.type(screen.getByLabelText('作品介绍'), '这是我自己做的模型')
    await user.type(screen.getByLabelText('使用过的 AI 工具'), '其他 AI 工具')
    await user.click(screen.getByRole('button', { name: '提交发布' }))

    expect(await screen.findByText('作品已提交发布')).toBeInTheDocument()
    await waitFor(async () => {
      expect(await repository.list('student-a')).toEqual(expect.arrayContaining([
        expect.objectContaining({
          source: 'external-upload',
          fileName: 'model.custom-ai',
          title: '我的 AI 模型作品',
          status: 'published',
          previewKind: 'generic',
        }),
      ]))
    })
  })

  it('保存失败时保留已填写的表单', async () => {
    const user = userEvent.setup()
    const working = createMemoryWorkRepository()
    const failing = {
      ...working,
      saveDraft: async () => { throw new Error('quota') },
    } as WorkRepository
    renderDialog(failing)

    await user.upload(screen.getByLabelText('选择作品文件'), new File(['x'], 'draft.mine'))
    await user.type(screen.getByLabelText('作品名称'), '需要保留的标题')
    await user.type(screen.getByLabelText('使用过的 AI 工具'), '豆包')
    await user.click(screen.getByRole('button', { name: '提交发布' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('暂时没有保存成功')
    expect(screen.getByLabelText('作品名称')).toHaveValue('需要保留的标题')
    expect(screen.getByLabelText('使用过的 AI 工具')).toHaveValue('豆包')
  })
})
