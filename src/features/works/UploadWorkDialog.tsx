import { UploadCloud, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useWorks } from './WorksProvider'
import './works.css'

export function UploadWorkDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { upload, error: providerError } = useWorks()
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [aiTools, setAiTools] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!open) return
    setError('')
    setSaved(false)
  }, [open])

  if (!open) return null

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    const tools = aiTools.split(/[，,、]/).map((tool) => tool.trim()).filter(Boolean)
    if (!file) return setError('先选择一个作品文件吧')
    if (!title.trim() || title.trim().length > 80) return setError('作品名称需要填写 1—80 个字')
    if (description.length > 500) return setError('作品介绍最多 500 字')
    if (!tools.length) return setError('请至少填写一个使用过的 AI 工具')

    setSaving(true)
    setError('')
    try {
      await upload({ title: title.trim(), description: description.trim(), aiTools: tools, fileName: file.name, blob: file })
      setSaved(true)
      setFile(null)
      setTitle('')
      setDescription('')
      setAiTools('')
    } catch {
      setError(providerError || '作品暂时没有保存成功，请保留表单后重试')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="upload-work-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose()
    }}>
      <section className="upload-work-dialog" role="dialog" aria-modal="true" aria-labelledby="upload-work-title">
        <header>
          <div>
            <span className="section-kicker">任何 AI 创作都能收进来</span>
            <h2 id="upload-work-title">上传 AI 作品</h2>
          </div>
          <button type="button" aria-label="关闭上传作品" onClick={onClose}><X aria-hidden="true" /></button>
        </header>

        <form onSubmit={submit}>
          <label className="upload-file-picker">
            <UploadCloud aria-hidden="true" />
            <strong>{file ? file.name : '选择作品文件'}</strong>
            <small>不限制格式，图片、视频、音频、PDF 和其他文件都可以</small>
            <input
              type="file"
              aria-label="选择作品文件"
              onChange={(event) => {
                const selected = event.target.files?.[0] ?? null
                setFile(selected)
              }}
            />
          </label>

          <label>
            <span>作品名称</span>
            <input aria-label="作品名称" value={title} maxLength={80} onChange={(event) => setTitle(event.target.value)} />
          </label>
          <label>
            <span>作品介绍</span>
            <textarea aria-label="作品介绍" value={description} maxLength={500} rows={3} onChange={(event) => setDescription(event.target.value)} />
          </label>
          <label>
            <span>使用过的 AI 工具</span>
            <input aria-label="使用过的 AI 工具" value={aiTools} placeholder="例如：豆包、即梦、其他 AI 工具" onChange={(event) => setAiTools(event.target.value)} />
          </label>

          {(error || providerError) && <p className="upload-work-error" role="alert">{error || providerError}</p>}
          {saved && <p className="upload-work-success" role="status">已保存为草稿</p>}

          <div className="upload-work-actions">
            <button type="button" className="wm-action-ghost" onClick={onClose}>取消</button>
            <button type="submit" className="wm-action-primary" disabled={saving}>
              {saving ? '正在保存…' : '保存为草稿'}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}
